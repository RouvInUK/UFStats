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
import TeamSelectionScreen from './components/TeamSelectionScreen';
import { fetchPlayers } from './supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { ShieldCheck, Star, LogOut, Cloud, CloudOff, CloudUpload, Crown } from 'lucide-react';
import { getPendingSyncCount } from './SyncEngine';

const SyncIndicator = () => {
  const [status, setStatus] = useState('synced');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      const count = await getPendingSyncCount();
      setPendingCount(count);
      if (status === 'offline' && count === 0) setStatus('synced');
    };

    const handleSyncStatus = (e) => {
      setStatus(e.detail);
      updateCount();
    };

    window.addEventListener('sync-status', handleSyncStatus);
    
    // Initial check
    updateCount();
    const interval = setInterval(updateCount, 2000);

    return () => {
      window.removeEventListener('sync-status', handleSyncStatus);
      clearInterval(interval);
    };
  }, [status]);

  if (status === 'synced' && pendingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full text-xs font-bold" title="All data synced to cloud">
        <Cloud className="w-3.5 h-3.5" />
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full text-xs font-bold" title="Syncing data to cloud...">
        <CloudUpload className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full text-xs font-bold animate-pulse" title={`${pendingCount} points waiting for connection`}>
      <CloudOff className="w-3.5 h-3.5" />
      <span>{pendingCount}</span>
    </div>
  );
};

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
    if (gameType === 'training') {
      setGameType('grass');
    } else {
      localStorage.setItem('ufstats_game_type', gameType);
    }
  }, [gameType]);

  const [currentTeam, setCurrentTeam] = useState(() => {
    try {
      const saved = localStorage.getItem('ufstats_team');
      if (saved && saved.startsWith('{')) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [shadowTeam, setShadowTeam] = useState(null);

  // Auto-sync the current team to their actual database team name once profile loads
  useEffect(() => {
    if (profile?.is_system_admin && shadowTeam) {
      // Don't auto-sync if we are actively shadowing
      return;
    }
  }, [profile, currentTeam, shadowTeam]);

  useEffect(() => {
    if (currentTeam) {
      localStorage.setItem('ufstats_team', JSON.stringify(currentTeam));
    } else {
      localStorage.removeItem('ufstats_team');
    }
  }, [currentTeam]);

  // Prevent Cross-Team State Leakage
  const [previousTeamId, setPreviousTeamId] = useState(null);
  useEffect(() => {
    if (currentTeam?.id) {
      if (previousTeamId !== null && previousTeamId !== currentTeam.id) {
        setCurrentGame('');
        setCurrentPoint(0);
        setIsTrackingActive(false);
        setOpponentName('');
        setGameType('game');
        setActiveLineup([]);
      }
      setPreviousTeamId(currentTeam.id);
    }
  }, [currentTeam?.id]);

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

  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    return localStorage.getItem('ufstats_voice_enabled') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ufstats_voice_enabled', isVoiceEnabled);
  }, [isVoiceEnabled]);

  useEffect(() => {
    // Voice Pro is temporarily disabled for iOS compatibility updates
    if (isVoiceEnabled) {
      setIsVoiceEnabled(false);
    }
  }, [isVoiceEnabled]);

  // Screen Wake Lock API (keeps mobile screens from dimming/locking)
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.warn(`Wake Lock error: ${err.name}, ${err.message}`);
      }
    };

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
        });
      }
    };
  }, []);

  const targetTeamId = shadowTeam?.id
    ? shadowTeam.id
    : typeof currentTeam === 'object' && currentTeam?.id
      ? currentTeam.id
      : null;

  const effectiveTeamName = shadowTeam?.name || currentTeam?.name || (typeof currentTeam === 'string' ? currentTeam : '');

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

  // If there's no team selected and we're not in the admin view, force team_selection view
  useEffect(() => {
    // Only run this logic if auth has finished loading and we have a profile to avoid premature redirects
    if (!authLoading && profile && !effectiveTeamName && !shadowTeam && currentView !== 'admin' && currentView !== 'team_selection') {
      setCurrentView('team_selection');
    }
  }, [effectiveTeamName, shadowTeam, currentView, authLoading, profile]);

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
        <div className="flex items-center gap-6">
          <div className="text-xl font-black text-white lowercase tracking-widest flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <img src="/logo.png" alt="ustats.pro logo" className="w-8 h-8 rounded-full" />
            <span>ustats<span className="text-indigo-500 font-light">.pro</span></span>
            <BetaBadge />
            {profile?.tier === 'PRO' ? (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1"><Crown className="w-3 h-3" /> PRO</span>
            ) : (
              <span className="text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md">FREE</span>
            )}
          </div>
          {effectiveTeamName && (
             <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2">
               {effectiveTeamName}
             </div>
          )}
          <SyncIndicator />
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
            onClick={() => {
              if (profile?.tier !== 'PRO') {
                alert("Coach Pro is exclusively available on the Coach Pro Tier. Please upgrade to access advanced analytics and data.");
                return;
              }
              setCurrentView('coach');
            }}
            className={`px-6 py-2.5 font-extrabold rounded-xl transition-all flex items-center gap-2 uppercase tracking-wide text-sm ${profile?.tier === 'PRO' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] scale-100 hover:scale-[1.02]' : 'bg-slate-800 text-slate-600 border border-slate-700/50 cursor-not-allowed opacity-75'}`}
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
      <div className="sm:hidden flex flex-col px-4 py-3 bg-slate-950/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 shadow-md gap-2">
        <div className="flex justify-between items-center w-full">
          <div className="text-lg font-black text-white lowercase tracking-widest flex items-center gap-1.5 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <img src="/logo.png" alt="ustats.pro logo" className="w-6 h-6 rounded-full" />
            <span>ustats<span className="text-indigo-500 font-light">.pro</span></span>
            {profile?.tier === 'PRO' ? (
              <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md"><Crown className="w-3 h-3 inline-block mr-0.5" /> PRO</span>
            ) : (
              <span className="text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded-md">FREE</span>
            )}
            <SyncIndicator />
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
            onClick={() => {
              if (profile?.tier !== 'PRO') {
                alert("Coach Pro is exclusively available on the Coach Pro Tier.");
                return;
              }
              setCurrentView('coach');
            }}
            className={`p-2 rounded-lg transition-all ${currentView === 'coach' ? 'text-amber-400 bg-amber-500/10' : profile?.tier === 'PRO' ? 'text-slate-400 hover:text-amber-400' : 'text-slate-600 cursor-not-allowed opacity-50'}`}
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
        {effectiveTeamName && (
           <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-between w-full cursor-pointer active:bg-indigo-500/20 transition-all" onClick={() => setCurrentTeam(null)}>
             <span>{effectiveTeamName}</span>
             <span className="opacity-50">Switch</span>
           </div>
        )}
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
          isVoiceEnabled={isVoiceEnabled}
          setIsVoiceEnabled={setIsVoiceEnabled}
          isPro={profile?.tier === 'PRO'}
        />
      )}

      {currentView === 'analytics' && (
        <Analytics targetTeamId={targetTeamId} players={players} />
      )}
      
      {currentView === 'roster' && (
        <RosterSetup 
          players={players} 
          setPlayers={setPlayers}
          currentTeam={effectiveTeamName}
          currentTeamObject={currentTeam}
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
          isVoiceEnabled={isVoiceEnabled}
          setIsVoiceEnabled={setIsVoiceEnabled}
        />
      )}

      {currentView === 'coach' && (
        <CoachDashboard 
          currentGame={currentGame}
          currentTeam={effectiveTeamName}
          targetTeamId={targetTeamId}
          setCurrentTeam={setCurrentTeam}
          players={players}
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

      {currentView === 'team_selection' && (
        <TeamSelectionScreen 
          allowAutoSelect={false}
          onSelectTeam={(team) => {
            setCurrentTeam(team);
            setCurrentView('dashboard');
          }}
          onNavigateToAdmin={() => setCurrentView('admin')}
        />
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center px-1 py-3 sm:py-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-safe">
        <button onClick={() => setCurrentView('team_selection')} className={`flex flex-col items-center gap-1.5 w-14 sm:w-16 transition-colors ${currentView === 'team_selection' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'team_selection' ? 'scale-125' : 'scale-100'}`}>🛡️</span>
          <span className="text-[10px] uppercase tracking-wider">Teams</span>
        </button>
        <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1.5 w-14 sm:w-16 transition-colors ${currentView === 'dashboard' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'dashboard' ? 'scale-125' : 'scale-100'}`}>🎯</span>
          <span className="text-[10px] uppercase tracking-wider">Track</span>
        </button>
        <button onClick={() => setCurrentView('lineup')} className={`flex flex-col items-center gap-1.5 w-14 sm:w-16 transition-colors ${currentView === 'lineup' || currentView === 'roster' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'lineup' || currentView === 'roster' ? 'scale-125' : 'scale-100'}`}>👕</span>
          <span className="text-[10px] uppercase tracking-wider">Lineup</span>
        </button>
        <button onClick={() => setCurrentView('log')} className={`flex flex-col items-center gap-1.5 w-14 sm:w-16 transition-colors ${currentView === 'log' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'log' ? 'scale-125' : 'scale-100'}`}>📜</span>
          <span className="text-[10px] uppercase tracking-wider">Log</span>
        </button>
        <button onClick={() => setCurrentView('analytics')} className={`flex flex-col items-center gap-1.5 w-14 sm:w-16 transition-colors ${currentView === 'analytics' ? 'text-indigo-400 font-extrabold' : 'text-slate-500 font-medium hover:text-slate-400'}`}>
          <span className={`text-xl leading-none transition-transform ${currentView === 'analytics' ? 'scale-125' : 'scale-100'}`}>📊</span>
          <span className="text-[10px] uppercase tracking-wider">Data</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
