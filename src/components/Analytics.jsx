import { useState, useEffect, useMemo } from 'react';
import { fetchStats } from '../supabaseClient';

const Analytics = ({ targetTeamId, players = [] }) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGames, setSelectedGames] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'touches', direction: 'desc' });
  const currentGame = localStorage.getItem('ufstats_game');

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 5000));
        const rawStats = await Promise.race([fetchStats(targetTeamId), timeoutPromise]);
        if (isMounted) setStats(rawStats);
      } catch (err) {
        console.error('Failed to load stats', err);
        if (isMounted) alert("Network issue: Failed to load analytics. Please refresh.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadStats();
    return () => { isMounted = false; };
  }, [targetTeamId]);

  const games = useMemo(() => {
    const uniqueGames = [...new Set(stats.map(s => s.game_name))].filter(Boolean);
    return ['All', ...uniqueGames];
  }, [stats]);

  const playerStats = useMemo(() => {
    const filteredStats = selectedGames.length === 0 
      ? stats 
      : stats.filter(s => selectedGames.includes(s.game_name));

    const playersMap = {};

    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { name, touches: 0, pointsSet: new Set(), goals: 0, assists: 0, passes: 0, completions: 0, turnovers: 0, throwaways: 0, drops: 0, stallouts: 0, defence: 0 };
      }
      return playersMap[name];
    };

    filteredStats.forEach((stat, index) => {
      if (stat.player === 'System' || stat.player === 'Opponent' || stat.stat_type === 'Match Metadata') return;
      
      let normalizedPlayerName = stat.player;
      
      // Group legacy stats where the user manually typed "Name 10" or "Name #10" before the shirt_number field existed
      if (players && players.length > 0) {
        const match = players.find(p => {
          const statP = stat.player.trim().toLowerCase().replace(/\s+/g, ' ');
          const pName = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
          if (pName === statP) return true;
          
          if (p.shirt_number) {
             const numStr = String(p.shirt_number).trim().toLowerCase();
             if (statP === `${pName} ${numStr}`) return true;
             if (statP === `${pName} #${numStr}`) return true;
             if (statP === `${numStr} ${pName}`) return true;
          }
          return false;
        });
        if (match) {
          normalizedPlayerName = match.name;
        }
      }
      
      const p = ensurePlayer(normalizedPlayerName);
      
      if (stat.stat_type === 'Lineup') {
        p.pointsSet.add(`${stat.game_name}-${stat.point_number}`);
        return; // Don't count lineup explicitly as a touch
      }

      p.touches += 1;

      if (stat.stat_type === 'Point') {
        p.goals += 1;
      } else if (stat.stat_type === 'Pass') {
        p.passes += 1;
        
        // Next stat in same game and point
        const nextStat = filteredStats[index + 1];
        let isCompleted = true;
        let isAssist = false;

        if (
          nextStat &&
          nextStat.game_name === stat.game_name &&
          nextStat.point_number === stat.point_number
        ) {
          if (nextStat.stat_type === 'Drop') {
            isCompleted = false;
          } else if (nextStat.stat_type === 'Point') {
            isAssist = true;
          }
        }

        if (isCompleted) {
          p.completions += 1;
        }
        if (isAssist) {
          p.assists += 1;
        }

      } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
        p.turnovers += 1;
        
        if (stat.stat_type === 'Throwaway') {
          p.passes += 1; // A throwaway is a pass attempt!
          p.throwaways += 1;
        } else if (stat.stat_type === 'Drop') {
          p.drops += 1;
        } else if (stat.stat_type === 'Stall Out') {
          p.stallouts += 1;
        }
      } else if (stat.stat_type === 'Defence') {
        p.defence += 1;
      }
    });

    const data = Object.values(playersMap).map(row => {
      const pct = row.passes > 0 ? (row.completions / row.passes) * 100 : 0;
      return { ...row, compPct: pct, pointsPlayed: row.pointsSet.size };
    });

    return data.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      // Tie breaker: Alphabetical by name
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
  }, [stats, selectedGames, sortConfig, players]);

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-4 min-h-screen text-indigo-400 font-bold tracking-widest text-lg">
        CRUNCHING DATA...
      </div>
    );
  }

  const toggleGame = (game) => {
    if (selectedGames.includes(game)) {
      setSelectedGames(selectedGames.filter(g => g !== game));
    } else {
      setSelectedGames([...selectedGames, game]);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-5xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        {/* Header */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Analytics</h1>
            <p className="text-slate-400 text-sm font-medium">Advanced Performance Metrics</p>
          </div>
        </div>

        {/* Multi-Select Filters */}
        <div className="w-full px-6 sm:px-8 py-4 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full sm:w-64 px-4 py-2.5 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl font-bold flex justify-between items-center gap-4 hover:bg-slate-700 transition-colors shadow-inner"
            >
              <span>
                {selectedGames.length === 0 
                  ? 'Filter Games (All)' 
                  : `Filtered (${selectedGames.length} Game${selectedGames.length > 1 ? 's' : ''})`
                }
              </span>
              <span className="text-slate-400 text-xs">{isDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {currentGame && (
              <button 
                onClick={() => setSelectedGames([currentGame])}
                className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-inner"
              >
                🎯 Active Game Only
              </button>
            )}
          </div>
          
          {isDropdownOpen && (
            <div className="mt-3 bg-slate-900/80 border border-slate-700 rounded-xl overflow-hidden shadow-inner">
              <div className="p-3 border-b border-slate-700 bg-slate-800/50">
                <label className="flex items-center gap-3 w-full cursor-pointer group px-2">
                  <input 
                    type="checkbox" 
                    checked={selectedGames.length === 0} 
                    onChange={() => setSelectedGames([])}
                    className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span className={`${selectedGames.length === 0 ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-200'} transition-colors`}>
                    All Games
                  </span>
                </label>
              </div>
              
              <div className="max-h-[250px] overflow-y-auto p-2 scrollbar-hide">
                {games.filter(g => g !== 'All').map(game => (
                  <label key={game} className="flex items-center gap-3 w-full p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                    <input 
                      type="checkbox"
                      checked={selectedGames.includes(game)}
                      onChange={() => toggleGame(game)}
                      className="w-5 h-5 rounded border-slate-600 text-emerald-500 focus:ring-0 cursor-pointer bg-slate-900"
                    />
                    <span className={`${selectedGames.includes(game) ? 'text-white font-bold' : 'text-slate-400 group-hover:text-slate-200'} transition-colors line-clamp-1`}>
                      {game}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content Table */}
        <div className="p-0 sm:p-6 overflow-x-auto">
          {playerStats.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium bg-slate-900/50 m-6 rounded-2xl border border-slate-700/50">
              No stats recorded for {selectedGames.length === 0 ? 'any game' : 'the selected matches'} yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700/50 uppercase text-xs tracking-wider text-slate-400 select-none">
                  <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>Player {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('pointsPlayed')}>PP {sortConfig.key === 'pointsPlayed' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('touches')}>Touches {sortConfig.key === 'touches' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('goals')}>Goals {sortConfig.key === 'goals' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('assists')}>Assists {sortConfig.key === 'assists' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => handleSort('passes')}>Passes <span className="text-[10px] opacity-70">(C/A)</span> {sortConfig.key === 'passes' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors whitespace-nowrap" onClick={() => handleSort('compPct')}>Comp % {sortConfig.key === 'compPct' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('defence')}>Defence {sortConfig.key === 'defence' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="p-4 font-bold text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('turnovers')}>Turnovers {sortConfig.key === 'turnovers' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {playerStats.map((row) => {
                  return (
                    <tr key={row.name} className="hover:bg-slate-700/20 transition-colors">
                      <td className="p-4 text-white font-bold">{row.name}</td>
                      <td className="p-4 text-center text-indigo-300 font-bold">{row.pointsPlayed}</td>
                      <td className="p-4 text-center text-slate-300 font-bold">{row.touches}</td>
                      <td className="p-4 text-center">
                        <span className="inline-block w-8 h-8 leading-8 bg-emerald-500/10 text-emerald-400 font-bold rounded-lg text-sm">
                          {row.goals}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-block w-8 h-8 leading-8 bg-blue-500/10 text-blue-400 font-bold rounded-lg text-sm">
                          {row.assists}
                        </span>
                      </td>
                      <td className="p-4 text-center text-slate-300 font-medium text-sm">
                        <span className="text-white font-bold">{row.completions}</span> / {row.passes}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-1 font-bold rounded text-xs ${row.compPct >= 90 ? 'bg-indigo-500/20 text-indigo-300' : row.compPct >= 75 ? 'bg-slate-700 text-slate-300' : 'bg-rose-500/10 text-rose-400'}`}>
                          {row.passes > 0 ? `${Math.round(row.compPct)}%` : '-'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-block w-8 h-8 leading-8 bg-orange-500/10 text-orange-400 font-bold rounded-lg text-sm">
                          {row.defence}
                        </span>
                      </td>
                      <td className="p-4 text-center text-sm">
                        <span className="text-rose-400 font-bold">{row.turnovers}</span>
                        {row.turnovers > 0 && (
                          <span className="text-slate-500 text-xs ml-2">
                            ({row.throwaways}T, {row.drops}D, {row.stallouts}S)
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
