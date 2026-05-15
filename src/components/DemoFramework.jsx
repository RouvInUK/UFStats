import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FastForward, SkipBack, ShieldCheck, Star, Activity, Crown, Menu, Check } from 'lucide-react';

const DEMO_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"; // Placeholder

const MOCK_PLAYERS = [
  { id: 1, name: 'Alex', shirt_number: 14 },
  { id: 2, name: 'Sam', shirt_number: 5 },
  { id: 3, name: 'Jordan', shirt_number: 7 },
  { id: 4, name: 'Taylor', shirt_number: 10 },
  { id: 5, name: 'Casey', shirt_number: 22 },
  { id: 6, name: 'Morgan', shirt_number: 33 },
  { id: 7, name: 'Riley', shirt_number: 44 },
];

const DEMO_SCRIPT = [
  { time: 0, view: 'tracking', state: { possession: [], ourScore: 0, oppScore: 0, activePlayer: null } },
  { time: 5, view: 'tracking', action: 'tap', player: 14, desc: 'The Pull', id: 'pull' },
  { time: 10, view: 'tracking', action: 'tap', player: 5, desc: 'The Flow', id: 'flow' },
  { time: 12, view: 'tracking', action: 'tap', player: 7 },
  { time: 14, view: 'tracking', action: 'tap', player: 10 },
  { time: 16, view: 'tracking', action: 'action', type: 'turnover', desc: 'The D', id: 'defense' },
  { time: 20, view: 'tracking', action: 'tap', player: 22 },
  { time: 23, view: 'tracking', action: 'tap', player: 33 },
  { time: 26, view: 'tracking', action: 'action', type: 'score', player: 44, desc: 'The Goal', id: 'goal' },
  { time: 28, view: 'dashboard', desc: 'The Pro View', id: 'pro' },
  { time: 35, view: 'lineup' }
];

