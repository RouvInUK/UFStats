import { useState, useEffect, useRef } from 'react';
import { recordStatToDB, fetchActiveGames, clearActiveLineup, fetchLastStatForGame, deleteStat, fetchGameStats } from '../supabaseClient';
import { Undo2, ArrowLeftRight, Mic, MicOff } from 'lucide-react';
import Fuse from 'fuse.js';
import { playChime, playClick, playBuzz } from '../utils/audioFeedback';

const Dashboard = ({ activeLineup, currentPoint, setCurrentPoint, currentGame, gameType, currentTeam, targetTeamId, opponentName, initialPossession, isTrackingActive, setIsTrackingActive, onNavigate, players, setPlayers, isVoiceEnabled, setIsVoiceEnabled }) => {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [flashType, setFlashType] = useState(null);

  // Voice Tracking State
  const [voiceFeedback, setVoiceFeedback] = useState('');
  const [voiceRecognizedAction, setVoiceRecognizedAction] = useState(null);
  const [voiceRecognizedPlayer, setVoiceRecognizedPlayer] = useState(null);
  const recognitionRef = useRef(null);

  const triggerFeedback = (type) => {
    setFlashType(type);
    
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'success') navigator.vibrate([50, 50, 50]);
        else if (type === 'error') navigator.vibrate([100, 50, 100]);
        else navigator.vibrate(40);
      }
    } catch {
      // Ignore haptic errors securely
    }

    setTimeout(() => setFlashType(null), 250); 
  };

  const [score, setScore] = useState({ us: 0, them: 0 });
  const [currentOD, setCurrentOD] = useState('O');
  const [liveOpponentName, setLiveOpponentName] = useState('Opponent');

  useEffect(() => {
    if (!currentGame) return;
    const loadGameContext = async () => {
       try {
          const stats = await fetchGameStats(currentGame, targetTeamId);
          let us = 0, them = 0;
          let od = initialPossession || 'O';
          let oppName = opponentName || 'Opponent';

          const chronStats = [...stats].reverse();
          chronStats.forEach(stat => {
              if (stat.stat_type === 'Start Offense') od = 'O';
              if (stat.stat_type === 'Start Defense') od = 'D';
              if (stat.stat_type === 'Half Time') od = od === 'O' ? 'D' : 'O';
              if (stat.stat_type === 'Point') { us += 1; od = 'D'; }
              if (stat.stat_type === 'Opponent Point') { them += 1; od = 'O'; }
              if (stat.stat_type === 'Match Metadata') oppName = stat.player;
          });
          setScore({ us, them });
          setCurrentOD(od);
          setLiveOpponentName(oppName);
       } catch (e) {
          console.error("Failed to load live score context", e);
       }
    };
    loadGameContext();
  }, [currentGame, isTrackingActive, lastSaved]);

  useEffect(() => {
    fetchActiveGames(targetTeamId).then(setActiveGames).catch(console.error);
  }, [targetTeamId]);

  useEffect(() => {
    const matchedGame = activeGames.find(g => g.name === currentGame);
    if (matchedGame && matchedGame.maxPoint) {
      setCurrentPoint(matchedGame.maxPoint);
    }
  }, [currentGame, activeGames, setCurrentPoint]);

  useEffect(() => {
    if (activeLineup.length > 0 && !activeLineup.includes(selectedPlayer)) {
      setSelectedPlayer(activeLineup[0]);
    } else if (activeLineup.length === 0) {
      setSelectedPlayer('');
    }
  }, [activeLineup, selectedPlayer]);

  const handleStatRecord = async (statType, overridePlayer = null) => {
    const activePlayer = overridePlayer || selectedPlayer;
    if (statType !== 'Opponent Point' && !activePlayer) return alert("Select a player first!");
    
    setIsSaving(true);
    setLastSaved(null);
    try {
      const pObj = players?.find(p => p.name === activePlayer);
      const dbPlayer = pObj?.shirt_number ? `${activePlayer} ${pObj.shirt_number}` : activePlayer;
      
      const statData = {
        player: statType === 'Opponent Point' ? 'Opponent' : dbPlayer,
        stat: statType,
        timestamp: new Date().toLocaleString(),
        pointNumber: currentPoint,
        gameName: currentGame,
        gameType: gameType,
        teamName: currentTeam,
      };
      await recordStatToDB(statData, targetTeamId);
      setLastSaved(statType === 'Opponent Point' ? `Saved Opponent Point` : `Saved ${statType} for ${activePlayer}`);
      
      if (statType === 'Point' || statType === 'Opponent Point') {
        setIsTrackingActive(false);
        clearActiveLineup(currentTeam).catch(console.error);
        if (players && setPlayers) {
            setPlayers(players.map(p => ({ ...p, is_active: false })));
        }
        setTimeout(() => {
          onNavigate('lineup');
        }, 1000);
      }

      if (statType === 'Point') {
        triggerFeedback('success');
      } else if (['Throwaway', 'Drop', 'Stall Out', 'Opponent Point'].includes(statType)) {
        triggerFeedback('error');
      } else {
        triggerFeedback('neutral');
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save. Check server logs.');
    } finally {
      setIsSaving(false);
    }
  };

  // Voice Tracking Engine
  useEffect(() => {
    if (!isVoiceEnabled || !isTrackingActive) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setVoiceFeedback('');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceFeedback("Voice tracking not supported on this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const commands = {
      'opponent scored': 'Opponent Point',
      'scored': 'Point',
      'pass': 'Pass',
      'incomplete': 'Throwaway',
      'drop': 'Drop',
      'stall out': 'Stall Out',
      'defence': 'Defence',
      'defense': 'Defence'
    };

    // We no longer use fuse for phonetic name matching; we strictly match shirt numbers
    // const fuse = new Fuse(activeLineup, { threshold: 0.4 });

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      
      let matchedAction = null;
      let matchedActionKey = null;
      
      for (const [phrase, action] of Object.entries(commands)) {
        if (transcript.includes(phrase)) {
          matchedAction = action;
          matchedActionKey = phrase;
          break;
        }
      }

      if (!matchedAction) {
         setVoiceFeedback(`Heard: "${transcript}" (No match)`);
         return;
      }

      if (matchedAction === 'Opponent Point') {
         setVoiceFeedback(`Heard: "Opponent Scored" ✓`);
         setVoiceRecognizedAction('Opponent Point');
         playBuzz();
         handleStatRecord('Opponent Point');
         setTimeout(() => setVoiceRecognizedAction(null), 500);
         return;
      }

      const remainingText = transcript.replace(matchedActionKey, '').trim();
      
      let targetPlayer = null;
      const numberMatch = remainingText.match(/\b([A-Za-z0-9]{1,3})\b/);
      
      if (numberMatch) {
         const spokenNumber = numberMatch[1];
         const activePlayerObjects = activeLineup.map(name => players?.find(p => p.name === name)).filter(Boolean);
         const foundObj = activePlayerObjects.find(p => p.shirt_number && p.shirt_number.toLowerCase() === spokenNumber);
         if (foundObj) {
            targetPlayer = foundObj.name;
         }
      } else if (activeLineup.length === 1) {
         targetPlayer = activeLineup[0];
      }

      if (targetPlayer) {
        setVoiceFeedback(`Heard: "${targetPlayer} ${matchedActionKey}" ✓`);
        setVoiceRecognizedAction(matchedAction);
        setVoiceRecognizedPlayer(targetPlayer);
        
        if (['Point', 'Defence'].includes(matchedAction)) {
           playChime();
        } else if (matchedAction === 'Pass') {
           playClick();
        } else {
           playBuzz();
        }

        handleStatRecord(matchedAction, targetPlayer);
        
        setTimeout(() => {
          setVoiceRecognizedAction(null);
          setVoiceRecognizedPlayer(null);
        }, 500);
      } else {
        setVoiceFeedback(`Heard: "${matchedActionKey}" (Unknown player)`);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
         setVoiceFeedback(`Mic error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isVoiceEnabled && isTrackingActive && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch(e) {
          // Ignore
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setVoiceFeedback("Listening...");
    } catch (e) {
      console.error("Failed to start speech recognition", e);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isVoiceEnabled, isTrackingActive, activeLineup, selectedPlayer]);

  const handleUndo = async () => {
    if (!currentGame) return;
    setIsSaving(true);
    try {
      const lastStat = await fetchLastStatForGame(currentGame, targetTeamId);
      if (!lastStat) {
        alert("No recent actions found to undo for this game.");
        return;
      }
      
      const isPoint = lastStat.stat_type === 'Point' || lastStat.stat_type === 'Opponent Point';
      if (isPoint) {
        if (!window.confirm(`Are you sure you want to undo this ${lastStat.stat_type}?`)) return;
        await deleteStat(lastStat.id);
        setLastSaved('Point Undone');
      } else {
        await deleteStat(lastStat.id);
        setLastSaved('Action Undone');
      }
    } catch (error) {
      console.error('Undo failed:', error);
      alert('Failed to undo action.');
    } finally {
      setIsSaving(false);
    }
  };

  const getActionClass = (baseClass, actionName) => {
    const isVoiceGlow = voiceRecognizedAction === actionName;
    return `${baseClass} ${isVoiceGlow ? '!ring-4 !ring-emerald-400 !scale-105 shadow-[0_0_30px_rgba(52,211,153,0.8)] z-50 transition-all duration-300' : ''}`;
  };

  const getPlayerClass = (player) => {
    const isSelected = selectedPlayer === player;
    const isVoiceGlow = voiceRecognizedPlayer === player;
    
    if (isVoiceGlow) {
      return 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(52,211,153,0.8)] ring-4 ring-emerald-400 scale-110 z-50 transition-all duration-300';
    }
    if (isVoiceEnabled) {
      return 'bg-slate-900 text-slate-500 border border-slate-800 opacity-50 cursor-not-allowed transition-all';
    }
    if (isSelected) {
      return 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] ring-2 ring-indigo-400 scale-105 z-10 transition-all';
    }
    return 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105';
  };

  return (
    <>
      {/* Visual Feedback Flash Overlay */}
      <div 
        className={`pointer-events-none fixed inset-0 z-[100] transition-colors duration-200 ${
          flashType === 'success' ? 'bg-emerald-500/20' :
          flashType === 'error' ? 'bg-rose-600/30' :
          flashType === 'neutral' ? 'bg-cyan-500/10' :
          'bg-transparent'
        }`}
      />
      
      <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        {/* Scoreboard Header Section */}
        <div className="p-6 sm:p-8 bg-slate-900 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  className={`p-2 rounded-xl transition-all ${isVoiceEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.2)]' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                  title={isVoiceEnabled ? "Voice Tracking Active" : "Voice Tracking Off"}
                >
                   {isVoiceEnabled ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                </button>
             </div>
          </div>

          <div className="flex items-center justify-between bg-slate-950/50 rounded-2xl border border-white/5 shadow-inner p-4">
             {/* Left Column: Us */}
             <div className="flex flex-col items-start w-1/3">
                <span className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate w-full">{currentTeam}</span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tighter ${score.us > score.them ? 'text-indigo-400 drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]' : 'text-slate-300'}`}>{score.us}</div>
             </div>

             {/* Center Column: Point & O/D */}
             <div className="flex flex-col items-center justify-center w-1/3 px-2">
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-black shadow-lg ${currentOD === 'O' ? 'bg-indigo-600 text-white ring-2 ring-indigo-400/50' : 'bg-rose-600 text-white ring-2 ring-rose-400/50'}`}>
                    {currentOD}
                  </div>
                </div>
                <div className="mt-2 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap">Point {currentPoint}</div>
             </div>

             {/* Right Column: Them */}
             <div className="flex flex-col items-end w-1/3 text-right">
                <span className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest truncate w-full text-right">{liveOpponentName}</span>
                <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tighter ${score.them > score.us ? 'text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'text-slate-300'}`}>{score.them}</div>
             </div>
          </div>
          
          <div className="flex justify-between items-center mt-4 h-6">
             <div className="flex-1">
                 {isSaving && <p className="text-amber-400 text-sm font-bold animate-pulse text-left">Synchronizing...</p>}
                 {lastSaved && !isSaving && <p className="text-emerald-400 text-sm font-bold text-left">✓ {lastSaved}</p>}
             </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Player Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold tracking-wide text-slate-300 uppercase">
              On Pitch ({activeLineup.length})
            </label>

            {activeLineup.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-700 p-6 rounded-2xl text-center">
                <p className="text-slate-400 font-medium mb-4">No active players on the pitch.</p>
                <button 
                  onClick={() => onNavigate('lineup')}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all text-sm"
                >
                  Select Lineup
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeLineup.map((player) => (
                  <button
                    key={player}
                    onClick={() => setSelectedPlayer(player)}
                    disabled={isSaving || isVoiceEnabled}
                    className={`px-3 py-3 text-sm font-bold rounded-xl ${getPlayerClass(player)}`}
                  >
                    <span className="flex flex-col items-center">
                       <span>{player}</span>
                       {players?.find(p => p.name === player)?.shirt_number && (
                          <span className="opacity-70 font-mono text-xs">#{players.find(p => p.name === player).shirt_number}</span>
                       )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Control Buttons */}
            {activeLineup.length > 0 && (
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    if (!isVoiceEnabled) {
                      const activeObjects = activeLineup.map(name => players?.find(p => p.name === name)).filter(Boolean);
                      const missingNumbers = activeObjects.filter(p => !p.shirt_number);
                      if (missingNumbers.length > 0) {
                        return alert(`Voice tracking requires every active player to have a shirt number. Please add numbers for: ${missingNumbers.map(p => p.name).join(', ')}`);
                      }
                    }
                    setIsVoiceEnabled(!isVoiceEnabled);
                  }}
                  className={`w-full sm:w-auto py-3 px-6 flex items-center justify-center gap-2 font-bold rounded-xl transition-all border ${
                    isVoiceEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/40'
                      : 'border-slate-700/50 text-slate-400 bg-slate-900 shadow-md hover:bg-slate-800 hover:text-white'
                  }`}
                  title={isVoiceEnabled ? "Disable Voice Tracking" : "Enable Voice Tracking"}
                >
                  {isVoiceEnabled ? <Mic className="w-5 h-5 animate-pulse" /> : <MicOff className="w-5 h-5" />}
                  <span className="sm:hidden">Voice</span>
                </button>
                <button
                  onClick={handleUndo}
                  disabled={isSaving || !currentGame}
                  className="w-full sm:w-auto py-3 px-6 flex items-center justify-center gap-2 font-bold rounded-xl transition-all border border-slate-700/50 text-slate-400 hover:text-white bg-slate-900 shadow-md hover:bg-slate-800"
                  title="Undo Last Action"
                >
                  <Undo2 className="w-5 h-5" />
                  <span className="sm:hidden">Undo Last Action</span>
                </button>
              </div>
            )}
          </div>

           {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <button
                onClick={() => handleStatRecord('Point')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
                className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-emerald-500 hover:bg-emerald-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Point')}
              >
                Scored
              </button>
              <button
                onClick={() => handleStatRecord('Pass')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
                className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-cyan-500 hover:bg-cyan-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Pass')}
              >
                Pass
              </button>
            </div>
            
            <button
              onClick={() => handleStatRecord('Opponent Point')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-700 hover:bg-rose-600 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Opponent Point')}
            >
              Opponent Scored
            </button>
            <button
              onClick={() => handleStatRecord('Throwaway')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-500 hover:bg-rose-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(244,63,94,0.2)] hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Throwaway')}
            >
              Incomplete
            </button>
            <button
              onClick={() => handleStatRecord('Drop')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-500 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Drop')}
            >
              Drop
            </button>
            <button
              onClick={() => handleStatRecord('Stall Out')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-violet-600 hover:bg-violet-500 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Stall Out')}
            >
              Stall Out
            </button>
            <button
              onClick={() => handleStatRecord('Defence')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer || isVoiceEnabled}
              className={getActionClass("group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-orange-500 hover:bg-orange-400 focus:outline-none active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed", 'Defence')}
            >
              Defence
            </button>
          </div>

          {isVoiceEnabled && (
            <div className="pt-2 text-center h-6 flex items-center justify-center overflow-hidden">
               <p className={`text-xs font-mono tracking-widest uppercase transition-all duration-300 ${voiceFeedback.includes('✓') ? 'text-emerald-400 font-bold scale-105' : 'text-slate-500'}`}>
                  {voiceFeedback || 'Mic Active... Listening'}
               </p>
            </div>
          )}
          
          {/* Secondary Footer Action */}
          {activeLineup.length > 0 && (
            <div className="pt-2 pb-2 w-full">
              <button
                onClick={() => onNavigate('lineup')}
                disabled={isSaving || !currentGame || !isTrackingActive}
                className="w-full py-3.5 px-6 flex items-center justify-center gap-3 font-bold rounded-xl transition-all bg-transparent border border-white/20 backdrop-blur-sm text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeftRight className="w-5 h-5" />
                Substitution
              </button>
            </div>
          )}

        </div>
      </div>
      </div>
    </>
  );
};

export default Dashboard;
