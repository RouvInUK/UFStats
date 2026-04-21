import { useState, useEffect, useCallback } from 'react';
import { fetchGameStats, updateStat, deleteStat, fetchAllGameNames } from '../supabaseClient';
import { Pencil, Trash2 } from 'lucide-react';

const STAT_TYPES = ['Point', 'Pass', 'Throwaway', 'Drop', 'Stall Out', 'Defence'];

const EventLog = ({ currentGame, onNavigate }) => {
  const [selectedGame, setSelectedGame] = useState(currentGame);
  const [allGames, setAllGames] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const names = await fetchAllGameNames();
        setAllGames(names);
        if (!selectedGame && names.length > 0) {
           setSelectedGame(names[names.length - 1]); // Default to latest if no active game
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, [selectedGame]);

  const loadLogs = useCallback(async () => {
    if (!selectedGame) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchGameStats(selectedGame);
      setLogs(data);
    } catch (err) {
      console.error(err);
      alert('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [selectedGame]);

  useEffect(() => {
    loadLogs();
  }, [selectedGame, loadLogs]);

  const handleUpdate = async (id, newStatType) => {
    setSavingId(id);
    try {
      await updateStat(id, newStatType);
      await loadLogs();
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update event');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to completely delete this event? This cannot be undone.")) return;
    setSavingId(id);
    try {
      await deleteStat(id);
      await loadLogs();
    } catch (err) {
      console.error(err);
      alert('Failed to delete event');
    } finally {
      setSavingId(null);
    }
  };

  if (!loading && allGames.length === 0 && !selectedGame) {
    return (
      <div className="flex flex-col items-center justify-center p-4 min-h-screen text-slate-400 bg-slate-900">
        <h2 className="text-xl font-bold mb-4">No Games Recorded</h2>
        <p className="mb-6">Please enter a match name on the Dashboard first.</p>
        <button 
          onClick={() => onNavigate('dashboard')}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-2xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        {/* Header */}
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <h1 className="text-2xl font-extrabold text-white tracking-tight shrink-0">Game Log</h1>
            <select
              value={selectedGame || ''}
              onChange={(e) => setSelectedGame(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-4 py-2 font-bold outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto shadow-inner"
            >
              {allGames.map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content list */}
        <div className="p-4 sm:p-6">
          {loading ? (
            <p className="text-center text-indigo-400 font-bold tracking-widest my-12 animate-pulse">LOADING LOGS...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-medium bg-slate-900/50 rounded-2xl border border-slate-700/50">
              No stats recorded yet for {selectedGame}.
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                const groupedObj = logs.reduce((acc, log) => {
                   const pt = log.point_number;
                   if (!acc[pt]) acc[pt] = [];
                   acc[pt].push(log);
                   return acc;
                }, {});

                const sortedPoints = Object.keys(groupedObj).map(Number).sort((a,b) => b - a);

                return sortedPoints.map(pointNum => {
                   const pointLogs = groupedObj[pointNum];
                   const endedInGoal = pointLogs.some(l => l.stat_type === 'Point' || l.stat_type === 'Opponent Point');

                   return (
                     <div key={pointNum} className={`p-5 rounded-xl border bg-white/5 backdrop-blur-sm ${endedInGoal ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/10'}`}>
                       <h3 className="text-slate-400 font-semibold uppercase tracking-wider mb-4 border-b border-slate-700/50 pb-2">
                         Point {pointNum}
                       </h3>
                       {pointLogs.length === 0 ? (
                         <p className="text-slate-500 italic text-sm">No actions logged for this point</p>
                       ) : (
                         <div className="space-y-4">
                           {pointLogs.map(log => {
                             const isSystem = log.player === 'System';
                             return (
                               <div key={log.id} className="flex justify-between items-center gap-2 group">
                                 <div className="flex items-center gap-3">
                                   {isSystem ? (
                                      <span className="text-slate-500 font-bold italic">{log.stat_type}</span>
                                   ) : (
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <span className="text-white font-bold">{log.player}</span>
                                        <div className="flex items-center gap-2 opacity-50 transition-opacity group-hover:opacity-100 ml-1">
                                          <button onClick={() => editingId === log.id ? setEditingId(null) : setEditingId(log.id)} disabled={savingId === log.id} className="text-indigo-400 hover:text-indigo-300 bg-slate-900/50 p-1.5 rounded-md hover:bg-slate-800 transition-colors" title="Edit">
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => handleDelete(log.id)} disabled={savingId === log.id} className="text-rose-400 hover:text-rose-300 bg-slate-900/50 p-1.5 rounded-md hover:bg-slate-800 transition-colors" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                   )}
                                 </div>
                                 <div className="flex items-center gap-3">
                                   {editingId === log.id && !isSystem ? (
                                      <select 
                                        value={log.stat_type}
                                        onChange={(e) => handleUpdate(log.id, e.target.value)}
                                        disabled={savingId === log.id}
                                        className="bg-slate-900 border border-indigo-500 text-indigo-300 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                      >
                                        {STAT_TYPES.map(type => (
                                          <option key={type} value={type}>{type}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className={`text-sm font-bold px-2 py-0.5 rounded-md 
                                        ${log.stat_type === 'Point' ? 'bg-emerald-500/20 text-emerald-400' : 
                                          log.stat_type === 'Pass' ? 'bg-cyan-500/20 text-cyan-400' : 
                                          log.stat_type === 'Defence' ? 'bg-orange-500/20 text-orange-400' : 
                                          'bg-rose-500/20 text-rose-400'}`}
                                      >
                                        {log.stat_type}
                                      </span>
                                    )}
                                    <span className="text-slate-500 text-xs font-medium min-w-[60px] text-right tabular-nums">
                                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventLog;
