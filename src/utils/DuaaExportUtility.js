/**
 * DuaaExportUtility.js
 * Utility to compile tournament match telemetry, point timelines,
 * roster ratios (MMP/FMP), and player statistics into a clean CSV report.
 */

export const exportMatchToCsv = (match, rawStats, homePlayers = [], awayPlayers = []) => {
  if (!match) return;

  const homeTeamName = match.home_team?.team_name || 'Home Team';
  const awayTeamName = match.away_team?.team_name || 'Away Team';
  const division = match.home_team?.division || 'Standard Mixed';
  const pitch = match.pitch_number || '1';
  const scheduledTime = match.start_time ? new Date(match.start_time).toLocaleString() : 'TBD';

  // 1. Gather stats calculations (similar to Analytics.jsx logic)
  const homeStatsMap = {};
  const awayStatsMap = {};

  const ensurePlayer = (map, name, gender) => {
    if (!map[name]) {
      map[name] = { name, gender: gender || 'None', touches: 0, goals: 0, assists: 0, passes: 0, completions: 0, turnovers: 0, defence: 0 };
    }
    return map[name];
  };

  // Pre-populate rosters with gender designation
  homePlayers.forEach(p => {
    ensurePlayer(homeStatsMap, p.name, p.gender_designation);
  });
  awayPlayers.forEach(p => {
    ensurePlayer(awayStatsMap, p.name, p.gender_designation);
  });

  // Process chronological events
  const chronological = [...rawStats].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Compute scoring timeline
  const timeline = [];
  let homeScore = 0;
  let awayScore = 0;

  chronological.forEach((stat, index) => {
    // Determine player team and lookup gender
    const isHome = stat.team_id === match.home_team_id;
    const activeMap = isHome ? homeStatsMap : awayStatsMap;
    const roster = isHome ? homePlayers : awayPlayers;
    const playerRecord = roster.find(p => p.name === stat.player);
    const gender = playerRecord?.gender_designation || 'None';

    if (stat.player !== 'System' && stat.player !== 'Opponent' && stat.stat_type !== 'Match Metadata') {
      const p = ensurePlayer(activeMap, stat.player, gender);

      if (stat.stat_type !== 'Lineup') {
        if (!stat.stat_type.startsWith('Pull')) {
          p.touches += 1;
        }

        if (stat.stat_type === 'Point') {
          p.goals += 1;

          // Robust backward-scanning logic for assists
          let passesInPoint = [];
          for (let i = index - 1; i >= 0; i--) {
            const s = chronological[i];
            if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
              break;
            }
            if (s.stat_type === 'Pass' && s.team_id === stat.team_id) {
              passesInPoint.push(s);
            }
          }

          if (passesInPoint.length > 1) {
            const primaryAssisterStat = passesInPoint[1];
            if (primaryAssisterStat.player !== stat.player) {
              const playerRecord = roster.find(pr => pr.name === primaryAssisterStat.player);
              const gender = playerRecord?.gender_designation || 'None';
              const assisterPlayer = ensurePlayer(activeMap, primaryAssisterStat.player, gender);
              assisterPlayer.assists += 1;
            }
          }
        } else if (stat.stat_type === 'Pass') {
          p.passes += 1;
          
          // Robust look-ahead: scan forward to find the next active gameplay event in the same point
          let nextGameplayStat = null;
          for (let i = index + 1; i < chronological.length; i++) {
            const s = chronological[i];
            if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
              break;
            }
            if (['Point', 'Pass', 'Throwaway', 'Drop', 'Stall Out', 'Block', 'Defence', 'Opponent Point'].includes(s.stat_type)) {
              nextGameplayStat = s;
              break;
            }
          }
          
          let isCompleted = true;

          if (nextGameplayStat && nextGameplayStat.team_id === stat.team_id) {
            if (nextGameplayStat.stat_type === 'Drop') {
              isCompleted = false;
            }
          }

          if (isCompleted) p.completions += 1;

        } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
          p.turnovers += 1;
          if (stat.stat_type === 'Throwaway') {
            p.passes += 1;
          }
        } else if (stat.stat_type === 'Defence' || stat.stat_type === 'Block') {
          p.defence += 1;
        }
      }
    }

    // Add goals to the score timeline
    if (stat.stat_type === 'Point') {
      if (isHome) homeScore++; else awayScore++;
      
      let assistPlayer = 'None';
      let passesInPoint = [];
      for (let i = index - 1; i >= 0; i--) {
        const s = chronological[i];
        if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
          break;
        }
        if (s.stat_type === 'Pass' && s.team_id === stat.team_id) {
          passesInPoint.push(s);
        }
      }
      if (passesInPoint.length > 1) {
        const primaryAssisterStat = passesInPoint[1];
        if (primaryAssisterStat.player !== stat.player) {
          assistPlayer = primaryAssisterStat.player;
        }
      }

      timeline.push({
        pointNumber: stat.point_number,
        scoringTeam: isHome ? homeTeamName : awayTeamName,
        goal: stat.player,
        assist: assistPlayer,
        score: `${homeScore} - ${awayScore}`
      });
    } else if (stat.stat_type === 'Opponent Point') {
      if (isHome) awayScore++; else homeScore++;
      timeline.push({
        pointNumber: stat.point_number,
        scoringTeam: isHome ? awayTeamName : homeTeamName,
        goal: 'Opponent',
        assist: 'None',
        score: `${homeScore} - ${awayScore}`
      });
    }
  });

  // Calculate gender designations statistics
  const homeMmp = homePlayers.filter(p => p.gender_designation === 'mmp').length;
  const homeFmp = homePlayers.filter(p => p.gender_designation === 'fmp').length;
  const awayMmp = awayPlayers.filter(p => p.gender_designation === 'mmp').length;
  const awayFmp = awayPlayers.filter(p => p.gender_designation === 'fmp').length;

  // 2. Construct CSV lines
  let csvContent = '';

  const addHeader = (title) => {
    csvContent += `\n=== ${title.toUpperCase()} ===\n`;
  };

  const addRow = (cols) => {
    const escaped = cols.map(c => {
      const cell = c === null || c === undefined ? '' : String(c);
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    csvContent += escaped.join(',') + '\n';
  };

  // Section A: Match Summary Metadata
  addHeader('Match Summary Details');
  addRow(['Parameter', 'Details']);
  addRow(['Home Team', homeTeamName]);
  addRow(['Away Team', awayTeamName]);
  addRow(['Final Score', `${match.home_score} - ${match.away_score}`]);
  addRow(['Division', division]);
  addRow(['Pitch Number', pitch]);
  addRow(['Status', match.status]);
  addRow(['Scheduled Time', scheduledTime]);
  addRow(['Home Roster MMP Count', homeMmp]);
  addRow(['Home Roster FMP Count', homeFmp]);
  addRow(['Away Roster MMP Count', awayMmp]);
  addRow(['Away Roster FMP Count', awayFmp]);

  // Section B: Point-by-Point Score Timeline
  addHeader('Point-by-Point Timeline');
  addRow(['Point #', 'Scoring Team', 'Scorer', 'Assist', 'Running Score']);
  timeline.forEach(row => {
    addRow([row.pointNumber, row.scoringTeam, row.goal, row.assist, row.score]);
  });
  if (timeline.length === 0) {
    addRow(['-', 'No goals recorded yet', '-', '-', '0 - 0']);
  }

  // Section C: Home Team Statistics
  addHeader(`${homeTeamName} Player Metrics`);
  addRow(['Player Name', 'Gender Match', 'Touches', 'Goals', 'Assists', 'Completed Passes', 'Attempted Passes', 'Pass Comp %', 'Turnovers', 'Defence Blocks']);
  Object.values(homeStatsMap).forEach(p => {
    const compPct = p.passes > 0 ? Math.round((p.completions / p.passes) * 100) : 0;
    addRow([p.name, p.gender.toUpperCase(), p.touches, p.goals, p.assists, p.completions, p.passes, p.passes > 0 ? `${compPct}%` : '-', p.turnovers, p.defence]);
  });

  // Section D: Away Team Statistics
  addHeader(`${awayTeamName} Player Metrics`);
  addRow(['Player Name', 'Gender Match', 'Touches', 'Goals', 'Assists', 'Completed Passes', 'Attempted Passes', 'Pass Comp %', 'Turnovers', 'Defence Blocks']);
  Object.values(awayStatsMap).forEach(p => {
    const compPct = p.passes > 0 ? Math.round((p.completions / p.passes) * 100) : 0;
    addRow([p.name, p.gender.toUpperCase(), p.touches, p.goals, p.assists, p.completions, p.passes, p.passes > 0 ? `${compPct}%` : '-', p.turnovers, p.defence]);
  });

  // 3. Trigger File Download
  const filename = `${homeTeamName.replace(/\s+/g, '_')}_vs_${awayTeamName.replace(/\s+/g, '_')}_telemetry.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
