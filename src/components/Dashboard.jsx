import { useState, useEffect } from 'react';
import { recordStatToDB, fetchActiveGames, clearActiveLineup, fetchLastStatForGame, deleteStat, fetchGameStats } from '../supabaseClient';
import { Undo2, ArrowLeftRight } from 'lucide-react';

const Dashboard = ({ activeLineup, currentPoint, setCurrentPoint, currentGame, gameType, currentTeam, opponentName, initialPossession, isTrackingActive, setIsTrackingActive, onNavigate, players, setPlayers }) => {
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

  const [score, setScore] = useState({ us: 0, them: 0 });
  const [currentOD, setCurrentOD] = useState('O');
  const [liveOpponentName, setLiveOpponentName] = useState('Opponent');

  useEffect(() => {
    if (!currentGame) return;
    const loadGameContext = async () => {
       try {
          const stats = await fetchGameStats(currentGame);
          let us = 0, them = 0;
          let od = initialPossession || 'O';
          let oppName = opponentName || 'Opponent';

          // Ensure it's chronological to accurately trace the O/D shift
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



  const handleUndo = async () => {
    if (!currentGame) return;
    setIsSaving(true);
    try {
      const lastStat = await fetchLastStatForGame(currentGame, currentTeam);
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
              <div className="flex justify-end gap-3 mt-4">
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
          
          {/* Secondary Footer Action */}
          {activeLineup.length > 0 && (
            <div className="pt-6 pb-2 w-full">
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
