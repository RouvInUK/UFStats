import React, { useState, useEffect, useRef } from 'react';
import { Dumbbell, Shield, LayoutGrid, Check, Plus, RefreshCw, X, ArrowLeft, Users, Zap, BookOpen, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useDrillState } from '../contexts/DrillStateContext';
import { fetchAllGameNames, deleteGame } from '../supabaseClient';

const TrainingSetupScreen = ({ players, setPlayers, currentTeam, targetTeamId, onNavigate }) => {
  const {
    drills,
    activeDrill,
    isGhostScrimmage,
    setIsGhostScrimmage,
    lightShirtPlayers,
    darkShirtPlayers,
    setLightShirtPlayers,
    setDarkShirtPlayers,
    selectDrill,
    createCustomDrill
  } = useDrillState();

  const [hasSavedScrimmage, setHasSavedScrimmage] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ufstats_active_scrimmage_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.activeSessionId && (parsed.activeSessionId.includes('Training scrimmage') || parsed.activeSessionId.startsWith('Scrimmage: '))) {
          setHasSavedScrimmage(true);
        } else {
          setHasSavedScrimmage(false);
        }
      } else {
        setHasSavedScrimmage(false);
      }
    } catch {
      setHasSavedScrimmage(false);
    }
  }, [targetTeamId]);

  const [activeTab, setActiveTab] = useState('drills'); // 'drills', 'scrimmage', or 'history'
  const [recordedSessions, setRecordedSessions] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = async () => {
    if (!targetTeamId) return;
    setIsLoadingHistory(true);
    try {
      const names = await fetchAllGameNames(targetTeamId);
      // Filter only game names that represent training drills or scrimmages
      const filtered = names.filter(
        name => name.startsWith('Training drill ') || 
                name.startsWith('Training scrimmage ') ||
                name.startsWith('Drill: ') ||
                name.startsWith('Scrimmage: ')
      );
      // Sort newest first
      filtered.sort((a, b) => b.localeCompare(a));
      setRecordedSessions(filtered);
    } catch (err) {
      console.error("Failed to load recorded sessions history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, targetTeamId]);

  const parseSessionName = (sessionName) => {
    let isDrill = false;
    let displayName = '';
    let sessionDate = '';

    if (sessionName.startsWith('Drill: ')) {
      isDrill = true;
      const parts = sessionName.replace('Drill: ', '').split('::');
      displayName = parts[0] || 'Drill';
      sessionDate = parts[1] || '';
    } else if (sessionName.startsWith('Scrimmage: ')) {
      isDrill = false;
      const parts = sessionName.replace('Scrimmage: ', '').split('::');
      displayName = parts[0] || 'Scrimmage';
      sessionDate = parts[1] || '';
    } else if (sessionName.startsWith('Training drill ')) {
      isDrill = true;
      displayName = 'Active Drill';
      sessionDate = sessionName.replace('Training drill ', '');
    } else if (sessionName.startsWith('Training scrimmage ')) {
      isDrill = false;
      displayName = 'Jersey Scrimmage';
      sessionDate = sessionName.replace('Training scrimmage ', '');
    } else {
      displayName = sessionName;
    }

    return { isDrill, displayName, sessionDate };
  };

  const handleDeleteSession = async (gameName) => {
    const { isDrill } = parseSessionName(gameName);
    const label = isDrill ? 'drill session' : 'scrimmage match';
    
    if (!confirm(`Are you sure you want to permanently delete this ${label} ("${sessionDisplay(gameName)}")? All stats logged for this session will be lost.`)) {
      return;
    }

    try {
      await deleteGame(gameName, targetTeamId);
      alert(`Deleted ${label} successfully.`);
      loadHistory();
    } catch (err) {
      console.error(err);
      alert("Failed to delete session.");
    }
  };

  const sessionDisplay = (name) => {
    const { isDrill, displayName, sessionDate } = parseSessionName(name);
    const prefix = isDrill ? 'Practice Drill' : 'Jersey Scrimmage';
    return `${prefix}: ${displayName} (${sessionDate})`;
  };

  const playersListRef = useRef(null);

  const handleJumpToPlayers = () => {
    playersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [drillLineup, setDrillLineup] = useState([]);
  const [collapsedDays, setCollapsedDays] = useState({});

  const toggleDayCollapse = (dayKey) => {
    setCollapsedDays(prev => {
      const currentCollapsed = prev[dayKey] !== false;
      return {
        ...prev,
        [dayKey]: !currentCollapsed
      };
    });
  };

  const groupSessionsByDay = (sessions) => {
    const groups = {};
    sessions.forEach(session => {
      const { isDrill, displayName, sessionDate } = parseSessionName(session);
      const datePart = sessionDate.split(' ')[0] || 'Unknown Date';
      
      let formattedDay = datePart;
      try {
        const parts = datePart.split('-');
        if (parts.length === 3) {
          const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          if (!isNaN(dateObj.getTime())) {
            formattedDay = dateObj.toLocaleDateString(undefined, { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });
          }
        }
      } catch {}

      if (!groups[datePart]) {
        groups[datePart] = {
          dayLabel: formattedDay,
          sessions: []
        };
      }
      groups[datePart].sessions.push(session);
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(key => ({
        dayKey: key,
        dayLabel: groups[key].dayLabel,
        sessions: groups[key].sessions
      }));
  };
  
  // Custom drill creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scrimmageName, setScrimmageName] = useState('');
  const [newDrillName, setNewDrillName] = useState('');
  const [newDrillCategory, setNewDrillCategory] = useState('Cutting');
  const [newDrillFlowType, setNewDrillFlowType] = useState('continuous');
  const [newDrillMetrics, setNewDrillMetrics] = useState(['', '', '', '']);
  const [newDrillActions, setNewDrillActions] = useState(['Custom', 'Custom', 'Custom', 'Custom']);
  const [newDrillIsPublic, setNewDrillIsPublic] = useState(false);
  const [isSavingDrill, setIsSavingDrill] = useState(false);

  // Load standard active players as initial drill selection
  useEffect(() => {
    if (players && players.length > 0) {
      const activeNames = players.filter(p => p.is_active).map(p => p.name);
      setDrillLineup(activeNames.length > 0 ? activeNames : players.slice(0, 7).map(p => p.name));
    }
  }, [players]);

  // Handle player toggle in Drill Mode active rotation
  const handleToggleDrillPlayer = (playerName) => {
    setDrillLineup(prev => 
      prev.includes(playerName)
        ? prev.filter(name => name !== playerName)
        : [...prev, playerName]
    );
  };

  const handleSelectAllDrillPlayers = () => {
    if (!players || players.length === 0) return;
    const allNames = players.map(p => p.name).filter(Boolean);
    if (drillLineup.length === allNames.length) {
      setDrillLineup([]);
    } else {
      setDrillLineup(allNames);
    }
  };

  // Handle jersey team allocations in Scrimmage Mode
  const handleAssignScrimmageTeam = (playerName, team) => {
    if (team === 'light') {
      setDarkShirtPlayers(prev => prev.filter(name => name !== playerName));
      setLightShirtPlayers(prev => 
        prev.includes(playerName) ? prev.filter(name => name !== playerName) : [...prev, playerName]
      );
    } else if (team === 'dark') {
      setLightShirtPlayers(prev => prev.filter(name => name !== playerName));
      setDarkShirtPlayers(prev => 
        prev.includes(playerName) ? prev.filter(name => name !== playerName) : [...prev, playerName]
      );
    }
  };

  // Smart Auto-Roster Balancing Engine
  const handleAutoSplit = () => {
    if (!players || players.length === 0) return;
    
    // Partition FMPs (Female Matching Players) and other roster entries
    const fmpPlayers = players.filter(p => p.gender_designation === 'fmp');
    const otherPlayers = players.filter(p => p.gender_designation !== 'fmp');
    
    // Shuffle groups independently for organic variability
    const shuffledFmp = [...fmpPlayers].sort(() => 0.5 - Math.random());
    const shuffledOther = [...otherPlayers].sort(() => 0.5 - Math.random());
    
    const lightTeam = [];
    const darkTeam = [];
    
    // Allocate FMP players side-by-side as equally as possible
    shuffledFmp.forEach((player, idx) => {
      if (idx % 2 === 0) {
        lightTeam.push(player.name);
      } else {
        darkTeam.push(player.name);
      }
    });
    
    // Allocate other roster players greedily to minimize final squad size variance
    shuffledOther.forEach((player) => {
      if (lightTeam.length <= darkTeam.length) {
        lightTeam.push(player.name);
      } else {
        darkTeam.push(player.name);
      }
    });
    
    setLightShirtPlayers(lightTeam);
    setDarkShirtPlayers(darkTeam);
  };

  // Reset jersey mappings
  const handleClearScrimmage = () => {
    setLightShirtPlayers([]);
    setDarkShirtPlayers([]);
  };

  const handleCreateDrillSubmit = async (e) => {
    e.preventDefault();
    if (!newDrillName.trim()) return alert("Enter drill name.");
    
    const cleanedMetrics = newDrillMetrics
      .map((m, idx) => {
        const label = m.trim();
        if (!label) return null;
        const action = newDrillActions[idx] || 'Custom';
        return `${label}::${action}`;
      })
      .filter(Boolean);

    if (cleanedMetrics.length === 0) {
      return alert("Please fill in at least one dynamic metric label.");
    }

    setIsSavingDrill(true);
    try {
      const res = await createCustomDrill({
        name: newDrillName,
        category: newDrillCategory,
        flowType: newDrillFlowType,
        metrics: cleanedMetrics,
        isPublic: newDrillIsPublic
      });
      if (res && res.success) {
        alert("Custom drill registered successfully!");
        setShowCreateModal(false);
        setNewDrillName('');
        setNewDrillMetrics(['', '', '', '']);
        setNewDrillActions(['Custom', 'Custom', 'Custom', 'Custom']);
      } else {
        alert(res.error || "Failed to save drill.");
      }
    } catch (err) {
      alert("Failed to save custom drill.");
    } finally {
      setIsSavingDrill(false);
    }
  };

  const handleStartDrillMode = () => {
    if (drillLineup.length < 2) {
      return alert("Please select at least 2 active players to run rotating drill cycles.");
    }
    
    // Update core active flags in players array to match selection
    if (players && setPlayers) {
      const updated = players.map(p => ({
        ...p,
        is_active: drillLineup.includes(p.name)
      }));
      setPlayers(updated);
    }

    setIsGhostScrimmage(false);
    onNavigate('training_scorer');
  };

  const handleResumeScrimmageMode = () => {
    setIsGhostScrimmage(true);
    onNavigate('training_scorer');
  };

  const handleStartScrimmageMode = () => {
    if (hasSavedScrimmage) {
      if (!confirm("Starting a new scrimmage will discard the stats and progress of your currently active scrimmage. Do you want to continue?")) {
        return;
      }
      localStorage.removeItem('ufstats_active_scrimmage_state');
    }

    if (lightShirtPlayers.length === 0 || darkShirtPlayers.length === 0) {
      return alert("Assign players to both Light Shirts and Dark Shirts before launching Trainings Scrimmage.");
    }
    
    // Save the custom scrimmage name to localStorage
    const finalScrimmageName = scrimmageName.trim() || 'Jersey Scrimmage';
    localStorage.setItem('ufstats_pending_scrimmage_name', finalScrimmageName);

    // Scrimmage active roster is the union of light and dark shirt teams
    const allScrimmagePlayers = [...lightShirtPlayers, ...darkShirtPlayers];
    if (players && setPlayers) {
      const updated = players.map(p => ({
        ...p,
        is_active: allScrimmagePlayers.includes(p.name)
      }));
      setPlayers(updated);
    }

    setIsGhostScrimmage(true);
    onNavigate('training_scorer');
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8 pb-32 text-slate-100 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-xl gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
              <Dumbbell className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-widest text-white">Trainings Desk</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">{currentTeam} Roster Workspace</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {activeTab === 'drills' && (
              <button
                onClick={handleJumpToPlayers}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-650/30 font-bold rounded-xl transition-all border border-indigo-500/20 text-indigo-400"
              >
                <Users className="w-4 h-4" /> Select Players
              </button>
            )}
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition-all border border-slate-700/50 text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
          </div>
        </div>

        {/* Sticky Active Session Banner */}
        {hasSavedScrimmage && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg shadow-emerald-900/10 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping shrink-0" />
              <div>
                <h4 className="font-extrabold text-white text-sm uppercase tracking-wider">Active Scrimmage Match in Progress</h4>
                <p className="text-xs text-slate-400 mt-0.5">You have a scrimmage match paused. Return to scorer to continue logging stats.</p>
              </div>
            </div>
            <button
              onClick={handleResumeScrimmageMode}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              Resume Scrimmage Scorer
            </button>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex gap-2 p-1.5 bg-slate-900/40 border border-white/5 rounded-2xl">
          <button
            onClick={() => setActiveTab('drills')}
            className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
              activeTab === 'drills' 
                ? 'bg-slate-950 text-white border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-350'
            }`}
          >
            <Zap className="w-4 h-4 text-indigo-400" /> Drills
          </button>
          <button
            onClick={() => setActiveTab('scrimmage')}
            className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
              activeTab === 'scrimmage' 
                ? 'bg-slate-950 text-white border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-350'
            }`}
          >
            <Users className="w-4 h-4 text-amber-500" /> Scrimmages
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
              activeTab === 'history' 
                ? 'bg-slate-950 text-white border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-350'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" /> Recorded Sessions
          </button>
        </div>

        {/* DRILLS WORKSPACE PANEL */}
        {activeTab === 'drills' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left: Drill Selector Card deck */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <button
                    onClick={() => setLibraryCollapsed(!libraryCollapsed)}
                    className="flex items-center gap-2 text-left outline-none group selection:bg-transparent"
                  >
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    <span className="text-lg font-black uppercase tracking-widest text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                      Drill Specifications Library
                      {libraryCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-all" />
                      ) : (
                        <ChevronUp className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-all" />
                      )}
                    </span>
                  </button>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/10 text-white"
                  >
                    <Plus className="w-3.5 h-3.5" /> Custom
                  </button>
                </div>

                {!libraryCollapsed && (
                  <div className="grid grid-cols-1 gap-4">
                    {drills.map(drill => {
                      const isSelected = activeDrill?.id === drill.id;
                      return (
                        <div
                          key={drill.id}
                          onClick={() => selectDrill(drill.id)}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-950/40 border-indigo-500/80 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {drill.category}
                              </span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                                (drill.flow_type || drill.flowType) === 'rep_based'
                                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                              }`}>
                                {(drill.flow_type || drill.flowType) === 'rep_based' ? 'Rep-by-Rep' : 'Continuous'}
                              </span>
                            </div>
                            <h4 className="text-base font-extrabold text-white">{drill.name}</h4>
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                            <div className="text-[10px] text-slate-500 font-extrabold uppercase">Telemetry Labels:</div>
                            <div className="flex gap-1 overflow-hidden">
                              {drill.metrics?.slice(0, 3).map((m, idx) => (
                                <span key={idx} className="text-[9px] font-bold bg-slate-950 px-2 py-0.5 border border-white/5 rounded text-slate-400 truncate max-w-[80px]">
                                  {m.split('::')[0]}
                                </span>
                              ))}
                              {drill.metrics?.length > 3 && <span className="text-[9px] font-bold text-slate-500">...</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Start Drill Card */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h4 className="font-extrabold text-white text-base">Launch Drill Scorer</h4>
                  <p className="text-xs text-slate-400 mt-1">Ready to run rotating repetitions for {activeDrill?.name} with {drillLineup.length} active players.</p>
                </div>
                <button
                  onClick={handleStartDrillMode}
                  className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  Start Drill Sessions
                </button>
              </div>
            </div>

            {/* Right: Pick rotation players */}
            <div ref={playersListRef} className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">
                  Rotation Lines ({drillLineup.length})
                </h3>
                <button
                  onClick={handleSelectAllDrillPlayers}
                  className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  {players && drillLineup.length === players.map(p => p.name).filter(Boolean).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <p className="text-xs text-slate-400">Select which players are active in the rotating queue for rapid rep tracking.</p>
              
              <div className="space-y-2">
                {players?.map(player => {
                  const isSelected = drillLineup.includes(player.name);
                  return (
                    <button
                      key={player.name}
                      onClick={() => handleToggleDrillPlayer(player.name)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-slate-800/80 border-indigo-500/50 text-white font-bold'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900/60'
                      }`}
                    >
                      <span className="truncate">{player.name}</span>
                      {isSelected ? (
                        <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-700"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* SCRIMMAGE MATCH WORKSPACE PANEL */}
        {activeTab === 'scrimmage' && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
              
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest text-white">Jersey Swapping Roster allocation</h3>
                  <p className="text-xs text-slate-400 mt-1">Split your roster into Light and Dark shirts to track both teams simultaneously in a trainings scrimmage.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleAutoSplit}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-white/5 transition-all text-slate-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Auto Split
                  </button>
                  <button
                    onClick={handleClearScrimmage}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-950/20 hover:bg-rose-900/30 text-xs font-bold rounded-xl border border-rose-500/20 transition-all text-rose-300"
                  >
                    <X className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
              </div>

              {/* Roster Swap Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Column 1: Light Shirts */}
                <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-400">⬜ Light Shirts ({lightShirtPlayers.length})</span>
                  </div>
                  <div className="space-y-2 min-h-[250px] max-h-[350px] overflow-y-auto pr-1">
                    {lightShirtPlayers.map(name => (
                      <div key={name} className="p-3 bg-slate-100 text-slate-900 border border-slate-200 rounded-xl flex items-center justify-between font-bold text-sm shadow-md">
                        <span className="truncate pr-2">{name}</span>
                        <button 
                          onClick={() => handleAssignScrimmageTeam(name, 'light')}
                          className="p-1 hover:bg-slate-200 rounded"
                          title="Move to Bench"
                        >
                          <X className="w-4 h-4 text-slate-600" />
                        </button>
                      </div>
                    ))}
                    {lightShirtPlayers.length === 0 && (
                      <div className="h-full min-h-[200px] flex items-center justify-center text-center text-xs text-slate-600 font-bold uppercase tracking-wider">No Lights Assigned</div>
                    )}
                  </div>
                </div>

                {/* Column 2: Unassigned Bench */}
                <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">👤 Bench / Unassigned</span>
                  </div>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {players?.filter(p => !lightShirtPlayers.includes(p.name) && !darkShirtPlayers.includes(p.name)).map(player => (
                      <div key={player.name} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300 font-semibold text-sm">
                        <span className="truncate pr-1">{player.name}</span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleAssignScrimmageTeam(player.name, 'light')}
                            className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-[10px] font-black uppercase border border-slate-700 text-indigo-400 rounded-md"
                          >
                            Light
                          </button>
                          <button
                            onClick={() => handleAssignScrimmageTeam(player.name, 'dark')}
                            className="px-2 py-1 bg-slate-950 hover:bg-slate-900 text-[10px] font-black uppercase border border-slate-800 text-amber-500 rounded-md"
                          >
                            Dark
                          </button>
                        </div>
                      </div>
                    ))}
                    {players?.filter(p => !lightShirtPlayers.includes(p.name) && !darkShirtPlayers.includes(p.name)).length === 0 && (
                      <div className="min-h-[200px] flex items-center justify-center text-center text-xs text-slate-600 font-bold uppercase tracking-wider">All Active on Field</div>
                    )}
                  </div>
                </div>

                {/* Column 3: Dark Shirts */}
                <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-500">⬛ Dark Shirts ({darkShirtPlayers.length})</span>
                  </div>
                  <div className="space-y-2 min-h-[250px] max-h-[350px] overflow-y-auto pr-1">
                    {darkShirtPlayers.map(name => (
                      <div key={name} className="p-3 bg-slate-950 text-slate-100 border border-slate-800 rounded-xl flex items-center justify-between font-bold text-sm shadow-md">
                        <span className="truncate pr-2">{name}</span>
                        <button 
                          onClick={() => handleAssignScrimmageTeam(name, 'dark')}
                          className="p-1 hover:bg-slate-900 rounded"
                          title="Move to Bench"
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    ))}
                    {darkShirtPlayers.length === 0 && (
                      <div className="h-full min-h-[200px] flex items-center justify-center text-center text-xs text-slate-600 font-bold uppercase tracking-wider">No Darks Assigned</div>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Scrimmage Configuration and Launch Card */}
            <div className="bg-indigo-950/10 border border-indigo-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800/60">
                <div>
                  <h4 className="font-extrabold text-white text-base">Scrimmage Match Details</h4>
                  <p className="text-xs text-slate-400 mt-1">Provide an optional name for this scrimmage to identify it in your recorded sessions history.</p>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Wednesday night 5v5"
                  value={scrimmageName}
                  onChange={(e) => setScrimmageName(e.target.value)}
                  className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-650 outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2">
                <div className="flex-1">
                  <h4 className="font-extrabold text-white text-sm">Launch Scrimmage Match Scorer</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Ready to run a Trainings Match between Light Shirts ({lightShirtPlayers.length}) and Dark Shirts ({darkShirtPlayers.length}).</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                  {hasSavedScrimmage && (
                    <button
                      onClick={handleResumeScrimmageMode}
                      className="flex-1 sm:flex-none px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-600/20 border border-emerald-500 flex items-center justify-center gap-1.5"
                    >
                      <span>▶</span> Resume Scrimmage
                    </button>
                  )}
                  <button
                    onClick={handleStartScrimmageMode}
                    className="flex-1 sm:flex-none px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                  >
                    {hasSavedScrimmage ? 'Start New Scrimmage' : 'Start Scrimmage Match'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY / RECORDED WORKSPACE PANEL */}
        {activeTab === 'history' && (
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">Recorded Training Sessions</h3>
              <p className="text-xs text-slate-400 mt-1">Review, manage, or delete logged drill repetitions and trainings scrimmages for this roster.</p>
            </div>

            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Retrieving training archives...</span>
              </div>
            ) : recordedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-2xl gap-3 bg-slate-950/20">
                <Dumbbell className="w-12 h-12 text-slate-700" />
                <span className="text-sm font-black text-slate-650 uppercase tracking-widest">No recorded sessions found</span>
                <p className="text-xs text-slate-500 text-center max-w-sm">Launch a Drill Session or Scrimmage Match to begin logging data to your training archives.</p>
              </div>
            ) : (
              <div className="space-y-4 pr-1">
                {groupSessionsByDay(recordedSessions).map(({ dayKey, dayLabel, sessions }) => {
                  const isCollapsed = collapsedDays[dayKey] !== false;
                  return (
                    <div key={dayKey} className="space-y-3">
                      {/* Day Group Header */}
                      <button
                        onClick={() => toggleDayCollapse(dayKey)}
                        className="w-full flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                          <span className="text-xs sm:text-sm font-black text-slate-200 group-hover:text-white uppercase tracking-wider transition-colors">{dayLabel}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-900 border border-white/5 px-2.5 py-1 rounded-lg">
                            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                          </span>
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
                          )}
                        </div>
                      </button>

                      {/* Day Group Sessions List */}
                      {!isCollapsed && (
                        <div className="grid grid-cols-1 gap-2.5 pl-2 border-l border-indigo-500/10 ml-5 space-y-1">
                          {sessions.map(sessionName => {
                            const { isDrill, displayName, sessionDate } = parseSessionName(sessionName);
                            const timePart = sessionDate.split(' ')[1] || sessionDate;

                            return (
                              <div
                                key={sessionName}
                                className="p-4 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-xl transition-all flex items-center justify-between gap-4"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div className={`p-2.5 rounded-lg shrink-0 ${
                                    isDrill 
                                      ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' 
                                      : 'bg-amber-600/10 border border-amber-500/20 text-amber-400'
                                  }`}>
                                    {isDrill ? <Zap className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border leading-none ${
                                        isDrill 
                                          ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                                          : 'bg-amber-500/10 border-amber-500/20 text-amber-455'
                                      }`}>
                                        {isDrill ? 'Drill' : 'Scrimmage'}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-extrabold">{timePart}</span>
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-200 mt-1 truncate max-w-full">
                                      {displayName}
                                    </h4>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDeleteSession(sessionName)}
                                  className="px-3 py-2 bg-rose-950/20 hover:bg-rose-900/30 text-[10px] font-black uppercase border border-rose-500/20 transition-all text-rose-450 hover:text-rose-450 rounded-lg shrink-0 flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* CREATE CUSTOM DRILL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-lg text-white uppercase tracking-widest">Create Custom Drill</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-450 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateDrillSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Drill Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pivot Break reset"
                  value={newDrillName}
                  onChange={(e) => setNewDrillName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                  <select
                    value={newDrillCategory}
                    onChange={(e) => setNewDrillCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
                  >
                    <option value="Cutting">Cutting</option>
                    <option value="Timing">Timing</option>
                    <option value="Field Awareness">Field Awareness</option>
                    <option value="Conditioning">Conditioning</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Flow Type</label>
                  <select
                    value={newDrillFlowType}
                    onChange={(e) => setNewDrillFlowType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
                  >
                    <option value="continuous">Continuous</option>
                    <option value="rep_based">Rep-Based</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Metrics Grid Buttons (Up to 4)</label>
                <div className="space-y-2">
                  {newDrillMetrics.map((m, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required={idx === 0}
                        placeholder={idx === 0 ? "Button 1 Label (Required)" : `Button ${idx + 1} Label (Optional)`}
                        value={m}
                        onChange={(e) => {
                          const next = [...newDrillMetrics];
                          next[idx] = e.target.value;
                          setNewDrillMetrics(next);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 outline-none focus:border-indigo-500/50"
                      />
                      <select
                        value={newDrillActions[idx] || 'Custom'}
                        onChange={(e) => {
                          const next = [...newDrillActions];
                          next[idx] = e.target.value;
                          setNewDrillActions(next);
                        }}
                        className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-300 outline-none cursor-pointer focus:border-indigo-500/50"
                      >
                        <option value="Custom">Custom Action</option>
                        <option value="Pass">Pass / Catch</option>
                        <option value="Drop">Dropped Pass</option>
                        <option value="Throwaway">Throwaway</option>
                        <option value="Defence">Defence / Block</option>
                        <option value="Point">Goal / Score</option>
                        <option value="Stall Out">Stall Out</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 pb-4">
                <input
                  type="checkbox"
                  id="make_public_box"
                  checked={newDrillIsPublic}
                  onChange={(e) => setNewDrillIsPublic(e.target.checked)}
                  className="w-4 h-4 bg-slate-950 border-slate-850 rounded text-indigo-600 cursor-pointer"
                />
                <label htmlFor="make_public_box" className="text-xs text-slate-400 font-bold uppercase tracking-wider cursor-pointer">
                  Request to add to Public library 🌐
                </label>
              </div>

              <button
                type="submit"
                disabled={isSavingDrill}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md"
              >
                {isSavingDrill ? 'SAVING...' : 'REGISTER CUSTOM DRILL'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TrainingSetupScreen;
