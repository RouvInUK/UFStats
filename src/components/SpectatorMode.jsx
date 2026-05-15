import { useState, useEffect } from 'react';
import { supabase, fetchGameStats } from '../supabaseClient';
import { Radio, RefreshCw } from 'lucide-react';

const SpectatorMode = ({ spectatorGameId }) => {
  const [stats, setStats] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [gameName, setGameName] = useState(null);
  const [score, setScore] = useState({ us: 0, them: 0 });
  const [lastAction, setLastAction] = useState(null);
  const [pointHistory, setPointHistory] = useState([]);
  const [pulse, setPulse] = useState(false);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [startTime, setStartTime] = useState(null);
  const [teamNames, setTeamNames] = useState({ us: 'Us', them: 'Them' });

  useEffect(() => {
    try {
      // Safe base64 decoding for unicode
      const decoded = decodeURIComponent(escape(atob(spectatorGameId)));
      const [tId, gName] = decoded.split('|');
      setTeamId(tId);
      setGameName(gName);
    } catch (e) {
      console.error("Invalid link");
    }
  }, [spectatorGameId]);

  // Clock interval
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now - startTime) / 1000);
      if (diff < 0) return;
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsedTime(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (!teamId || !gameName) return;

    const loadData = async () => {
      try {
        const data = await fetchGameStats(gameName, teamId);
        if (data && data.length > 0) {
           const earliest = new Date(Math.min(...data.map(d => new Date(d.created_at))));
           setStartTime(earliest);
        }
        recalculateState(data);
        setStats(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
    const filterStr = isUUID ? `team_id=eq.${teamId}` : undefined;

    const channel = supabase
      .channel(`public:stats:${gameName}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stats',
        ...(filterStr ? { filter: filterStr } : {})
      }, payload => {
        if (payload.eventType === 'DELETE') {
           setStats(prev => {
              const updated = prev.filter(s => s.id !== payload.old.id);
              recalculateState(updated);
              return updated;
           });
           return;
        }

        if (payload.new && payload.new.game_name === gameName) {
           setStats(prev => {
             // Handle both INSERT and UPDATE
             const exists = prev.some(s => s.id === payload.new.id);
             let updated;
             if (exists) {
                updated = prev.map(s => s.id === payload.new.id ? payload.new : s);
             } else {
                updated = [payload.new, ...prev];
                triggerPulse();
             }
             if (updated.length === 1 && payload.new.created_at) {
                setStartTime(new Date(payload.new.created_at));
             }
             recalculateState(updated);
             return updated;
           });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, gameName]);

  const triggerPulse = () => {
    setPulse(true);
    setTimeout(() => setPulse(false), 2000);
  };

  const recalculateState = (allStats) => {
     let us = 0; let them = 0;
     const history = [];
     let latestGoal = null;
     let tUs = 'Us';
     let tThem = 'Them';
     
     // allStats from fetchGameStats is descending (newest first). 
     // Sort ascending for sequential calculation
     const chronological = [...allStats].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

     chronological.forEach((stat, i) => {
        if (stat.stat_type === 'Match Metadata') {
           tThem = stat.player;
           if (stat.team_name && stat.team_name !== 'Default Team' && stat.team_name !== 'Default Team (Migrated)') {
              tUs = stat.team_name;
           }
        } else if (stat.stat_type === 'Point') {
           us++;
           let assist = null;
           const prevStat = chronological[i-1];
           if (prevStat && prevStat.stat_type === 'Pass' && prevStat.point_number === stat.point_number) {
              assist = prevStat.player;
           }
           history.unshift({ us, them, scorer: stat.player, assist, type: 'us', number: us + them });
           latestGoal = { type: 'us', scorer: stat.player, assist };
        } else if (stat.stat_type === 'Opponent Point') {
           them++;
           history.unshift({ us, them, scorer: 'Opponent', assist: null, type: 'them', number: us + them });
           latestGoal = { type: 'them', scorer: 'Opponent' };
        }
     });

     setScore({ us, them });
     setPointHistory(history);
     setLastAction(latestGoal);
     setTeamNames({ us: tUs, them: tThem });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white font-mono uppercase tracking-widest animate-pulse p-4 text-center">
        <Radio className="w-8 h-8 opacity-50 animate-ping" />
        Connecting to pitch...
      </div>
    );
  }

  if (!teamId || !gameName) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-rose-500 font-mono uppercase tracking-widest font-bold">
        Invalid Spectator Link
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white font-sans flex flex-col ${pulse ? 'ring-4 ring-white inset-0' : 'transition-all duration-1000'}`}>
      
      {/* Header */}
      <header className="p-4 sm:p-6 border-b border-white/20 bg-black sticky top-0 z-10 flex flex-col items-center justify-center">
        <div className="flex items-center justify-between w-full max-w-md mb-6 px-4">
           <div className="flex items-center gap-2 opacity-70">
             <Radio className="w-4 h-4 text-white animate-pulse" />
             <span className="text-[10px] sm:text-xs tracking-[0.3em] font-bold uppercase">Live Broadcast</span>
           </div>
           <div className="font-mono text-sm sm:text-base font-black tracking-widest border border-white/20 px-3 py-1 rounded bg-white/5">
             {elapsedTime}
           </div>
        </div>

        <div className="flex justify-between items-center w-full max-w-md px-2 mt-4">
           <div className="flex flex-col items-center flex-1 w-1/3">
             <div className="h-12 flex items-end justify-center mb-2">
                <span className="text-sm sm:text-lg text-white/80 tracking-widest uppercase font-extrabold break-words text-center line-clamp-2">{teamNames.us || 'Us'}</span>
             </div>
             <span className={`text-7xl sm:text-9xl font-black tracking-tighter ${pulse && lastAction?.type === 'us' ? 'animate-bounce text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'text-white'}`}>{score.us}</span>
           </div>
           
           <div className="flex flex-col items-center px-2 w-1/3 mt-10">
             <span className="text-2xl sm:text-4xl font-black text-white/30">-</span>
           </div>

           <div className="flex flex-col items-center flex-1 w-1/3">
             <div className="h-12 flex items-end justify-center mb-2">
                <span className="text-sm sm:text-lg text-white/80 tracking-widest uppercase font-extrabold break-words text-center line-clamp-2">{teamNames.them || 'Them'}</span>
             </div>
             <span className={`text-7xl sm:text-9xl font-black tracking-tighter ${pulse && lastAction?.type === 'them' ? 'animate-bounce text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'text-white/80'}`}>{score.them}</span>
           </div>
        </div>
      </header>

      {/* Last Action Banner */}
      {lastAction && (
        <div className="w-full bg-white text-black p-4 text-center font-black uppercase tracking-wide border-b border-white/20">
          <span className="text-xs opacity-50 block mb-1">Latest Update</span>
          {lastAction.type === 'us' ? (
            <span className="text-lg sm:text-xl">
              GOAL: {lastAction.scorer} {lastAction.assist ? `(AST: ${lastAction.assist})` : ''}
            </span>
          ) : (
            <span className="text-lg sm:text-xl text-black/70">Opponent Scored</span>
          )}
        </div>
      )}

      {/* Point History */}
      <main className="flex-1 p-4 sm:p-6 w-full max-w-md mx-auto">
         <h2 className="text-xs font-bold tracking-widest uppercase text-white/40 mb-6 border-b border-white/10 pb-2">Scoring Feed</h2>
         
         <div className="flex flex-col gap-4">
            {pointHistory.map((pt, i) => (
               <div key={i} className="flex justify-between items-center bg-white/5 p-4 border border-white/10 rounded-lg">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold tracking-wider text-white/40 mb-1 uppercase">Point {pt.number}</span>
                     <span className="font-bold text-sm sm:text-base">
                       {pt.type === 'us' ? (
                         <span><span className="text-white">Goal:</span> {pt.scorer} {pt.assist ? <span className="text-white/50 text-xs ml-1">(ast: {pt.assist})</span> : ''}</span>
                       ) : (
                         <span className="text-white/60">Opponent Goal</span>
                       )}
                     </span>
                  </div>
                  <div className="text-xl font-black tracking-tighter shrink-0 bg-white/10 px-3 py-1 rounded">
                     {pt.us} - {pt.them}
                  </div>
               </div>
            ))}
            
            {pointHistory.length === 0 && (
              <div className="text-center p-8 border border-white/10 border-dashed rounded-xl opacity-50">
                <span className="block text-xs uppercase tracking-widest font-bold">Awaiting first point...</span>
              </div>
            )}
         </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center border-t border-white/10 opacity-50">
        <img src="/logo.png" alt="logo" className="w-6 h-6 mx-auto mb-2 grayscale opacity-50" />
        <span className="text-[9px] uppercase tracking-[0.2em] font-bold">Powered by ustats.pro</span>
        <span className="block text-[8px] tracking-widest mt-1">Professional Ultimate Analytics</span>
      </footer>

    </div>
  );
};

export default SpectatorMode;
