import { useState, useEffect } from 'react';
import { recordStatToDB } from '../supabaseClient';

const Dashboard = ({ activeLineup, currentPoint, setCurrentPoint, currentGame, setCurrentGame, onNavigate }) => {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Auto-select first active player if none selected and lineup exists
  useEffect(() => {
    if (activeLineup.length > 0 && !activeLineup.includes(selectedPlayer)) {
      setSelectedPlayer(activeLineup[0]);
    } else if (activeLineup.length === 0) {
      setSelectedPlayer('');
    }
  }, [activeLineup, selectedPlayer]);

  const handleStatRecord = async (statType) => {
    if (!selectedPlayer) return alert("Select a player first!");
    
    setIsSaving(true);
    setLastSaved(null);
    try {
      const statData = {
        player: selectedPlayer,
        stat: statType,
        timestamp: new Date().toLocaleString(),
        pointNumber: currentPoint,
        gameName: currentGame,
      };
      await recordStatToDB(statData);
      setLastSaved(`Saved ${statType} for ${selectedPlayer}`);
      
      if (statType === 'Point') {
        setCurrentPoint(prev => prev + 1);
      }
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save. Check server logs.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        {/* Header Section */}
        <div className="p-6 sm:p-8 bg-slate-800 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Ultimate Stats
              </h1>
              <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-xl border border-slate-700 shadow-inner">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider pl-2 pr-1">Point</span>
                <button onClick={() => setCurrentPoint(p => Math.max(1, p - 1))} className="text-slate-500 hover:text-white hover:bg-slate-700 px-2 rounded-lg font-bold transition-colors">-</button>
                <span className="text-white font-bold text-lg w-5 text-center">{currentPoint}</span>
                <button onClick={() => setCurrentPoint(p => p + 1)} className="text-slate-500 hover:text-white hover:bg-slate-700 px-2 rounded-lg font-bold transition-colors">+</button>
              </div>
            </div>
            <input 
              type="text" 
              value={currentGame}
              onChange={(e) => setCurrentGame(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-slate-700/50 text-slate-400 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:text-indigo-300 transition-colors placeholder-slate-600 mb-2 pb-1 w-full max-w-[200px]"
              placeholder="e.g. Vs Team X"
            />
            
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

          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              onClick={() => onNavigate('roster')}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white text-sm font-bold rounded-xl transition-all shadow-md"
            >
              Roster
            </button>
            <button 
              onClick={() => onNavigate('lineup')}
              className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/30"
            >
              Lineup
            </button>
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
          </div>

          {/* Action Buttons */}
          <div className="space-y-4 pt-4 border-t border-slate-700/50">
            <button
              onClick={() => handleStatRecord('Point')}
              disabled={isSaving || activeLineup.length === 0}
              className="w-full group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-emerald-500 hover:bg-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Point
            </button>
            <button
              onClick={() => handleStatRecord('Assist')}
              disabled={isSaving || activeLineup.length === 0}
              className="w-full group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-blue-500 hover:bg-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Assist
            </button>
            <button
              onClick={() => handleStatRecord('Pass')}
              disabled={isSaving || activeLineup.length === 0}
              className="w-full group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-cyan-500 hover:bg-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pass
            </button>
            <button
              onClick={() => handleStatRecord('Turnover')}
              disabled={isSaving || activeLineup.length === 0}
              className="w-full group relative flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-rose-500 hover:bg-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(244,63,94,0.2)] hover:shadow-[0_0_30px_rgba(244,63,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Turnover
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
