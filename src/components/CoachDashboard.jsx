import React, { useState, useEffect, useMemo } from 'react';
import { fetchGameStats, fetchAllGameNames } from '../supabaseClient';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Lock, Zap, Target, AlertTriangle, Presentation, Users, Clock, ChevronDown, Check } from 'lucide-react';

const CoachDashboard = ({ currentGame }) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGames, setSelectedGames] = useState(currentGame ? [currentGame] : []);
  const [allGames, setAllGames] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchAllGameNames().then(setAllGames).catch(console.error);
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      if (selectedGames.length === 0) {
        setStats([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rawStats = await fetchGameStats(selectedGames);
        // fetchGameStats returns desc, we want chronological for the timeline
        setStats(rawStats.reverse());
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [selectedGames]);

  const toggleGameSelection = (game) => {
    setSelectedGames(prev => 
      prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game]
    );
  };

  const { playerStats, timeline, activeLineup, gameType, score } = useMemo(() => {
    const playersMap = {};
    const timelineData = [];
    let currentUs = 0;
    let currentThem = 0;
    let type = 'grass';
    let teamTouchesCount = 0;
    let activeNames = new Set();
    let highestPoint = 0;

    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { name, goals: 0, assists: 0, blocks: 0, throwaways: 0, drops: 0, stalls: 0, touches: 0, usage: 0 };
      }
      return playersMap[name];
    };

    timelineData.push({ point: 0, Us: 0, Them: 0 });

    stats.forEach((stat, index) => {
      if (stat.game_type) type = stat.game_type;
      
      // Track points and timeline
      if (stat.stat_type === 'Point') {
        currentUs += 1;
        timelineData.push({ point: currentUs + currentThem, Us: currentUs, Them: currentThem });
      } else if (stat.stat_type === 'Opponent Point') {
        currentThem += 1;
        timelineData.push({ point: currentUs + currentThem, Us: currentUs, Them: currentThem });
      }

      // Track active lineup based on max point
      if (stat.point_number >= highestPoint) {
        if (stat.point_number > highestPoint) {
          highestPoint = stat.point_number;
          activeNames = new Set(); // reset lineup for new point
        }
        if (stat.stat_type === 'Lineup') {
          activeNames.add(stat.player);
        }
      }

      if (stat.player === 'System' || stat.player === 'Opponent' || stat.stat_type === 'Lineup') return;

      const p = ensurePlayer(stat.player);
      p.touches += 1;
      teamTouchesCount += 1;

      if (stat.stat_type === 'Point') {
        p.goals += 1;
      } else if (stat.stat_type === 'Pass') {
        // Look ahead for assist
        const nextStat = stats[index + 1];
        if (nextStat && nextStat.point_number === stat.point_number && nextStat.stat_type === 'Point') {
          p.assists += 1;
        }
      } else if (stat.stat_type === 'Defence') {
        p.blocks += 1;
      } else if (stat.stat_type === 'Throwaway') {
        p.throwaways += 1;
      } else if (stat.stat_type === 'Drop') {
        p.drops += 1;
      } else if (stat.stat_type === 'Stall Out') {
        p.stalls += 1;
      }
    });

    // Calculate usage rates
    const calculatedPlayerStats = Object.values(playersMap).map(p => ({
      ...p,
      usage: teamTouchesCount > 0 ? ((p.touches / teamTouchesCount) * 100).toFixed(1) : 0,
      turnovers: p.throwaways + p.drops + p.stalls
    })).sort((a, b) => b.touches - a.touches);

    return {
      playerStats: calculatedPlayerStats,
      timeline: timelineData,
      activeLineup: Array.from(activeNames),
      gameType: type,
      score: { us: currentUs, them: currentThem }
    };
  }, [stats]);

  if (selectedGames.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 pb-32">
        <Presentation className="w-16 h-16 text-indigo-500/50 mb-4" />
        <h2 className="text-2xl font-black text-white tracking-widest uppercase mb-6">Coach Dashboard</h2>
        
        <div className="relative w-full max-w-sm">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-6 py-4 bg-slate-800 rounded-2xl border border-slate-700 text-left transition-all hover:bg-slate-700"
          >
            <span className="font-bold text-slate-200">Select Matches to Analyze</span>
            <ChevronDown className="w-5 h-5 text-slate-400" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
              {allGames.map(game => (
                <div 
                  key={game} 
                  onClick={() => toggleGameSelection(game)}
                  className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0 text-slate-200 font-medium"
                >
                  {game}
                  {selectedGames.includes(game) && <Check className="w-5 h-5 text-indigo-500" />}
                </div>
              ))}
              {allGames.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">No games logged yet.</div>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-indigo-400 font-bold tracking-widest text-lg animate-pulse">SYNCING DATABASES...</div>;
  }

  const isMultiGame = selectedGames.length > 1;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 pb-32 space-y-6 sm:space-y-8 max-w-7xl mx-auto font-sans">
      
      {/* Live Header / Selector Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
        <div className="w-full sm:w-auto relative group">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 group-hover:opacity-80 transition-opacity"
          >
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
              {isMultiGame ? 'Aggregate Analysis' : selectedGames[0]}
            </h1>
            <ChevronDown className="w-6 h-6 text-indigo-400 bg-indigo-500/10 rounded-full p-1" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-4 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-64 overflow-y-auto">
              <div className="p-3 border-b border-slate-800 text-xs font-bold text-slate-400 tracking-wider">SELECT MATCHES</div>
              {allGames.map(game => (
                <div 
                  key={game} 
                  onClick={() => toggleGameSelection(game)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0 text-slate-200 text-sm font-medium"
                >
                  <span className="truncate">{game}</span>
                  {selectedGames.includes(game) && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                </div>
              ))}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {!isMultiGame && (
              <span className={`px-3 py-1 font-bold text-xs uppercase tracking-widest rounded-full ${gameType === 'beach' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {gameType === 'beach' ? '5v5 Beach' : '7v7 Grass'}
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-400 text-sm font-medium bg-slate-800/50 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              {selectedGames.length} Game{selectedGames.length !== 1 ? 's' : ''} Mode
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-slate-950 px-6 py-4 rounded-2xl border border-white/5 shadow-inner">
          <div className="text-center">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Us</span>
            <div className="text-4xl font-black text-indigo-400">{score.us}</div>
          </div>
          <div className="text-slate-700 text-3xl font-light">-</div>
          <div className="text-center">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Them</span>
            <div className="text-4xl font-black text-rose-500">{score.them}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Main Content Area (Left 2 columns) */}
        <div className="col-span-1 lg:col-span-2 space-y-6 sm:space-y-8">
          
          {/* Active Lineup Area */}
          {!isMultiGame && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" /> On-Field Personnel</h3>
              </div>
              {activeLineup.length === 0 ? (
                <div className="p-6 text-center text-slate-500 font-medium bg-slate-950/50 rounded-2xl border border-white/5">No active players</div>
              ) : (
                <div className={`grid gap-4 ${gameType === 'beach' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-7'}`}>
                  {activeLineup.map(player => {
                    const pStat = playerStats.find(p => p.name === player) || { usage: 0, goals: 0, assists: 0 };
                    const isHighUsage = parseFloat(pStat.usage) > 15;
                    
                    return (
                      <div key={player} className="flex flex-col items-center p-4 bg-slate-950/80 border border-white/5 rounded-2xl text-center shadow-md relative overflow-hidden group">
                        {isHighUsage && <div className="absolute inset-0 bg-indigo-500/10 blur-xl"></div>}
                        <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center text-lg font-bold shadow-inner border-2 ${isHighUsage ? 'bg-indigo-500/20 text-indigo-400 border-indigo-400/50' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                          {player.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-200 font-bold text-sm truncate w-full mb-1">{player}</span>
                        <span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">Usage: <span className={isHighUsage ? 'text-indigo-400' : 'text-slate-400'}>{pStat.usage}%</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Performance Table */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Target className="w-5 h-5 text-emerald-400" /> Performance Matrix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 text-[10px] uppercase tracking-widest">
                    <th className="p-4 font-bold">Player</th>
                    <th className="p-4 font-bold text-center">G / A / D</th>
                    <th className="p-4 font-bold text-center" title="Throwaway / Drop / Stall">Turnovers</th>
                    <th className="p-4 font-bold text-right">Usage</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {playerStats.map((p, i) => (
                    <tr key={p.name} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-slate-800 transition-colors`}>
                      <td className="p-4 font-bold text-slate-200">{p.name}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono font-medium">
                          <span className="text-emerald-400 w-4">{p.goals}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-indigo-400 w-4">{p.assists}</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-amber-400 w-4">{p.blocks}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 font-mono text-xs">
                          <span className="text-rose-400 font-bold">{p.turnovers}</span>
                          <span className="text-slate-500 font-medium">({p.throwaways}/{p.drops}/{p.stalls})</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-slate-300">
                        {p.usage}%
                      </td>
                    </tr>
                  ))}
                  {playerStats.length === 0 && (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-500 font-medium">No recorded actions yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pulse Chart */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
            <h3 className="text-lg font-bold text-white flex items-center justify-between mb-6">
              <span className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400" /> {isMultiGame ? 'Cumulative Tournament Pulse' : 'Match Pulse'}</span>
              <span className="text-xs bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-slate-500 font-medium text-right">
                {isMultiGame ? 'Across all selected games sequentially' : 'Live Score Differential'}
              </span>
            </h3>
            <div className="h-64 w-full">
              {timeline.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorThem" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="point" stroke="#334155" tick={{fill: '#64748b', fontSize: 12}} />
                    <YAxis stroke="#334155" tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Area type="stepAfter" dataKey="Us" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorUs)" />
                    <Area type="stepAfter" dataKey="Them" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorThem)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 font-medium border border-slate-800 rounded-xl bg-slate-950/50">
                  Not enough scoring data to visualize timeline.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Sidebar Paywall */}
        <div className="col-span-1">
          <div className="relative h-full min-h-[500px] bg-slate-900/30 border border-white/5 p-6 rounded-3xl shadow-xl overflow-hidden flex flex-col">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6 opacity-40"><AlertTriangle className="w-5 h-5" /> Deep Analytics</h3>
            
            {/* Blurred Mock Content */}
            <div className="space-y-4 opacity-20 blur-[4px] pointer-events-none flex-1">
              <div className="h-24 bg-slate-800 rounded-xl"></div>
              <div className="h-40 bg-slate-800 rounded-xl"></div>
              <div className="h-32 bg-slate-800 rounded-xl"></div>
            </div>

            {/* Glass Paywall Overlay */}
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center border-l border-white/10">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-2xl font-black text-white mb-3 tracking-tight">Upgrade to Pro</h4>
              <p className="text-slate-300 font-medium text-sm mb-8 leading-relaxed">
                Unlock granular Lineup +/- differentials, advanced wind impact analysis, and predictive fatigue modeling.
              </p>
              <button className="w-full py-4 bg-white text-slate-950 hover:bg-slate-200 font-black tracking-wide uppercase text-sm rounded-xl transition-all shadow-xl hover:scale-[1.02] active:scale-95">
                Unlock Premium
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CoachDashboard;
