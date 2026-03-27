import { useState } from 'react';
import { addPlayer, removePlayer } from '../supabaseClient';

const RosterSetup = ({ players, setPlayers, onNavigate }) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    
    // Check local array quickly
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return alert("Player already exists!");
    }
    if (players.length >= 21) {
      return alert("Maximum 21 players allowed.");
    }

    setIsProcessing(true);
    try {
      const savedPlayer = await addPlayer(trimmed);
      if (savedPlayer) {
        setPlayers([...players, savedPlayer]);
      }
      setNewPlayerName('');
    } catch (err) {
      alert("Failed to add player to database. Check connection or RLS rules.");
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePlayer = async (id) => {
    setIsProcessing(true);
    try {
      await removePlayer(id);
      setPlayers(players.filter(p => p.id !== id));
    } catch (err) {
      alert("Failed to remove player from database.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Team Roster</h1>
            <p className="text-slate-400 text-sm font-medium">{players.length} / 21 Players Configured</p>
          </div>
          <button 
            onClick={() => onNavigate('dashboard')}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded-xl transition-all w-full sm:w-auto text-center"
          >
            ← Dashboard
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleAddPlayer} className="flex gap-3">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Enter player name..."
              disabled={isProcessing}
              className="flex-1 appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={players.length >= 21 || !newPlayerName.trim() || isProcessing}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              Add
            </button>
          </form>

          {players.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-medium">
              No players added yet. Start building your squad!
            </div>
          ) : (
            <ul className="space-y-2">
              {players.map((player) => (
                <li key={player.id} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-slate-200 font-semibold">{player.name}</span>
                  <button 
                    onClick={() => handleRemovePlayer(player.id)}
                    disabled={isProcessing}
                    className="text-rose-400 hover:text-rose-300 font-medium text-sm px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
export default RosterSetup;
