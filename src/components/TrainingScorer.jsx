import React, { useState, useEffect, useRef } from 'react';
import { Dumbbell, Shield, Undo2, ArrowLeftRight, Star, Lock, RefreshCw, X, Play, Square, Award, AlertTriangle } from 'lucide-react';
import { recordStatToDB, fetchLastStatForGame, deleteStat, recordLineup } from '../supabaseClient';
import { playChime, playClick, playBuzz } from '../utils/audioFeedback';
import { useDrillState } from '../contexts/DrillStateContext';

const TrainingScorer = ({ players, setPlayers, currentTeam, targetTeamId, onNavigate, isPro, isVoiceBeta }) => {
  const {
    activeDrill,
    isGhostScrimmage,
    lightShirtPlayers,
    darkShirtPlayers,
    lockedThrowerId,
    toggleLockedThrower,
    setLockedThrowerId
  } = useDrillState();

  const loggedLineupPointsRef = useRef(new Set());

  // Core tracking states
  const [possessionChain, setPossessionChain] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.possessionChain || [];
        }
      } catch {}
    }
    return [];
  });

  const [possessionTeam, setPossessionTeam] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.possessionTeam || 'light';
        }
      } catch {}
    }
    return 'light';
  });

  const [score, setScore] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.score || { light: 0, dark: 0 };
        }
      } catch {}
    }
    return { light: 0, dark: 0 };
  });

  const [previousChain, setPreviousChain] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.previousChain || [];
        }
      } catch {}
    }
    return [];
  });

  const [previousTeam, setPreviousTeam] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.previousTeam || 'light';
        }
      } catch {}
    }
    return 'light';
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.activeTab || 'light';
        }
      } catch {}
    }
    return 'light';
  });

  const [huckThrowerName, setHuckThrowerName] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.huckThrowerName !== undefined ? parsed.huckThrowerName : null;
        }
      } catch {}
    }
    return null;
  });

  const isHuckPending = !!huckThrowerName;

  const [lockLightRole, setLockLightRole] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.lockLightRole || false;
        }
      } catch {}
    }
    return false;
  });

  const [lockDarkRole, setLockDarkRole] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.lockDarkRole || false;
        }
      } catch {}
    }
    return false;
  });

  const isRoleLocked = lockLightRole || lockDarkRole;
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  // Drill-specific extensions
  const [dropEndsDrill, setDropEndsDrill] = useState(true);
  const [repFlowLength, setRepFlowLength] = useState(2);
  const [pendingAction, setPendingAction] = useState(null); // 'Drop' or 'Incomplete'

  const [activeSessionId] = useState(() => {
    if (isGhostScrimmage) {
      try {
        const saved = localStorage.getItem('ufstats_active_scrimmage_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.activeSessionId) return parsed.activeSessionId;
        }
      } catch {}
      
      const customName = localStorage.getItem('ufstats_pending_scrimmage_name') || 'Jersey Scrimmage';
      localStorage.removeItem('ufstats_pending_scrimmage_name');
      
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return `Scrimmage: ${customName}::${dateStr}`;
    }
    
    const drillName = activeDrill?.name || 'Active Drill';
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `Drill: ${drillName}::${dateStr}`;
  });

  const lastTapRef = useRef({});

  // Sync possession chain when thrower lock changes in Drill Mode
  useEffect(() => {
    if (!isGhostScrimmage) {
      setPossessionChain(lockedThrowerId ? [lockedThrowerId] : []);
      setPendingAction(null);
    }
  }, [lockedThrowerId, isGhostScrimmage]);

  // Record initial lineup for Drill Mode to track games/points played correctly
  useEffect(() => {
    if (!isGhostScrimmage && activeSessionId) {
      const storageKey = `ufstats_logged_lineup_${activeSessionId}`;
      if (localStorage.getItem(storageKey)) {
        return;
      }
      
      const activePlayers = players?.filter(p => p.is_active).map(p => p.name) || [];
      if (activePlayers.length > 0) {
        localStorage.setItem(storageKey, 'true');
        recordLineup(
          activePlayers,
          1,
          activeSessionId,
          'training',
          currentTeam,
          targetTeamId
        ).catch(err => {
          console.error("Failed to record drill lineup:", err);
          localStorage.removeItem(storageKey); // Retry on failure
        });
      }
    }
  }, [isGhostScrimmage, activeSessionId, currentTeam, targetTeamId, players]);

  // Serialize active scrimmage state to localStorage on any state change
  useEffect(() => {
    if (isGhostScrimmage && activeSessionId) {
      const stateToSave = {
        possessionChain,
        possessionTeam,
        score,
        previousChain,
        previousTeam,
        activeTab,
        huckThrowerName,
        lockLightRole,
        lockDarkRole,
        activeSessionId
      };
      localStorage.setItem('ufstats_active_scrimmage_state', JSON.stringify(stateToSave));
    }
  }, [
    isGhostScrimmage,
    possessionChain,
    possessionTeam,
    score,
    previousChain,
    previousTeam,
    activeTab,
    huckThrowerName,
    lockLightRole,
    lockDarkRole,
    activeSessionId
  ]);

  const triggerFeedback = (type) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'success') navigator.vibrate([50, 50, 50]);
        else if (type === 'error') navigator.vibrate([100, 50, 100]);
        else navigator.vibrate(30);
      }
    } catch {}
  };

  // --- DRILL MODE LOGGING HANDLERS ---
  const handleDrillPlayerCardTap = (playerName) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[playerName] || 0;
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double-tap: toggle locked thrower
      toggleLockedThrower(playerName);
      lastTapRef.current[playerName] = 0;
      setPendingAction(null);
      return;
    }
    lastTapRef.current[playerName] = now;

    // Single tap handling
    const activeThrower = lockedThrowerId || (possessionChain.length > 0 ? possessionChain[possessionChain.length - 1] : null);

    if (!activeThrower) {
      // No thrower active yet, so this tapped player becomes the new thrower
      setPossessionChain([playerName]);
      setPendingAction(null);
      playClick();
    } else {
      // We already have an active thrower
      if (activeThrower === playerName) {
        // Tapped active thrower again -> unselect them
        if (lockedThrowerId === playerName) {
          setPossessionChain([lockedThrowerId]);
        } else {
          setPossessionChain([]);
        }
        setPendingAction(null);
        playClick();
      } else {
        // Tapped a different player
        if (pendingAction) {
          // We have a pending action like Drop or Incomplete to attribute to this player
          handleRecordDrillStat(pendingAction, activeThrower, playerName);
          setPendingAction(null);
        } else {
          // Completed pass!
          handleRecordDrillStat('Catch', activeThrower, playerName);
        }
      }
    }
  };

  const handleRecordDrillStat = async (statType, overrideThrower = null, overrideCatcher = null) => {
    // 1. Resolve matching metric action mapping
    const matchingMetric = activeDrill?.metrics?.find(m => {
      const parts = m.split('::');
      const label = parts[0];
      return label === statType || (statType === 'Incomplete' && (label.toLowerCase().includes('overthrow') || label.toLowerCase().includes('underthrow') || label.toLowerCase().includes('throwaway')));
    });
    
    const parts = matchingMetric ? matchingMetric.split('::') : [];
    const mappedAction = parts[1] || 'Custom';
    const displayLabel = parts[0] || statType;

    const isSuccess = statType === 'Catch' || mappedAction === 'Pass' || ['leading catch', 'pass', 'catch'].some(x => statType.toLowerCase().includes(x));
    const isDrop = mappedAction === 'Drop' || statType.toLowerCase().includes('drop');
    const isThrowaway = mappedAction === 'Throwaway' || ['overthrow', 'underthrow', 'throwaway', 'incomplete'].some(x => statType.toLowerCase().includes(x));
    const isDefence = mappedAction === 'Defence' || ['block', 'defence', 'defense'].some(x => statType.toLowerCase().includes(x));
    const isPoint = mappedAction === 'Point' || (['goal', 'score', 'point'].some(x => statType.toLowerCase().includes(x)) && !statType.toLowerCase().includes('opponent'));
    const isStall = mappedAction === 'Stall Out' || statType.toLowerCase().includes('stall');

    // If they click Drop or Incomplete button directly (without catcher overrides)
    if (!overrideThrower && !overrideCatcher) {
      const activeThrower = lockedThrowerId || (possessionChain.length > 0 ? possessionChain[possessionChain.length - 1] : null);
      if (!activeThrower) {
        alert("Select a thrower first.");
        return;
      }
      
      if (isDrop || isThrowaway) {
        if (pendingAction === statType) {
          // Double-click on the same button -> log immediately for active thrower (no receiver needed)
          setPendingAction(null);
          // Proceed to record immediate stat below with activeThrower only
        } else {
          // Single-click -> set pending and wait for receiver tap
          setPendingAction(statType);
          playClick();
          return;
        }
      }
    }

    const activeThrower = overrideThrower || lockedThrowerId || (possessionChain.length > 0 ? possessionChain[possessionChain.length - 1] : null);
    const activeCatcher = overrideCatcher;

    if (!activeThrower) {
      alert("Select a thrower.");
      return;
    }

    setIsSaving(true);
    try {
      const statsToSave = [];
      const baseStat = {
        point_number: 1,
        game_name: activeSessionId,
        game_type: 'training',
        team_name: currentTeam
      };

      if (isSuccess) {
        if (!activeCatcher) {
          alert("Select catcher.");
          setIsSaving(false);
          return;
        }
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Pass',
          details: { target: activeCatcher, drill_name: activeDrill?.name || 'Drill', metric: displayLabel }
        });
        statsToSave.push({
          ...baseStat,
          player: activeCatcher,
          stat_type: 'Catch',
          details: { thrower: activeThrower, drill_name: activeDrill?.name || 'Drill' }
        });
        playChime();
        triggerFeedback('success');
      } else if (isDrop) {
        const dropPlayer = activeCatcher || activeThrower;
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Pass Attempt',
          details: { target: dropPlayer, drill_name: activeDrill?.name || 'Drill', metric: displayLabel }
        });
        statsToSave.push({
          ...baseStat,
          player: dropPlayer,
          stat_type: 'Drop',
          details: { thrower: activeThrower, drill_name: activeDrill?.name || 'Drill' }
        });
        playBuzz();
        triggerFeedback('error');
      } else if (isThrowaway) {
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Throwaway',
          details: { target: activeCatcher || 'None', drill_name: activeDrill?.name || 'Drill', metric: displayLabel }
        });
        playBuzz();
        triggerFeedback('error');
      } else if (isDefence) {
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Defence',
          details: { drill_name: activeDrill?.name || 'Drill', metric: displayLabel }
        });
        playChime();
        triggerFeedback('success');
      } else if (isPoint) {
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Point',
          details: { drill_name: activeDrill?.name || 'Drill', metric: displayLabel }
        });
        playChime();
        triggerFeedback('success');
      } else if (isStall) {
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Stall Out',
          details: { drill_name: activeDrill?.name || 'Drill', metric: displayLabel }
        });
        playBuzz();
        triggerFeedback('error');
      } else if (activeDrill?.id === 'system_drill_pull') {
        let pullScore = 0;
        const cleanStat = statType.trim().toLowerCase();
        if (cleanStat.includes('endzone')) pullScore = 4;
        else if (cleanStat.includes('field')) pullScore = 3;
        else if (cleanStat.includes('past brick') || (cleanStat.includes('bounds') && cleanStat.includes('past')) || (cleanStat.includes('bounce') && cleanStat.includes('past'))) pullScore = 2;
        else if (cleanStat.includes('short') || cleanStat.includes('bounds') || cleanStat.includes('bounce') || cleanStat.includes('ob')) pullScore = 0;

        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: 'Pull',
          details: { 
            drill_name: 'Pull Practice', 
            location: statType, 
            score: pullScore 
          }
        });
        playChime();
        triggerFeedback('success');
      } else {
        // Fallback for custom actions
        statsToSave.push({
          ...baseStat,
          player: activeThrower,
          stat_type: displayLabel,
          details: { drill_name: activeDrill?.name || 'Drill' }
        });
        playClick();
      }

      for (const st of statsToSave) {
        await recordStatToDB(st, targetTeamId);
      }

      setLastSaved(`Logged ${statType}`);

      // Possession chain update logic:
      if (isSuccess) {
        if (activeDrill?.flow_type === 'rep_based') {
          // For rep_based drills: chain accumulates up to repFlowLength
          const newChain = [...possessionChain, activeCatcher];
          if (newChain.length >= repFlowLength) {
            // Rep completed successfully!
            setPossessionChain(lockedThrowerId ? [lockedThrowerId] : []);
            playChime(); // Play extra success chime for completed rep
          } else {
            // Rep continues
            setPossessionChain(newChain);
          }
        } else {
          // Continuous Mode: catcher becomes the new thrower
          setPossessionChain(lockedThrowerId ? [lockedThrowerId] : [activeCatcher]);
        }
      } else if (isDrop || isThrowaway || ['stall out', 'turnover'].some(x => statType.toLowerCase().includes(x))) {
        const nextThrower = activeCatcher || activeThrower;
        if (dropEndsDrill) {
          // Turnover ends rep: start next rep with nextThrower
          setPossessionChain(lockedThrowerId ? [lockedThrowerId] : (nextThrower ? [nextThrower] : []));
        } else {
          // Drop does NOT end rep/drill: continue sequence or set thrower
          if (activeDrill?.flow_type === 'rep_based') {
            setPossessionChain(lockedThrowerId ? [lockedThrowerId] : (nextThrower ? [...possessionChain, nextThrower] : possessionChain));
          } else {
            setPossessionChain(lockedThrowerId ? [lockedThrowerId] : (nextThrower ? [nextThrower] : []));
          }
        }
      } else {
        // Other stats
        setPossessionChain(lockedThrowerId ? [lockedThrowerId] : []);
      }

    } catch (err) {
      console.error(err);
      alert("Failed to save rep.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuitSession = () => {
    const isScrimmage = isGhostScrimmage;
    const label = isScrimmage ? 'scrimmage match' : 'drill session';
    
    let confirmMsg = `Are you sure you want to quit this ${label}?`;
    if (isScrimmage) {
      confirmMsg = `Are you sure you want to quit this scrimmage match? This will clear the active match session. If you want to check stats or dashboard, use the navigation bar instead.`;
    }
    
    if (confirm(confirmMsg)) {
      if (isScrimmage) {
        localStorage.removeItem('ufstats_active_scrimmage_state');
      }
      onNavigate('training_setup');
    }
  };


  // --- SCRIMMAGE (TRAININGS MATCH) LOGGING HANDLERS ---
  const ensureLineupRecordedForPoint = async (pointNum) => {
    if (loggedLineupPointsRef.current.has(pointNum)) {
      return;
    }
    
    // Mark as logged to prevent double-calls
    loggedLineupPointsRef.current.add(pointNum);
    
    try {
      const allActivePlayers = [...lightShirtPlayers, ...darkShirtPlayers];
      if (allActivePlayers.length > 0) {
        await recordLineup(
          allActivePlayers,
          pointNum,
          activeSessionId,
          'training_match',
          currentTeam,
          targetTeamId
        );
      }
    } catch (err) {
      console.error("Failed to record scrimmage lineup:", err);
      // Remove from logged set so we can retry on next action
      loggedLineupPointsRef.current.delete(pointNum);
    }
  };

  const handleScrimmagePlayerTap = (playerName, playerTeam) => {
    // If the opponent team is tapped, trigger a dynamic possession intercept flip!
    if (playerTeam !== possessionTeam) {
      handleScrimmageIntercept(playerName, playerTeam);
      return;
    }

    setPossessionChain(prev => {
      if (prev.includes(playerName) && prev[prev.length - 1] === playerName) {
        return prev; // Ignore repeat tap
      }
      playClick();
      const newChain = [...prev, playerName];

      // Log implied pass
      if (prev.length >= 2) {
        const thrower = prev[prev.length - 2];
        handleRecordScrimmageStat('Pass', thrower, playerTeam, prev);
      }
      return newChain;
    });
  };

  // Intercept: dynamic possession turnover mapping
  const handleScrimmageIntercept = async (interceptorName, interceptorTeam) => {
    setIsSaving(true);
    setPreviousChain(possessionChain);
    setPreviousTeam(possessionTeam);
    setHuckThrowerName(null);

    try {
      const currentPointNumber = score.light + score.dark + 1;
      await ensureLineupRecordedForPoint(currentPointNumber);

      // Log D-Block for interceptor
      const baseStat = {
        point_number: currentPointNumber,
        game_name: activeSessionId,
        game_type: 'training_match',
        team_name: currentTeam,
        player: interceptorName,
        stat_type: 'Defence',
        details: { scrimmage_shirt: interceptorTeam }
      };

      await recordStatToDB(baseStat, targetTeamId);
      
      if (!isRoleLocked) {
        setPossessionTeam(interceptorTeam);
        setActiveTab(interceptorTeam);
        setPossessionChain([interceptorName]);
        setLastSaved(`Possession flipped to ${interceptorTeam} Shirts!`);
      } else {
        setLastSaved(`Logged Defence for ${interceptorName}`);
      }
      playChime();
      triggerFeedback('success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordScrimmageStat = async (statType, overridePlayer = null, overrideTeam = null, overrideChain = null) => {
    const activePlayer = overridePlayer || possessionChain[possessionChain.length - 1];
    const activeTeam = overrideTeam || possessionTeam;
    const chain = overrideChain || possessionChain;

    if (!activePlayer) return alert("Select player.");

    setIsSaving(true);
    try {
      const currentPointNumber = score.light + score.dark + 1;
      await ensureLineupRecordedForPoint(currentPointNumber);

      // Resolve huck thrower details if a huck throws is pending
      let throwerNameOfAction = null;
      if (statType === 'Goal') {
        throwerNameOfAction = chain.length > 1 ? chain[chain.length - 2] : null;
      } else if (statType === 'Drop') {
        throwerNameOfAction = chain.length > 1 && chain[chain.length - 1] === activePlayer
          ? chain[chain.length - 2] : null;
      } else if (['Throwaway', 'Stall Out'].includes(statType)) {
        throwerNameOfAction = activePlayer;
      }

      const isHuck = throwerNameOfAction && throwerNameOfAction === huckThrowerName;
      if (isHuck) {
        setHuckThrowerName(null);
      }
      const huckDetails = isHuck ? { is_huck: true } : {};

      const statsToSave = [];
      const baseStat = {
        point_number: currentPointNumber,
        game_name: activeSessionId,
        game_type: 'training_match',
        team_name: currentTeam,
        player: activePlayer,
        stat_type: statType,
        details: { scrimmage_shirt: activeTeam, ...huckDetails }
      };

      if (statType === 'Goal') {
        // Record assist for the secondary huck/passer if present
        if (chain.length > 1) {
          const passer = chain[chain.length - 2];
          statsToSave.push({
            point_number: currentPointNumber,
            game_name: activeSessionId,
            game_type: 'training_match',
            team_name: currentTeam,
            player: passer,
            stat_type: 'Pass',
            details: { target: activePlayer, scrimmage_shirt: activeTeam, ...huckDetails }
          });
        }
        statsToSave.push({ ...baseStat, stat_type: 'Point' });

        setPreviousTeam(possessionTeam);
        setPreviousChain(possessionChain);

        setScore(prev => ({
          ...prev,
          [activeTeam]: prev[activeTeam] + 1
        }));
        setPossessionChain([]);
        setHuckThrowerName(null);

        // Score flip logic matching tournament mode (if roles are not locked)
        if (!isRoleLocked) {
          const opposingTeam = activeTeam === 'light' ? 'dark' : 'light';
          setPossessionTeam(opposingTeam);
          setActiveTab(opposingTeam);
        }

        playChime();
        triggerFeedback('success');
      } else if (statType === 'Drop') {
        // Drop turnover: log a "Pass Attempt" for the thrower if present, and "Drop" for the receiver
        if (chain.length > 1 && chain[chain.length - 1] === activePlayer) {
          const thrower = chain[chain.length - 2];
          statsToSave.push({
            point_number: currentPointNumber,
            game_name: activeSessionId,
            game_type: 'training_match',
            team_name: currentTeam,
            player: thrower,
            stat_type: 'Pass Attempt',
            details: { target: activePlayer, scrimmage_shirt: activeTeam, ...huckDetails }
          });
        }
        statsToSave.push(baseStat); // This is the Drop

        setPreviousTeam(possessionTeam);
        setPreviousChain(possessionChain);

        // Flip team on turnover (if roles are not locked)
        if (!isRoleLocked) {
          const opposingTeam = activeTeam === 'light' ? 'dark' : 'light';
          setPossessionTeam(opposingTeam);
          setActiveTab(opposingTeam);
        }
        setPossessionChain([]);
        setHuckThrowerName(null);
        
        playBuzz();
        triggerFeedback('error');
      } else if (['Throwaway', 'Stall Out'].includes(statType)) {
        // Throwaway/Stall Out turnover: log a completed "Pass" to the active player from the previous thrower if present
        if (chain.length > 1 && chain[chain.length - 1] === activePlayer) {
          const thrower = chain[chain.length - 2];
          statsToSave.push({
            point_number: currentPointNumber,
            game_name: activeSessionId,
            game_type: 'training_match',
            team_name: currentTeam,
            player: thrower,
            stat_type: 'Pass',
            details: { target: activePlayer, scrimmage_shirt: activeTeam, ...huckDetails }
          });
        }
        statsToSave.push(baseStat); // This is the Throwaway/Stall Out

        setPreviousTeam(possessionTeam);
        setPreviousChain(possessionChain);

        // Flip team on turnover (if roles are not locked)
        if (!isRoleLocked) {
          const opposingTeam = activeTeam === 'light' ? 'dark' : 'light';
          setPossessionTeam(opposingTeam);
          setActiveTab(opposingTeam);
        }
        setPossessionChain([]);
        setHuckThrowerName(null);
        
        playBuzz();
        triggerFeedback('error');
      } else {
        // General stat
        statsToSave.push(baseStat);
        playClick();
      }

      for (const st of statsToSave) {
        await recordStatToDB(st, targetTeamId);
      }

      setLastSaved(`Logged ${statType} for ${activePlayer}`);

    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    setIsSaving(true);
    try {
      const last = await fetchLastStatForGame(activeSessionId, targetTeamId);
      if (!last) {
        alert("No actions to undo.");
        return;
      }

      await deleteStat(last.id);
      
      if (isGhostScrimmage) {
        // Scrimmage undo logic
        if (['Drop', 'Throwaway', 'Stall Out', 'Point'].includes(last.stat_type)) {
          const nextLast = await fetchLastStatForGame(activeSessionId, targetTeamId);
          if (nextLast && (nextLast.stat_type === 'Pass' || nextLast.stat_type === 'Pass Attempt')) {
            if (nextLast.point_number === last.point_number) {
              await deleteStat(nextLast.id);
            }
          }
        }

        if (['Defence', 'Drop', 'Throwaway', 'Stall Out'].includes(last.stat_type)) {
          setPossessionTeam(previousTeam);
          setActiveTab(previousTeam);
          setPossessionChain(previousChain);
        } else if (last.stat_type === 'Point') {
          const shirt = last.details?.scrimmage_shirt || 'light';
          setScore(prev => ({
            ...prev,
            [shirt]: Math.max(0, prev[shirt] - 1)
          }));
          setPossessionTeam(previousTeam);
          setActiveTab(previousTeam);
          setPossessionChain(previousChain);
        } else {
          setPossessionChain(prev => prev.slice(0, -1));
        }
      } else {
        // Drill Mode undo logic
        if (last.stat_type === 'Catch') {
          const nextLast = await fetchLastStatForGame(activeSessionId, targetTeamId);
          if (nextLast && nextLast.stat_type === 'Pass') {
            await deleteStat(nextLast.id);
          }
        } else if (last.stat_type === 'Drop') {
          const nextLast = await fetchLastStatForGame(activeSessionId, targetTeamId);
          if (nextLast && nextLast.stat_type === 'Pass Attempt') {
            await deleteStat(nextLast.id);
          }
        }

        // Restore possession chain based on the undone stat's details
        if (last.details?.thrower) {
          setPossessionChain(lockedThrowerId ? [lockedThrowerId] : [last.details.thrower]);
        } else if (last.player) {
          setPossessionChain(lockedThrowerId ? [lockedThrowerId] : [last.player]);
        } else {
          setPossessionChain(lockedThrowerId ? [lockedThrowerId] : []);
        }
      }

      setHuckThrowerName(null);
      setPendingAction(null);
      setLastSaved("Action Undone");
      playClick();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const activePossessionPlayer = possessionChain[possessionChain.length - 1];
  const activeTabPlayers = activeTab === 'light' ? lightShirtPlayers : darkShirtPlayers;

  const filteredMetrics = (() => {
    if (!activeDrill || !activeDrill.metrics) return ['Incomplete', 'Drop'];
    const mapped = activeDrill.metrics
      .map(m => {
        const parts = m.split('::');
        const label = parts[0];
        const action = parts[1] || 'Custom';

        // Filter out Pass and Point since those are logged via player cards/scrimmage goals
        if (action === 'Pass' || action === 'Point') return null;

        const lower = label.toLowerCase();
        if (['leading catch', 'pass', 'catch', 'score', 'goal'].includes(lower)) {
          return null;
        }
        
        // Group system default errors
        if (lower.includes('overthrow') || lower.includes('underthrow') || lower.includes('throwaway')) {
          return 'Incomplete';
        }
        return label;
      })
      .filter(Boolean);
    return [...new Set(mapped)];
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-h-[100dvh] overflow-hidden select-none">
      
      {/* 1. SCRIMMAGE MATCH MODE RENDERING (TABS LOOK & FEEL EXACTLY MATCHING TOURNAMENT SCREENSHOT) */}
      {isGhostScrimmage ? (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* Scorer Header Console Pill Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-slate-500 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
              <span>Pitch 1 Scorer Console</span>
            </div>
            <div className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-black flex items-center gap-1">
              ⚠️ Local Sandbox
            </div>
          </div>

          {/* Main Score Title */}
          <div className="px-4 py-6 bg-slate-950 text-center shrink-0">
            <div className="flex justify-between items-center max-w-md mx-auto">
              <div className="flex flex-col items-end w-1/3">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest leading-none">Light Team</span>
                <span className="text-xl font-black text-white uppercase tracking-tight mt-1.5 truncate max-w-full">Team Light</span>
              </div>
              <div className="flex items-center gap-4 text-4xl font-black shrink-0 mx-2">
                <span className="text-indigo-400 font-mono leading-none">{score.light}</span>
                <span className="text-slate-700 font-light leading-none">-</span>
                <span className="text-rose-500 font-mono leading-none">{score.dark}</span>
              </div>
              <div className="flex flex-col items-start w-1/3">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest leading-none">Dark Team</span>
                <span className="text-xl font-black text-white uppercase tracking-tight mt-1.5 truncate max-w-full">Team Dark</span>
              </div>
            </div>
          </div>

          {/* Scrimmage Action Controls Row */}
          <div className="flex gap-3 px-4 pb-5 bg-slate-950 shrink-0 max-w-md mx-auto w-full">
            <button className="flex-1 py-3 bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl text-slate-400 flex items-center justify-center gap-1.5 cursor-default">
              <span>⚡ Scrimmage</span>
            </button>
            <button 
              onClick={handleQuitSession}
              className="flex-1 py-3 bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl text-rose-400 hover:text-rose-350 transition-all flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5 text-rose-450" /> Quit
            </button>
            <button 
              onClick={handleUndo}
              disabled={isSaving}
              className="flex-1 py-3 bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl text-indigo-400 hover:text-indigo-300 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              ↩ Undo
            </button>
          </div>

          {/* Team Switcher Tabs (Matches screenshot exactly with green indicator) */}
          <div className="px-4 pb-5 bg-slate-950 shrink-0 max-w-md mx-auto w-full">
            <div className="flex gap-2.5 p-1 bg-slate-900/60 border border-white/5 rounded-2xl">
              <button
                onClick={() => setActiveTab('light')}
                className={`flex-1 py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                  activeTab === 'light' 
                    ? 'bg-slate-950 text-white border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-350'
                }`}
              >
                <span>Team Light</span>
                <span className="font-mono text-sm leading-none bg-slate-800 text-slate-300 px-2 py-0.5 rounded ml-1">{score.light}</span>
                {possessionTeam === 'light' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
              </button>
              <button
                onClick={() => setActiveTab('dark')}
                className={`flex-1 py-3 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                  activeTab === 'dark' 
                    ? 'bg-slate-950 text-white border-amber-500/40 shadow-lg shadow-amber-500/5' 
                    : 'bg-transparent text-slate-500 border-transparent hover:text-slate-350'
                }`}
              >
                <span>Team Dark</span>
                <span className="font-mono text-sm leading-none bg-slate-800 text-slate-300 px-2 py-0.5 rounded ml-1">{score.dark}</span>
                {possessionTeam === 'dark' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>}
              </button>
            </div>
          </div>

          {/* Continuous Role Lock Checkboxes Row */}
          <div className="px-4 pb-4 bg-slate-950 shrink-0 max-w-md mx-auto w-full flex justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 font-extrabold uppercase tracking-widest select-none">
              <input 
                type="checkbox" 
                checked={lockLightRole} 
                onChange={(e) => setLockLightRole(e.target.checked)} 
                className="w-4 h-4 bg-slate-900 border-white/5 text-indigo-500 rounded cursor-pointer focus:ring-0 focus:ring-offset-0" 
              />
              <span>Lock Light Role</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 font-extrabold uppercase tracking-widest select-none">
              <input 
                type="checkbox" 
                checked={lockDarkRole} 
                onChange={(e) => setLockDarkRole(e.target.checked)} 
                className="w-4 h-4 bg-slate-900 border-white/5 text-amber-500 rounded cursor-pointer focus:ring-0 focus:ring-offset-0" 
              />
              <span>Lock Dark Role</span>
            </label>
          </div>

          {/* Active Lineup Panel & Scorer Grid */}
          <div className="flex-1 px-4 overflow-y-auto min-h-0 bg-slate-950 pb-6 flex flex-col justify-between max-w-md mx-auto w-full">
            <div className="border border-white/5 rounded-3xl p-6 bg-slate-900/30 flex flex-col justify-between flex-1">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider mb-6 border-b border-slate-800 pb-4 flex items-center justify-between">
                  <span>{activeTab === 'light' ? 'Team Light' : 'Team Dark'}</span>
                  <div className="flex items-center gap-3">
                    {possessionTeam === activeTab ? (
                      <span className="text-[9px] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 uppercase tracking-widest animate-pulse">Offense</span>
                    ) : (
                      <span className="text-[9px] px-3 py-1 rounded-full bg-slate-850 text-slate-500 font-bold border border-slate-800 uppercase tracking-widest">Defense</span>
                    )}
                  </div>
                </h3>

                {/* Player Grid */}
                <div className="grid grid-cols-2 gap-3.5">
                  {activeTabPlayers.map(name => {
                    const player = players.find(p => p.name === name);
                    const isHolder = possessionChain[possessionChain.length - 1] === name;
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          if (possessionTeam === activeTab) {
                            handleScrimmagePlayerTap(name, activeTab);
                          } else {
                            handleScrimmageIntercept(name, activeTab);
                          }
                        }}
                        className={`p-4 border rounded-2xl text-left text-xs uppercase font-black tracking-wider transition-all flex flex-col justify-between h-20 relative ${
                          isHolder 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
                            : possessionTeam === activeTab
                              ? 'bg-slate-950 border-slate-850 text-slate-200 hover:border-slate-700'
                              : 'bg-slate-950 border-slate-900 text-slate-450 hover:border-indigo-500/30 hover:text-indigo-400'
                        }`}
                      >
                        <span className="flex items-center justify-between w-full gap-2">
                          <span className="truncate">{name}</span>
                          {isHolder && <span className="text-xs shrink-0 animate-bounce">🥏</span>}
                        </span>
                        <span className="text-[9px] font-mono opacity-80 mt-1">#{player?.shirt_number || 'TBD'}</span>
                      </button>
                    );
                  })}

                  {/* Huck Card */}
                  <button
                    onClick={() => {
                      if (huckThrowerName) {
                        setHuckThrowerName(null);
                      } else if (activePossessionPlayer) {
                        setHuckThrowerName(activePossessionPlayer);
                      }
                    }}
                    disabled={possessionTeam !== activeTab || !activePossessionPlayer}
                    className={`p-4 border rounded-2xl text-center text-xs uppercase font-black tracking-wider transition-all flex flex-col items-center justify-center h-20 relative ${
                      possessionTeam !== activeTab || !activePossessionPlayer
                        ? 'opacity-40 bg-slate-950 border-slate-900 text-slate-650 cursor-not-allowed'
                        : isHuckPending
                          ? 'bg-rose-600 border-rose-450 text-white shadow-lg shadow-rose-500/30 font-black animate-pulse'
                          : 'bg-rose-950/20 border-rose-500/30 text-rose-400 hover:bg-rose-900/20'
                    }`}
                  >
                    <Star className={`w-5 h-5 mb-1 ${isHuckPending ? 'fill-white text-white' : 'fill-transparent text-rose-400'}`} />
                    <span>Huck</span>
                  </button>
                </div>
              </div>

              {/* Bottom Scrimmage Actions (Score, Throwaway, Drop) */}
              <div className="grid grid-cols-3 gap-3.5 mt-8 border-t border-slate-800 pt-6">
                <button
                  onClick={() => handleRecordScrimmageStat('Goal')}
                  disabled={isSaving || possessionTeam !== activeTab || !activePossessionPlayer}
                  className="col-span-1 h-14 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white border border-emerald-500/20 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center"
                >
                  Score
                </button>
                <button
                  onClick={() => handleRecordScrimmageStat('Throwaway')}
                  disabled={isSaving || possessionTeam !== activeTab || !activePossessionPlayer}
                  className="h-14 bg-slate-950 hover:bg-slate-900 border border-slate-850 disabled:opacity-40 text-xs font-black uppercase tracking-widest rounded-2xl text-rose-400 hover:text-rose-350 transition-all flex items-center justify-center"
                >
                  Throwaway
                </button>
                <button
                  onClick={() => handleRecordScrimmageStat('Drop')}
                  disabled={isSaving || possessionTeam !== activeTab || !activePossessionPlayer}
                  className="h-14 bg-slate-950 hover:bg-slate-900 border border-slate-850 disabled:opacity-40 text-xs font-black uppercase tracking-widest rounded-2xl text-rose-400 hover:text-rose-350 transition-all flex items-center justify-center"
                >
                  Drop
                </button>
              </div>

              {/* Console Sync Feed */}
              <div className="flex items-center justify-between pt-4 mt-6 text-[9px] text-slate-500 font-bold uppercase border-t border-slate-850">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 bg-indigo-500 rounded-full animate-pulse"></span>
                  <span>{isSaving ? 'Logging to DB...' : lastSaved || 'Awaiting scrimmage play...'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        
        /* 2. DRILL MODE SCORER RENDERING (ORIGINAL FUNCTIONAL ROTATIONS AND LOCKS) */
        <div className="min-h-screen bg-slate-950 p-2 sm:p-4 text-slate-100 flex flex-col justify-between max-h-[100dvh] overflow-hidden w-full">
          
          {/* Scoreboard Header */}
          <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl flex items-center justify-between shrink-0 shadow-xl">
            <div>
              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                Drill Mode ({activeDrill?.flow_type === 'rep_based' ? 'Rep-based' : 'Continuous'})
              </span>
              <h2 className="text-base sm:text-lg font-black text-white mt-1.5">{activeDrill?.name}</h2>
            </div>
            
            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest block">Active Sequence</span>
              <span className="text-sm font-black font-mono text-indigo-400 block mt-1">
                {possessionChain.length > 0 ? possessionChain.join(' → ') : 'Idle'}
              </span>
            </div>
          </div>

          {/* Drill Action Controls Row */}
          <div className="flex gap-3 mt-3 shrink-0 max-w-md mx-auto w-full">
            <button className="flex-1 py-3 bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl text-slate-400 flex items-center justify-center gap-1.5 cursor-default">
              <span>⚡ Active Drill</span>
            </button>
            <button 
              onClick={handleQuitSession}
              className="flex-1 py-3 bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl text-rose-400 hover:text-rose-350 transition-all flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5 text-rose-450" /> Quit
            </button>
            <button 
              onClick={handleUndo}
              disabled={isSaving}
              className="flex-1 py-3 bg-slate-900 border border-white/5 text-[9px] font-black uppercase tracking-widest rounded-xl text-indigo-400 hover:text-indigo-300 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              ↩ Undo
            </button>
          </div>

          {/* Drill Configuration Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl mt-3 max-w-md mx-auto w-full text-xs shrink-0 shadow-md">
            <label className="flex items-center gap-2 cursor-pointer font-extrabold uppercase tracking-widest text-[9px] text-slate-400 select-none">
              <input 
                type="checkbox" 
                checked={dropEndsDrill} 
                onChange={(e) => setDropEndsDrill(e.target.checked)} 
                className="w-4 h-4 bg-slate-950 border-slate-850 text-indigo-500 rounded cursor-pointer focus:ring-0 focus:ring-offset-0" 
              />
              <span>Drop Ends Rep</span>
            </label>
            
            {activeDrill?.flow_type === 'rep_based' && (
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[9px] text-slate-500 uppercase tracking-widest">Rep Flow:</span>
                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                  {[2, 3, 4, 5].map(len => (
                    <button
                      key={len}
                      onClick={() => setRepFlowLength(len)}
                      className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wider transition-all ${
                        repFlowLength === len 
                          ? 'bg-indigo-600 text-white shadow-sm border border-indigo-500/20' 
                          : 'text-slate-500 hover:text-slate-350 border border-transparent'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Pitch Rotation */}
          <div className="my-3 flex-1 overflow-y-auto min-h-0 bg-slate-950 p-2 border border-slate-900 rounded-2xl flex flex-col justify-center">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {players?.filter(p => p.is_active).map(player => {
                const isHolder = possessionChain.includes(player.name);
                const isActiveThrower = possessionChain.length > 0 && possessionChain[possessionChain.length - 1] === player.name;
                const isLocked = lockedThrowerId === player.name;

                let cardClass = 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white';
                if (isLocked) {
                  cardClass = 'bg-blue-600 text-white border-blue-400 ring-4 ring-blue-400/50 shadow-lg shadow-blue-600/30';
                } else if (isActiveThrower) {
                  cardClass = 'bg-blue-950/60 text-blue-300 border-blue-600/40 shadow-inner ring-2 ring-blue-500/30';
                } else if (isHolder) {
                  cardClass = 'bg-indigo-950/40 text-indigo-300 border-indigo-900/60';
                }

                return (
                  <button
                    key={player.name}
                    onClick={() => handleDrillPlayerCardTap(player.name)}
                    className={`relative h-20 sm:h-24 rounded-2xl border flex flex-col items-center justify-center p-2 transition-all font-black uppercase text-sm ${cardClass}`}
                  >
                    {isLocked && (
                      <div className="absolute top-1.5 right-1.5 text-blue-200">
                        <Lock className="w-3.5 h-3.5 fill-blue-250/20" />
                      </div>
                    )}
                    {player.shirt_number ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-extrabold block">{player.shirt_number}</span>
                        <span className="text-[10px] truncate max-w-full tracking-wider mt-1">{player.name}</span>
                      </>
                    ) : (
                      <span className="truncate max-w-full font-bold">{player.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drill Metric Grid Panel */}
          <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 rounded-2xl shrink-0 space-y-3">
            <div className={`grid gap-2 ${
              filteredMetrics.length === 2 ? 'grid-cols-2' : 
              filteredMetrics.length === 3 ? 'grid-cols-3' : 'grid-cols-4'
            }`}>
              {filteredMetrics.map((actionLabel) => {
                const clickHandler = () => handleRecordDrillStat(actionLabel);

                const isOrangeDef = actionLabel.toLowerCase().includes('def') || actionLabel.toLowerCase().includes('d-') || actionLabel.toLowerCase().includes('block');
                const isPending = pendingAction === actionLabel;
                
                const btnColorClass = isPending
                  ? 'bg-rose-600 border-rose-450 text-white shadow-lg shadow-rose-500/25 ring-2 ring-rose-405 animate-pulse'
                  : isOrangeDef
                    ? 'bg-orange-600/30 border border-orange-500/30 text-orange-400 hover:bg-orange-600/50'
                    : 'bg-slate-800 border-slate-700/80 text-slate-200 hover:bg-slate-700/60';

                return (
                  <button
                    key={actionLabel}
                    onClick={clickHandler}
                    disabled={isSaving || possessionChain.length === 0}
                    className={`h-14 sm:h-16 rounded-xl font-bold uppercase text-[10px] sm:text-xs tracking-tighter flex items-center justify-center border transition-all active:scale-95 disabled:opacity-40 ${btnColorClass}`}
                  >
                    {actionLabel}
                  </button>
                );
              })}
            </div>

            {/* Console Sync Feed */}
            <div className="flex items-center justify-between pt-2 text-[10px] text-slate-500 font-bold uppercase border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                <span>
                  {isSaving 
                    ? 'Logging rep...' 
                    : pendingAction 
                      ? `Select receiver to attribute ${pendingAction} (or click again to log thrower)`
                      : lastSaved || 'Awaiting rep cycle...'}
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default TrainingScorer;
