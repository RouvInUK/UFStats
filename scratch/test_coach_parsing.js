import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testClubParsing() {
  const { data: rawStats, error } = await supabase
    .from('stats')
    .select('*')
    .eq('game_name', 'Test Game after intro of Tournament Mode')
    .order('created_at', { ascending: false }); // fetchGameStats returns descending, then CoachDashboard reverses it!

  if (error) {
    console.error("Error fetching stats:", error);
    return;
  }

  // Simulate CoachDashboard.jsx logic:
  const stats = rawStats.reverse(); // Reverse it to be ascending (chronological)

  const playersMap = {};
  const ensurePlayer = (name) => {
    if (!playersMap[name]) {
      playersMap[name] = {
        name,
        passes: 0,
        huckPasses: 0,
        huckThrowaways: 0,
        huckAttemptsDropped: 0,
        huckDrops: 0,
        passDropped: 0
      };
    }
    return playersMap[name];
  };

  stats.forEach((stat, index) => {
    const SYSTEM_EVENTS = ['Match Metadata', 'Game Completed', 'Start Offense', 'Start Defense', 'Half Time', 'Lineup'];
    if (stat.player === 'System' || stat.player === 'Opponent' || SYSTEM_EVENTS.includes(stat.stat_type) || !stat.player) return;

    const p = ensurePlayer(stat.player);

    if (stat.stat_type === 'Pass') {
      // Robust look-ahead: scan forward to find the next active gameplay event in the same point
      let nextGameplayStat = null;
      for (let i = index + 1; i < stats.length; i++) {
        const s = stats[i];
        if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
          break;
        }
        if (['Point', 'Pass', 'Throwaway', 'Drop', 'Stall Out', 'Block', 'Defence', 'Opponent Point'].includes(s.stat_type)) {
          nextGameplayStat = s;
          break;
        }
      }
      
      // Look ahead for a receiver drop
      if (nextGameplayStat && nextGameplayStat.stat_type === 'Drop' && nextGameplayStat.team_id === stat.team_id) {
          p.passDropped += 1;
      } else {
          p.passes += 1; // Completed pass
          if (stat.details?.is_huck || (nextGameplayStat && nextGameplayStat.details?.is_huck && (nextGameplayStat.stat_type === 'Pass' || nextGameplayStat.stat_type === 'Point'))) {
              p.huckPasses = (p.huckPasses || 0) + 1;
          }
      }
    } else if (stat.stat_type === 'Pass Attempt') {
      p.passDropped += 1;
      if (stat.details?.is_huck) {
         p.huckAttemptsDropped = (p.huckAttemptsDropped || 0) + 1;
      }
    } else if (stat.stat_type === 'Throwaway') {
      p.huckThrowaways = (p.huckThrowaways || 0) + (stat.details?.is_huck ? 1 : 0);
    } else if (stat.stat_type === 'Drop') {
      p.huckDrops = (p.huckDrops || 0) + (stat.details?.is_huck ? 1 : 0);
    }
  });

  console.log("--- CLUB PRO PARSING OUTPUT ---");
  Object.values(playersMap).forEach(p => {
    const totalHuckAttempts = (p.huckPasses || 0) + (p.huckThrowaways || 0) + (p.huckAttemptsDropped || 0);
    console.log(`Player: ${p.name} | Passes: ${p.passes} | Huck Passes: ${p.huckPasses} | Huck Attempts: ${totalHuckAttempts}`);
  });
}

testClubParsing();
