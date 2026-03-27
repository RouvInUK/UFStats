import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RosterSetup from './components/RosterSetup';
import LineupSelector from './components/LineupSelector';
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
    return saved ? parseInt(saved, 10) : 1;
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

  // Persist local state
  useEffect(() => {
    localStorage.setItem('ufstats_game', currentGame);
  }, [currentGame]);

  useEffect(() => {
    localStorage.setItem('ufstats_point', currentPoint.toString());
  }, [currentPoint]);

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
    </div>
  )
}

export default App;
