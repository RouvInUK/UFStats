import React, { useState, useEffect, useMemo } from 'react';
import { supabase, fetchTournaments, fetchTournamentMatches, fetchTournamentTeams } from '../supabaseClient';
import { Trophy, Users, Star, Award, Shield, CircleDot, Play, Calendar, RefreshCw, ArrowLeft, BarChart3, Eye, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const TournamentProDashboard = ({ onBack, profile }) => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [rawStats, setRawStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('leaders'); // 'leaders' | 'standings' | 'matches'
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [secondsUntilReload, setSecondsUntilReload] = useState(30);
  const [selectedAnalyticsTeamId, setSelectedAnalyticsTeamId] = useState('');
  const [selectedAnalyticsGames, setSelectedAnalyticsGames] = useState([]);
  const [isAnalyticsDropdownOpen, setIsAnalyticsDropdownOpen] = useState(false);
  const [analyticsSortConfig, setAnalyticsSortConfig] = useState({ key: 'touches', direction: 'desc' });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedTournament) return;
    
    // Load immediately
    loadTournamentMetrics(selectedTournament.id);
    setSecondsUntilReload(30);

    // Auto-update every 30 seconds silently in the background
    const interval = setInterval(() => {
      loadTournamentMetrics(selectedTournament.id, true);
      setSecondsUntilReload(30);
    }, 30000);

    // 1-second countdown tick timer
    const timer = setInterval(() => {
      setSecondsUntilReload(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [selectedTournament]);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const tData = await fetchTournaments();
      setTournaments(tData || []);
      if (tData && tData.length > 0) {
        setSelectedTournament(tData[0]);
      }
    } catch (err) {
      setError('Failed to retrieve active tournaments list.');
    } finally {
      setLoading(false);
    }
  };

  const loadTournamentMetrics = async (tid, isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    setError('');
    try {
      // 1. Fetch all matches
      const matchesData = await fetchTournamentMatches(tid);
      setMatches(matchesData || []);

      // 2. Fetch all teams
      const teamsData = await fetchTournamentTeams(tid);
      setTeams(teamsData || []);

      // 3. Fetch all stat events logged under all matches of this tournament
      if (matchesData && matchesData.length > 0) {
        const gameKeys = matchesData.map(m => `tournament_match_${m.id}`);
        const { data: statsData, error: statsErr } = await supabase
          .from('stats')
          .select('*')
          .in('game_name', gameKeys)
          .order('created_at', { ascending: true });

        if (statsErr) throw statsErr;
        
        let mergedStats = statsData || [];
        
        // Merge with local unsynced stats
        try {
          const { keys, get } = await import('idb-keyval');
          const allKeys = await keys();
          
          let localStats = [];
          for (const key of allKeys) {
            if (typeof key === 'string' && key.startsWith('point_')) {
              const pointData = await get(key);
              if (pointData && pointData.stats && !pointData.synced && gameKeys.includes(pointData.gameName)) {
                 localStats.push(...pointData.stats);
              }
            }
          }
          const serverMap = new Map(mergedStats.map(s => [s.id, s]));
          for (const ls of localStats) {
             serverMap.set(ls.id, ls);
          }
          mergedStats = Array.from(serverMap.values());
          // Sort chronological
          mergedStats.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } catch (e) {
          console.warn("Could not merge local stats", e);
        }

        setRawStats(mergedStats);
      } else {
        setRawStats([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to aggregate tournament metrics.');
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // 1. Aggregate Player Metrics (Goals, Assists, D-Blocks, Turnovers)
  const playerStats = useMemo(() => {
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
          blocks: 0,
          turnovers: 0,
          touches: 0
        };
      }
      return playersMap[key];
    };

    rawStats.forEach((stat, index) => {
      // Exclude system logs, opponent scores, lineups, or non-player entities
      if (stat.player === 'System' || stat.player === 'Opponent' || stat.stat_type === 'Match Metadata' || stat.stat_type === 'Lineup' || !stat.player) return;

      const teamId = stat.team_id;
      const teamName = stat.team_name || 'Roster Team';
      const p = ensurePlayer(stat.player, teamId, teamName);
      p.touches += 1; // Any action represents a touch/event contribution

      if (stat.stat_type === 'Point') {
        p.goals += 1;

        // Robust backward-scanning logic for assists
        let passesInPoint = [];
        for (let i = index - 1; i >= 0; i--) {
          const s = rawStats[i];
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
            const assisterPlayer = ensurePlayer(primaryAssisterStat.player, teamId, teamName);
            assisterPlayer.assists += 1;
          }
        }
      } else if (['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)) {
        p.turnovers += 1;
      } else if (stat.stat_type === 'Defence' || stat.stat_type === 'Block') {
        p.blocks += 1;
      }
    });

    return Object.values(playersMap);
  }, [rawStats]);

  // Extract Leaders lists
  const goalLeaders = useMemo(() => [...playerStats].sort((a, b) => b.goals - a.goals || b.touches - a.touches).slice(0, 5), [playerStats]);
  const assistLeaders = useMemo(() => [...playerStats].sort((a, b) => b.assists - a.assists || b.touches - a.touches).slice(0, 5), [playerStats]);
  const blockLeaders = useMemo(() => [...playerStats].sort((a, b) => b.blocks - a.blocks || b.touches - a.touches).slice(0, 5), [playerStats]);

  // 2. Aggregate Team standings from completed and active matches
  const teamStandings = useMemo(() => {
    const standings = {};

    // Initialize all registered teams
    teams.forEach(t => {
      standings[t.id] = {
        id: t.id,
        team_name: t.team_name,
        division: t.division || 'Mixed',
        played: 0,
        wins: 0,
        losses: 0,
        gf: 0, // Goals For
        ga: 0, // Goals Against
        gd: 0, // Goal Difference
        points: 0
      };
    });

    // Process each match to calculate W/L/Scores
    matches.forEach(m => {
      // Ensure team standings rows are initialized
      if (!standings[m.home_team_id]) {
        standings[m.home_team_id] = { id: m.home_team_id, team_name: m.home_team?.team_name || 'Light', division: 'Mixed', played: 0, wins: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 };
      }
      if (!standings[m.away_team_id]) {
        standings[m.away_team_id] = { id: m.away_team_id, team_name: m.away_team?.team_name || 'Dark', division: 'Mixed', played: 0, wins: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 };
      }

      const h = standings[m.home_team_id];
      const a = standings[m.away_team_id];

      // Add scores to totals
      h.gf += m.home_score || 0;
      h.ga += m.away_score || 0;
      a.gf += m.away_score || 0;
      a.ga += m.home_score || 0;

      if (m.status === 'completed') {
        h.played += 1;
        a.played += 1;

        if (m.home_score > m.away_score) {
          h.wins += 1;
          h.points += 3; // 3 points for a win
          a.losses += 1;
        } else if (m.away_score > m.home_score) {
          a.wins += 1;
          a.points += 3;
          h.losses += 1;
        } else {
          // Draws (unlikely in Ultimate, but keep consistent)
          h.points += 1;
          a.points += 1;
        }
      } else if (m.status === 'active') {
        // Active matches are counted in Played but don't commit W/L points yet
        h.played += 1;
        a.played += 1;
      }
    });

    // Calculate Goal Differences and sort standings
    return Object.values(standings)
      .map(s => {
        s.gd = s.gf - s.ga;
        return s;
      })
      .sort((a, b) => b.wins - a.wins || b.gd - a.gd || b.gf - a.gf);
  }, [matches, teams]);

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      // 1. Pin active games to the absolute top
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      // 2. Scheduled games are next, completed games are last
      if (a.status === 'scheduled' && b.status === 'completed') return -1;
      if (a.status === 'completed' && b.status === 'scheduled') return 1;
      
      // 3. Fallback to start_time ordering
      return new Date(a.start_time) - new Date(b.start_time);
    });
  }, [matches]);

  useEffect(() => {
    if (teams && teams.length > 0 && !selectedAnalyticsTeamId) {
      setSelectedAnalyticsTeamId(teams[0].id);
    }
  }, [teams, selectedAnalyticsTeamId]);

  const analyticsGames = useMemo(() => {
    if (!selectedAnalyticsTeamId) return ['All'];
    // Extract unique game names from rawStats where the team belongs
    const teamStats = rawStats.filter(s => s.team_id === selectedAnalyticsTeamId);
    const uniqueGames = [...new Set(teamStats.map(s => s.game_name))].filter(Boolean);
    return ['All', ...uniqueGames];
  }, [rawStats, selectedAnalyticsTeamId]);

  const analyticsPlayerStats = useMemo(() => {
    if (!selectedAnalyticsTeamId) return [];
    
    // Filter stats by selected games if applicable
    const filteredStats = selectedAnalyticsGames.length === 0
      ? rawStats
      : rawStats.filter(s => selectedAnalyticsGames.includes(s.game_name));

    const playersMap = {};
    const ensurePlayer = (name) => {
      if (!playersMap[name]) {
        playersMap[name] = { 
          name, 
          goals: 0, 
          assists: 0, 
          secondaryAssists: 0, 
          defence: 0, 
          throwaways: 0, 
          drops: 0, 
          stallouts: 0, 
          touches: 0, 
          passes: 0, 
          passDropped: 0,
          pointsPlayedSet: new Set(),
          holdsPlayed: 0,
          holdsWon: 0,
          breaksPlayed: 0,
          breaksWon: 0,
          cleanHolds: 0,
          possessionsPlayed: 0,
          goalsOnPitch: 0,
          pulls: 0,
          pullScoreTotal: 0,
          huckPasses: 0,
          huckThrowaways: 0,
          huckAttemptsDropped: 0,
          huckDrops: 0
        };
      }
      return playersMap[name];
    };

    const pointODState = {};
    const currentLineStatePerGame = {};
    const pointOutcomes = {};
    const pointTurnovers = {};
    const pointPossessions = {};
    const pointCleanHolds = {};
    let teamTouchesCount = 0;

    // First scan to determine points played, O/D states, point outcomes
    filteredStats.forEach((stat) => {
      if (!stat.game_name || stat.point_number === undefined) return;
      const pointKey = `${stat.game_name}_${stat.point_number}`;

      if (stat.player && stat.player !== 'System' && stat.player !== 'Opponent' && stat.team_id === selectedAnalyticsTeamId) {
        const p = ensurePlayer(stat.player);
        if (stat.stat_type === 'Lineup') {
          p.pointsPlayedSet.add(pointKey);
        }
      }

      if (!currentLineStatePerGame[stat.game_name]) {
        currentLineStatePerGame[stat.game_name] = 'O'; // Default starting assumption
      }

      if (stat.stat_type === 'Start Offense' && stat.team_id === selectedAnalyticsTeamId) {
        currentLineStatePerGame[stat.game_name] = 'O';
      }
      if (stat.stat_type === 'Start Defense' && stat.team_id === selectedAnalyticsTeamId) {
        currentLineStatePerGame[stat.game_name] = 'D';
      }
      if (stat.stat_type === 'Pull' && stat.team_id === selectedAnalyticsTeamId) {
        currentLineStatePerGame[stat.game_name] = 'D';
      }
      if (stat.stat_type === 'Half Time') {
        currentLineStatePerGame[stat.game_name] = currentLineStatePerGame[stat.game_name] === 'O' ? 'D' : 'O';
      }

      const isLineupOrScore = stat.stat_type === 'Lineup' || stat.stat_type === 'Point' || stat.stat_type === 'Opponent Point';
      if (isLineupOrScore && !pointODState[pointKey]) {
        pointODState[pointKey] = currentLineStatePerGame[stat.game_name];
      }

      if (stat.stat_type === 'Point') {
        const outcome = stat.team_id === selectedAnalyticsTeamId ? 'won' : 'lost';
        pointOutcomes[pointKey] = outcome;
        // Scoring swaps O/D for the next point
        currentLineStatePerGame[stat.game_name] = stat.team_id === selectedAnalyticsTeamId ? 'D' : 'O';
      } else if (stat.stat_type === 'Opponent Point') {
        pointOutcomes[pointKey] = 'lost';
        currentLineStatePerGame[stat.game_name] = 'O';
      }
    });

    // Second scan for detailed actions and stats
    filteredStats.forEach((stat, index) => {
      const SYSTEM_EVENTS = ['Match Metadata', 'Game Completed', 'Start Offense', 'Start Defense', 'Half Time', 'Lineup'];
      if (stat.player === 'System' || stat.player === 'Opponent' || SYSTEM_EVENTS.includes(stat.stat_type) || !stat.player) return;

      const pointKey = `${stat.game_name}_${stat.point_number}`;

      // Only aggregate actions belonging to our target team's players
      if (stat.team_id !== selectedAnalyticsTeamId) return;

      const p = ensurePlayer(stat.player);
      
      if (!stat.stat_type.startsWith('Pull')) {
        p.touches += 1;
        teamTouchesCount += 1;
      }

      if (stat.stat_type === 'Point') {
        p.goals += 1;

        // Backward-scanning assists
        let passesInPoint = [];
        for (let i = index - 1; i >= 0; i--) {
          const s = filteredStats[i];
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
            const assisterPlayer = ensurePlayer(primaryAssisterStat.player);
            assisterPlayer.assists += 1;
          }
        }

        if (passesInPoint.length > 2) {
          const secondaryAssisterStat = passesInPoint[2];
          if (secondaryAssisterStat.player !== stat.player && secondaryAssisterStat.player !== passesInPoint[1].player) {
            const secAssisterPlayer = ensurePlayer(secondaryAssisterStat.player);
            secAssisterPlayer.secondaryAssists += 1;
          }
        }
      } else if (stat.stat_type === 'Pass') {
        let nextGameplayStat = null;
        for (let i = index + 1; i < filteredStats.length; i++) {
          const s = filteredStats[i];
          if (s.game_name !== stat.game_name || s.point_number !== stat.point_number) {
            break;
          }
          if (['Point', 'Pass', 'Throwaway', 'Drop', 'Stall Out', 'Block', 'Defence', 'Opponent Point'].includes(s.stat_type)) {
            nextGameplayStat = s;
            break;
          }
        }

        if (nextGameplayStat && nextGameplayStat.stat_type === 'Drop' && nextGameplayStat.team_id === stat.team_id) {
          p.passDropped += 1;
        } else {
          p.passes += 1; // Completed pass
          if (stat.details?.is_huck || (nextGameplayStat && nextGameplayStat.details?.is_huck && (nextGameplayStat.stat_type === 'Pass' || nextGameplayStat.stat_type === 'Point'))) {
            p.huckPasses += 1;
          }
        }
      } else if (stat.stat_type === 'Pass Attempt') {
        p.passDropped += 1;
        if (stat.details?.is_huck) {
          p.huckAttemptsDropped += 1;
        }
      } else if (stat.stat_type === 'Defence' || stat.stat_type === 'Block') {
        p.defence += 1;
      } else if (stat.stat_type === 'Throwaway') {
        p.throwaways += 1;
        if (stat.details?.is_huck) p.huckThrowaways += 1;
        pointTurnovers[pointKey] = (pointTurnovers[pointKey] || 0) + 1;
      } else if (stat.stat_type === 'Drop') {
        p.drops += 1;
        if (stat.details?.is_huck) p.huckDrops += 1;
        pointTurnovers[pointKey] = (pointTurnovers[pointKey] || 0) + 1;
      } else if (stat.stat_type === 'Stall Out') {
        p.stallouts += 1;
        pointTurnovers[pointKey] = (pointTurnovers[pointKey] || 0) + 1;
      } else if (stat.stat_type === 'Pull') {
        p.pulls += 1;
        if (stat.details?.score !== undefined) {
          p.pullScoreTotal += stat.details.score;
        }
      }
    });

    let globalHoldsPlayed = 0; let globalHoldsWon = 0;
    let globalBreaksPlayed = 0; let globalBreaksWon = 0;

    Object.entries(pointOutcomes).forEach(([ptKey, outcome]) => {
      const turnovers = pointTurnovers[ptKey] || 0;
      if (pointODState[ptKey] === 'O') {
        globalHoldsPlayed++;
        if (outcome === 'won') {
          globalHoldsWon++;
          if (turnovers === 0) pointCleanHolds[ptKey] = true;
        }
      } else {
        globalBreaksPlayed++;
        if (outcome === 'won') globalBreaksWon++;
      }
      pointPossessions[ptKey] = turnovers + (outcome === 'won' ? 1 : 0);
    });

    const globalHoldRate = globalHoldsPlayed > 0 ? globalHoldsWon / globalHoldsPlayed : 0;
    const globalBreakRate = globalBreaksPlayed > 0 ? globalBreaksWon / globalBreaksPlayed : 0;

    const data = Object.values(playersMap).map(p => {
      const turnovers = p.throwaways + p.drops + p.stallouts;
      const pointsPlayed = Math.max(1, p.pointsPlayedSet.size);
      const touchesPerPoint = p.touches / pointsPlayed;
      
      const passAttempts = p.passes + p.throwaways + p.passDropped;
      const compPct = passAttempts > 0 ? (p.passes / passAttempts) * 100 : 0;
      
      const totalHuckAttempts = p.huckPasses + p.huckThrowaways + p.huckAttemptsDropped;
      const totalHuckTurnovers = p.huckThrowaways + p.huckDrops;
      const nis = ((p.goals * 2) + (p.assists * 1.5) + (p.secondaryAssists * 1.5) + (p.defence * 2) + (p.passes * 0.3) + (p.huckPasses * 0.7) - (turnovers * 2) + (totalHuckTurnovers * 0.5)) / pointsPlayed;

      let plusMinus = 0;
      let totalWeightedImpact = 0;

      p.pointsPlayedSet.forEach(ptKey => {
        const outcome = pointOutcomes[ptKey];
        if (outcome === 'won') plusMinus += 1;
        if (outcome === 'lost') plusMinus -= 1;

        if (pointODState[ptKey] === 'O') {
          p.holdsPlayed += 1;
          if (outcome === 'won') {
            p.holdsWon += 1;
            if (pointCleanHolds[ptKey]) p.cleanHolds += 1;
          }
        } else {
          p.breaksPlayed += 1;
          if (outcome === 'won') p.breaksWon += 1;
        }

        p.possessionsPlayed += pointPossessions[ptKey] || 0;
        if (outcome === 'won') p.goalsOnPitch += 1;

        if (outcome === 'won' || outcome === 'lost') {
          const result = outcome === 'won' ? 1 : 0;
          let impact = 0;
          if (pointODState[ptKey] === 'O') {
            impact = result - globalHoldRate;
          } else {
            impact = result - globalBreakRate;
            if (impact > 0) impact *= 2;
          }
          totalWeightedImpact += impact;
        }
      });

      const systemImpact = p.pointsPlayedSet.size > 0 ? parseFloat(((totalWeightedImpact / p.pointsPlayedSet.size) * 100).toFixed(1)) : 0;
      const oce = p.possessionsPlayed > 0 ? parseFloat(((p.goalsOnPitch / p.possessionsPlayed) * 100).toFixed(1)) : 0;
      const ova = (p.cleanHolds * 0.5) + (p.assists * 2.0) + (p.secondaryAssists * 1.5);
      const avgPullScore = p.pulls > 0 ? parseFloat((p.pullScoreTotal / p.pulls).toFixed(2)) : 0;
      const usage = teamTouchesCount > 0 ? parseFloat(((p.touches / teamTouchesCount) * 100).toFixed(1)) : 0;

      return {
        ...p,
        pointsPlayed,
        turnovers,
        touchesPerPoint: parseFloat(touchesPerPoint.toFixed(1)),
        passAttempts,
        compPct,
        totalHuckAttempts,
        systemImpact,
        oce,
        ova: parseFloat(ova.toFixed(1)),
        avgPullScore,
        usage,
        nis: parseFloat(nis.toFixed(2)),
        plusMinus
      };
    });

    return data.sort((a, b) => {
      let aVal = a[analyticsSortConfig.key];
      let bVal = b[analyticsSortConfig.key];

      if (analyticsSortConfig.key === 'gad') {
        aVal = a.goals + a.assists + a.secondaryAssists + a.defence;
        bVal = b.goals + b.assists + b.secondaryAssists + b.defence;
      } else if (analyticsSortConfig.key === 'passes') {
        aVal = a.passes;
        bVal = b.passes;
      } else if (analyticsSortConfig.key === 'huck') {
        aVal = a.huckPasses;
        bVal = b.huckPasses;
      }

      if (aVal < bVal) {
        return analyticsSortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return analyticsSortConfig.direction === 'asc' ? 1 : -1;
      }
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });
  }, [rawStats, selectedAnalyticsTeamId, selectedAnalyticsGames, analyticsSortConfig]);

  const handleAnalyticsSort = (key) => {
    let direction = 'desc';
    if (analyticsSortConfig.key === key && analyticsSortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setAnalyticsSortConfig({ key, direction });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 md:p-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-900 pb-6 mb-8 no-print">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-850 transition-colors">
              <ArrowLeft className="w-5 h-5 text-indigo-400" />
            </button>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              Tournament Pro
              <span className="text-[10px] uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full text-amber-400 font-bold shadow-lg shadow-amber-500/5 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> PRO ANALYTICS
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">Aggregated leaderboard statistics, standings, and active game telemetry</p>
          </div>
        </div>

        {/* Tournament Selector */}
        <div className="flex items-center gap-3 self-stretch md:self-auto shrink-0">
          {tournaments.length > 0 && (
            <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 border border-slate-850 rounded-2xl w-full md:w-auto">
              <Trophy className="w-5 h-5 text-indigo-400 shrink-0" />
              <select
                value={selectedTournament?.id || ''}
                onChange={(e) => setSelectedTournament(tournaments.find(t => t.id === e.target.value))}
                className="bg-transparent text-white font-black text-xs uppercase tracking-wider border-none outline-none focus:ring-0 cursor-pointer pr-8 w-full"
              >
                {tournaments.map(t => (
                  <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 uppercase font-black tracking-wide text-xs">
                    {t.name} ({t.game_type || 'grass'})
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <button
            onClick={() => selectedTournament && loadTournamentMetrics(selectedTournament.id)}
            disabled={loading}
            className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-2xl transition-colors text-indigo-400"
            title="Refresh Leaderboard Stats"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 mb-6 no-print">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-900 pb-4 mb-8 no-print">
        <button
          onClick={() => setActiveTab('leaders')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border ${
            activeTab === 'leaders'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Award className="w-4 h-4" /> Player Leaders
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border ${
            activeTab === 'standings'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Team Stats
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border ${
            activeTab === 'matches'
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CircleDot className="w-4 h-4" /> Game Central
        </button>
        <button
          onClick={() => setActiveTab('pro_plus')}
          className={`flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-black rounded-xl transition-all border no-print ${
            activeTab === 'pro_plus'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-md'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" /> Pro + Analytics
        </button>
      </div>

      {loading && rawStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-slate-900/40 border border-slate-850 rounded-3xl h-80">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <span className="text-xs uppercase tracking-widest text-slate-500 font-black mt-4 animate-pulse">Aggregating tournament telemetry...</span>
        </div>
      ) : (
        <>
          {/* 1. PLAYER LEADERS TAB */}
          {activeTab === 'leaders' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Goals leaders card */}
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
                <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-900 pb-4">
                  <Award className="w-5 h-5 text-indigo-400" /> Goals Leaders
                </h3>
                {goalLeaders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">No goals recorded yet</div>
                ) : (
                  <div className="space-y-4">
                    {goalLeaders.map((p, idx) => (
                      <div key={p.name + p.teamId} className="flex justify-between items-center bg-slate-950/60 p-4 border border-slate-900 rounded-2xl hover:border-indigo-500/20 hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-900 text-slate-400'}`}>
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-sm font-black text-white uppercase tracking-tight block leading-tight">{p.name}</span>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black">{p.teamName}</span>
                          </div>
                        </div>
                        <span className="text-lg font-black text-indigo-400 px-3 py-1 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                          {p.goals} <span className="text-[10px] text-indigo-500 uppercase tracking-widest">G</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assists leaders card */}
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
                <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-900 pb-4">
                  <Star className="w-5 h-5 text-rose-400" /> Assists Leaders
                </h3>
                {assistLeaders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">No assists recorded yet</div>
                ) : (
                  <div className="space-y-4">
                    {assistLeaders.map((p, idx) => (
                      <div key={p.name + p.teamId} className="flex justify-between items-center bg-slate-950/60 p-4 border border-slate-900 rounded-2xl hover:border-rose-500/20 hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-900 text-slate-400'}`}>
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-sm font-black text-white uppercase tracking-tight block leading-tight">{p.name}</span>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black">{p.teamName}</span>
                          </div>
                        </div>
                        <span className="text-lg font-black text-rose-400 px-3 py-1 bg-rose-500/5 rounded-xl border border-rose-500/10">
                          {p.assists} <span className="text-[10px] text-rose-500 uppercase tracking-widest">A</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* D-Blocks leaders card */}
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
                <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-900 pb-4">
                  <Shield className="w-5 h-5 text-emerald-400" /> D-Blocks Leaders
                </h3>
                {blockLeaders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">No blocks recorded yet</div>
                ) : (
                  <div className="space-y-4">
                    {blockLeaders.map((p, idx) => (
                      <div key={p.name + p.teamId} className="flex justify-between items-center bg-slate-950/60 p-4 border border-slate-900 rounded-2xl hover:border-emerald-500/20 hover:scale-[1.01] transition-all">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-900 text-slate-400'}`}>
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-sm font-black text-white uppercase tracking-tight block leading-tight">{p.name}</span>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black">{p.teamName}</span>
                          </div>
                        </div>
                        <span className="text-lg font-black text-emerald-400 px-3 py-1 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                          {p.blocks} <span className="text-[10px] text-emerald-500 uppercase tracking-widest">D</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. TEAM STATS TAB */}
          {activeTab === 'standings' && (
            <div className="bg-slate-900/40 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
              <div className="px-6 py-5 border-b border-slate-900 flex justify-between items-center">
                <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-400" /> Tournament Leaderboard Table
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="py-4 px-6 text-center w-16">Rank</th>
                      <th className="py-4 px-6">Team Name</th>
                      <th className="py-4 px-6">Division</th>
                      <th className="py-4 px-6 text-center w-24">Played</th>
                      <th className="py-4 px-6 text-center w-20">Wins</th>
                      <th className="py-4 px-6 text-center w-20">Losses</th>
                      <th className="py-4 px-6 text-center w-24">Goals For</th>
                      <th className="py-4 px-6 text-center w-24">Goals Against</th>
                      <th className="py-4 px-6 text-center w-24">Diff (GD)</th>
                      <th className="py-4 px-6 text-center w-20">Roster</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStandings.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">No teams registered or active in tournament stats</td>
                      </tr>
                    ) : (
                      teamStandings.map((team, idx) => (
                        <React.Fragment key={team.id}>
                          <tr 
                            className="border-b border-slate-900 hover:bg-slate-900/35 transition-colors font-medium cursor-pointer"
                            onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                          >
                            <td className="py-5 px-6 text-center font-black text-sm text-slate-400">
                              <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center ${idx === 0 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-slate-950 border border-slate-850'}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-5 px-6 font-black text-white uppercase tracking-tight text-sm">
                              {team.team_name}
                            </td>
                            <td className="py-5 px-6 text-xs uppercase font-black text-slate-400">
                              <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                                {team.division}
                              </span>
                            </td>
                            <td className="py-5 px-6 text-center font-mono font-bold text-slate-300">{team.played}</td>
                            <td className="py-5 px-6 text-center font-mono font-bold text-emerald-400">{team.wins}</td>
                            <td className="py-5 px-6 text-center font-mono font-bold text-rose-500">{team.losses}</td>
                            <td className="py-5 px-6 text-center font-mono text-slate-400">{team.gf}</td>
                            <td className="py-5 px-6 text-center font-mono text-slate-400">{team.ga}</td>
                            <td className={`py-5 px-6 text-center font-mono font-black ${team.gd > 0 ? 'text-emerald-400' : team.gd < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                              {team.gd > 0 ? `+${team.gd}` : team.gd}
                            </td>
                            <td className="py-5 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                                className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-850 text-indigo-400 hover:text-white transition-colors"
                              >
                                {expandedTeamId === team.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                          {expandedTeamId === team.id && (
                            <tr className="bg-slate-950/80 border-b border-slate-900">
                              <td colSpan={10} className="py-6 px-8">
                                <div className="bg-slate-900/60 border border-slate-850 rounded-2xl p-6 sm:p-8">
                                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-indigo-400" /> {team.team_name} Player Roster Stats
                                  </h4>
                                  
                                  {(() => {
                                    const teamPlayers = playerStats.filter(p => p.teamId === team.id);
                                    if (teamPlayers.length === 0) {
                                      return (
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider py-4 text-center">
                                          No stats recorded for this team's roster yet
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                          <thead>
                                            <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                              <th className="py-2.5 px-4">Player Name</th>
                                              <th className="py-2.5 px-4 text-center w-24">Goals</th>
                                              <th className="py-2.5 px-4 text-center w-24">Assists</th>
                                              <th className="py-2.5 px-4 text-center w-24">D-Blocks</th>
                                              <th className="py-2.5 px-4 text-center w-24">Turnovers</th>
                                              <th className="py-2.5 px-4 text-center w-24">Touches</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {teamPlayers
                                              .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.touches - a.touches)
                                              .map(p => (
                                                <tr key={p.name} className="border-b border-slate-850/60 hover:bg-slate-950/40 transition-colors font-medium">
                                                  <td className="py-3 px-4 text-xs font-black text-slate-200 uppercase tracking-tight">{p.name}</td>
                                                  <td className="py-3 px-4 text-center font-mono text-sm text-indigo-400 font-bold">{p.goals}</td>
                                                  <td className="py-3 px-4 text-center font-mono text-sm text-rose-400 font-bold">{p.assists}</td>
                                                  <td className="py-3 px-4 text-center font-mono text-sm text-emerald-400 font-bold">{p.blocks}</td>
                                                  <td className="py-3 px-4 text-center font-mono text-sm text-rose-500">{p.turnovers}</td>
                                                  <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">{p.touches}</td>
                                                </tr>
                                              ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. GAME CENTRAL TAB */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <CircleDot className="w-5 h-5 text-indigo-400" /> Match Schedules & Scores
                </h3>
                <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-slate-500">
                  Refreshing in {secondsUntilReload}s
                </span>
              </div>
              
              <div className="relative w-full h-1 bg-slate-900 overflow-hidden rounded-full">
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-indigo-500 transition-all duration-1000 ease-linear rounded-full animate-pulse"
                  style={{ width: `${(secondsUntilReload / 30) * 100}%` }}
                />
              </div>
              
              {sortedMatches.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-16 text-center text-slate-500 font-medium">
                  No scheduled games found in this tournament pool.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {sortedMatches.map(m => {
                    const isExpanded = expandedMatchId === m.id;
                    const matchEvents = rawStats.filter(s => s.game_name === `tournament_match_${m.id}` && s.stat_type !== 'Lineup' && s.stat_type !== 'Match Metadata');
                    
                    return (
                      <div
                        key={m.id}
                        className={`bg-slate-900/40 border border-slate-850 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all shadow-md ${
                          isExpanded ? 'h-auto min-h-48 border-indigo-500/30' : 'h-48 overflow-hidden hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] uppercase tracking-widest font-black bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400">
                              Pitch {m.pitch_number || '1'}
                            </span>
                            {m.status === 'completed' ? (
                              <span className="text-[10px] uppercase tracking-widest font-black bg-slate-950 border border-slate-850 px-3 py-1 rounded-full text-slate-400">
                                Completed
                              </span>
                            ) : m.status === 'active' ? (
                              <span className="text-[10px] uppercase tracking-widest font-black bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 animate-pulse flex items-center gap-1.5 font-bold">
                                <span className="w-1 h-1 rounded-full bg-emerald-400" /> Active
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest font-black bg-slate-950 border border-slate-850 px-3 py-1 rounded-full text-slate-500">
                                Scheduled
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 my-2">
                          <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-base font-black text-white uppercase tracking-tight truncate leading-tight">{m.home_team?.team_name || 'Light'}</span>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black mt-0.5">Light</span>
                          </div>
                          <div className="flex items-center gap-3 text-xl font-black shrink-0 px-3.5 py-1.5 bg-slate-950/80 border border-slate-900 rounded-2xl shadow-inner">
                            <span className="text-indigo-400 font-mono">{m.home_score}</span>
                            <span className="text-slate-800 font-light text-sm">-</span>
                            <span className="text-rose-500 font-mono">{m.away_score}</span>
                          </div>
                          <div className="flex-1 flex flex-col items-end min-w-0">
                            <span className="text-base font-black text-white uppercase tracking-tight truncate leading-tight">{m.away_team?.team_name || 'Dark'}</span>
                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-black mt-0.5">Dark</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-xs font-bold text-slate-500 uppercase tracking-wider mt-1 w-full">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{m.start_time ? new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span>
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMatchId(isExpanded ? null : m.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all text-indigo-400 hover:text-white"
                          >
                            <span>Playlog</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3 text-indigo-400" /> : <ChevronDown className="w-3 h-3 text-indigo-400" />}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-6 border-t border-slate-900 pt-6 animate-fadeIn w-full">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">Timeline Play-By-Play</h4>
                            {matchEvents.length === 0 ? (
                              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider py-4 text-center">
                                No plays recorded yet.
                              </div>
                            ) : (
                              <div className="max-h-60 overflow-y-auto space-y-3 pr-2 custom-scrollbar text-[11px] w-full">
                                {(() => {
                                  const sortedMatchEvents = [...matchEvents].reverse();
                                  return sortedMatchEvents.map((stat, sIdx) => {
                                    const isHome = stat.team_id === m.home_team_id;
                                    return (
                                      <div 
                                        key={stat.id || sIdx} 
                                        className={`flex items-center justify-between p-2.5 border rounded-xl gap-2 ${
                                          isHome 
                                            ? 'bg-indigo-950/20 border-indigo-500/10' 
                                            : 'bg-rose-950/20 border-rose-500/10'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-400">
                                            P{stat.point_number}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[8px] ${
                                            stat.stat_type === 'Point' 
                                              ? 'bg-emerald-500/20 text-emerald-400' 
                                              : stat.stat_type === 'Opponent Point'
                                                ? 'bg-rose-500/20 text-rose-400'
                                                : ['Throwaway', 'Drop', 'Stall Out'].includes(stat.stat_type)
                                                  ? 'bg-amber-500/20 text-amber-400'
                                                  : 'bg-indigo-500/20 text-indigo-300'
                                          }`}>
                                            {stat.stat_type}
                                          </span>
                                          <span className="font-black text-slate-200 uppercase tracking-wide">
                                            {stat.player}
                                          </span>
                                        </div>
                                        <span className="text-slate-500 font-bold uppercase tracking-widest text-[9px] truncate max-w-24 shrink-0">
                                          {stat.team_name}
                                        </span>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. PRO + ANALYTICS TAB */}
          {activeTab === 'pro_plus' && (
            <div className="space-y-6">
              {/* Print-Only Header */}
              {(() => {
                const selectedTeam = teams.find(t => t.id === selectedAnalyticsTeamId);
                return (
                  <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <h1 className="text-3xl font-black text-slate-950 tracking-tight uppercase">Stats Analytics Suite</h1>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-1">Tournament: {selectedTournament?.name || 'Tournament'}</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Team: {selectedTeam?.team_name || 'Roster Team'}</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">
                          {selectedAnalyticsGames.length === 0 
                            ? 'All Pool Matches' 
                            : `Filtered: ${selectedAnalyticsGames.length} Game(s)`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* On-screen control bar (hidden on print) */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-4 border border-slate-850 rounded-2xl no-print mb-6">
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  {/* Team Selector */}
                  <div className="flex items-center gap-3 bg-slate-950 p-2.5 border border-slate-850 rounded-xl w-full sm:w-64">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-black">Team</span>
                    <select
                      value={selectedAnalyticsTeamId}
                      onChange={(e) => {
                        setSelectedAnalyticsTeamId(e.target.value);
                        setSelectedAnalyticsGames([]); // Reset selected games when changing team
                      }}
                      className="bg-transparent text-white font-black text-xs uppercase tracking-wider border-none outline-none focus:ring-0 cursor-pointer pr-8 w-full"
                    >
                      {teams.map(t => (
                        <option key={t.id} value={t.id} className="bg-slate-950 text-slate-200 uppercase font-black tracking-wide text-xs">
                          {t.team_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Games Filter */}
                  <div className="relative w-full sm:w-64">
                    <button 
                      onClick={() => setIsAnalyticsDropdownOpen(!isAnalyticsDropdownOpen)}
                      className="w-full h-full px-4 py-2.5 bg-slate-950 border border-slate-850 text-xs font-black uppercase tracking-wider text-slate-100 rounded-xl flex justify-between items-center gap-4 hover:bg-slate-900 transition-colors shadow-inner"
                    >
                      <span>
                        {selectedAnalyticsGames.length === 0 
                          ? 'Filter Games (All)' 
                          : `Filtered (${selectedAnalyticsGames.length} Game${selectedAnalyticsGames.length > 1 ? 's' : ''})`
                        }
                      </span>
                      <span className="text-slate-400 text-xs">{isAnalyticsDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    
                    {isAnalyticsDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden shadow-2xl">
                        <div className="p-3 border-b border-slate-850 bg-slate-900/50">
                          <label className="flex items-center gap-3 w-full cursor-pointer group px-2">
                            <input 
                              type="checkbox" 
                              checked={selectedAnalyticsGames.length === 0} 
                              onChange={() => setSelectedAnalyticsGames([])}
                              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <span className={`text-xs uppercase tracking-wider ${selectedAnalyticsGames.length === 0 ? 'text-white font-black' : 'text-slate-400 group-hover:text-slate-200'} transition-colors`}>
                              All Games
                            </span>
                          </label>
                        </div>
                        
                        <div className="max-h-[200px] overflow-y-auto p-2 scrollbar-hide">
                          {analyticsGames.filter(g => g !== 'All').map(game => {
                            const matchId = game.replace('tournament_match_', '');
                            const match = matches.find(m => m.id === matchId);
                            const displayName = match 
                              ? `${match.home_team?.team_name || 'Light'} vs ${match.away_team?.team_name || 'Dark'}`
                              : game;
                              
                            const isChecked = selectedAnalyticsGames.includes(game);
                            
                            return (
                              <label key={game} className="flex items-center gap-3 w-full p-2 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors group">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedAnalyticsGames(selectedAnalyticsGames.filter(g => g !== game));
                                    } else {
                                      setSelectedAnalyticsGames([...selectedAnalyticsGames, game]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer bg-slate-950"
                                />
                                <span className={`text-xs uppercase tracking-wider ${isChecked ? 'text-white font-black' : 'text-slate-400 group-hover:text-slate-200'} transition-colors line-clamp-1`}>
                                  {displayName}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PDF Export Button */}
                <button
                  onClick={() => window.print()}
                  className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>Export PDF</span>
                  <span className="text-sm">📄</span>
                </button>
              </div>

              {/* Analytics Table Card */}
              <div className="bg-slate-900/40 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl print-container">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1100px] print-table">
                    <thead>
                      <tr className="border-b border-slate-900 bg-slate-950/40 text-[10px] font-black text-slate-500 uppercase tracking-widest select-none cursor-pointer">
                        <th className="py-4 px-4 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('name')}>
                          Player {analyticsSortConfig.key === 'name' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-16 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('pointsPlayed')} title="Points Played">
                          PP {analyticsSortConfig.key === 'pointsPlayed' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-20 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('touches')} title="Total Touches">
                          Touches {analyticsSortConfig.key === 'touches' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-20 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('touchesPerPoint')} title="Avg Touches per Point">
                          T/Pt {analyticsSortConfig.key === 'touchesPerPoint' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-40 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('gad')} title="Goals / Assists / Secondary Assists / Blocks">
                          G/A/SA/D {analyticsSortConfig.key === 'gad' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-20 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('turnovers')} title="Throwaways / Drops / Stalls">
                          TO {analyticsSortConfig.key === 'turnovers' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-28 hover:text-white transition-colors" title="Completed Passes / Attempted Passes">
                          Passes (C/A)
                        </th>
                        <th className="py-4 px-4 text-center w-20 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('compPct')} title="Pass Completion %">
                          Comp % {analyticsSortConfig.key === 'compPct' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-28 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('huck')} title="Completed Hucks / Attempted Hucks">
                          Deep (C/A) {analyticsSortConfig.key === 'huck' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-24 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('systemImpact')} title="System Impact (Scoring Efficiency Effect)">
                          Impact % {analyticsSortConfig.key === 'systemImpact' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-24 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('oce')} title="Offensive Conversion Efficiency">
                          OCE % {analyticsSortConfig.key === 'oce' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-center w-20 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('ova')} title="Offensive Value Added">
                          OVA {analyticsSortConfig.key === 'ova' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                        <th className="py-4 px-4 text-right w-20 hover:text-white transition-colors" onClick={() => handleAnalyticsSort('nis')} title="Net Impact Score (Efficiency per Point)">
                          NIS {analyticsSortConfig.key === 'nis' ? (analyticsSortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsPlayerStats.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                            {(() => {
                              const selectedTeam = teams.find(t => t.id === selectedAnalyticsTeamId);
                              return `No stats recorded for ${selectedTeam?.team_name || 'this team'} yet.`;
                            })()}
                          </td>
                        </tr>
                      ) : (
                        analyticsPlayerStats.map((row) => (
                          <tr key={row.name} className="border-b border-slate-900 hover:bg-slate-900/35 transition-colors font-medium">
                            <td className="py-4 px-4 font-black text-white uppercase tracking-tight text-xs print-text-black">
                              <div className="flex flex-col gap-0.5 items-start">
                                <span className="text-slate-100 print-text-black">{row.name}</span>
                                <span className={`px-1.5 py-0.5 text-[8px] uppercase tracking-widest font-black rounded-sm print-badge ${
                                  row.plusMinus > 0 
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                                    : row.plusMinus < 0 
                                      ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                                      : 'bg-slate-950 border border-slate-850 text-slate-400'
                                }`}>
                                  {row.plusMinus > 0 ? '+' : ''}{row.plusMinus} On/Off
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-slate-300 text-xs print-text-black">{row.pointsPlayed}</td>
                            <td className="py-4 px-4 text-center font-mono text-slate-400 text-xs print-text-black">{row.touches}</td>
                            <td className="py-4 px-4 text-center font-mono text-slate-300 text-xs print-text-black">{row.touchesPerPoint}</td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1 font-mono text-xs">
                                <span className="text-emerald-400 font-bold">{row.goals}</span>
                                <span className="text-slate-700">/</span>
                                <span className="text-indigo-400 font-bold">{row.assists}</span>
                                <span className="text-slate-700">/</span>
                                <span className="text-purple-400 font-bold" title="Secondary Assists">{row.secondaryAssists}</span>
                                <span className="text-slate-700">/</span>
                                <span className="text-amber-400 font-bold">{row.defence}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-flex items-center justify-center font-mono text-xs ${row.turnovers > 0 ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                                {row.turnovers}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-slate-400 text-xs print-text-black">
                              <span className="text-white font-bold print-text-black">{row.passes}</span> / {row.passAttempts}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 font-bold rounded text-[10px] print-badge ${
                                row.compPct >= 90 
                                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                                  : row.compPct >= 75 
                                    ? 'bg-slate-950 border border-slate-850 text-slate-300' 
                                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                              }`}>
                                {row.passAttempts > 0 ? `${Math.round(row.compPct)}%` : '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-slate-400 text-xs print-text-black">
                              <span className="text-slate-200 font-bold print-text-black">{row.huckPasses}</span> / {row.totalHuckAttempts}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 font-bold rounded text-[10px] print-badge ${
                                row.systemImpact > 0 
                                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                                  : row.systemImpact < 0 
                                    ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' 
                                    : 'text-slate-400 bg-slate-950 border border-slate-850'
                              }`}>
                                {row.systemImpact > 0 ? '+' : ''}{row.systemImpact}%
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-950 border border-slate-850 text-slate-300 print-badge">
                                {row.oce > 0 ? `${row.oce}%` : '-'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center font-mono text-slate-300 text-xs print-text-black">{row.ova}</td>
                            <td className="py-4 px-4 text-right">
                              <span className={`inline-flex px-1.5 py-0.5 font-bold rounded text-[10px] print-badge ${
                                row.nis > 0 
                                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' 
                                  : row.nis < 0 
                                    ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20' 
                                    : 'text-slate-400 bg-slate-950 border border-slate-850'
                              }`}>
                                {row.nis > 0 ? '+' : ''}{row.nis}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Embedded Print CSS */}
              <style>{`
                @media print {
                  body, html, #root {
                    background: white !important;
                    color: black !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .print-container {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                  .print-table {
                    width: 100% !important;
                    min-width: 100% !important;
                    color: black !important;
                    border-collapse: collapse !important;
                  }
                  .print-table th {
                    color: #475569 !important;
                    border-bottom: 2px solid #cbd5e1 !important;
                    font-weight: 900 !important;
                    background: transparent !important;
                  }
                  .print-table td {
                    color: #0f172a !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                    background: transparent !important;
                  }
                  .print-text-black {
                    color: black !important;
                  }
                  .print-badge {
                    background: transparent !important;
                    border: 1px solid #cbd5e1 !important;
                    color: black !important;
                    box-shadow: none !important;
                  }
                }
              `}</style>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TournamentProDashboard;