export default function DemoFramework() {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeRipple, setActiveRipple] = useState(null); // { type: 'player'|'action', id }
  
  // Simulated App State
  const [appView, setAppView] = useState('tracking'); // 'tracking', 'dashboard', 'lineup'
  const [possession, setPossession] = useState([]);
  const [activePlayer, setActivePlayer] = useState(null);
  const [ourScore, setOurScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [lastEventTime, setLastEventTime] = useState(-1);

  // Sync state with video
  useEffect(() => {
    // Find the current state based on script
    let currentView = 'tracking';
    let currentPossession = [];
    let currActivePlayer = null;
    let currOurScore = 0;
    
    // We compute the state by replaying actions up to current time
    for (let i = 0; i < DEMO_SCRIPT.length; i++) {
      const step = DEMO_SCRIPT[i];
      if (step.time <= currentTime) {
        if (step.view) currentView = step.view;
        
        if (step.action === 'tap') {
          currActivePlayer = step.player;
          if (currentPossession.length === 0 || currentPossession[currentPossession.length-1] !== step.player) {
              currentPossession = [...currentPossession, step.player];
          }
        } else if (step.action === 'action') {
            if (step.type === 'turnover') {
                currentPossession = [];
                currActivePlayer = null;
            } else if (step.type === 'score') {
                currOurScore = 1; // Just hardcode for demo
                currentPossession = [];
                currActivePlayer = null;
            }
        }
      }
    }

    setAppView(currentView);
    setPossession(currentPossession);
    setActivePlayer(currActivePlayer);
    setOurScore(currOurScore);

    // Trigger Ripple if we just crossed a timestamp
    const recentStep = DEMO_SCRIPT.find(s => Math.abs(s.time - currentTime) < 0.3 && s.time !== lastEventTime);
    if (recentStep && isPlaying) {
      setLastEventTime(recentStep.time);
      if (recentStep.action === 'tap') {
         setActiveRipple({ type: 'player', id: recentStep.player });
         setTimeout(() => setActiveRipple(null), 600);
      } else if (recentStep.action === 'action') {
         setActiveRipple({ type: 'action', id: recentStep.type });
         setTimeout(() => setActiveRipple(null), 600);
      }
    }

  }, [currentTime, isPlaying, lastEventTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setLastEventTime(-1); // Reset event tracking
      if (!isPlaying) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const markers = DEMO_SCRIPT.filter(s => s.desc);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Left: Video & Controls */}
      <div className="flex-1 flex flex-col relative border-r border-white/10 shadow-2xl z-10">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 flex justify-between items-center">
           <div className="flex items-center gap-3" onClick={() => window.location.href='/'} style={{cursor: 'pointer'}}>
            <img src="/logo.png" alt="ustats.pro" className="w-8 h-8 rounded-lg shadow-lg" />
            <span className="text-lg font-black text-white lowercase tracking-widest">
              ustats<span className="text-indigo-400 font-light">.pro</span> demo
            </span>
          </div>
        </div>

        {/* Video Player */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          <video 
            ref={videoRef}
            src={DEMO_VIDEO_URL}
            className="w-full h-full object-cover opacity-80"
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted
          />
          {/* Overlay text if using placeholder */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
             <span className="text-white font-black text-6xl tracking-widest uppercase rotate-12">Demo Match</span>
          </div>
        </div>

        {/* Video Controls & Jump Marks */}
        <div className="bg-slate-900 p-6 flex flex-col gap-6 border-t border-white/10">
          
          {/* Timeline */}
          <div className="relative h-2 bg-slate-800 rounded-full cursor-pointer overflow-hidden">
             <div className="absolute top-0 left-0 h-full bg-indigo-500" style={{ width: `${(currentTime / 40) * 100}%` }}></div>
             {markers.map(m => (
                <div key={m.id} className="absolute top-0 w-1 h-full bg-amber-400 z-10" style={{ left: `${(m.time / 40) * 100}%` }}></div>
             ))}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={togglePlay} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20">
              {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-1" />}
            </button>
            <div className="text-slate-400 font-mono font-medium">
               00:{Math.floor(currentTime).toString().padStart(2, '0')} / 00:40
            </div>
          </div>

          {/* Jump Markers */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Interactive Jump Marks</h3>
            <div className="flex flex-wrap gap-3">
              {markers.map((marker) => {
                const isActive = currentTime >= marker.time && currentTime < (marker.time + 5);
                return (
                  <button 
                    key={marker.id}
                    onClick={() => jumpTo(marker.time)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold tracking-wide transition-all ${
                      isActive 
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-white/5'
                    }`}
                  >
                    {marker.desc}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Right: Phone Mockup */}
      <div className="w-full md:w-[450px] bg-slate-950 flex items-center justify-center p-6 md:p-12 relative">
         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 pointer-events-none"></div>
         
         {/* Phone Frame */}
         <div className="relative w-full max-w-[340px] aspect-[9/19.5] bg-black rounded-[40px] border-[8px] border-slate-800 shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col">
            
            {/* Dynamic App Content */}
            {appView === 'tracking' && (
              <MockTracking 
                possession={possession} 
                activePlayer={activePlayer} 
                ourScore={ourScore} 
                oppScore={oppScore}
                activeRipple={activeRipple}
              />
            )}

            {appView === 'dashboard' && (
              <MockDashboard ourScore={ourScore} oppScore={oppScore} />
            )}

            {appView === 'lineup' && (
              <MockLineup />
            )}

         </div>
      </div>
    </div>
  );
}

// --- Mock Components ---

function MockTracking({ possession, activePlayer, ourScore, oppScore, activeRipple }) {
  return (
    <div className="flex-1 bg-slate-900 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-slate-950 p-4 border-b border-white/10 flex justify-between items-center">
        <Menu className="w-5 h-5 text-slate-400" />
        <div className="text-center flex-1">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mock Game</div>
          <div className="text-2xl font-black text-white tracking-tight">
             <span className="text-indigo-400">{ourScore}</span> - {oppScore}
          </div>
        </div>
        <div className="w-5"></div>
      </div>

      {/* Possession Chain */}
      <div className="h-14 bg-slate-900 border-b border-white/5 flex items-center px-4 overflow-hidden gap-2">
         {possession.length === 0 && <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">Awaiting Pull...</span>}
         {possession.map((pid, idx) => {
           const p = MOCK_PLAYERS.find(pl => pl.shirt_number === pid);
           return (
             <div key={idx} className="flex items-center gap-2">
                {idx > 0 && <span className="text-slate-600">→</span>}
                <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  idx === possession.length - 1 ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {p?.shirt_number} {p?.name}
                </div>
             </div>
           )
         })}
      </div>

      {/* Players Grid */}
      <div className="flex-1 p-3 grid grid-cols-2 gap-3 content-start">
        {MOCK_PLAYERS.map(p => {
          const isActive = activePlayer === p.shirt_number;
          const isRipple = activeRipple?.type === 'player' && activeRipple?.id === p.shirt_number;
          
          return (
            <div 
              key={p.id}
              className={`relative aspect-[2.5/1] rounded-xl border flex items-center justify-center transition-all ${
                isActive 
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-inner' 
                  : 'bg-slate-800 border-white/5 text-slate-300'
              }`}
            >
              <span className="font-black text-lg tracking-tight">{p.shirt_number} <span className="font-medium opacity-80">{p.name}</span></span>
              {isRipple && (
                <div className="absolute inset-0 rounded-xl bg-white/30 animate-ping"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="p-3 grid grid-cols-2 gap-3 bg-slate-950 border-t border-white/10">
        <ActionBtn label="Drop" color="amber" isRipple={activeRipple?.type === 'action' && activeRipple?.id === 'turnover'} />
        <ActionBtn label="Throwaway" color="rose" isRipple={activeRipple?.type === 'action' && activeRipple?.id === 'turnover'} />
        <ActionBtn label="Point" color="emerald" isRipple={activeRipple?.type === 'action' && activeRipple?.id === 'score'} />
        <ActionBtn label="Defence" color="violet" isRipple={false} />
      </div>
    </div>
  );
}

function ActionBtn({ label, color, isRipple }) {
  const colorMap = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-500',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
    violet: 'bg-violet-500/10 border-violet-500/30 text-violet-500',
  };
  return (
    <div className={`relative py-4 rounded-xl border flex items-center justify-center text-sm font-black uppercase tracking-widest ${colorMap[color]}`}>
      {label}
      {isRipple && (
        <div className="absolute inset-0 rounded-xl bg-white/30 animate-ping"></div>
      )}
    </div>
  );
}

function MockDashboard({ ourScore, oppScore }) {
  return (
    <div className="flex-1 bg-slate-950 flex flex-col p-6 animate-in fade-in zoom-in duration-500">
       <div className="text-center mb-8 mt-4">
         <div className="inline-block p-4 bg-indigo-500/20 rounded-full mb-4">
            <Crown className="w-8 h-8 text-indigo-400" />
         </div>
         <h2 className="text-2xl font-black text-white tracking-tight uppercase">Point Scored</h2>
         <p className="text-slate-400 text-sm">Automated Coach View</p>
       </div>

       <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Net Impact Score</span>
             <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-3">
             <NISRow name="14 Alex" score="+3.2" color="text-emerald-400" />
             <NISRow name="44 Riley" score="+2.8" color="text-emerald-400" />
             <NISRow name="5 Sam" score="+1.1" color="text-emerald-400" />
          </div>
       </div>

       <div className="bg-slate-900 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pull Quality</span>
             <Wind className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-3xl font-black text-white">4.8<span className="text-sm font-medium text-slate-500 ml-1">/5.0</span></div>
          <div className="text-xs text-slate-400 mt-1">Excellent defensive pressure applied.</div>
       </div>
    </div>
  );
}

function NISRow({ name, score, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-300">{name}</span>
      <span className={`text-sm font-black ${color}`}>{score}</span>
    </div>
  )
}

function MockLineup() {
  return (
    <div className="flex-1 bg-slate-950 flex flex-col p-4 animate-in fade-in duration-300">
      <h2 className="text-lg font-black text-white uppercase tracking-widest mb-4 mt-2 text-center">Next Lineup</h2>
      <div className="space-y-2">
        {MOCK_PLAYERS.map(p => (
           <div key={p.id} className="p-3 bg-slate-900 border border-white/5 rounded-xl flex items-center justify-between">
             <span className="text-slate-300 font-bold">{p.shirt_number} <span className="font-normal opacity-70">{p.name}</span></span>
             <Check className="w-4 h-4 text-emerald-500" />
           </div>
        ))}
      </div>
      <div className="mt-auto pt-4">
         <div className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl text-center uppercase tracking-widest text-sm shadow-lg shadow-indigo-500/20">Start Tracking</div>
      </div>
    </div>
  );
}
