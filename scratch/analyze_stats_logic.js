import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("=== Fetching Tournaments ===");
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  if (!tournaments || tournaments.length === 0) return;
  const latestTournament = tournaments[0];
  console.log(`Tournament: ${latestTournament.name}`);

  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('*, home_team:home_team_id(*), away_team:away_team_id(*)')
    .eq('tournament_id', latestTournament.id);

  const gameKeys = matches.map(m => `tournament_match_${m.id}`);

  const { data: rawStats } = await supabase
    .from('stats')
    .select('*')
    .in('game_name', gameKeys)
    .order('created_at', { ascending: true });

  console.log(`\nRaw stats count: ${rawStats.length}`);

  const playersMap = {};

  const ensurePlayer = (name, teamId, teamName) => {
    const key = `${name.trim().toUpperCase()}_${teamId}`;
    if (!playersMap[key]) {
      playersMap[key] = {
        name: name.trim(),
        teamId,
        teamName,
        goals: 0,
        assists: 0,
        secondaryAssists: 0,
        blocks: 0,
        turnovers: 0,
        touches: 0
      };
    }
    return playersMap[key];
  };

  rawStats.forEach((stat, index) => {
    if (stat.player === 'System' || stat.player === 'Opponent' || stat.stat_type === 'Match Metadata' || stat.stat_type === 'Lineup' || !stat.player) return;

    const p = ensurePlayer(stat.player, stat.team_id, stat.team_name || 'Roster Team');
    p.touches += 1;

    if (stat.stat_type === 'Point') {
      p.goals += 1;

      // Backward-scanning logic for assists
      let passesInPoint = [];
      for (let i = index - 1; i >= 0; i--) {
        const s = rawStats[i];
        if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
          break; // Crossed point boundary
        }
        if (s.stat_type === 'Pass' && s.team_id === stat.team_id) {
          passesInPoint.push(s);
        }
      }

      // passesInPoint is ordered from newest to oldest
      // passesInPoint[0] is the scorer's own catch (e.g. C)
      // passesInPoint[1] is the primary assister (e.g. B)
      // passesInPoint[2] is the secondary assister (e.g. A)
      if (passesInPoint.length > 1) {
        const primaryAssisterStat = passesInPoint[1];
        if (primaryAssisterStat.player !== stat.player) {
          const assisterPlayer = ensurePlayer(primaryAssisterStat.player, stat.team_id, stat.team_name || 'Roster Team');
          assisterPlayer.assists += 1;
        }
      }

      if (passesInPoint.length > 2) {
        const secondaryAssisterStat = passesInPoint[2];
        if (secondaryAssisterStat.player !== stat.player && secondaryAssisterStat.player !== passesInPoint[1].player) {
          const secAssisterPlayer = ensurePlayer(secondaryAssisterStat.player, stat.team_id, stat.team_name || 'Roster Team');
          secAssisterPlayer.secondaryAssists += 1;
        }
      }

    } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
      p.turnovers += 1;
    } else if (stat.stat_type === 'Defence' || stat.stat_type === 'Block') {
      p.blocks += 1;
    }
  });

  const parsed = Object.values(playersMap);
  console.log("\nParsed Player Stats:");
  parsed.forEach(p => {
    console.log(`Player: ${p.name} | Team: ${p.teamName} | Goals: ${p.goals} | Assists: ${p.assists} | 2nd Assists: ${p.secondaryAssists} | Touches: ${p.touches}`);
  });
}

check();
