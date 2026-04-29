import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import RosterSetup from './components/RosterSetup';
import LineupSelector from './components/LineupSelector';
import Analytics from './components/Analytics';
import EventLog from './components/EventLog';
import CoachDashboard from './components/CoachDashboard';
import BetaBadge from './components/BetaBadge';
import AuthScreen from './components/AuthScreen';
import AdminDashboard from './components/AdminDashboard';
import { fetchPlayers } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { ShieldCheck, Star, LogOut } from 'lucide-react';

function App() {
  const { user, profile, loading: authLoading, authError, signOut } = useAuth();
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
    return localStorage.getItem('ufstats_team') || '';
  });

  const [shadowTeam, setShadowTeam] = useState(null);

  // Auto-sync the current team to their actual database team name once profile loads
  useEffect(() => {
    if (profile?.is_system_admin && shadowTeam) {
      // Don't auto-sync if we are actively shadowing
      return;
    }
    if (profile?.teams?.name && (!currentTeam || currentTeam === 'Default Team (Migrated)')) {
      setCurrentTeam(profile.teams.name);
    }
  }, [profile, currentTeam, shadowTeam]);

  useEffect(() => {
    localStorage.setItem('ufstats_team', currentTeam);
  }, [currentTeam]);

  const [opponentName, setOpponentName] = useState(() => {
    return localStorage.getItem('ufstats_opponent') || '';
  });

  useEffect(() => {
    localStorage.setItem('ufstats_opponent', opponentName);
  }, [opponentName]);

  const [initialPossession, setInitialPossession] = useState(() => {
    return localStorage.getItem('ufstats_possession') || 'O';
  });

  useEffect(() => {
    localStorage.setItem('ufstats_possession', initialPossession);
  }, [initialPossession]);

  const targetTeamId = shadowTeam?.id
    ? shadowTeam.id
    : profile?.is_system_admin && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentTeam)
      ? currentTeam
      : profile?.team_id;

  const effectiveTeamName = shadowTeam?.name || currentTeam;

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        if (targetTeamId) {
            const data = await fetchPlayers(targetTeamId);
            setPlayers(data);
        }
      } catch (err) {
        console.error("Failed to load players.", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [targetTeamId, user]);

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-400 font-bold tracking-widest text-lg">
        AUTHENTICATING...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if ((authError && !profile) || (user && !profile && !authLoading)) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center p-6">
        <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-3xl max-w-md">
          <div className="text-rose-400 font-black tracking-widest text-xl mb-4">PROFILE SYNC ERROR</div>
          <p className="text-slate-300 text-sm mb-6">
            We couldn't securely fetch your user profile. This occasionally happens if your connection is unstable or if your session has partially expired.
          </p>
          {authError && (
            <div className="bg-black/50 p-4 rounded-xl text-left font-mono text-[10px] text-rose-300 mb-6 break-words">
               {authError}
            </div>
          )}
          <button 
            onClick={() => {
              signOut();
            }}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all"
          >
            Force Sign Out & Reset
          </button>
        </div>
      </div>
    );
  }

  if (loading && !authLoading) {
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
      {shadowTeam && (
        <div className="bg-amber-500 text-amber-950 font-black tracking-widest text-xs py-2 px-4 flex justify-center items-center gap-4 z-50 sticky top-0 shadow-md">
           <span>IMPERSONATING: {shadowTeam.name}</span>
           <button onClick={() => setShadowTeam(null)} className="bg-amber-950 text-amber-400 px-3 py-1 rounded hover:bg-amber-900 transition-colors shadow-inner">
             EXIT SHADOW
           </button>
        </div>
      )}
      
      {/* Premium Desktop Header */}
      <div className="hidden sm:flex justify-between items-center px-8 py-4 bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 shadow-xl">
        <div className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
          UF<span className="text-indigo-500 font-light">STATS</span>
          <BetaBadge />
        </div>
        <div className="flex items-center gap-4">
          {profile?.is_system_admin && (
             <button 
                onClick={() => setCurrentView('admin')}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white font-bold rounded-xl transition-all uppercase tracking-wide text-xs"
             >
                Admin Panel
             </button>
          )}
          <button 
            onClick={() => setCurrentView('coach')}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-extrabold rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] transition-all flex items-center gap-2 uppercase tracking-wide text-sm scale-100 hover:scale-[1.02]"
          >
            Coach Pro ★
          </button>
          <button 
            onClick={() => {
               if (window.confirm("Are you sure you want to sign out?")) {
                  signOut();
               }
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all uppercase tracking-wide text-xs border border-white/10"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sm:hidden flex justify-between items-center px-4 py-3 bg-slate-950/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 shadow-md">
        <div className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-1.5">
          UF<span className="text-indigo-500 font-light">STATS</span>
        </div>
        <div className="flex items-center gap-1">
          {profile?.is_system_admin && (
             <button 
                onClick={() => setCurrentView('admin')}
                className={`p-2 rounded-lg transition-all ${currentView === 'admin' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'}`}
                title="Admin Panel"
             >
                <ShieldCheck className="w-5 h-5" />
             </button>
          )}
          <button 
            onClick={() => setCurrentView('coach')}
            className={`p-2 rounded-lg transition-all ${currentView === 'coach' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-400 hover:text-amber-400'}`}
            title="Coach Pro"
          >
            <Star className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {
               if (window.confirm("Are you sure you want to sign out?")) {
                  signOut();
               }
            }}
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
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
          currentTeam={effectiveTeamName}
          targetTeamId={targetTeamId}
          opponentName={opponentName}
          initialPossession={initialPossession}
          isTrackingActive={isTrackingActive}
          setIsTrackingActive={setIsTrackingActive}
          onNavigate={setCurrentView} 
          players={players}
          setPlayers={setPlayers}
        />
      )}

      {currentView === 'analytics' && (
        <Analytics targetTeamId={targetTeamId} />
      )}
      
      {currentView === 'roster' && (
        <RosterSetup 
          players={players} 
          setPlayers={setPlayers}
          currentTeam={effectiveTeamName}
          setCurrentTeam={setCurrentTeam}
          targetTeamId={targetTeamId}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'lineup' && (
        <LineupSelector 
          players={players} 
          setPlayers={setPlayers}
          currentTeam={effectiveTeamName}
          targetTeamId={targetTeamId}
          onNavigate={setCurrentView} 
          currentGame={currentGame}
          setCurrentGame={setCurrentGame}
          currentPoint={currentPoint}
          setCurrentPoint={setCurrentPoint}
          gameType={gameType}
          setGameType={setGameType}
          setIsTrackingActive={setIsTrackingActive}
          opponentName={opponentName}
          setOpponentName={setOpponentName}
          initialPossession={initialPossession}
          setInitialPossession={setInitialPossession}
        />
      )}

      {currentView === 'coach' && (
        <CoachDashboard 
          currentGame={currentGame}
          currentTeam={effectiveTeamName}
          targetTeamId={targetTeamId}
          setCurrentTeam={setCurrentTeam}
        />
      )}

      {currentView === 'log' && (
        <EventLog 
          currentGame={currentGame}
          currentTeam={effectiveTeamName}
          targetTeamId={targetTeamId}
          onNavigate={setCurrentView} 
        />
      )}

      {currentView === 'admin' && profile?.is_system_admin && (
        <AdminDashboard 
          onNavigate={setCurrentView}
          onShadowTeam={setShadowTeam}
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
