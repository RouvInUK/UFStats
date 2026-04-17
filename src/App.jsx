import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RosterSetup from './components/RosterSetup';
import LineupSelector from './components/LineupSelector';
import Analytics from './components/Analytics';
import EventLog from './components/EventLog';
import CoachDashboard from './components/CoachDashboard';
import { fetchPlayers } from './supabaseClient';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Database State
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Local Game State
  const [currentGame, setCurrentGame] = useState(() => {
    return localStorage.getItem('ufstats_game') || '';
  });

  const [currentPoint, setCurrentPoint] = useState(() => {
    const saved = localStorage.getItem('ufstats_point');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isTrackingActive, setIsTrackingActive] = useState(() => {
    return localStorage.getItem('ufstats_tracking') === 'true';
  });

  const [gameType, setGameType] = useState(() => {
    return localStorage.getItem('ufstats_game_type') || 'grass';
  });

  useEffect(() => {
    localStorage.setItem('ufstats_game_type', gameType);
  }, [gameType]);

  const [currentTeam, setCurrentTeam] = useState(() => {
    return localStorage.getItem('ufstats_team') || 'Default Team';
  });

  useEffect(() => {
    localStorage.setItem('ufstats_team', currentTeam);
  }, [currentTeam]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchPlayers(currentTeam);
        setPlayers(data);
      } catch (err) {
        console.error("Failed to load players for team.", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentTeam]);

  // Screen Wake Lock
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      if (wakeLock !== null && !wakeLock.released) return;

      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => {
            wakeLock = null;
          });
        }
      } catch (err) {
        console.warn('Wake Lock error:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // iOS deeply requires direct user interaction to trigger wake requests
    document.addEventListener('touchstart', requestWakeLock, { passive: true });
    document.addEventListener('click', requestWakeLock, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('touchstart', requestWakeLock);
      document.removeEventListener('click', requestWakeLock);
      if (wakeLock !== null) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // Persist local state
  useEffect(() => {
    localStorage.setItem('ufstats_game', currentGame);
  }, [currentGame]);

  useEffect(() => {
    localStorage.setItem('ufstats_point', currentPoint.toString());
  }, [currentPoint]);

  useEffect(() => {
    localStorage.setItem('ufstats_tracking', isTrackingActive.toString());
  }, [isTrackingActive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-indigo-400 font-bold tracking-widest text-lg">
        SYNCING DATABASE...
      </div>
    );
  }

  // Derive active lineup (array of strings) for Dashboard compatibility
  const activeLineup = players.filter(p => p.is_active).map(p => p.name);

  return (
    <div className="min-h-screen bg-slate-900 selection:bg-indigo-500 selection:text-white pb-24">
      
      {/* Premium Desktop Header */}
      <div className="hidden sm:flex justify-between items-center px-8 py-4 bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 shadow-xl">
        <div className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
          UF<span className="text-indigo-500 font-light">STATS</span>
        </div>
        <button 
          onClick={() => setCurrentView('coach')}
          className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] transition-all flex items-center gap-2 uppercase tracking-wide text-sm scale-100 hover:scale-[1.02]"
        >
          Coach Pro ★
        </button>
      </div>

      {currentView === 'dashboard' && (
        <Dashboard 
          activeLineup={activeLineup} 
          currentPoint={currentPoint}
          setCurrentPoint={setCurrentPoint}
          currentGame={currentGame}
          setCurrentGame={setCurrentGame}
          gameType={gameType}
          setGameType={setGameType}
          currentTeam={currentTeam}
          isTrackingActive={isTrackingActive}
          setIsTrackingActive={setIsTrackingActive}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'analytics' && (
        <Analytics />
      )}
      
      {currentView === 'roster' && (
        <RosterSetup 
          players={players} 
          setPlayers={setPlayers}
          currentTeam={currentTeam}
          setCurrentTeam={setCurrentTeam}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'lineup' && (
        <LineupSelector 
          players={players} 
          setPlayers={setPlayers}
          currentTeam={currentTeam}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'coach' && (
        <CoachDashboard 
          currentGame={currentGame}
          currentTeam={currentTeam}
          setCurrentTeam={setCurrentTeam}
        />
      )}

      {currentView === 'log' && (
        <EventLog 
          currentGame={currentGame}
          onNavigate={setCurrentView} 
        />
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center px-2 py-3 sm:py-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-safe">
        <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentView === 'dashboard' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'dashboard' ? 'scale-125' : 'scale-100'}`}>🎯</span>
          <span className="text-[10px] uppercase tracking-wider">Track</span>
        </button>
        <button onClick={() => setCurrentView('lineup')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentView === 'lineup' || currentView === 'roster' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'lineup' || currentView === 'roster' ? 'scale-125' : 'scale-100'}`}>👕</span>
          <span className="text-[10px] uppercase tracking-wider">Lineup</span>
        </button>
        <button onClick={() => setCurrentView('log')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentView === 'log' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'log' ? 'scale-125' : 'scale-100'}`}>📜</span>
          <span className="text-[10px] uppercase tracking-wider">Log</span>
        </button>
        <button onClick={() => setCurrentView('analytics')} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${currentView === 'analytics' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'analytics' ? 'scale-125' : 'scale-100'}`}>📊</span>
          <span className="text-[10px] uppercase tracking-wider">Data</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
