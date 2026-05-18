import { useState, useEffect, useRef } from 'react';
import { addPlayerToClub, togglePlayerOnTeam, removePlayerGlobally, fetchClubPlayers } from '../supabaseClient';

const RosterSetup = ({ players, setPlayers, currentTeam, currentTeamObject, targetTeamId }) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newShirtNumber, setNewShirtNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clubPlayers, setClubPlayers] = useState([]);
  const [viewMode, setViewMode] = useState('team'); // 'team' or 'club'
  const inputRef = useRef(null);

  const clubId = typeof currentTeamObject === 'object' ? currentTeamObject?.club_id : null;

  useEffect(() => {
    if (clubId) {
      fetchClubPlayers(clubId).then(setClubPlayers).catch(console.error);
    }
  }, [clubId, players]);

  // Derived state: which club players are currently on the team
  const teamPlayerIds = new Set(players.map(p => p.id));

  const handleAddPlayerToClub = async (e) => {
    e.preventDefault();
    const trimmedName = newPlayerName.trim();
    const trimmedNumber = newShirtNumber.trim();
    if (!trimmedName || !clubId) return;
    
    if (trimmedNumber && !/^[A-Za-z0-9]{1,3}$/.test(trimmedNumber)) {
      return alert("Shirt number must be 1-3 alphanumeric characters.");
    }

    if (clubPlayers.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      return alert("Player name already exists in this club!");
    }

    setIsProcessing(true);
    try {
      // 1. Add to Club
      const newPlayer = await addPlayerToClub(trimmedName, clubId, trimmedNumber || null);
      if (newPlayer) {
        setClubPlayers([...clubPlayers, newPlayer]);
        
        // 2. Automatically assign to current team if we are in Team view
        if (viewMode === 'team' && targetTeamId) {
          await togglePlayerOnTeam(newPlayer.id, targetTeamId, true);
          setPlayers([...players, { ...newPlayer, is_active: false }]);
        }
      }
      setNewPlayerName('');
      setNewShirtNumber('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      alert("Failed to add player: " + (err.message || err.details || JSON.stringify(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleTeamAssignment = async (player) => {
    if (!targetTeamId) return alert("No active team selected.");
    setIsProcessing(true);
    const isCurrentlyOnTeam = teamPlayerIds.has(player.id);
    
    try {
      await togglePlayerOnTeam(player.id, targetTeamId, !isCurrentlyOnTeam);
      
      if (isCurrentlyOnTeam) {
        // Remove from local team array
        setPlayers(players.filter(p => p.id !== player.id));
      } else {
        // Add to local team array
        setPlayers([...players, { ...player, is_active: false }]);
      }
    } catch (err) {
      alert("Failed to update team assignment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteFromClub = async (id) => {
    if (!window.confirm("Are you sure? This will permanently delete the player from the entire club and all teams.")) return;
    setIsProcessing(true);
    try {
      await removePlayerGlobally(id);
      setClubPlayers(clubPlayers.filter(p => p.id !== id));
      setPlayers(players.filter(p => p.id !== id));
    } catch {
      alert("Failed to delete player from database.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div className="flex flex-col w-full gap-4">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-white mb-2 sm:mb-0">
                Roster: <span className="text-indigo-400">{typeof currentTeamObject === 'object' ? currentTeamObject.name : currentTeam}</span>
              </h2>
            </div>
            
            <p className="text-xs text-slate-400">
              Need to create a new team or switch teams? Go to the <span className="text-indigo-400 font-bold">🛡️ Teams</span> tab in the bottom menu.
            </p>
            
            <div className="flex bg-slate-900 rounded-lg p-1 w-full sm:w-auto">
              <button 
                onClick={() => setViewMode('team')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${viewMode === 'team' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Team Roster ({players.length})
              </button>
              <button 
                onClick={() => setViewMode('club')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-bold transition-all ${viewMode === 'club' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Club Players ({clubPlayers.length})
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleAddPlayerToClub} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={newShirtNumber}
              onChange={(e) => setNewShirtNumber(e.target.value)}
              placeholder="#"
              disabled={isProcessing || !clubId}
              className="w-full sm:w-24 appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50 text-center"
            />
            <input
              ref={inputRef}
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder={clubId ? "Add new player to club..." : "Select a team first"}
              disabled={isProcessing || !clubId}
              className="flex-1 appearance-none bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={!newPlayerName.trim() || isProcessing || !clubId}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              Add
            </button>
          </form>

          {viewMode === 'team' && (
            <div>
              {clubPlayers.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-medium">
                  Your club has no players. Add some above!
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Assign Players to Team</p>
                  <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {clubPlayers.map((player) => {
                      const isOnTeam = teamPlayerIds.has(player.id);
                      return (
                        <li key={player.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${isOnTeam ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-900/50 border-slate-700/50 opacity-60 hover:opacity-100'}`}>
                          <span className={`font-semibold ${isOnTeam ? 'text-indigo-200' : 'text-slate-300'}`}>
                            {player.name} {player.shirt_number ? <span className="text-indigo-400/70 font-mono ml-1">#{player.shirt_number}</span> : ''}
                          </span>
                          <button 
                            onClick={() => handleToggleTeamAssignment(player)}
                            disabled={isProcessing}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${isOnTeam ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                          >
                            {isOnTeam ? 'Remove' : 'Add to Team'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {viewMode === 'club' && (
             <div className="space-y-2">
               <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Manage Club Roster</p>
               <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                 {clubPlayers.map((player) => (
                   <li key={player.id} className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                     <span className="text-slate-200 font-semibold">
                       {player.name} {player.shirt_number ? <span className="text-indigo-400 font-mono ml-1">#{player.shirt_number}</span> : ''}
                     </span>
                     <button 
                       onClick={() => handleDeleteFromClub(player.id)}
                       disabled={isProcessing}
                       className="text-rose-400 hover:text-rose-300 font-medium text-sm px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all disabled:opacity-50"
                     >
                       Delete Globally
                     </button>
                   </li>
                 ))}
               </ul>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default RosterSetup;
