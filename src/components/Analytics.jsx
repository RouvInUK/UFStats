import { useState, useEffect, useMemo } from 'react';
import { fetchStats } from '../supabaseClient';

const Analytics = ({ onNavigate }) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'touches', direction: 'desc' });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const rawStats = await fetchStats();
        setStats(rawStats);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const games = useMemo(() => {
    const uniqueGames = [...new Set(stats.map(s => s.game_name))].filter(Boolean);
    return ['All', ...uniqueGames];
  }, [stats]);

  const playerStats = useMemo(() => {
    const filteredStats = selectedGame === 'All' 
      ? stats 
      : stats.filter(s => s.game_name === selectedGame);

    const playersMap = {};

    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { name, touches: 0, goals: 0, assists: 0, passes: 0, completions: 0, turnovers: 0, throwaways: 0, drops: 0, stallouts: 0, defence: 0 };
      }
      return playersMap[name];
    };

    filteredStats.forEach((stat, index) => {
      if (stat.player === 'System') return;
      
      const p = ensurePlayer(stat.player);
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
      return { ...row, compPct: pct };
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
  }, [stats, selectedGame, sortConfig]);

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

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-4xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        {/* Header */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Analytics</h1>
            <p className="text-slate-400 text-sm font-medium">Advanced Performance Metrics</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <select 
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="flex-1 sm:flex-none appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              {games.map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
            <button 
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-xl transition-all shadow-md"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-0 sm:p-6 overflow-x-auto">
          {playerStats.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium bg-slate-900/50 m-6 rounded-2xl border border-slate-700/50">
              No stats recorded for {selectedGame === 'All' ? 'any game' : 'this match'} yet.
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-700/50 uppercase text-xs tracking-wider text-slate-400 select-none">
                  <th className="p-4 font-bold cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>Player {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
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
