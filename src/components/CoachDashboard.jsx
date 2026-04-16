import React, { useState, useEffect, useMemo } from 'react';
import { fetchGameStats, fetchAllGameNames } from '../supabaseClient';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Lock, Zap, Target, AlertTriangle, Presentation, Users, ChevronDown, Check, Activity } from 'lucide-react';

const CoachDashboard = ({ currentGame, currentTeam }) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visualGameType, setVisualGameType] = useState('beach');
  const [selectedGames, setSelectedGames] = useState(currentGame ? [currentGame] : []);
  const [allGames, setAllGames] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState('nis');
  const [sortDirection, setSortDirection] = useState('desc');
  const [highlightedPlayerName, setHighlightedPlayerName] = useState(null);

  useEffect(() => {
    fetchAllGameNames(currentTeam).then(setAllGames).catch(console.error);
  }, [currentTeam]);

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

  const { playerStats, timeline, activeLineup, score, teamSummary, coachInsight, connectionsMap } = useMemo(() => {
    const playersMap = {};
    const timelineData = [];
    let currentUs = 0;
    let currentThem = 0;
    let teamTouchesCount = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalTurnovers = 0;
    let totalBlocks = 0;
    let totalThrowaways = 0;
    let totalDrops = 0;
    let totalStalls = 0;
    let activeNames = new Set();
    let highestPoint = 0;

    const pointOutcomes = {};
    const connectionsMap = {};

    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { name, goals: 0, assists: 0, secondaryAssists: 0, blocks: 0, throwaways: 0, drops: 0, stalls: 0, touches: 0, passes: 0, usage: 0, pointsPlayedSet: new Set(), holdsPlayed: 0, holdsWon: 0, breaksPlayed: 0, breaksWon: 0 };
      }
      return playersMap[name];
    };

    const pointODState = {};
    let currentLineState = 'O';

    timelineData.push({ point: 0, pointNumber: 0, Us: 0, Them: 0 });

    stats.forEach((stat, index) => {
      
      // Track O/D State Initializations
      if (stat.stat_type === 'Start Offense') currentLineState = 'O';
      if (stat.stat_type === 'Start Defense') currentLineState = 'D';
      if (stat.stat_type === 'Half Time') {
        currentLineState = currentLineState === 'O' ? 'D' : 'O';
      }

      const isLineupOrScore = stat.stat_type === 'Lineup' || stat.stat_type === 'Point' || stat.stat_type === 'Opponent Point';
      if (isLineupOrScore && !pointODState[stat.point_number]) {
          pointODState[stat.point_number] = currentLineState;
      }

      // Track points and timeline
      if (stat.stat_type === 'Point') {
        currentUs += 1;
        pointOutcomes[stat.point_number] = 'won';
        timelineData.push({ point: currentUs + currentThem, pointNumber: stat.point_number, Us: currentUs, Them: currentThem });
        currentLineState = 'D'; // Scored, now pull on D
      } else if (stat.stat_type === 'Opponent Point') {
        currentThem += 1;
        pointOutcomes[stat.point_number] = 'lost';
        timelineData.push({ point: currentUs + currentThem, pointNumber: stat.point_number, Us: currentUs, Them: currentThem });
        currentLineState = 'O'; // Got scored on, now receive on O
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
        
        // Track the connection
        const assister = stats[index - 1];
        if (assister && assister.point_number === stat.point_number && assister.stat_type === 'Pass') {
           const pairKey = `${assister.player} → ${stat.player}`;
           connectionsMap[pairKey] = (connectionsMap[pairKey] || 0) + 1;
           
           // Secondary Assist Logic
           const hockeyAssister = stats[index - 2];
           if (hockeyAssister && hockeyAssister.point_number === stat.point_number && hockeyAssister.stat_type === 'Pass') {
              const saPlayer = ensurePlayer(hockeyAssister.player);
              saPlayer.secondaryAssists += 1;
           }
        }
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

    let globalHoldsPlayed = 0; let globalHoldsWon = 0;
    let globalBreaksPlayed = 0; let globalBreaksWon = 0;

    Object.entries(pointOutcomes).forEach(([ptStr, outcome]) => {
       const ptNum = parseInt(ptStr, 10);
       if (pointODState[ptNum] === 'O') {
          globalHoldsPlayed++;
          if (outcome === 'won') globalHoldsWon++;
       } else {
          globalBreaksPlayed++;
          if (outcome === 'won') globalBreaksWon++;
       }
    });

    // Calculate usage rates, NIS, Tags, Completion %, and System Impact
    const calculatedPlayerStats = Object.values(playersMap).map(p => {
      const turnovers = p.throwaways + p.drops + p.stalls;
      totalGoals += p.goals;
      totalAssists += p.assists;
      totalTurnovers += turnovers;
      totalBlocks += p.blocks;
      totalThrowaways += p.throwaways;
      totalDrops += p.drops;
      totalStalls += p.stalls;

      const pointsPlayed = Math.max(1, p.pointsPlayedSet.size);
      const touchesPerPoint = p.touches / pointsPlayed;
      const blocksPerPoint = p.blocks / pointsPlayed;

      const passAttempts = p.passes + p.throwaways;
      const completion = passAttempts > 0 ? (p.passes / passAttempts) * 100 : 0;
      
      const nis = ((p.goals * 2) + (p.assists * 1.5) + (p.blocks * 2) + (p.passes * 0.3) - (turnovers * 2)) / pointsPlayed;

      let plusMinus = 0;
      p.pointsPlayedSet.forEach(ptNum => {
         const outcome = pointOutcomes[ptNum];
         if (outcome === 'won') plusMinus += 1;
         if (outcome === 'lost') plusMinus -= 1;

         if (pointODState[ptNum] === 'O') {
             p.holdsPlayed += 1;
             if (outcome === 'won') p.holdsWon += 1;
         } else {
             p.breaksPlayed += 1;
             if (outcome === 'won') p.breaksWon += 1;
         }
      });

      const sOn = (p.holdsPlayed + p.breaksPlayed) > 0 
           ? ((p.holdsWon + p.breaksWon) / (p.holdsPlayed + p.breaksPlayed)) * 100 : 0;
           
      const offHoldsPlayed = globalHoldsPlayed - p.holdsPlayed;
      const offBreaksPlayed = globalBreaksPlayed - p.breaksPlayed;
      const offHoldsWon = globalHoldsWon - p.holdsWon;
      const offBreaksWon = globalBreaksWon - p.breaksWon;
      
      const sOff = (offHoldsPlayed + offBreaksPlayed) > 0 
           ? ((offHoldsWon + offBreaksWon) / (offHoldsPlayed + offBreaksPlayed)) * 100 : 0;
           
      // If team has 0 points off, neutral offset
      const systemImpact = (offHoldsPlayed + offBreaksPlayed) > 0 ? parseFloat((sOn - sOff).toFixed(1)) : 0;

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
        plusMinus,
        systemImpact,
        tags
      };
    }).sort((a, b) => b.touches - a.touches);

    // Generate Coach Insight
    const engines = calculatedPlayerStats.filter(p => p.tags.includes("The Engine"));
    const finishers = calculatedPlayerStats.filter(p => p.tags.includes("The Finisher"));
    const sortedByTouches = [...calculatedPlayerStats].sort((a,b) => b.touches - a.touches);
    const highestImpactPlayer = [...calculatedPlayerStats].sort((a,b) => b.systemImpact - a.systemImpact)[0];
    
    let insight = "Not enough data to analyze impact trends.";
    
    if (highestImpactPlayer && highestImpactPlayer.systemImpact > 10 && highestImpactPlayer.touchesPerPoint <= 2) {
       insight = `Despite low traditional stats, ${highestImpactPlayer.name} has a massive +${highestImpactPlayer.systemImpact}% System Impact. Their structural positioning allows the team to drastically increase scoring efficiency when they step on the field.`;
    } else if (engines.length > 0 && finishers.length > 0) {
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
      teamSummary: { totalTouches: teamTouchesCount, totalGoals, totalAssists, totalTurnovers, totalBlocks, totalThrowaways, totalDrops, totalStalls },
      coachInsight: insight,
      connectionsMap
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPlayers = playerStats ? [...playerStats].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    // Derived fields combined for sorting G/A/D
    if (sortField === 'gad') {
       aVal = a.goals + a.assists + a.secondaryAssists + a.blocks;
       bVal = b.goals + b.assists + b.secondaryAssists + b.blocks;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : [];



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
                    
                    {/* Add Reference Area Highlights for highlighted player */}
                    {highlightedPlayerName && (
                      timeline.map((d, i) => {
                         const playerObj = playerStats.find(p => p.name === highlightedPlayerName);
                         if (playerObj && playerObj.pointsPlayedSet.has(d.pointNumber)) {
                            // Render a reference area from this point to the next
                            const nextD = timeline[i + 1];
                            const endPoint = nextD ? nextD.point : d.point + 1; // Approximate right edge
                            return (
                               <ReferenceArea key={i} x1={d.point} x2={endPoint} fill="#f8fafc" fillOpacity={0.1} />
                            )
                         }
                         return null;
                      })
                    )}
                    
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
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-black text-rose-500">{teamSummary.totalTurnovers}</div>
                    <div className="text-sm font-medium text-slate-500 tracking-tight">({teamSummary.totalThrowaways}T / {teamSummary.totalDrops}D / {teamSummary.totalStalls}S)</div>
                  </div>
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
          
          {/* Connection Map UI */}
          {Object.keys(connectionsMap).length > 0 && (
            <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-indigo-400" /> Connection Map (Assist Pairs)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(connectionsMap)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([pair, count], index) => (
                    <div key={pair} className={`p-4 rounded-2xl border ${index === 0 ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-950/50 border-white/5'}`}>
                      <div className="text-xs font-bold uppercase tracking-widest mb-2">
                        {index === 0 ? <span className="text-indigo-400 flex items-center gap-1"><Zap className="w-3 h-3" /> Deadly Duo</span> : <span className="text-slate-500">Rank #{index + 1}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-bold text-slate-200 text-sm truncate">{pair}</span>
                        <span className="font-black text-xl text-emerald-400 shrink-0">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Master Sortable Analytics Table */}
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden mt-6">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" /> True Impact Master Roster
              </h3>
              <span className="text-xs bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-slate-500 font-medium">
                Click column headers to sort
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 text-[10px] uppercase tracking-widest cursor-pointer select-none">
                    <th className="p-4 font-bold hover:text-white transition-colors" onClick={() => handleSort('name')}>
                      Player {sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-center hover:text-white transition-colors" onClick={() => handleSort('touchesPerPoint')} title="Avg Touches per Point">
                      Touches/Pt {sortField === 'touchesPerPoint' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-center hover:text-white transition-colors" onClick={() => handleSort('gad')}>
                      G / A / SA / D {sortField === 'gad' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-center hover:text-white transition-colors" onClick={() => handleSort('turnovers')} title="Throwaways / Drops / Stalls">
                      Turnovers {sortField === 'turnovers' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-right hover:text-white transition-colors" onClick={() => handleSort('completion')} title="Pass Completion %">
                      Comp % {sortField === 'completion' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-center hover:text-white transition-colors" onClick={() => handleSort('systemImpact')} title="The % change in team scoring efficiency when this player is on the field. Corrects for O/D starting bias.">
                      System Impact % {sortField === 'systemImpact' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-right hover:text-white transition-colors" onClick={() => handleSort('usage')} title="Share of Team Touches">
                      Usage {sortField === 'usage' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th className="p-4 font-bold text-right hover:text-white transition-colors" onClick={() => handleSort('nis')} title="Net Impact Score (Efficiency per Point)">
                      NIS {sortField === 'nis' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {sortedPlayers.map((p, i) => {
                    const isSelected = highlightedPlayerName === p.name;
                    return (
                      <tr key={p.name} onClick={() => setHighlightedPlayerName(isSelected ? null : p.name)} className={`border-b border-white/5 cursor-pointer ${isSelected ? 'bg-indigo-500/20' : (i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30')} hover:bg-slate-800 transition-colors`}>
                        <td className="p-4 font-bold text-slate-200">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="flex items-center gap-2">
                              {p.name}
                              <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-black rounded-sm ${p.plusMinus > 0 ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400' : p.plusMinus < 0 ? 'bg-rose-500/20 border border-rose-500/50 text-rose-400' : 'bg-slate-500/20 border border-slate-500/50 text-slate-400'}`}>
                                {p.plusMinus > 0 ? '+' : ''}{p.plusMinus} On/Off
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono font-medium text-slate-300">
                          {p.touchesPerPoint}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1 font-mono font-medium">
                            <span className="text-emerald-400 w-3">{p.goals}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-indigo-400 w-3">{p.assists}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-purple-400 w-3" title="Secondary Assists">{p.secondaryAssists}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-amber-400 w-3">{p.blocks}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1 font-mono text-xs">
                            <span className="text-rose-400 font-bold">{p.turnovers}</span>
                            <span className="text-slate-500 font-medium tracking-tight">({p.throwaways}T / {p.drops}D / {p.stalls}S)</span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-300">
                          {p.completion}%
                        </td>
                        <td className="p-4 align-middle group relative min-w-[120px]">
                          <div className="flex items-center justify-center w-full relative h-[18px]">
                             {/* Center line */}
                             <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/20 z-10" />
                             {/* Negative bar (moves left from center) */}
                             <div className="w-1/2 flex justify-end h-full">
                                {p.systemImpact < 0 && (
                                   <div className="bg-rose-500/80 h-full rounded-l-sm" style={{ width: `${Math.min(100, Math.abs(p.systemImpact))}%` }} />
                                )}
                             </div>
                             {/* Positive bar (moves right from center) */}
                             <div className="w-1/2 flex justify-start h-full">
                                {p.systemImpact > 0 && (
                                   <div className="bg-emerald-500/80 h-full rounded-r-sm" style={{ width: `${Math.min(100, p.systemImpact)}%` }} />
                                )}
                             </div>
                             <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow-md z-20 pointer-events-none">
                                {p.systemImpact > 0 ? '+' : ''}{p.systemImpact}%
                             </span>
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-slate-500">
                          {p.usage}%
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-mono font-bold text-base ${p.nis > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{p.nis > 0 ? '+' : ''}{p.nis}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default CoachDashboard;
