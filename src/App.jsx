import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RosterSetup from './components/RosterSetup';
import LineupSelector from './components/LineupSelector';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Load initial state from local storage or start totally blank
  const [roster, setRoster] = useState(() => {
    const saved = localStorage.getItem('ufstats_roster');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [activeLineup, setActiveLineup] = useState(() => {
    const saved = localStorage.getItem('ufstats_lineup');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentPoint, setCurrentPoint] = useState(() => {
    const saved = localStorage.getItem('ufstats_point');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem('ufstats_roster', JSON.stringify(roster));
  }, [roster]);

  useEffect(() => {
    localStorage.setItem('ufstats_lineup', JSON.stringify(activeLineup));
  }, [activeLineup]);

  useEffect(() => {
    localStorage.setItem('ufstats_point', currentPoint.toString());
  }, [currentPoint]);

  return (
    <div className="min-h-screen bg-slate-900 selection:bg-indigo-500 selection:text-white">
      {currentView === 'dashboard' && (
        <Dashboard 
          activeLineup={activeLineup} 
          currentPoint={currentPoint}
          setCurrentPoint={setCurrentPoint}
          onNavigate={setCurrentView} 
        />
      )}
      
      {currentView === 'roster' && (
        <RosterSetup 
          roster={roster} 
          setRoster={setRoster}
          activeLineup={activeLineup}
          setActiveLineup={setActiveLineup}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'lineup' && (
        <LineupSelector 
          roster={roster} 
          activeLineup={activeLineup}
          setActiveLineup={setActiveLineup}
          onNavigate={setCurrentView} 
        />
      )}
    </div>
  )
}

export default App;
