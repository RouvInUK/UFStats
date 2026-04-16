import React, { useState, useEffect, useMemo } from 'react';
import { fetchGameStats, fetchAllGameNames } from '../supabaseClient';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell, CartesianGrid } from 'recharts';
import { Lock, Zap, Target, AlertTriangle, Presentation, Users, Clock, ChevronDown, Check } from 'lucide-react';

const CoachDashboard = ({ currentGame }) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visualGameType, setVisualGameType] = useState('beach');
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

  const { playerStats, timeline, activeLineup, score, teamSummary, coachInsight } = useMemo(() => {
    const playersMap = {};
    const timelineData = [];
    let currentUs = 0;
    let currentThem = 0;
    let teamTouchesCount = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalTurnovers = 0;
    let totalBlocks = 0;
    let activeNames = new Set();
    let highestPoint = 0;

    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { name, goals: 0, assists: 0, blocks: 0, throwaways: 0, drops: 0, stalls: 0, touches: 0, passes: 0, usage: 0, pointsPlayedSet: new Set() };
      }
      return playersMap[name];
    };

    timelineData.push({ point: 0, Us: 0, Them: 0 });

    stats.forEach((stat, index) => {
      
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

      if (stat.stat_type === 'Lineup') {
        if (stat.player !== 'System' && stat.player !== 'Opponent') {
          const lp = ensurePlayer(stat.player);
          lp.pointsPlayedSet.add(stat.point_number);
        }
        return;
      }

      if (stat.player === 'System' || stat.player === 'Opponent') return;

      const p = ensurePlayer(stat.player);
      p.touches += 1;
      teamTouchesCount += 1;

      if (stat.stat_type === 'Point') {
        p.goals += 1;
      } else if (stat.stat_type === 'Pass') {
        p.passes += 1;
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

    // Calculate usage rates, NIS, Tags, and Completion %
    const calculatedPlayerStats = Object.values(playersMap).map(p => {
      const turnovers = p.throwaways + p.drops + p.stalls;
      totalGoals += p.goals;
      totalAssists += p.assists;
      totalTurnovers += turnovers;
      totalBlocks += p.blocks;

      const pointsPlayed = Math.max(1, p.pointsPlayedSet.size);
      const touchesPerPoint = p.touches / pointsPlayed;
      const blocksPerPoint = p.blocks / pointsPlayed;

      const passAttempts = p.passes + p.throwaways;
      const completion = passAttempts > 0 ? (p.passes / passAttempts) * 100 : 0;
      
      const nis = ((p.goals * 2) + (p.assists * 1.5) + (p.blocks * 2) + (p.passes * 0.3) - (turnovers * 2)) / pointsPlayed;

      let tags = [];
      if (touchesPerPoint > 3 && completion >= 90) tags.push("The Engine");
      if (touchesPerPoint < 2 && (p.goals + p.assists) / pointsPlayed > 0.4) tags.push("The Finisher");
      if (blocksPerPoint > 0.3) tags.push("The Lockdown");

      return {
        ...p,
        usage: teamTouchesCount > 0 ? ((p.touches / teamTouchesCount) * 100).toFixed(1) : 0,
        turnovers: turnovers,
        completion: parseFloat(completion.toFixed(1)),
        nis: parseFloat(nis.toFixed(2)),
        touchesPerPoint: parseFloat(touchesPerPoint.toFixed(1)),
        tags
      };
    }).sort((a, b) => b.touches - a.touches);

    // Generate Coach Insight
    const engines = calculatedPlayerStats.filter(p => p.tags.includes("The Engine"));
    const finishers = calculatedPlayerStats.filter(p => p.tags.includes("The Finisher"));
    const sortedByTouches = [...calculatedPlayerStats].sort((a,b) => b.touches - a.touches);
    
    let insight = "Not enough data to analyze impact trends.";
    
    if (engines.length > 0 && finishers.length > 0) {
      insight = `${engines[0].name} is averaging ${engines[0].touchesPerPoint} touches per point (The Engine), providing absolute foundational stability for ${finishers[0].name} (The Finisher) to attack.`;
    } else if (engines.length > 0) {
      insight = `${engines[0].name} is effectively running the entire offense as The Engine, boasting a ${engines[0].completion}% completion rate over high volume.`;
    } else if (finishers.length > 0) {
      insight = `The team currently lacks a true Engine handler, but ${finishers[0].name} is ruthlessly finishing opportunities in the cutting lanes.`;
    } else if (sortedByTouches.length > 0 && teamTouchesCount > 10) {
      const topToucher = sortedByTouches[0];
      if (topToucher.nis < 0) {
         insight = `Warning: ${topToucher.name} is your primary handler (Highest Touches), but their turnover weight is dragging their Net Impact into the negative.`;
      } else {
         insight = `The offense is moving through ${topToucher.name}, but no player has established a dominant Engine/Finisher archetype yet.`;
      }
    }

    return {
      playerStats: calculatedPlayerStats,
      timeline: timelineData,
      activeLineup: Array.from(activeNames),
      score: { us: currentUs, them: currentThem },
      teamSummary: { totalTouches: teamTouchesCount, totalGoals, totalAssists, totalTurnovers, totalBlocks },
      coachInsight: insight
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

  const isMultiGame = selectedGames.length > 1;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 pb-32 space-y-6 sm:space-y-8 max-w-7xl mx-auto font-sans">
      
      {/* Live Header / Selector Panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl relative z-50">
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
              <button 
                onClick={() => setVisualGameType(visualGameType === 'beach' ? 'grass' : 'beach')}
                className={`px-3 py-1 font-bold text-xs uppercase tracking-widest rounded-full ${visualGameType === 'beach' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}
              >
                {visualGameType === 'beach' ? '5v5 Beach' : '7v7 Grass'}
              </button>
            )}
            <span className="flex items-center gap-1 text-slate-400 text-sm font-medium bg-slate-800/50 px-3 py-1 rounded-full">
              {loading ? (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              )}
              {loading ? 'Syncing...' : `${selectedGames.length} Game${selectedGames.length !== 1 ? 's' : ''} Mode`}
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
                          <span className="text-slate-500 font-medium tracking-tight">({p.throwaways}T / {p.drops}D / {p.stalls}S)</span>
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

        {/* Sidebar Analytics Update */}
        <div className="col-span-1">
          <div className="relative h-full min-h-[400px] bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col">
            <h3 className="text-lg font-bold text-white flex items-center justify-between mb-6">
               <span className="flex items-center gap-2"><Target className="w-5 h-5 text-indigo-400" /> Team Overview</span>
            </h3>
            
            <div className="flex flex-col gap-4 flex-1">
              
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Total Touches</div>
                  <div className="text-2xl font-black text-slate-200">{teamSummary.totalTouches}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Scores / Assists</div>
                  <div className="text-2xl font-black text-emerald-400">{teamSummary.totalGoals} <span className="text-slate-600 text-lg">/</span> <span className="text-indigo-400 text-lg">{teamSummary.totalAssists}</span></div>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Total Blocks</div>
                  <div className="text-2xl font-black text-amber-400">{teamSummary.totalBlocks}</div>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Total Turnovers</div>
                  <div className="text-2xl font-black text-rose-500">{teamSummary.totalTurnovers}</div>
                </div>
                <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* True Impact Analytics Suite */}
      {playerStats.length > 0 && (
        <div className="space-y-6 sm:space-y-8 mt-6">
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex flex-shrink-0 items-center justify-center text-indigo-400 border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
              <Presentation className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                Coach's Neural Insight
              </div>
              <p className="text-slate-200 font-medium text-lg leading-relaxed">{coachInsight}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
            {/* Scatter Chart */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
              <h3 className="text-lg font-bold text-white flex items-center justify-between mb-6">
                 <span className="flex items-center gap-2"><Target className="w-5 h-5 text-indigo-400" /> Utility vs Volume Map</span>
                 <span className="text-xs bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-slate-500 font-medium">Radius = Completion %</span>
              </h3>
              <div className="h-80 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                    <defs>
                      <filter id="engineGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f59e0b" floodOpacity="0.8" />
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis type="number" dataKey="touchesPerPoint" name="Touches/Pt" stroke="#64748b" tick={{fill: '#64748b'}} label={{ value: 'Touches per Point (Workload)', position: 'insideBottom', offset: -10, fill: '#64748b' }} />
                    <YAxis type="number" dataKey="nis" name="Net Impact" stroke="#64748b" tick={{fill: '#64748b'}} label={{ value: 'Net Impact Score / Pt', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b' }} />
                    <ZAxis type="number" dataKey="completion" range={[50, 400]} name="Completion %" />
                    <Tooltip 
                      cursor={{strokeDasharray: '3 3'}}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ fontWeight: 'bold', color: '#cbd5e1' }}
                      formatter={(value, name, props) => {
                        if (name === 'Touches/Pt') return [value, 'Touches / Pt'];
                        if (name === 'Net Impact') return [value, 'NIS'];
                        if (name === 'Completion %') return [`${value}%`, 'Completion'];
                        return [value, name];
                      }}
                    />
                    <Scatter name="Handlers" data={playerStats} fill="#8884d8">
                      {playerStats.map((entry, index) => {
                        let color = '#3b82f6'; // Cold
                        if (entry.nis > 1.5) color = '#f59e0b'; // Gold
                        else if (entry.nis > 0.5) color = '#f43f5e'; // Hot
                        else if (entry.nis > 0) color = '#8b5cf6'; // Warm

                        return <Cell key={`cell-${index}`} fill={color} filter={entry.tags.includes("The Engine") ? 'url(#engineGlow)' : ''} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Utility Leaderboard */}
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Lock className="w-5 h-5 text-amber-400" /> True Impact Leaderboard</h3>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 text-[10px] uppercase tracking-widest">
                      <th className="p-4 font-bold">Rank</th>
                      <th className="p-4 font-bold">Player</th>
                      <th className="p-4 font-bold text-center">Net Impact</th>
                      <th className="p-4 font-bold text-right">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {[...playerStats].sort((a,b) => b.nis - a.nis).map((p, i) => {
                      const isEliteHandler = p.touches > 20 && p.completion >= 95;
                      
                      return (
                        <tr key={p.name} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-slate-800 transition-colors`}>
                          <td className="p-4 font-mono font-bold text-slate-500">#{i + 1}</td>
                          <td className="p-4 font-bold text-slate-200">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="flex items-center gap-2">
                                {p.name}
                                {p.tags.includes("The Engine") && (
                                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[9px] uppercase tracking-widest font-black rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                    The Engine
                                  </span>
                                )}
                              </span>
                              {p.tags.filter(t => t !== "The Engine").length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {p.tags.filter(t => t !== "The Engine").map(t => (
                                    <span key={t} className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 text-[8px] uppercase tracking-wider rounded">
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-mono font-bold ${p.nis > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.nis > 0 ? '+' : ''}{p.nis}</span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-300">
                            {p.completion}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default CoachDashboard;
