import { useState } from 'react';

const RosterSetup = ({ roster, setRoster, activeLineup, setActiveLineup, onNavigate }) => {
  const [newPlayerName, setNewPlayerName] = useState('');

  const handleAddPlayer = (e) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    if (roster.includes(trimmed)) return alert("Player already exists!");
    if (roster.length >= 21) return alert("Maximum 21 players allowed.");

    setRoster([...roster, trimmed]);
    setNewPlayerName('');
  };

  const handleRemovePlayer = (player) => {
    setRoster(roster.filter(p => p !== player));
    // Also remove from active lineup if they were on the pitch
    setActiveLineup(activeLineup.filter(p => p !== player));
  };

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Team Roster</h1>
            <p className="text-slate-400 text-sm font-medium">{roster.length} / 21 Players Configured</p>
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
              className="flex-1 appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            />
            <button 
              type="submit"
              disabled={roster.length >= 21 || !newPlayerName.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              Add
            </button>
          </form>

          {roster.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-medium">
              No players added yet. Start building your squad!
            </div>
          ) : (
            <ul className="space-y-2">
              {roster.map((player) => (
                <li key={player} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-slate-200 font-semibold">{player}</span>
                  <button 
                    onClick={() => handleRemovePlayer(player)}
                    className="text-rose-400 hover:text-rose-300 font-medium text-sm px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all"
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
