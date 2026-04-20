import { useState, useEffect } from 'react';
import { recordStatToDB, fetchActiveGames, clearActiveLineup } from '../supabaseClient';

const Dashboard = ({ activeLineup, currentPoint, setCurrentPoint, currentGame, setCurrentGame, gameType, setGameType, currentTeam, isTrackingActive, setIsTrackingActive, onNavigate, players, setPlayers }) => {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const [flashType, setFlashType] = useState(null);

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

  // Fetch active games on mount
  useEffect(() => {
    fetchActiveGames(currentTeam).then(setActiveGames).catch(console.error);
  }, [currentTeam]);

  // Sync point if user selects an existing active game
  useEffect(() => {
    const matchedGame = activeGames.find(g => g.name === currentGame);
    if (matchedGame && matchedGame.maxPoint) {
      setCurrentPoint(matchedGame.maxPoint);
    }
  }, [currentGame, activeGames, setCurrentPoint]);

  // Auto-select first active player if none selected and lineup exists
  useEffect(() => {
    if (activeLineup.length > 0 && !activeLineup.includes(selectedPlayer)) {
      setSelectedPlayer(activeLineup[0]);
    } else if (activeLineup.length === 0) {
      setSelectedPlayer('');
    }
  }, [activeLineup, selectedPlayer]);

  const handleStatRecord = async (statType) => {
    if (statType !== 'Opponent Point' && !selectedPlayer) return alert("Select a player first!");
    
    setIsSaving(true);
    setLastSaved(null);
    try {
      const statData = {
        player: statType === 'Opponent Point' ? 'Opponent' : selectedPlayer,
        stat: statType,
        timestamp: new Date().toLocaleString(),
        pointNumber: currentPoint,
        gameName: currentGame,
        gameType: gameType,
        teamName: currentTeam,
      };
      await recordStatToDB(statData);
      setLastSaved(statType === 'Opponent Point' ? `Saved Opponent Point` : `Saved ${statType} for ${selectedPlayer}`);
      
      if (statType === 'Point' || statType === 'Opponent Point') {
        setIsTrackingActive(false);
        
        // Auto-clean the lineup on the backend asynchronously
        clearActiveLineup(currentTeam).catch(console.error);
        // Instant visual clearing via optimistically mutated prop
        if (players && setPlayers) {
            setPlayers(players.map(p => ({ ...p, is_active: false })));
        }

        // Seamless Loop: Auto-redirect to Lineup after a goal to prepare for the next point
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

  const handleMarkCompleted = async () => {
    if (!currentGame) return alert("Enter a game name first.");
    if (window.confirm(`Are you sure you want to close "${currentGame}"? It will no longer appear in the active dropdown for anyone.`)) {
      setIsSaving(true);
      try {
        await recordStatToDB({
          player: 'System',
          stat: 'Game Completed',
          timestamp: new Date().toLocaleString(),
          pointNumber: currentPoint,
          gameName: currentGame,
          gameType: gameType,
          teamName: currentTeam
        });
        setLastSaved(`Closed ${currentGame}!`);
        setCurrentGame('');
        setCurrentPoint(0);
        setIsTrackingActive(false);
      } catch (err) {
        console.error(err);
        alert('Failed to mark completed.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSystemEvent = async (type) => {
    if (!currentGame) return alert("Enter a game name first.");
    setIsSaving(true);
    setLastSaved(null);
    try {
      const statData = {
        player: 'System',
        stat: type,
        timestamp: new Date().toLocaleString(),
        pointNumber: currentPoint,
        gameName: currentGame,
        gameType: gameType,
        teamName: currentTeam
      };
      await recordStatToDB(statData);
      setLastSaved(`Logged: ${type}`);
      triggerFeedback('success');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to log system event.');
    } finally {
      setIsSaving(false);
    }
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
        
        {/* Header Section */}
        <div className="p-6 sm:p-8 bg-slate-800 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-start gap-4 sm:gap-5 w-full">
            <img src="/logo.png" alt="UFStats Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl shadow-lg border border-slate-700/50 shrink-0" />
            <div className="flex flex-col w-full">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <div className="flex flex-col">
                  <span className="text-indigo-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{currentTeam}</span>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight leading-none mt-0.5">
                    Ultimate Stats
                  </h1>
                </div>
                <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700 shadow-inner">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider pl-2 pr-1">Point</span>
                  <button onClick={() => setCurrentPoint(p => Math.max(0, p - 1))} className="text-slate-500 hover:text-white hover:bg-slate-700 px-2 rounded-lg font-bold transition-colors">-</button>
                  <span className="text-white font-bold text-lg w-5 text-center">{currentPoint}</span>
                  <button onClick={() => setCurrentPoint(p => p + 1)} className="text-slate-500 hover:text-white hover:bg-slate-700 px-2 rounded-lg font-bold transition-colors">+</button>
                </div>
              </div>
            <div className="flex flex-col gap-2 w-full max-w-[300px] mb-2">
              <div className="flex bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-inner text-sm font-bold w-full">
                <button
                  onClick={() => setGameType('beach')}
                  className={`flex-1 py-1 px-4 transition-colors ${gameType === 'beach' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                >
                  🏖️ 5v5 Beach
                </button>
                <div className="w-[1px] bg-slate-800"></div>
                <button
                  onClick={() => setGameType('grass')}
                  className={`flex-1 py-1 px-4 transition-colors ${gameType === 'grass' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                >
                  🌿 7v7 Grass
                </button>
              </div>
              <div className="flex bg-slate-900 border border-slate-700/50 rounded-xl overflow-hidden shadow-inner font-bold w-full text-xs sm:text-sm">
                <button
                  onClick={() => handleSystemEvent('Start Offense')}
                  disabled={isSaving || !currentGame}
                  className="flex-1 py-1 px-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Start (O)
                </button>
                <div className="w-[1px] bg-slate-800"></div>
                <button
                  onClick={() => handleSystemEvent('Start Defense')}
                  disabled={isSaving || !currentGame}
                  className="flex-1 py-1 px-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Start (D)
                </button>
                <div className="w-[1px] bg-slate-800"></div>
                <button
                  onClick={() => handleSystemEvent('Half Time')}
                  disabled={isSaving || !currentGame}
                  className="flex-1 py-1 px-1 text-amber-500 hover:text-amber-400 hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Half Time
                </button>
              </div>
              <div className="flex items-center gap-2 w-full">
                <input 
                  type="text" 
                  list="active-games-list"
                  value={currentGame}
                  onChange={(e) => setCurrentGame(e.target.value)}
                  className="flex-1 bg-transparent border-b border-transparent hover:border-slate-700/50 text-slate-400 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:text-indigo-300 transition-colors placeholder-slate-600 pb-1"
                  placeholder="Match Name (e.g. Vs Team X)"
                />
                {currentGame && (
                  <button 
                    onClick={handleMarkCompleted}
                    className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg transition-all whitespace-nowrap"
                    title="Close out Game"
                  >
                    ✓ Close Game
                  </button>
                )}
              </div>
            </div>

            <datalist id="active-games-list">
              {activeGames.map(game => (
                <option key={game.name} value={game.name} />
              ))}
            </datalist>
            
            {isSaving && (
              <p className="text-amber-400 text-sm font-bold mt-2 animate-pulse">
                Saving to Google Sheets...
              </p>
            )}
            {lastSaved && !isSaving && (
              <p className="text-emerald-400 text-sm font-bold mt-2">
                ✓ {lastSaved}
              </p>
            )}
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
                    disabled={isSaving}
                    className={`px-3 py-3 text-sm font-bold rounded-xl transition-all ${
                      selectedPlayer === player
                        ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] ring-2 ring-indigo-400 scale-105 z-10'
                        : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105'
                    }`}
                  >
                    {player}
                  </button>
                ))}
              </div>
            )}

            {/* Control Buttons */}
            {activeLineup.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  onClick={() => onNavigate('lineup')}
                  disabled={isSaving || !currentGame || !isTrackingActive}
                  className={`w-full py-3 px-4 flex items-center justify-center gap-2 font-bold rounded-xl transition-all shadow-md ${
                    !isTrackingActive
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 shadow-lg'
                  }`}
                >
                  ↻ Substitution
                </button>
              </div>
            )}
          </div>

           {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <button
                onClick={() => handleStatRecord('Point')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer}
                className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-emerald-500 hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                We Scored!
              </button>
              <button
                onClick={() => handleStatRecord('Pass')}
                disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer}
                className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-cyan-500 hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pass
              </button>
            </div>
            
            <button
              onClick={() => handleStatRecord('Opponent Point')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive}
              className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-700 hover:bg-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Opponent Scored
            </button>
            <button
              onClick={() => handleStatRecord('Throwaway')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer}
              className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-500 hover:bg-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(244,63,94,0.2)] hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Throwaway
            </button>
            <button
              onClick={() => handleStatRecord('Drop')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer}
              className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(225,29,72,0.2)] hover:shadow-[0_0_30px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Drop
            </button>
            <button
              onClick={() => handleStatRecord('Stall Out')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer}
              className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-violet-600 hover:bg-violet-500 focus:outline-none focus:ring-4 focus:ring-violet-600/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] hover:shadow-[0_0_30px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stall Out
            </button>
            <button
              onClick={() => handleStatRecord('Defence')}
              disabled={isSaving || activeLineup.length === 0 || !isTrackingActive || !selectedPlayer}
              className="group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-orange-500 hover:bg-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Defence
            </button>
          </div>
          
        </div>
      </div>
      </div>
    </>
  );
};

export default Dashboard;
