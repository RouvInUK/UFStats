import { useState, useEffect, useRef } from 'react';
import { supabase, addPlayerToClub, togglePlayerOnTeam, removePlayerGlobally, fetchClubPlayers, updatePlayerInClub } from '../supabaseClient';

const RosterSetup = ({ players, setPlayers, currentTeam, currentTeamObject, targetTeamId }) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newShirtNumber, setNewShirtNumber] = useState('');
  const [newGender, setNewGender] = useState(''); // '' | 'mmp' | 'fmp'
  const [isProcessing, setIsProcessing] = useState(false);
  const [clubPlayers, setClubPlayers] = useState([]);
  const [viewMode, setViewMode] = useState('team'); // 'team' or 'club'
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editShirtNumber, setEditShirtNumber] = useState('');
  const [editGender, setEditGender] = useState(''); // '' | 'mmp' | 'fmp'
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [showCsvImporter, setShowCsvImporter] = useState(false);
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
      const newPlayer = await addPlayerToClub(trimmedName, clubId, trimmedNumber || null, newGender || null);
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
      setNewGender('');
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      alert("Failed to add player: " + (err.message || err.details || JSON.stringify(err)));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile || !clubId) return;

    setCsvUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) {
          throw new Error('CSV is empty or lacks headers.');
        }

        const headers = lines[0].toLowerCase().split(',');
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const numberIdx = headers.findIndex(h => h.includes('number') || h.includes('shirt'));
        const genderIdx = headers.findIndex(h => h.includes('gender') || h.includes('designation') || h.includes('mmp') || h.includes('fmp'));

        if (nameIdx === -1) {
          throw new Error('CSV must contain a "name" column.');
        }

        const playersToInsert = [];
        const uniqueNames = new Set();

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
          const pName = cols[nameIdx];
          if (!pName || uniqueNames.has(pName)) continue;
          uniqueNames.add(pName);

          const shirtNum = numberIdx !== -1 ? cols[numberIdx] : '';
          
          let gender = null;
          if (genderIdx !== -1 && cols[genderIdx]) {
            const rawGender = cols[genderIdx].toLowerCase();
            if (rawGender.includes('mmp') || rawGender === 'm' || rawGender.includes('male')) {
              gender = 'mmp';
            } else if (rawGender.includes('fmp') || rawGender === 'f' || rawGender.includes('female')) {
              gender = 'fmp';
            }
          }

          playersToInsert.push({
            name: pName,
            club_id: clubId,
            shirt_number: shirtNum || null,
            gender_designation: gender
          });
        }

        if (playersToInsert.length === 0) {
          throw new Error('No valid players parsed from CSV.');
        }

        // Check for duplicate names already in club
        const existingNames = new Set(clubPlayers.map(cp => cp.name.toLowerCase()));
        const nonDuplicatePlayers = playersToInsert.filter(p => !existingNames.has(p.name.toLowerCase()));

        if (nonDuplicatePlayers.length === 0) {
          throw new Error('All players in the CSV are already registered in this club.');
        }

        // Insert into players
        const { data: insertedPlayers, error: insertError } = await supabase
          .from('players')
          .insert(nonDuplicatePlayers)
          .select();

        if (insertError) throw insertError;

        // If viewMode === 'team' and targetTeamId, automatically assign them in team_players
        if (viewMode === 'team' && targetTeamId && insertedPlayers && insertedPlayers.length > 0) {
          const teamPlayersToInsert = insertedPlayers.map(p => ({
            player_id: p.id,
            team_id: targetTeamId,
            is_active: false
          }));

          const { error: teamInsertError } = await supabase
            .from('team_players')
            .insert(teamPlayersToInsert);

          if (teamInsertError) throw teamInsertError;

          // Update local team state
          setPlayers(prev => [...prev, ...insertedPlayers.map(p => ({ ...p, is_active: false }))]);
        }

        setClubPlayers(prev => [...prev, ...insertedPlayers]);
        alert(`Successfully imported ${insertedPlayers.length} players to the club!`);
        setCsvFile(null);
        setShowCsvImporter(false);
      } catch (err) {
        alert(err.message || 'Failed to process CSV file.');
      } finally {
        setCsvUploading(false);
      }
    };
    reader.readAsText(csvFile);
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

  const handleEditClick = (player) => {
    setEditingPlayerId(player.id);
    setEditPlayerName(player.name);
    setEditShirtNumber(player.shirt_number || '');
    setEditGender(player.gender_designation || '');
  };

  const handleSaveEdit = async (e, playerId) => {
    e.preventDefault();
    const trimmedName = editPlayerName.trim();
    const trimmedNumber = editShirtNumber.trim();
    if (!trimmedName) return;

    if (trimmedNumber && !/^[A-Za-z0-9]{1,3}$/.test(trimmedNumber)) {
      return alert("Shirt number must be 1-3 alphanumeric characters.");
    }

    setIsProcessing(true);
    try {
      const updatedPlayer = await updatePlayerInClub(playerId, trimmedName, trimmedNumber || null, editGender || null);
      setClubPlayers(clubPlayers.map(p => p.id === playerId ? updatedPlayer : p));
      setPlayers(players.map(p => p.id === playerId ? { ...p, name: updatedPlayer.name, shirt_number: updatedPlayer.shirt_number, gender_designation: updatedPlayer.gender_designation } : p));
      setEditingPlayerId(null);
    } catch (err) {
      alert("Failed to update player: " + (err.message || JSON.stringify(err)));
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
          <form onSubmit={handleAddPlayerToClub} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
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
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 border border-slate-750 rounded-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Division Roster Match</span>
              <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setNewGender('')}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-black tracking-widest transition-all ${
                    newGender === '' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Unspecified
                </button>
                <button
                  type="button"
                  onClick={() => setNewGender('mmp')}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-black tracking-widest transition-all ${
                    newGender === 'mmp' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  MMP
                </button>
                <button
                  type="button"
                  onClick={() => setNewGender('fmp')}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase font-black tracking-widest transition-all ${
                    newGender === 'fmp' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  FMP
                </button>
              </div>
              
              <button 
                type="submit"
                disabled={!newPlayerName.trim() || isProcessing || !clubId}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 text-xs uppercase tracking-widest"
              >
                Add Player
              </button>
            </div>
          </form>

          {clubId && (
            <div className="border-t border-slate-700/50 pt-4 mt-4">
              <button
                type="button"
                onClick={() => setShowCsvImporter(!showCsvImporter)}
                className="w-full bg-slate-900 hover:bg-slate-750 border border-slate-750 text-indigo-400 py-3 px-6 font-black rounded-xl uppercase tracking-widest text-xs shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <span>📁 {showCsvImporter ? 'Hide Roster CSV Importer' : 'Import Roster from CSV'}</span>
              </button>

              {showCsvImporter && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-6 mt-4 space-y-4 animate-fadeIn">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    Roster CSV Importer
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                    Upload a CSV containing player names, shirt numbers, and gender matches. Players will be added to the club {viewMode === 'team' && targetTeamId && 'and automatically assigned to the active team roster'}.
                  </p>
                  
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Example CSV Format:</p>
                    <pre className="text-[9px] text-indigo-300 font-mono bg-slate-950 p-2.5 rounded-lg border border-white/5 overflow-x-auto select-all leading-normal">
{`name,number,gender/designation
Alex Smith,7,mmp
Sarah Connor,12,fmp
Jamie Jones,4,mmp`}
                    </pre>
                    <p className="text-[8px] text-slate-500 font-semibold mt-1.5 leading-normal italic">
                      * Header names are case-sensitive. "mmp" (Male Matching Player) and "fmp" (Female Matching Player) are used to audit mixed line balances.
                    </p>
                  </div>

                  <form onSubmit={handleCsvUpload} className="space-y-3">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      required
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none transition-all shadow-inner text-xs"
                    />

                    <button
                      type="submit"
                      disabled={csvUploading || !csvFile}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/20 text-white py-3.5 px-6 font-black rounded-xl uppercase tracking-widest text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {csvUploading ? 'Importing Roster...' : 'Import Roster CSV'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

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
                        <li key={player.id} className={`flex flex-col sm:flex-row justify-between sm:items-center p-3 rounded-xl border transition-all gap-3 ${isOnTeam ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-900/50 border-slate-700/50 opacity-60 hover:opacity-100'}`}>
                          {editingPlayerId === player.id ? (
                             <form onSubmit={(e) => handleSaveEdit(e, player.id)} className="flex flex-col gap-3 w-full">
                               <div className="flex gap-2">
                                 <input
                                   type="text"
                                   value={editShirtNumber}
                                   onChange={(e) => setEditShirtNumber(e.target.value)}
                                   className="w-16 bg-slate-800 border border-slate-650 rounded-xl px-2 py-1 text-white text-sm"
                                   placeholder="#"
                                 />
                                 <input
                                   type="text"
                                   value={editPlayerName}
                                   onChange={(e) => setEditPlayerName(e.target.value)}
                                   className="flex-1 bg-slate-800 border border-slate-650 rounded-xl px-2 py-1 text-white text-sm min-w-0"
                                 />
                               </div>
                               <div className="flex items-center justify-between gap-3 bg-slate-950 p-2 rounded-xl border border-slate-850">
                                 <div className="flex bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
                                   <button
                                     type="button"
                                     onClick={() => setEditGender('')}
                                     className={`px-3 py-1 rounded text-[9px] uppercase font-black tracking-widest transition-all ${
                                       editGender === '' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                                     }`}
                                   >
                                     Unspecified
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => setEditGender('mmp')}
                                     className={`px-3 py-1 rounded text-[9px] uppercase font-black tracking-widest transition-all ${
                                       editGender === 'mmp' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                                     }`}
                                   >
                                     MMP
                                   </button>
                                   <button
                                     type="button"
                                     onClick={() => setEditGender('fmp')}
                                     className={`px-3 py-1 rounded text-[9px] uppercase font-black tracking-widest transition-all ${
                                       editGender === 'fmp' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300'
                                     }`}
                                   >
                                     FMP
                                   </button>
                                 </div>
                                 <div className="flex gap-2">
                                   <button type="submit" disabled={isProcessing} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-emerald-500">Save</button>
                                   <button type="button" onClick={() => setEditingPlayerId(null)} className="bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-600">Cancel</button>
                                 </div>
                               </div>
                             </form>
                          ) : (
                             <>
                               <div className="flex items-center gap-2 flex-1">
                                 <span className={`font-semibold ${isOnTeam ? 'text-indigo-200' : 'text-slate-300'}`}>
                                   {player.name} {player.shirt_number ? <span className="text-indigo-400/70 font-mono ml-1">#{player.shirt_number}</span> : ''}
                                 </span>
                                 {player.gender_designation === 'mmp' && (
                                   <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">MMP</span>
                                 )}
                                 {player.gender_designation === 'fmp' && (
                                   <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">FMP</span>
                                 )}
                               </div>
                               <div className="flex gap-2 justify-end">
                                 <button 
                                   onClick={() => handleEditClick(player)}
                                   disabled={isProcessing}
                                   className="text-slate-300 hover:text-white font-medium text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all disabled:opacity-50"
                                 >
                                   Edit
                                 </button>
                                 <button 
                                   onClick={() => handleToggleTeamAssignment(player)}
                                   disabled={isProcessing}
                                   className={`px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${isOnTeam ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                                 >
                                   {isOnTeam ? 'Remove' : 'Add'}
                                 </button>
                               </div>
                             </>
                          )}
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
                   <li key={player.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 gap-3">
                     {editingPlayerId === player.id ? (
                        <form onSubmit={(e) => handleSaveEdit(e, player.id)} className="flex flex-col gap-3 w-full">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editShirtNumber}
                              onChange={(e) => setEditShirtNumber(e.target.value)}
                              className="w-16 bg-slate-800 border border-slate-650 rounded-xl px-2 py-1 text-white text-sm"
                              placeholder="#"
                            />
                            <input
                              type="text"
                              value={editPlayerName}
                              onChange={(e) => setEditPlayerName(e.target.value)}
                              className="flex-1 bg-slate-800 border border-slate-650 rounded-xl px-2 py-1 text-white text-sm min-w-0"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 bg-slate-950 p-2 rounded-xl border border-slate-850">
                            <div className="flex bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setEditGender('')}
                                className={`px-3 py-1 rounded text-[9px] uppercase font-black tracking-widest transition-all ${
                                  editGender === '' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                Unspecified
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditGender('mmp')}
                                className={`px-3 py-1 rounded text-[9px] uppercase font-black tracking-widest transition-all ${
                                  editGender === 'mmp' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                MMP
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditGender('fmp')}
                                className={`px-3 py-1 rounded text-[9px] uppercase font-black tracking-widest transition-all ${
                                  editGender === 'fmp' ? 'bg-purple-500/20 text-purple-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                FMP
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" disabled={isProcessing} className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-emerald-500">Save</button>
                              <button type="button" onClick={() => setEditingPlayerId(null)} className="bg-slate-700 text-slate-300 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-600">Cancel</button>
                            </div>
                          </div>
                        </form>
                     ) : (
                        <>
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-slate-200 font-semibold">
                              {player.name} {player.shirt_number ? <span className="text-indigo-400 font-mono ml-1">#{player.shirt_number}</span> : ''}
                            </span>
                            {player.gender_designation === 'mmp' && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">MMP</span>
                            )}
                            {player.gender_designation === 'fmp' && (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">FMP</span>
                            )}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => handleEditClick(player)}
                              disabled={isProcessing}
                              className="text-slate-300 hover:text-white font-medium text-xs px-3.5 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteFromClub(player.id)}
                              disabled={isProcessing}
                              className="text-rose-400 hover:text-rose-300 font-medium text-xs px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-all disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                     )}
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
