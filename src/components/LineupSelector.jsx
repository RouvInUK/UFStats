import { togglePlayerActiveStatus, clearActiveLineup, recordLineup, fetchLastStatForGame, deleteStat, restoreLineupForPoint, recordStatToDB, checkIfHalfTimeLogged, fetchActiveGames, deletePoint } from '../supabaseClient';
import { useState, useEffect } from 'react';
import { Undo2, Mic, MicOff } from 'lucide-react';
import PullTracker from './PullTracker';

const LineupSelector = ({ players, setPlayers, currentTeam, targetTeamId, onNavigate, currentGame, setCurrentGame, currentPoint, setCurrentPoint, gameType, setGameType, setIsTrackingActive, opponentName, setOpponentName, initialPossession, setInitialPossession, isVoiceEnabled, setIsVoiceEnabled }) => {
  const [processingId, setProcessingId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isStartingPoint, setIsStartingPoint] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [showPullTracker, setShowPullTracker] = useState(false);

  const [hasHalfTime, setHasHalfTime] = useState(false);
  const [activeGames, setActiveGames] = useState([]);

  const filteredPlayers = players;

  const handleVoiceToggle = () => {
    if (!isVoiceEnabled) {
      const missingNumbers = filteredPlayers.filter(p => p.shirt_number == null || p.shirt_number === '');
      if (missingNumbers.length > 0) {
        return alert(`Voice tracking requires every player to have a shirt number. Please add numbers for: ${missingNumbers.map(p => p.name).join(', ')}`);
      }
    }
    setIsVoiceEnabled(!isVoiceEnabled);
  };
  useEffect(() => {
    fetchActiveGames(targetTeamId).then(setActiveGames).catch(console.error);
  }, [targetTeamId]);

  useEffect(() => {
    if (currentGame) {
      fetchLastStatForGame(currentGame, targetTeamId)
        .then(lastStat => {
          if (!lastStat && currentPoint > 0) {
            // If we are ostensibly in the middle of a point, but NO stats exist in the DB, 
            // it means the game was deleted from another device. Auto-heal the local state.
            console.log("Game deleted remotely, clearing local state.");
            setCurrentGame('');
            setCurrentPoint(0);
            setOpponentName('');
            setInitialPossession('');
            setIsTrackingActive(false);
            return;
          }

          if (lastStat && lastStat.game_type) {
            setGameType(lastStat.game_type);
          }
          setLastAction(lastStat);
        })
        .catch(console.error);
        
      checkIfHalfTimeLogged(currentGame)
        .then(setHasHalfTime)
        .catch(console.error);
    }
  }, [currentGame, targetTeamId, setGameType, currentPoint, setCurrentGame, setCurrentPoint, setOpponentName, setInitialPossession, setIsTrackingActive]);

  const handleUndoLastPoint = async () => {
    if (!lastAction || !lastAction.id) return;
    
    if (window.confirm("Are you sure you want to undo this score? This will completely erase the point and restore the previous lineup.")) {
      setIsUndoing(true);
      try {
        // Find out what point number we are actually undoing (the one that just finished)
        const pointToUndo = lastAction.point_number;
        
        // Delete all stats for that point
        await deletePoint(currentGame, targetTeamId, pointToUndo);
        
        // Restore lineup for the point we are returning to
        const restoredNames = await restoreLineupForPoint(currentGame, pointToUndo, currentTeam);
        
        const optimisticallyRestored = players.map(p => ({
          ...p,
          is_active: restoredNames.includes(p.name)
        }));
        
        setPlayers(optimisticallyRestored);
        setCurrentPoint(pointToUndo);
        setIsTrackingActive(true);
        
        // Return to tracking
        onNavigate('dashboard');
      } catch (err) {
        console.error("Failed to undo point", err);
        alert("Failed to undo point.");
      } finally {
        setIsUndoing(false);
      }
    }
  };

  const handleStartPoint = async () => {
    // Only get active players that belong to the current team
    const activeLineupNames = filteredPlayers.filter(p => p.is_active).map(p => p.name);
    const expectedCount = gameType === 'grass' ? 7 : (gameType === 'beach' || gameType === 'indoor' ? 5 : 0);
    
    if (expectedCount > 0 && activeLineupNames.length !== expectedCount) {
      if (!window.confirm(`You selected ${activeLineupNames.length} players, but a ${gameType} game usually expects ${expectedCount}. Start ${gameType === 'training' ? 'session' : 'point'} anyway?`)) {
        return;
      }
    }

    if (!currentGame) return alert("Enter a Match Name first.");

    if (currentPoint === 0) {
      if (!opponentName) return alert(gameType === 'training' ? "Enter a Drill/Exercise Name first." : "Enter an Opponent Name first.");
      if (gameType !== 'training' && !initialPossession) return alert("Select Starting Possession (O or D).");
    }

    setIsStartingPoint(true);
    try {
      const nextPoint = currentPoint + 1;
      if (navigator.onLine) {
        try {
          await clearActiveLineup(targetTeamId);
        } catch(e) {
          console.warn("Offline or failed to clear lineup", e);
        }
      }
      await recordLineup(activeLineupNames, nextPoint, currentGame, gameType, currentTeam, targetTeamId);

      if (currentPoint === 0) {
          // Log Structural Events for first point
          await recordStatToDB({
              player: opponentName,
              stat: 'Match Metadata',
              pointNumber: nextPoint,
              gameName: currentGame,
              gameType: gameType,
              teamName: currentTeam
          }, targetTeamId);
          if (gameType !== 'training') {
            await recordStatToDB({
                player: 'System',
                stat: initialPossession === 'O' ? 'Start Offense' : 'Start Defense',
                pointNumber: nextPoint,
                gameName: currentGame,
                gameType: gameType,
                teamName: currentTeam
            }, targetTeamId);
          }
      }

      setCurrentPoint(nextPoint);
      setIsTrackingActive(true);

      // Robustly calculate the exact possession state using all historical stats
      let calculatedOD = initialPossession || 'O';
      let gameStartOD = initialPossession || null;
      
      if (allGameStats && allGameStats.length > 0) {
        const chronStats = [...allGameStats].reverse();
        chronStats.forEach(stat => {
            if (stat.stat_type === 'Start Offense') {
                calculatedOD = 'O';
                if (!gameStartOD) gameStartOD = 'O';
            }
            if (stat.stat_type === 'Start Defense') {
                calculatedOD = 'D';
                if (!gameStartOD) gameStartOD = 'D';
            }
            if (stat.stat_type === 'Half Time') {
                calculatedOD = gameStartOD === 'O' ? 'D' : 'O';
            }
            if (stat.stat_type === 'Point') { calculatedOD = 'D'; }
            if (stat.stat_type === 'Opponent Point') { calculatedOD = 'O'; }
        });
      }

      const isDefence = calculatedOD === 'D';

      if (isDefence && gameType !== 'training') {
        setShowPullTracker(true);
      } else {
        onNavigate('dashboard');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to start point. Error: ' + err.message + '\nStack: ' + err.stack);
    } finally {
      setIsStartingPoint(false);
    }
  };

  const handleHalfTime = async () => {
    if (!currentGame) return alert("Enter a Match Name first.");
    if (window.confirm("Are you sure you want to log Half Time?")) {
      setIsStartingPoint(true);
      try {
        const halfTimeStat = {
          player: 'System',
          stat_type: 'Half Time',
          point_number: currentPoint,
          game_name: currentGame,
          game_type: gameType,
          team_name: currentTeam,
          created_at: new Date().toISOString()
        };
        await recordStatToDB({
          player: 'System',
          stat: 'Half Time',
          pointNumber: currentPoint,
          gameName: currentGame,
          gameType: gameType,
          teamName: currentTeam
        }, targetTeamId);
        
        // Append to local state so immediate possession calculations are accurate
        setAllGameStats(prev => [halfTimeStat, ...prev]);
        setHasHalfTime(true);
        alert('Half Time logged successfully.');
      } catch (err) {
        console.error(err);
        alert('Failed to log Half Time.');
      } finally {
        setIsStartingPoint(false);
      }
    }
  };

  const handleMarkCompleted = async () => {
    if (!currentGame) return alert("Enter a game name first.");
    if (window.confirm(`Are you sure you want to close out Match "${currentGame}"?`)) {
      setIsStartingPoint(true);
      try {
        await recordStatToDB({
          player: 'System',
          stat: 'Game Completed',
          timestamp: new Date().toLocaleString(),
          pointNumber: currentPoint,
          gameName: currentGame,
          gameType: gameType,
          teamName: currentTeam
        }, targetTeamId);
        alert(`Match ${currentGame} completed!`);
        setCurrentGame('');
        setCurrentPoint(0);
        setIsTrackingActive(false);
        onNavigate('dashboard');
      } catch (err) {
        console.error(err);
        alert('Failed to end game.');
      } finally {
        setIsStartingPoint(false);
      }
    }
  };

  const togglePlayer = async (player) => {
    // Optimistically update UI locally
    const optimisticPlayers = players.map(p => 
      p.id === player.id ? { ...p, is_active: !p.is_active } : p
    );
    setPlayers(optimisticPlayers);
    
    setProcessingId(player.id);
    
    try {
      if (navigator.onLine) {
        // Fire request to Supabase
        await togglePlayerActiveStatus(player.id, targetTeamId, player.is_active);
      }
    } catch {
      if (navigator.onLine) {
        alert("Failed to update status in cloud.");
        // Revert optimistic update on failure only if online
        setPlayers(players);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleClearLineup = async () => {
    const optimisticPlayers = players.map(p => ({ ...p, is_active: false }));
    setPlayers(optimisticPlayers);
    
    setIsClearing(true);
    try {
      if (navigator.onLine) {
        await clearActiveLineup(targetTeamId);
      }
    } catch {
      if (navigator.onLine) {
        alert("Failed to clear lineup in cloud.");
        setPlayers(players); // revert
      }
    } finally {
      setIsClearing(false);
    }
  };



  const activeCount = filteredPlayers.filter(p => p.is_active).length;

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Active Lineup</h1>
            <p className="text-slate-400 text-sm font-medium">{activeCount} Players on Pitch</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={handleClearLineup}
              disabled={isClearing || activeCount === 0}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 text-sm font-bold rounded-xl transition-all w-full sm:w-auto text-center disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Clear All'}
            </button>
            <button 
              onClick={() => onNavigate('roster')}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-bold rounded-xl transition-all w-full sm:w-auto text-center shadow-md"
            >
              Edit Roster
            </button>
          </div>
        </div>

        {currentPoint > 0 && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-amber-400 text-sm font-bold truncate">
              Active Match: {currentGame || 'Unknown'} (Point {currentPoint})
            </div>
            <button 
              onClick={() => {
                if (window.confirm("Abandon this match and start a new one?")) {
                  setCurrentGame('');
                  setCurrentPoint(0);
                  setOpponentName('');
                  setInitialPossession('');
                  setIsTrackingActive(false);
                }
              }}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap"
            >
              Start New Match
            </button>
          </div>
        )}

        {currentPoint === 0 && (
          <div className="p-6 sm:p-8 border-b border-slate-700/50 bg-slate-900/50">
             <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">Pre-Game Configurations</h2>
             </div>
             <div className="space-y-5">
                {activeGames.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 mb-2 block">Resume Active Match</label>
                    <select 
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
                      value={activeGames.some(g => g.name === currentGame) ? currentGame : ''}
                      onChange={(e) => {
                         const val = e.target.value;
                         if (val) {
                           setCurrentGame(val);
                           const matched = activeGames.find(g => g.name === val);
                           if (matched) {
                             setCurrentPoint(matched.maxPoint);
                           }
                         }
                      }}
                    >
                      <option value="">-- Select a game to resume --</option>
                      {activeGames.map(g => (
                        <option key={g.name} value={g.name}>{g.name} (Point {g.maxPoint})</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-4 my-4">
                      <div className="flex-1 h-px bg-slate-700"></div>
                      <span className="text-slate-500 text-xs font-bold uppercase">OR START NEW</span>
                      <div className="flex-1 h-px bg-slate-700"></div>
                    </div>
                  </div>
                )}
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 mb-2 block">Match Identifier / Title</label>
                   <input type="text" value={currentGame} onChange={e => {
                      setCurrentGame(e.target.value);
                      if (activeGames.some(g => g.name === e.target.value)) {
                         setCurrentPoint(activeGames.find(g => g.name === e.target.value).maxPoint);
                      } else {
                         setCurrentPoint(0);
                      }
                   }} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner" placeholder="e.g. EUCF Pool Play - Game 1" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 mb-2 block">Game Format</label>
                   <div className="flex flex-wrap bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-inner font-bold w-full text-sm">
                      <button onClick={() => setGameType('grass')} className={`flex-1 min-w-[25%] py-3 px-2 transition-all ${gameType === 'grass' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800'}`}>Grass</button>
                      <button onClick={() => setGameType('beach')} className={`flex-1 min-w-[25%] py-3 px-2 transition-all ${gameType === 'beach' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800'}`}>Beach</button>
                      <button onClick={() => setGameType('indoor')} className={`flex-1 min-w-[25%] py-3 px-2 transition-all ${gameType === 'indoor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800'}`}>Indoor</button>
                      <button onClick={() => setGameType('training')} className={`flex-1 min-w-[25%] py-3 px-2 transition-all ${gameType === 'training' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800'}`}>Training</button>
                   </div>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 mb-2 block">
                     {gameType === 'training' ? 'Drill / Exercise Name' : 'Opponent Team Name'}
                   </label>
                   <input type="text" value={opponentName} onChange={e => setOpponentName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner" placeholder={gameType === 'training' ? "e.g. 3-Man Weave" : "e.g. Darkstar"} />
                </div>
                <div className={gameType === 'training' ? 'opacity-30 pointer-events-none' : ''}>
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 mb-2 block">Starting Possession</label>
                   <div className="flex bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-inner font-bold w-full text-sm">
                      <button onClick={() => setInitialPossession('O')} className={`flex-1 py-3 px-2 transition-all ${initialPossession === 'O' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800'}`}>Receive (Offense)</button>
                      <button onClick={() => setInitialPossession('D')} className={`flex-1 py-3 px-2 transition-all ${initialPossession === 'D' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-800'}`}>Pull (Defense)</button>
                   </div>
                </div>
             </div>
          </div>
        )}

        <div className="p-6 sm:p-8">

          {filteredPlayers.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-700/50 space-y-4">
              <p className="text-slate-400 font-medium">Your roster is currently empty.</p>
              <button 
                onClick={() => onNavigate('roster')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                Go setup your roster
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredPlayers.map((player) => {
                const isActive = player.is_active;
                const isProcessing = processingId === player.id;
                
                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player)}
                    disabled={isProcessing}
                    className={`px-3 py-4 text-sm font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-3 ${
                      isActive
                        ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400 scale-105 z-10'
                        : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    } ${isProcessing ? 'opacity-50 animate-pulse' : ''}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-white shadow-sm' : 'bg-slate-700'}`} />
                    <span className="text-center">
                      {player.name} {player.shirt_number ? <span className="opacity-70 font-mono ml-1">#{player.shirt_number}</span> : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Start Point Footer logic block */}
        <div className="p-6 sm:p-8 border-t border-slate-700/50 bg-slate-900/30">
          <button
            onClick={handleStartPoint}
            disabled={isStartingPoint || activeCount === 0 || !currentGame || (currentPoint === 0 && (!opponentName || (gameType !== 'training' && !initialPossession)))}
            className="w-full group relative flex items-center justify-center px-6 py-5 border border-emerald-500/50 text-xl font-black rounded-2xl text-white bg-emerald-500/20 hover:bg-emerald-500/40 backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-emerald-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
          >
            {isStartingPoint ? (
               <span className="flex items-center gap-3">
                 <div className="w-5 h-5 border-2 border-transparent border-t-white rounded-full animate-spin" />
                 Synchronizing...
               </span>
            ) : (gameType === 'training' ? "Start Session" : "Start Point")}
          </button>
          
          {currentPoint > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                 onClick={handleHalfTime}
                 disabled={isStartingPoint || hasHalfTime}
                 className={`w-full flex items-center justify-center gap-2 px-6 py-4 border text-sm font-bold rounded-2xl transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-slate-800 ${
                   hasHalfTime 
                     ? 'border-slate-700/50 text-slate-500 bg-slate-900/50 cursor-not-allowed opacity-50'
                     : 'border-amber-500/30 text-amber-500 bg-slate-900/50 hover:bg-amber-500/10 hover:text-amber-400 disabled:opacity-50'
                 }`}
              >
                 {hasHalfTime ? 'Half Time Logged' : 'Log Half Time'}
              </button>
              
              <button
                 onClick={handleMarkCompleted}
                 disabled={isStartingPoint}
                 className="w-full flex items-center justify-center gap-2 px-6 py-4 border border-rose-500/30 text-sm font-bold rounded-2xl text-rose-500 bg-slate-900/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-slate-800 disabled:opacity-50"
              >
                 End Game
              </button>
            </div>
          )}
          
          {lastAction && (lastAction.stat_type === 'Point' || lastAction.stat_type === 'Opponent Point') && (
            <button
              onClick={handleUndoLastPoint}
              disabled={isUndoing}
              className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-4 border border-slate-700/50 text-sm font-bold rounded-2xl text-slate-400 bg-slate-900/50 hover:bg-slate-800 hover:text-white transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-slate-800 disabled:opacity-50"
            >
              {isUndoing ? 'Undoing...' : (
                <>
                  <Undo2 className="w-4 h-4" />
                  Undo Last {lastAction.stat_type}
                </>
              )}
            </button>
          )}
        </div>

      </div>
      
      {showPullTracker && (
        <PullTracker
          activeLineup={filteredPlayers.filter(p => p.is_active).map(p => p.name)}
          currentGame={currentGame}
          currentPoint={currentPoint}
          gameType={gameType}
          currentTeam={currentTeam}
          targetTeamId={targetTeamId}
          onComplete={() => {
            setShowPullTracker(false);
            onNavigate('dashboard');
          }}
        />
      )}
    </div>
  );
};

export default LineupSelector;
