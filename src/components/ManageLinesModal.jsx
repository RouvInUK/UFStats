import React, { useState } from 'react';
import { X, Plus, Trash2, Check, UserPlus } from 'lucide-react';

const ManageLinesModal = ({ lines, saveLines, players, onClose }) => {
  const [editingLineId, setEditingLineId] = useState(null);
  const [newLineName, setNewLineName] = useState('');

  const handleAddLine = () => {
    if (!newLineName.trim()) return;
    const newLine = {
      id: Date.now().toString(),
      name: newLineName.trim(),
      playerIds: []
    };
    saveLines([...lines, newLine]);
    setNewLineName('');
    setEditingLineId(newLine.id);
  };

  const handleDeleteLine = (id) => {
    if (window.confirm("Delete this line template?")) {
      saveLines(lines.filter(l => l.id !== id));
      if (editingLineId === id) setEditingLineId(null);
    }
  };

  const togglePlayerInLine = (lineId, playerId) => {
    const updatedLines = lines.map(line => {
      if (line.id === lineId) {
        const isSelected = line.playerIds.includes(playerId);
        return {
          ...line,
          playerIds: isSelected 
            ? line.playerIds.filter(id => id !== playerId)
            : [...line.playerIds, playerId]
        };
      }
      return line;
    });
    saveLines(updatedLines);
  };

  const activeLine = lines.find(l => l.id === editingLineId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm sm:items-center sm:justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-full overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black text-white">Manage Lines</h2>
            <p className="text-slate-400 text-sm">Create and edit pre-load templates.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden min-h-[400px]">
          
          {/* Left Column: Lines List */}
          <div className="w-full sm:w-1/3 border-r border-slate-800 bg-slate-900/50 flex flex-col h-full overflow-y-auto">
            <div className="p-4 space-y-2 flex-1">
              {lines.length === 0 ? (
                <div className="text-slate-500 text-sm text-center py-4 italic">No lines created yet.</div>
              ) : (
                lines.map(line => (
                  <div 
                    key={line.id} 
                    className={`flex justify-between items-center p-3 rounded-xl cursor-pointer border transition-all ${editingLineId === line.id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800/50 border-transparent text-slate-300 hover:bg-slate-800'}`}
                    onClick={() => setEditingLineId(line.id)}
                  >
                    <span className="font-bold truncate pr-2">{line.name}</span>
                    <span className="text-xs bg-slate-900 px-2 py-1 rounded-md text-slate-400 font-mono">
                      {line.playerIds.length}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-900 sticky bottom-0">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newLineName} 
                  onChange={(e) => setNewLineName(e.target.value)} 
                  placeholder="New Line Name" 
                  className="w-full bg-slate-950 border border-slate-700 text-sm text-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLine()}
                />
                <button 
                  onClick={handleAddLine} 
                  disabled={!newLineName.trim()}
                  className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Player Assignment */}
          <div className="w-full sm:w-2/3 bg-slate-900 flex flex-col h-full overflow-y-auto">
            {activeLine ? (
              <>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-400" />
                    Editing {activeLine.name}
                  </h3>
                  <button 
                    onClick={() => handleDeleteLine(activeLine.id)}
                    className="text-rose-400 hover:text-rose-300 p-2 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                    title="Delete Line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2">
                  {players.map(player => {
                    const isSelected = activeLine.playerIds.includes(player.id);
                    return (
                      <button
                        key={player.id}
                        onClick={() => togglePlayerInLine(activeLine.id, player.id)}
                        className={`p-3 text-sm font-bold flex justify-between items-center rounded-xl border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
                      >
                        <span className="truncate">{player.name}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 p-8 text-center">
                Select a line from the left or create a new one to start assigning players.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManageLinesModal;
