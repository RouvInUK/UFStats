import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RosterSetup from './components/RosterSetup';
import LineupSelector from './components/LineupSelector';
import Analytics from './components/Analytics';
import EventLog from './components/EventLog';
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchPlayers();
        setPlayers(data);
      } catch (err) {
        console.error("Failed to load players. Ensure your table exists and RLS is disabled for inserts.", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
    <div className="min-h-screen bg-slate-900 selection:bg-indigo-500 selection:text-white">
      {currentView === 'dashboard' && (
        <Dashboard 
          activeLineup={activeLineup} 
          currentPoint={currentPoint}
          setCurrentPoint={setCurrentPoint}
          currentGame={currentGame}
          setCurrentGame={setCurrentGame}
          isTrackingActive={isTrackingActive}
          setIsTrackingActive={setIsTrackingActive}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'analytics' && (
        <Analytics 
          onNavigate={setCurrentView} 
        />
      )}
      
      {currentView === 'roster' && (
        <RosterSetup 
          players={players} 
          setPlayers={setPlayers}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'lineup' && (
        <LineupSelector 
          players={players} 
          setPlayers={setPlayers}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'log' && (
        <EventLog 
          currentGame={currentGame}
          onNavigate={setCurrentView} 
        />
      )}
    </div>
  )
}

export default App;
