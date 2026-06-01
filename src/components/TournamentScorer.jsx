import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { addStatToLocalPoint, removeStatLocally, getLastLocalStat, upgradeLastStatToHuck, getPendingSyncCount, attemptSync, clearLocalQueue, clearMatchLocalQueue, getLocalStatsForGame, updateLocalStatPlayer } from '../SyncEngine';
import { Target, AlertTriangle, ArrowLeft, Shield, Check, Undo2, Star, Play, CircleAlert, CheckCircle, RefreshCw } from 'lucide-react';
import { playChime, playClick, playBuzz } from '../utils/audioFeedback';

const TournamentScorer = ({ seat, onBack }) => {
  const match = seat?.tournament_matches;
  const matchId = match?.id;
  const tournamentId = seat?.tournament_id;
  const pitchCode = seat?.pitch_code;
  const division = match?.home_team?.division || 'Standard Mixed';
  
  // Intelligent format resolution: uses explicit database tournament format, or falls back to division keywords
  const divisionLower = division.toLowerCase();
  const isBeachOrLight = divisionLower.includes('beach') || divisionLower.includes('light') || divisionLower.includes('indoor');
  const resolvedGameType = match?.tournament?.game_type || (isBeachOrLight ? 'beach' : 'grass');
  const gameType = resolvedGameType === 'indoor' ? 'indoor' : (resolvedGameType === 'beach' ? 'beach' : 'grass');
  const expectedPlayersCount = gameType === 'grass' ? 7 : 5;

  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  
  const [homeLineup, setHomeLineup] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_home_lineup_${matchId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [awayLineup, setAwayLineup] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_away_lineup_${matchId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  // Game Play States
  const [isPointInProgress, setIsPointInProgress] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_is_point_in_progress_${matchId}`);
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  const [homeScore, setHomeScore] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_home_score_${matchId}`);
      return saved !== null ? parseInt(saved, 10) : (match?.home_score || 0);
    } catch (e) {
      return match?.home_score || 0;
    }
  });

  const [awayScore, setAwayScore] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_away_score_${matchId}`);
      return saved !== null ? parseInt(saved, 10) : (match?.away_score || 0);
    } catch (e) {
      return match?.away_score || 0;
    }
  });

  const [pointNumber, setPointNumber] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_point_number_${matchId}`);
      return saved !== null ? parseInt(saved, 10) : 1;
    } catch (e) {
      return 1;
    }
  });

  const [possessionTeam, setPossessionTeam] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_possession_team_${matchId}`);
      return saved ? saved : 'Home';
    } catch (e) {
      return 'Home';
    }
  });

  const [possessionChain, setPossessionChain] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_possession_chain_${matchId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const activePossessionPlayer = possessionChain.length > 0 ? possessionChain[possessionChain.length - 1] : null;

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_active_tab_${matchId}`);
      return saved ? saved : 'Home';
    } catch (e) {
      return 'Home';
    }
  });

  const [isHalftimeCalled, setIsHalftimeCalled] = useState(() => {
    try {
      const saved = localStorage.getItem(`scorer_is_halftime_called_${matchId}`);
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_is_halftime_called_${matchId}`, JSON.stringify(isHalftimeCalled));
    }
  }, [isHalftimeCalled, matchId]);

  const [huckThrowerId, setHuckThrowerId] = useState(null);
  const isHuckPending = !!huckThrowerId;
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activeTab === 'Home') {
      setActiveTab('Away');
    } else if (isRightSwipe && activeTab === 'Away') {
      setActiveTab('Home');
    }
  };
  
  // Roster setup and stats log
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [ignoreWarning, setIgnoreWarning] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline'
  const [pendingCount, setPendingCount] = useState(0);

  const [matchStats, setMatchStats] = useState([]);
  const [editingStatId, setEditingStatId] = useState(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);

  const loadRecentStats = async () => {
    if (!matchId) return;
    const matchKey = `tournament_match_${matchId}`;
    const stats = await getLocalStatsForGame(matchKey);
    setMatchStats(stats || []);
  };

  useEffect(() => {
    const handleSyncStatus = async (e) => {
      setSyncStatus(e.detail);
      const count = await getPendingSyncCount();
      setPendingCount(count);
      loadRecentStats();
    };

    window.addEventListener('sync-status', handleSyncStatus);
    
    getPendingSyncCount().then(setPendingCount);
    loadRecentStats();

    return () => {
      window.removeEventListener('sync-status', handleSyncStatus);
    };
  }, [matchId]);

  const [firstPointOffense, setFirstPointOffense] = useState(null); // 'Home' | 'Away'

  useEffect(() => {
    if (matchId) {
      if (match?.status === 'scheduled') {
        clearScorerLocalStorage(matchId);
        clearMatchLocalQueue(`tournament_match_${matchId}`);
        setHomeLineup([]);
        setAwayLineup([]);
        setIsPointInProgress(false);
        setHomeScore(0);
        setAwayScore(0);
        setPointNumber(1);
        setPossessionTeam('Home');
        setPossessionChain([]);
        setActiveTab('Home');
        setIsHalftimeCalled(false);
      }
      loadRosters();
      loadRecentStats();
      const saved = localStorage.getItem(`first_offense_${matchId}`);
      if (saved) {
        setFirstPointOffense(saved);
      } else {
        setFirstPointOffense(null);
      }
    }
  }, [matchId, match?.status]);

  const clearScorerLocalStorage = (id) => {
    if (!id) return;
    localStorage.removeItem(`scorer_home_lineup_${id}`);
    localStorage.removeItem(`scorer_away_lineup_${id}`);
    localStorage.removeItem(`scorer_is_point_in_progress_${id}`);
    localStorage.removeItem(`scorer_home_score_${id}`);
    localStorage.removeItem(`scorer_away_score_${id}`);
    localStorage.removeItem(`scorer_point_number_${id}`);
    localStorage.removeItem(`scorer_possession_team_${id}`);
    localStorage.removeItem(`scorer_active_possession_player_${id}`);
    localStorage.removeItem(`scorer_possession_chain_${id}`);
    localStorage.removeItem(`scorer_active_tab_${id}`);
    localStorage.removeItem(`first_offense_${id}`);
    localStorage.removeItem(`scorer_is_halftime_called_${id}`);
  };

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_home_lineup_${matchId}`, JSON.stringify(homeLineup));
    }
  }, [homeLineup, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_away_lineup_${matchId}`, JSON.stringify(awayLineup));
    }
  }, [awayLineup, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_is_point_in_progress_${matchId}`, JSON.stringify(isPointInProgress));
    }
  }, [isPointInProgress, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_home_score_${matchId}`, homeScore.toString());
    }
  }, [homeScore, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_away_score_${matchId}`, awayScore.toString());
    }
  }, [awayScore, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_point_number_${matchId}`, pointNumber.toString());
    }
  }, [pointNumber, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_possession_team_${matchId}`, possessionTeam);
    }
  }, [possessionTeam, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_possession_chain_${matchId}`, JSON.stringify(possessionChain));
    }
  }, [possessionChain, matchId]);

  useEffect(() => {
    if (matchId) {
      localStorage.setItem(`scorer_active_tab_${matchId}`, activeTab);
    }
  }, [activeTab, matchId]);

  const loadRosters = async () => {
    if (!matchId) return;
    setLoading(true);
    setError('');
    try {
      const { data: homeP, error: homeError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', match.home_team_id)
        .order('name', { ascending: true });

      if (homeError) throw homeError;
      setHomePlayers(homeP || []);

      const { data: awayP, error: awayError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', match.away_team_id)
        .order('name', { ascending: true });

      if (awayError) throw awayError;
      setAwayPlayers(awayP || []);
    } catch (err) {
      setError('Failed to retrieve team rosters from server.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate MMP and FMP counts in active lineup
  const homeRatio = useMemo(() => {
    let mmp = 0; let fmp = 0; let none = 0;
    homeLineup.forEach(p => {
      if (p.gender_designation === 'mmp') mmp++;
      else if (p.gender_designation === 'fmp') fmp++;
      else none++;
    });
    return { mmp, fmp, none };
  }, [homeLineup]);

  const awayRatio = useMemo(() => {
    let mmp = 0; let fmp = 0; let none = 0;
    awayLineup.forEach(p => {
      if (p.gender_designation === 'mmp') mmp++;
      else if (p.gender_designation === 'fmp') fmp++;
      else none++;
    });
    return { mmp, fmp, none };
  }, [awayLineup]);

  // Mixed Gender Ratio Auditor
  useEffect(() => {
    setWarningMessage('');
    if (division === 'Standard Mixed') {
      const homeTotal = homeLineup.length;
      const awayTotal = awayLineup.length;

      if (homeTotal > 0 && homeTotal !== expectedPlayersCount) {
        setWarningMessage(`Standard Mixed rules require exactly ${expectedPlayersCount} players rostered on the pitch.`);
        return;
      }
      
      if (gameType === 'grass') {
        if (homeRatio.mmp > 4 || homeRatio.fmp > 4) {
          setWarningMessage('Standard Mixed (Rule A/B/B/A) ratio constraints require either 4 MMP / 3 FMP or 3 MMP / 4 FMP.');
          return;
        }
      } else {
        // Beach/Indoor (5v5)
        if (homeRatio.mmp > 3 || homeRatio.fmp > 3) {
          setWarningMessage('Standard Beach/Indoor Mixed ratio constraints require either 3 MMP / 2 FMP or 2 MMP / 3 FMP.');
          return;
        }
      }

      if (awayTotal > 0 && awayTotal !== expectedPlayersCount) {
        setWarningMessage(`Standard Mixed rules require exactly ${expectedPlayersCount} players rostered on the pitch.`);
        return;
      }

      if (gameType === 'grass') {
        if (awayRatio.mmp > 4 || awayRatio.fmp > 4) {
          setWarningMessage('Standard Mixed (Rule A/B/B/A) ratio constraints require either 4 MMP / 3 FMP or 3 MMP / 4 FMP.');
          return;
        }
      } else {
        // Beach/Indoor (5v5)
        if (awayRatio.mmp > 3 || awayRatio.fmp > 3) {
          setWarningMessage('Standard Beach/Indoor Mixed ratio constraints require either 3 MMP / 2 FMP or 2 MMP / 3 FMP.');
          return;
        }
      }
    } else if (division === 'Light Mixed') {
      if (homeLineup.length > 0 && homeRatio.fmp < 2) {
        setWarningMessage('Light Beach Mixed division guidelines require at least 2 FMP active on the sand.');
        return;
      }
      if (awayLineup.length > 0 && awayRatio.fmp < 2) {
        setWarningMessage('Light Beach Mixed division guidelines require at least 2 FMP active on the sand.');
        return;
      }
    }
  }, [homeLineup, awayLineup, division, homeRatio, awayRatio, expectedPlayersCount, gameType]);

  const toggleHomePlayer = (player) => {
    setHomeLineup(prev => 
      prev.some(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : [...prev, player].slice(0, expectedPlayersCount)
    );
    setIgnoreWarning(false);
  };

  const toggleAwayPlayer = (player) => {
    setAwayLineup(prev => 
      prev.some(p => p.id === player.id)
        ? prev.filter(p => p.id !== player.id)
        : [...prev, player].slice(0, expectedPlayersCount)
    );
    setIgnoreWarning(false);
  };

  const handleStartPoint = async () => {
    setHuckThrowerId(null);
    if (warningMessage && !ignoreWarning) {
      alert(`Soft Ratio Warning: ${warningMessage} Please select "Ignore Warning" if you have a special lineup arrangement.`);
      return;
    }

    setProcessing(true);
    try {
      const matchKey = `tournament_match_${matchId}`;
      
      // Log Lineups to database
      const lineupStats = [
        ...homeLineup.map(p => ({
          game_name: matchKey,
          point_number: pointNumber,
          stat_type: 'Lineup',
          team_id: match.home_team_id,
          team_name: match.home_team?.team_name,
          player: p.name,
          game_type: gameType,
          details: { pitch_code: pitchCode }
        })),
        ...awayLineup.map(p => ({
          game_name: matchKey,
          point_number: pointNumber,
          stat_type: 'Lineup',
          team_id: match.away_team_id,
          team_name: match.away_team?.team_name,
          player: p.name,
          game_type: gameType,
          details: { pitch_code: pitchCode }
        }))
      ];

      for (const stat of lineupStats) {
        await addStatToLocalPoint(matchKey, pointNumber, stat);
      }

      // Automatically transition match status to 'active' in the database when scoring starts
      if (match.status === 'scheduled') {
        const { error: statusErr } = await supabase
          .from('tournament_matches')
          .update({ status: 'active' })
          .eq('id', matchId);
        if (!statusErr) {
          match.status = 'active'; // Sync local match object
        }
      }

      if (pointNumber === 1) {
        localStorage.setItem(`first_offense_${matchId}`, possessionTeam);
        setFirstPointOffense(possessionTeam);
      }

      setActiveTab(possessionTeam);
      setIsPointInProgress(true);
      setIgnoreWarning(false);
    } catch (err) {
      setError('Failed to initialize point lineups.');
    } finally {
      setProcessing(false);
    }
  };

  const handleHalftime = () => {
    setHuckThrowerId(null);
    const savedFirstOffense = localStorage.getItem(`first_offense_${matchId}`);
    const currentFirstOffense = savedFirstOffense || firstPointOffense || 'Home';
    const nextOffense = currentFirstOffense === 'Home' ? 'Away' : 'Home';
    setPossessionTeam(nextOffense);
    
    // Log halftime event to stats table for telemetry completeness
    const matchKey = `tournament_match_${matchId}`;
    supabase.from('stats').insert({
      game_name: matchKey,
      point_number: pointNumber,
      stat_type: 'Match Metadata',
      player: 'System',
      team_name: 'Telemetry',
      game_type: gameType,
      details: { event: 'Halftime', pitch_code: pitchCode }
    }).then(() => {}).catch(() => {});

    setIsHalftimeCalled(true);
    alert(`Halftime toggled. Starting offense set automatically to ${nextOffense === 'Home' ? (match?.home_team?.team_name || 'Light') : (match?.away_team?.team_name || 'Dark')}.`);
  };

  const handlePlayerSelect = (player) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate && localStorage.getItem('ufstats_haptic_enabled') !== 'false') {
      try { navigator.vibrate(30); } catch (e) {}
    }
    playClick();

    setPossessionChain(prev => {
      if (prev.length > 0 && prev[prev.length - 1].id === player.id) {
        return prev;
      }

      const newChain = [...prev, player];

      if (prev.length >= 2) {
        const thrower = prev[prev.length - 2];
        handleAction(thrower, 'Pass', prev);
      }

      return newChain;
    });
  };

  const handleTap = (playerOrId, singleAction) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate && localStorage.getItem('ufstats_haptic_enabled') !== 'false') {
      try { navigator.vibrate(30); } catch (e) {}
    }
    singleAction();
  };

  const handleEditStat = (stat) => {
    setEditingStatId(stat.id);
    setEditingPlayerName(stat.player);
  };

  const handleSaveStatEdit = async (statId) => {
    setProcessing(true);
    const matchKey = `tournament_match_${matchId}`;
    try {
      const success = await updateLocalStatPlayer(matchKey, statId, editingPlayerName);
      if (success) {
        setEditingStatId(null);
        loadRecentStats();
      }
    } catch (err) {
      alert("Failed to update event.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteStat = async (statId) => {
    if (!window.confirm("Are you sure you want to permanently delete this logged event?")) return;
    setProcessing(true);
    try {
      await removeStatLocally(statId);
      loadRecentStats();
    } catch (err) {
      alert("Failed to delete event.");
    } finally {
      setProcessing(false);
    }
  };

  const getAvailablePlayersForStat = (stat) => {
    if (stat.team_id === match.home_team_id) return homePlayers;
    if (stat.team_id === match.away_team_id) return awayPlayers;
    return [...homePlayers, ...awayPlayers];
  };

  const handleAction = async (player, actionType, overrideChain = null) => {
    setProcessing(true);
    const matchKey = `tournament_match_${matchId}`;
    const activeTeam = possessionTeam === 'Home' ? match.home_team : match.away_team;
    const activeTeamId = possessionTeam === 'Home' ? match.home_team_id : match.away_team_id;

    let actionTeamId = activeTeamId;
    let actionTeamName = activeTeam?.team_name;

    if (player && player.team_id) {
      actionTeamId = player.team_id;
      actionTeamName = player.team_id === match.home_team_id 
        ? match.home_team?.team_name 
        : match.away_team?.team_name;
    } else if (actionType === 'Defence' || actionType === 'Block') {
      // Generic defense action without a specific player
      const defendingTeam = possessionTeam === 'Home' ? 'Away' : 'Home';
      actionTeamId = defendingTeam === 'Home' ? match.home_team_id : match.away_team_id;
      actionTeamName = defendingTeam === 'Home' ? match.home_team?.team_name : match.away_team?.team_name;
    }

    try {
      const currentChain = overrideChain || possessionChain;
      const activePlayer = player || (currentChain.length > 0 ? currentChain[currentChain.length - 1] : null);

      const createPayload = (p, type, details = {}) => {
        const pTeamId = p?.team_id || actionTeamId;
        const pTeamName = p?.team_id 
          ? (p.team_id === match.home_team_id ? match.home_team?.team_name : match.away_team?.team_name)
          : actionTeamName;
        return {
          game_name: matchKey,
          point_number: pointNumber,
          stat_type: type,
          team_id: pTeamId,
          team_name: pTeamName,
          player: p?.name || 'Opponent',
          game_type: gameType,
          details: { ...details, pitch_code: pitchCode }
        };
      };

      // Check if this action is a huck (deep throw)
      let throwerIdOfAction = null;
      if (actionType === 'Pass') {
        throwerIdOfAction = player?.id;
      } else if (actionType === 'Point') {
        const pendingPasser = activePlayer && currentChain.length > 1 && currentChain[currentChain.length - 1].id === activePlayer.id
          ? currentChain[currentChain.length - 2] : null;
        throwerIdOfAction = pendingPasser?.id;
      } else if (['Drop', 'Throwaway', 'Stall Out'].includes(actionType)) {
        if (activePlayer && currentChain.length > 1 && currentChain[currentChain.length - 1].id === activePlayer.id) {
          const thrower = currentChain[currentChain.length - 2];
          throwerIdOfAction = thrower?.id;
        } else {
          throwerIdOfAction = activePlayer?.id;
        }
      }

      const isHuck = throwerIdOfAction && throwerIdOfAction === huckThrowerId;
      const huckDetails = isHuck ? { is_huck: true } : {};

      // Execute stats logging sequential inserts
      if (actionType === 'Point') {
        let pendingPasser = null;
        if (activePlayer && currentChain.length > 1 && currentChain[currentChain.length - 1].id === activePlayer.id) {
          pendingPasser = currentChain[currentChain.length - 2];
        }

        if (pendingPasser) {
          const passPayload = createPayload(pendingPasser, 'Pass', huckDetails);
          await addStatToLocalPoint(matchKey, pointNumber, passPayload);
        }

        const pointPayload = createPayload(activePlayer, 'Point');
        await addStatToLocalPoint(matchKey, pointNumber, pointPayload);

        // We scored! Update score locally
        if (possessionTeam === 'Home') {
          const newScore = homeScore + 1;
          setHomeScore(newScore);
          await supabase.from('tournament_matches').update({ home_score: newScore }).eq('id', matchId);
        } else {
          const newScore = awayScore + 1;
          setAwayScore(newScore);
          await supabase.from('tournament_matches').update({ away_score: newScore }).eq('id', matchId);
        }
        
        playChime(); // Audio feedback for point scored
        setIsPointInProgress(false);
        setPointNumber(prev => prev + 1);
        setPossessionChain([]);
        setHomeLineup([]);
        setAwayLineup([]);
        // Scored, now pull on defense
        setPossessionTeam(possessionTeam === 'Home' ? 'Away' : 'Home');

      } else if (actionType === 'Drop') {
        if (activePlayer && currentChain.length > 1 && currentChain[currentChain.length - 1].id === activePlayer.id) {
          const thrower = currentChain[currentChain.length - 2];
          const passAttemptPayload = createPayload(thrower, 'Pass Attempt', huckDetails);
          await addStatToLocalPoint(matchKey, pointNumber, passAttemptPayload);
        }

        const dropPayload = createPayload(activePlayer, 'Drop', huckDetails);
        await addStatToLocalPoint(matchKey, pointNumber, dropPayload);

        playBuzz(); // Audio feedback for turnover
        setTimeout(() => {
          const nextTeam = possessionTeam === 'Home' ? 'Away' : 'Home';
          setPossessionTeam(nextTeam);
          setActiveTab(nextTeam);
          setPossessionChain([]);
        }, 250);

      } else if (['Throwaway', 'Stall Out'].includes(actionType)) {
        if (activePlayer && currentChain.length > 1 && currentChain[currentChain.length - 1].id === activePlayer.id) {
          const thrower = currentChain[currentChain.length - 2];
          const passPayload = createPayload(thrower, 'Pass', huckDetails);
          await addStatToLocalPoint(matchKey, pointNumber, passPayload);
        }

        const turnoverPayload = createPayload(activePlayer, actionType, huckDetails);
        await addStatToLocalPoint(matchKey, pointNumber, turnoverPayload);

        playBuzz(); // Audio feedback for turnover
        setTimeout(() => {
          const nextTeam = possessionTeam === 'Home' ? 'Away' : 'Home';
          setPossessionTeam(nextTeam);
          setActiveTab(nextTeam);
          setPossessionChain([]);
        }, 250);

      } else if (actionType === 'Defence' || actionType === 'Block') {
        const defensePayload = createPayload(player, actionType);
        await addStatToLocalPoint(matchKey, pointNumber, defensePayload);

        playChime(); // Audio feedback for defensive block
        const nextTeam = possessionTeam === 'Home' ? 'Away' : 'Home';
        setPossessionTeam(nextTeam);
        setActiveTab(nextTeam);
        setPossessionChain([]);

      } else if (actionType === 'Pass') {
        const passPayload = createPayload(player, 'Pass', huckDetails);
        await addStatToLocalPoint(matchKey, pointNumber, passPayload);
        playClick(); // Audio feedback for completed pass

      } else {
        const payload = createPayload(player, actionType);
        await addStatToLocalPoint(matchKey, pointNumber, payload);
        playClick();
      }

      loadRecentStats();
    } catch (err) {
      console.error(err);
      setError('Failed to log stats event.');
    } finally {
      setProcessing(false);
      setHuckThrowerId(null);
    }
  };

  const handleOpponentScore = async () => {
    setProcessing(true);
    const matchKey = `tournament_match_${matchId}`;
    const activeTeamId = possessionTeam === 'Home' ? match.away_team_id : match.home_team_id;
    const activeTeam = possessionTeam === 'Home' ? match.away_team : match.home_team;

    try {
      const payload = {
        game_name: matchKey,
        point_number: pointNumber,
        stat_type: 'Opponent Point',
        team_id: activeTeamId,
        team_name: activeTeam?.team_name,
        player: 'Opponent',
        game_type: gameType,
        details: { pitch_code: pitchCode }
      };

      await addStatToLocalPoint(matchKey, pointNumber, payload);

      if (possessionTeam === 'Home') {
        const newScore = awayScore + 1;
        setAwayScore(newScore);
        await supabase.from('tournament_matches').update({ away_score: newScore }).eq('id', matchId);
      } else {
        const newScore = homeScore + 1;
        setHomeScore(newScore);
        await supabase.from('tournament_matches').update({ home_score: newScore }).eq('id', matchId);
      }

      setIsPointInProgress(false);
      setPointNumber(prev => prev + 1);
      setPossessionChain([]);
      setHomeLineup([]);
      setAwayLineup([]);
      // Scored on, now receive on offense
      setPossessionTeam(possessionTeam === 'Home' ? 'Home' : 'Away');
      loadRecentStats();
    } catch (err) {
      setError('Failed to log opponent score.');
    } finally {
      setProcessing(false);
      setHuckThrowerId(null);
    }
  };

  const handleUpgradeHuck = async () => {
    setProcessing(true);
    const matchKey = `tournament_match_${matchId}`;
    try {
      const upgraded = await upgradeLastStatToHuck(matchKey, possessionTeam === 'Home' ? match.home_team_id : match.away_team_id);
      if (upgraded) {
        loadRecentStats();
      } else {
        alert('No eligible completed pass found to upgrade.');
      }
    } catch (err) {
      alert('Failed to upgrade huck.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUndo = async () => {
    setProcessing(true);
    const matchKey = `tournament_match_${matchId}`;
    try {
      const lastStat = await getLastLocalStat(matchKey);
      if (!lastStat) {
        alert('No events to undo.');
        setProcessing(false);
        return;
      }

      await removeStatLocally(lastStat.id);

      // If we just undid a turnover, opponent point, or point, the system likely logged a "Pass" or "Pass Attempt" 
      // immediately before it for the previous player. We need to delete that too to fully revert the action.
      if (['Drop', 'Throwaway', 'Stall Out', 'Opponent Point', 'Point'].includes(lastStat.stat_type)) {
        const nextLast = await getLastLocalStat(matchKey);
        if (nextLast && (nextLast.stat_type === 'Pass Attempt' || nextLast.stat_type === 'Pass')) {
          if (nextLast.point_number === lastStat.point_number) {
            await removeStatLocally(nextLast.id);
          }
        }
      }

      if (lastStat.stat_type === 'Pass') {
        setPossessionChain(prev => prev.slice(0, -1));
      } else {
        setPossessionChain([]);
      }

      // Rollback game state
      if (lastStat.stat_type === 'Point') {
        setPointNumber(prev => Math.max(1, prev - 1));
        setIsPointInProgress(true);
        if (lastStat.team_id === match.home_team_id) {
          setHomeScore(prev => Math.max(0, prev - 1));
          setPossessionTeam('Home');
          setActiveTab('Home');
        } else {
          setAwayScore(prev => Math.max(0, prev - 1));
          setPossessionTeam('Away');
          setActiveTab('Away');
        }
      } else if (lastStat.stat_type === 'Opponent Point') {
        setPointNumber(prev => Math.max(1, prev - 1));
        setIsPointInProgress(true);
        if (lastStat.team_id === match.home_team_id) {
          setAwayScore(prev => Math.max(0, prev - 1));
          setPossessionTeam('Away');
          setActiveTab('Away');
        } else {
          setHomeScore(prev => Math.max(0, prev - 1));
          setPossessionTeam('Home');
          setActiveTab('Home');
        }
      } else if (['Throwaway', 'Drop', 'Stall Out', 'Defence', 'Block'].includes(lastStat.stat_type)) {
        const nextTeam = possessionTeam === 'Home' ? 'Away' : 'Home';
        setPossessionTeam(nextTeam);
        setActiveTab(nextTeam);
      }

      alert('Last event undone successfully!');
      loadRecentStats();
    } catch (err) {
      setError('Undo process failed.');
    } finally {
      setProcessing(false);
      setHuckThrowerId(null);
    }
  };

  const handleEndMatch = async () => {
    if (!window.confirm('Are you sure you want to end this match and finalize the bracket score?')) return;
    setProcessing(true);
    try {
      await supabase.from('tournament_matches').update({ status: 'completed' }).eq('id', matchId);
      await supabase.from('tournament_scorer_seats').update({ active: false }).eq('pitch_code', pitchCode);
      clearScorerLocalStorage(matchId);
      alert('Match completed! Pitch access code successfully deactivated.');
      onBack();
    } catch (err) {
      setError('Failed to complete match.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClearConsoleCache = async () => {
    if (!window.confirm("Are you sure you want to discard all local points and stats stored in this scorer terminal?\n\nThis will clear any pending sync events for all games from this device. Use this only if the tournament scores were reset or you want to start fresh. This cannot be undone.")) return;
    
    setProcessing(true);
    try {
      await clearLocalQueue();
      clearScorerLocalStorage(matchId);
      setPendingCount(0);
      
      setHomeLineup([]);
      setAwayLineup([]);
      setIsPointInProgress(false);
      setHomeScore(match?.home_score || 0);
      setAwayScore(match?.away_score || 0);
      setPointNumber(1);
      setPossessionTeam('Home');
      setPossessionChain([]);
      setActiveTab('Home');
      setIsHalftimeCalled(false);
      
      alert('Local scorer console queue and state cleared successfully.');
    } catch (err) {
      alert('Failed to clear local queue.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 pb-32">
        <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
        <span className="text-xs uppercase tracking-widest text-slate-500 font-black mt-4">Loading Rosters...</span>
      </div>
    );
  }

  return (
    <div 
      style={{ overscrollBehaviorX: 'contain' }}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-4 sm:p-6 md:p-8 pb-32"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 font-bold">
              Pitch {match?.pitch_number || '1'} Scorer Console
            </span>
            {syncStatus === 'syncing' ? (
              <span className="text-[10px] uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-indigo-400 font-bold animate-pulse flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" /> Syncing stats...
              </span>
            ) : pendingCount > 0 || syncStatus === 'offline' ? (
              <span 
                className="text-[10px] uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full text-amber-400 font-bold flex items-center gap-1.5 cursor-pointer hover:bg-amber-500/20 transition-all"
                onClick={attemptSync}
                title="Click to retry sync"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> {pendingCount} Pending Sync
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-emerald-400" /> Synced
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            {match?.home_team?.team_name || 'Light'} 
            <span className="text-indigo-400 font-black text-3xl">{homeScore}</span>
            <span className="text-slate-700 font-light text-base">-</span>
            <span className="text-rose-500 font-black text-3xl">{awayScore}</span>
            {match?.away_team?.team_name || 'Dark'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all text-indigo-400"
          >
            📋 Log
          </button>
          <button
            onClick={handleUndo}
            disabled={processing}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
          >
            <Undo2 className="w-4 h-4 text-indigo-400" /> Undo
          </button>
          {!isPointInProgress && (
            <button
              onClick={handleEndMatch}
              disabled={processing}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/30 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 text-rose-400"
            >
              End Match
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-2xl text-sm flex items-start gap-3 mb-6">
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Main Scorer Interface */}
      {!isPointInProgress ? (
        // Roster lineup selection screen
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Home Lineup Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">{match?.home_team?.team_name || 'Light'}</h3>
                <span className="text-xs uppercase tracking-widest font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                  {homeLineup.length} / {expectedPlayersCount} selected
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {homePlayers.map(p => {
                  const isChecked = homeLineup.some(x => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleHomePlayer(p)}
                      className={`p-3.5 border rounded-2xl text-left text-xs uppercase font-black tracking-wider transition-all flex items-center justify-between ${
                        isChecked 
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/15' 
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>
                        {p.name} {p.shirt_number ? `#${p.shirt_number}` : ''}
                      </span>
                      {p.gender_designation && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${p.gender_designation === 'mmp' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                          {p.gender_designation.toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Ratios:</span>
              <div className="flex gap-3">
                <span className="text-blue-400">{homeRatio.mmp} MMP</span>
                <span className="text-purple-400">{homeRatio.fmp} FMP</span>
                {homeRatio.none > 0 && <span className="text-slate-400">{homeRatio.none} None</span>}
              </div>
            </div>
          </div>

          {/* Away Lineup Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-wider">{match?.away_team?.team_name || 'Dark'}</h3>
                <span className="text-xs uppercase tracking-widest font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
                  {awayLineup.length} / {expectedPlayersCount} selected
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {awayPlayers.map(p => {
                  const isChecked = awayLineup.some(x => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleAwayPlayer(p)}
                      className={`p-3.5 border rounded-2xl text-left text-xs uppercase font-black tracking-wider transition-all flex items-center justify-between ${
                        isChecked 
                          ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-500/15' 
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span>
                        {p.name} {p.shirt_number ? `#${p.shirt_number}` : ''}
                      </span>
                      {p.gender_designation && (
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black ${p.gender_designation === 'mmp' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>
                          {p.gender_designation.toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Ratios:</span>
              <div className="flex gap-3">
                <span className="text-blue-400">{awayRatio.mmp} MMP</span>
                <span className="text-purple-400">{awayRatio.fmp} FMP</span>
                {awayRatio.none > 0 && <span className="text-slate-400">{awayRatio.none} None</span>}
              </div>
            </div>
          </div>

          {/* Setup Action Panel */}
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-850 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6">
            <div className="flex items-start gap-4">
              <CircleAlert className={`w-8 h-8 shrink-0 ${warningMessage ? 'text-amber-500 animate-pulse' : 'text-indigo-400'}`} />
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Lineup Audit</h4>
                <p className="text-xs text-slate-400 mt-1 leading-normal font-medium">
                  {warningMessage || `Lineups configured cleanly according to ${division} rules.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
              <button
                type="button"
                onClick={handleHalftime}
                disabled={isHalftimeCalled}
                className={`px-5 py-2.5 border text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow flex items-center justify-center gap-1.5 shrink-0 ${
                  isHalftimeCalled
                    ? 'bg-slate-950/45 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                    : 'bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 hover:text-white'
                }`}
                title={isHalftimeCalled ? "Halftime already toggled" : "Automatically swap starting offense for second half"}
              >
                🌓 Halftime
              </button>

              {/* Starting Offense Toggle Selector */}
              <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 border border-slate-850 rounded-2xl shrink-0">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Starting Offense:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPossessionTeam('Home')}
                    className={`px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border ${
                      possessionTeam === 'Home'
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400 font-extrabold shadow-sm'
                        : 'border-transparent text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    {match?.home_team?.team_name || 'Light'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPossessionTeam('Away')}
                    className={`px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border ${
                      possessionTeam === 'Away'
                        ? 'bg-rose-600/20 border-rose-500/40 text-rose-400 font-extrabold shadow-sm'
                        : 'border-transparent text-slate-500 hover:text-slate-400'
                    }`}
                  >
                    {match?.away_team?.team_name || 'Dark'}
                  </button>
                </div>
              </div>

              {warningMessage && (
                <button
                  onClick={() => setIgnoreWarning(!ignoreWarning)}
                  className={`px-5 py-3 border text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                    ignoreWarning 
                      ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/10' 
                      : 'border-slate-700 hover:border-slate-650 text-slate-300'
                  }`}
                >
                  Ignore Warning
                </button>
              )}
              <button
                onClick={handleStartPoint}
                disabled={homeLineup.length === 0 || awayLineup.length === 0 || processing}
                className={`flex items-center justify-center gap-2 px-8 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all border ${
                  homeLineup.length > 0 && awayLineup.length > 0 && !processing
                    ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/20 text-white active:scale-[0.98]'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                }`}
              >
                <Play className="w-4 h-4 text-indigo-300" /> Start Point {pointNumber}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Play-by-play live action panel
        <div className="flex flex-col gap-6">
          {/* Tab Selector Headers */}
          <div className="grid grid-cols-2 p-1.5 bg-slate-900 border border-slate-850 rounded-2xl">
            <button
              onClick={() => setActiveTab('Home')}
              className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                activeTab === 'Home'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/15'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/40'
              }`}
            >
              <span>{match?.home_team?.team_name || 'Light'}</span>
              <span className="font-mono text-sm px-2 py-0.5 rounded-lg bg-slate-950/60 font-black">
                {homeScore}
              </span>
              {possessionTeam === 'Home' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow animate-pulse shrink-0" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('Away')}
              className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                activeTab === 'Away'
                  ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-500/15'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/40'
              }`}
            >
              <span>{match?.away_team?.team_name || 'Dark'}</span>
              <span className="font-mono text-sm px-2 py-0.5 rounded-lg bg-slate-950/60 font-black">
                {awayScore}
              </span>
              {possessionTeam === 'Away' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow animate-pulse shrink-0" />
              )}
            </button>
          </div>

          {/* Swipe-friendly Active Tab Content Area */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="w-full transition-all"
          >
            {activeTab === 'Home' ? (
              /* Active Lineup Panel (Light) */
              <div className={`bg-slate-900/50 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                possessionTeam === 'Home' ? 'bg-slate-900/80 shadow-lg shadow-indigo-500/5' : 'opacity-90'
              }`}>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider mb-6 border-b border-slate-800 pb-4 flex items-center justify-between">
                    <span>{match?.home_team?.team_name || 'Light'}</span>
                    {possessionTeam === 'Home' ? (
                      <span className="text-[10px] px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 animate-pulse">Offense</span>
                    ) : (
                      <span className="text-[10px] px-3 py-1 rounded-full bg-slate-800 text-slate-400 font-bold border border-slate-700">Defense</span>
                    )}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {homeLineup.map(p => {
                      const isActive = activePossessionPlayer?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (possessionTeam === 'Home') {
                              handleTap(p, () => handlePlayerSelect(p));
                            } else {
                              handleAction(p, 'Defence');
                            }
                          }}
                          className={`p-4 border rounded-2xl text-left text-xs uppercase font-black tracking-wider transition-all flex flex-col justify-between h-20 relative ${
                            isActive 
                              ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
                              : possessionTeam === 'Home'
                                ? 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-indigo-500/30 hover:text-indigo-400'
                          }`}
                        >
                          <span className="flex items-center justify-between w-full gap-2">
                            <span className="truncate">{p.name}</span>
                            {isActive && <span className="text-xs animate-bounce shrink-0">🥏</span>}
                          </span>
                          <span className="text-[9px] font-mono opacity-80 mt-1">#{p.shirt_number || 'TBD'}</span>
                        </button>
                      );
                    })}
                    {possessionTeam === 'Home' && (
                      <button
                        onClick={() => {
                          if (huckThrowerId) {
                            setHuckThrowerId(null);
                          } else if (activePossessionPlayer) {
                            setHuckThrowerId(activePossessionPlayer.id);
                          }
                        }}
                        className={`p-4 border rounded-2xl text-center text-xs uppercase font-black tracking-wider transition-all flex flex-col items-center justify-center h-20 relative ${
                          isHuckPending
                            ? 'bg-rose-600 border-rose-450 text-white shadow-lg shadow-rose-500/30 font-black animate-pulse'
                            : 'bg-rose-950/20 border-rose-500/30 text-rose-400 hover:bg-rose-900/20'
                        }`}
                      >
                        <Star className={`w-5 h-5 mb-1 ${isHuckPending ? 'fill-white' : 'fill-transparent'}`} />
                        <span>Huck</span>
                      </button>
                    )}
                  </div>
                </div>

                {possessionTeam === 'Home' && (
                  <div className="grid grid-cols-2 gap-4 mt-8 border-t border-slate-800 pt-6">
                    <button
                      onClick={() => handleAction(activePossessionPlayer, 'Point')}
                      disabled={processing || !activePossessionPlayer}
                      className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      Score
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTap('Throwaway', () => handleAction(activePossessionPlayer, 'Throwaway'))}
                        disabled={!activePossessionPlayer}
                        className="h-14 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-2xl text-rose-400 flex flex-col items-center justify-center leading-tight disabled:opacity-50"
                      >
                        <span>Throw</span>
                        <span>away</span>
                      </button>
                      <button
                        onClick={() => handleTap('Drop', () => handleAction(activePossessionPlayer, 'Drop'))}
                        disabled={!activePossessionPlayer}
                        className="h-14 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-2xl text-rose-400 flex flex-col items-center justify-center leading-tight disabled:opacity-50"
                      >
                        <span>Drop</span>
                        <span className="text-transparent select-none">-</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* Active Lineup Panel (Dark) */
              <div className={`bg-slate-900/50 border border-rose-500/30 rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                possessionTeam === 'Away' ? 'bg-slate-900/80 shadow-lg shadow-rose-500/5' : 'opacity-90'
              }`}>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider mb-6 border-b border-slate-800 pb-4 flex items-center justify-between">
                    <span>{match?.away_team?.team_name || 'Dark'}</span>
                    {possessionTeam === 'Away' ? (
                      <span className="text-[10px] px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30 animate-pulse">Offense</span>
                    ) : (
                      <span className="text-[10px] px-3 py-1 rounded-full bg-slate-800 text-slate-400 font-bold border border-slate-700">Defense</span>
                    )}
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    {awayLineup.map(p => {
                      const isActive = activePossessionPlayer?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (possessionTeam === 'Away') {
                              handleTap(p, () => handlePlayerSelect(p));
                            } else {
                              handleAction(p, 'Defence');
                            }
                          }}
                          className={`p-4 border rounded-2xl text-left text-xs uppercase font-black tracking-wider transition-all flex flex-col justify-between h-20 relative ${
                            isActive 
                              ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-500/20' 
                              : possessionTeam === 'Away'
                                ? 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:border-rose-500/30 hover:text-rose-400'
                          }`}
                        >
                          <span className="flex items-center justify-between w-full gap-2">
                            <span className="truncate">{p.name}</span>
                            {isActive && <span className="text-xs animate-bounce shrink-0">🥏</span>}
                          </span>
                          <span className="text-[9px] font-mono opacity-80 mt-1">#{p.shirt_number || 'TBD'}</span>
                        </button>
                      );
                    })}
                    {possessionTeam === 'Away' && (
                      <button
                        onClick={() => {
                          if (huckThrowerId) {
                            setHuckThrowerId(null);
                          } else if (activePossessionPlayer) {
                            setHuckThrowerId(activePossessionPlayer.id);
                          }
                        }}
                        className={`p-4 border rounded-2xl text-center text-xs uppercase font-black tracking-wider transition-all flex flex-col items-center justify-center h-20 relative ${
                          isHuckPending
                            ? 'bg-rose-600 border-rose-450 text-white shadow-lg shadow-rose-500/30 font-black animate-pulse'
                            : 'bg-rose-950/20 border-rose-500/30 text-rose-400 hover:bg-rose-900/20'
                        }`}
                      >
                        <Star className={`w-5 h-5 mb-1 ${isHuckPending ? 'fill-white' : 'fill-transparent'}`} />
                        <span>Huck</span>
                      </button>
                    )}
                  </div>
                </div>

                {possessionTeam === 'Away' && (
                  <div className="grid grid-cols-2 gap-4 mt-8 border-t border-slate-800 pt-6">
                    <button
                      onClick={() => handleAction(activePossessionPlayer, 'Point')}
                      disabled={processing || !activePossessionPlayer}
                      className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      Score
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleTap('Throwaway', () => handleAction(activePossessionPlayer, 'Throwaway'))}
                        disabled={!activePossessionPlayer}
                        className="h-14 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-2xl text-rose-400 flex flex-col items-center justify-center leading-tight disabled:opacity-50"
                      >
                        <span>Throw</span>
                        <span>away</span>
                      </button>
                      <button
                        onClick={() => handleTap('Drop', () => handleAction(activePossessionPlayer, 'Drop'))}
                        disabled={!activePossessionPlayer}
                        className="h-14 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-2xl text-rose-400 flex flex-col items-center justify-center leading-tight disabled:opacity-50"
                      >
                        <span>Drop</span>
                        <span className="text-transparent select-none">-</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      )}

      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 sm:p-8 flex flex-col max-h-[85vh] shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center border-b border-slate-855 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow animate-pulse" />
                <h3 className="text-base font-black text-white uppercase tracking-wider">Match Playlog Editor</h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-xs font-black uppercase tracking-widest rounded-xl transition-all text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Playlog scroll container */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {(() => {
                const visibleStats = matchStats.filter(s => s.stat_type !== 'Lineup' && s.stat_type !== 'Match Metadata');
                if (visibleStats.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-widest">
                      No events logged yet for this match.
                    </div>
                  );
                }
                return visibleStats.map((stat) => {
                  const isEditing = editingStatId === stat.id;
                  const isHome = stat.team_id === match.home_team_id;
                  const playersList = getAvailablePlayersForStat(stat);
                  
                  return (
                    <div 
                      key={stat.id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 border rounded-2xl gap-3 transition-all ${
                        isHome 
                          ? 'bg-indigo-950/20 border-indigo-500/10 hover:border-indigo-500/25' 
                          : 'bg-rose-950/20 border-rose-500/10 hover:border-rose-500/25'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/60 font-black text-slate-400">
                          P{stat.point_number}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
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
                        {isEditing ? (
                          <select
                            value={editingPlayerName}
                            onChange={(e) => setEditingPlayerName(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-xs font-black uppercase tracking-wider rounded-xl px-3 py-1 text-slate-200 outline-none focus:border-indigo-500"
                          >
                            <option value="Opponent">Opponent</option>
                            <option value="System">System</option>
                            {playersList.map(p => (
                              <option key={p.id} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-black text-slate-200 uppercase tracking-wide">
                            {stat.player} <span className="text-slate-500 font-medium font-sans">({stat.team_name})</span>
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveStatEdit(stat.id)}
                              disabled={processing}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingStatId(null)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditStat(stat)}
                              className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-indigo-400 hover:text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteStat(stat.id)}
                              className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-850 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-wider">
              <span>Roster Playlog Editor</span>
              <button
                onClick={handleClearConsoleCache}
                disabled={processing}
                className="px-4 py-2 border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow"
              >
                Clear Local Cache
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentScorer;
