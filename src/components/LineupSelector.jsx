const LineupSelector = ({ roster, activeLineup, setActiveLineup, onNavigate }) => {
  
  const togglePlayer = (player) => {
    if (activeLineup.includes(player)) {
      setActiveLineup(activeLineup.filter(p => p !== player));
    } else {
      setActiveLineup([...activeLineup, player]);
    }
  };

  return (
    <div className="flex flex-col items-center p-4 py-8 sm:py-12 min-h-screen">
      <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-700 pb-6">
        
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 border-b border-slate-700/50">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Active Lineup</h1>
            <p className="text-slate-400 text-sm font-medium">{activeLineup.length} Players on Pitch</p>
          </div>
          <button 
            onClick={() => onNavigate('dashboard')}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-all w-full sm:w-auto text-center"
          >
            ← Done
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {roster.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-700/50 space-y-4">
              <p className="text-slate-400 font-medium">Your roster is currently empty.</p>
              <button 
                onClick={() => onNavigate('roster')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                Go setup your roster
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {roster.map((player) => {
                const isActive = activeLineup.includes(player);
                return (
                  <button
                    key={player}
                    onClick={() => togglePlayer(player)}
                    className={`px-3 py-4 text-sm font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-3 ${
                      isActive
                        ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-2 ring-emerald-400 scale-105 z-10'
                        : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-white shadow-sm' : 'bg-slate-700'}`} />
                    {player}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LineupSelector;
