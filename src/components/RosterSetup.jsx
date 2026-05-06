import { useState, useEffect, useRef } from 'react';
import { addPlayer, removePlayer, fetchAllTeamNames } from '../supabaseClient';
const RosterSetup = ({ players, setPlayers, currentTeam, setCurrentTeam, targetTeamId }) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newShirtNumber, setNewShirtNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [allTeams, setAllTeams] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchAllTeamNames().then(setAllTeams).catch(console.error);
  }, [players]);

  const filteredPlayers = players.filter(p => {
    if (currentTeam === 'Default Team (Migrated)' || currentTeam === 'Default Team') {
      return p.team_name === 'Default Team' || p.team_name === 'Default Team (Migrated)' || !p.team_name;
    }
    return p.team_name === currentTeam;
  });

  const handleClearLineup = async () => {
    try {
      await clearActiveLineup(targetTeamId);
      setPlayers([]);
    } catch (err) {
      alert("Failed to clear lineup: " + (err.message || err.details || JSON.stringify(err)));
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    const trimmedName = newPlayerName.trim();
    const trimmedNumber = newShirtNumber.trim();
    if (!trimmedName) return;
    
    if (trimmedNumber && !/^[A-Za-z0-9]{1,3}$/.test(trimmedNumber)) {
      return alert("Shirt number must be 1-3 alphanumeric characters.");
    }

    // Check local array quickly
    if (filteredPlayers.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      return alert("Player name already exists in this team!");
    }
    if (trimmedNumber && filteredPlayers.some(p => p.shirt_number === trimmedNumber)) {
      return alert("Shirt number already exists in this team!");
    }
    if (filteredPlayers.length >= 21) {
      return alert("Maximum 21 players allowed.");
    }

    setIsProcessing(true);
    try {
      const savedPlayer = await addPlayer(trimmedName, currentTeam, targetTeamId, trimmedNumber || null);
      if (savedPlayer) {
        // Append to the full global players array
        setPlayers([...players, savedPlayer]);
      }
      setNewPlayerName('');
      setNewShirtNumber('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      alert("Failed to add player to database: " + (err.message || err.details || JSON.stringify(err)));
      console.error("Full add error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePlayer = async (id) => {
    setIsProcessing(true);
    try {
      await removePlayer(id);
      setPlayers(players.filter(p => p.id !== id));
    } catch {
      alert("Failed to remove player from database.");
    } finally {
      setIsProcessing(false);
    }
  };



  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full">
            <h2 className="text-xl font-bold text-white mb-2 sm:mb-0">
              Roster: <span className="text-indigo-400">{typeof currentTeam === 'object' ? currentTeam.name : currentTeam}</span>
            </h2>
            <p className="text-slate-400 text-sm font-medium">{filteredPlayers.length} / 21 Players Configured</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newShirtNumber}
              onChange={(e) => setNewShirtNumber(e.target.value)}
              placeholder="#"
              disabled={isProcessing}
              className="w-full sm:w-24 appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50 text-center"
            />
            <input
              ref={inputRef}
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Enter player name..."
              disabled={isProcessing}
              className="flex-1 appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={filteredPlayers.length >= 21 || !newPlayerName.trim() || isProcessing}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              Add
            </button>
          </form>

          {filteredPlayers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-medium">
              No players added yet. Start building your squad!
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredPlayers.map((player) => (
                <li key={player.id} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                  <span className="text-slate-200 font-semibold">
                    {player.name} {player.shirt_number ? <span className="text-indigo-400 font-mono ml-1">#{player.shirt_number}</span> : ''}
                  </span>
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
