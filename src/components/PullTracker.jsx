import React, { useState } from 'react';
import { recordStatToDB } from '../supabaseClient';
import { Target, MapPin, Activity, X } from 'lucide-react';

const PullTracker = ({
  activeLineup,
  currentGame,
  currentPoint,
  gameType,
  currentTeam,
  targetTeamId,
  onComplete
}) => {
  const [step, setStep] = useState(1);
  const [puller, setPuller] = useState(null);
  const [location, setLocation] = useState(null);
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const locations = [
    { id: 'Endzone', label: 'Endzone', modifier: 1 },
    { id: 'Field', label: 'Field (Past Brick)', modifier: 0 },
    { id: 'Short', label: 'Short (Before Brick)', modifier: -1 },
    { id: 'OB-Brick', label: 'Out-of-Bounds (Brick)', modifier: 0 },
    { id: 'OB-Other', label: 'Out-of-Bounds (Other)', modifier: 0 }
  ];

  const results = [
    { id: 'Dropped Pull', label: 'Dropped Pull', base: 4 },
    { id: 'D-Marking', label: 'D-Marking (0 passes)', base: 3 },
    { id: 'D after 1 pass', label: 'D after 1 pass', base: 2 },
    { id: 'D 1+ passes', label: 'D after 1+ passes', base: 1 }
  ];

  const handleLocationSelect = (loc) => {
    setLocation(loc);
    if (loc.id === 'OB-Brick') {
      setResult({ id: 'OB-Brick', base: 2 }); // Auto-set result and skip step 3
      setStep(3); // Go directly to save
    } else if (loc.id === 'OB-Other') {
      setResult({ id: 'OB-Other', base: 0 }); // Auto-set result and skip step 3
      setStep(3); // Go directly to save
    } else {
      setStep(3);
    }
  };

  const calculateScore = () => {
    if (!location || !result) return 0;
    if (location.id === 'OB-Brick') return 2;
    if (location.id === 'OB-Other') return 0;
    
    let score = result.base + location.modifier;
    // ensure score doesn't go below 0 logically
    return Math.max(0, score);
  };

  const handleSave = async () => {
    if (!puller || !location || !result) return;
    setIsSaving(true);
    
    const score = calculateScore();
    const details = {
      location: location.id,
      result: result.id,
      score: score
    };

    try {
      await recordStatToDB({
        player: puller,
        stat: 'Pull',
        pointNumber: currentPoint,
        gameName: currentGame,
        gameType: gameType,
        teamName: currentTeam,
        details: details
      }, targetTeamId);
      
      // We successfully saved the pull, let the parent know to proceed
      onComplete();
    } catch (err) {
      console.error('Failed to save pull:', err);
      alert('Failed to save pull. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-white">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <div>
          <h2 className="text-xl font-bold text-emerald-400">Pull Tracking</h2>
          <p className="text-sm text-slate-400">Point {currentPoint} • Defence</p>
        </div>
        <button 
          onClick={onComplete}
          className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-full"
          title="Skip Pull Tracking"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto max-w-2xl mx-auto w-full">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
              <Target className="w-5 h-5" />
              Who is pulling?
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activeLineup.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPuller(p);
                    setStep(2);
                  }}
                  className="p-4 bg-slate-800 border border-slate-700 rounded-xl font-bold text-lg active:scale-95 transition-all hover:bg-slate-700"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
              <MapPin className="w-5 h-5" />
              Pull Distance / Location
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleLocationSelect(loc)}
                  className="p-5 bg-slate-800 border border-slate-700 rounded-xl font-bold text-lg active:scale-95 transition-all hover:bg-slate-700 text-left flex justify-between items-center"
                >
                  {loc.label}
                  {loc.modifier !== 0 && (
                    <span className={`text-sm ${loc.modifier > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {loc.modifier > 0 ? '+' : ''}{loc.modifier}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setStep(1)}
              className="mt-6 text-sm text-slate-400 underline"
            >
              Back to Puller Selection
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 flex flex-col h-full">
            {!location?.id?.startsWith('OB-') && (
              <>
                <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-400">
                  <Activity className="w-5 h-5" />
                  Result / Pressure
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {results.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => setResult(res)}
                      className={`p-5 rounded-xl font-bold text-lg active:scale-95 transition-all text-left flex justify-between items-center border ${
                        result?.id === res.id 
                          ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.5)] text-white' 
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {res.label}
                      <span className="text-sm opacity-70">Base: {res.base}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {(result || location?.id?.startsWith('OB-')) && (
              <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
                <div className="bg-slate-900 rounded-xl p-4 border border-emerald-900/50">
                  <p className="text-slate-400 text-sm mb-1">Summary</p>
                  <p className="text-lg font-semibold">
                    {puller} • {location.label} {!location.id?.startsWith('OB-') && `• ${result.label}`}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-slate-400">Calculated Score</span>
                    <span className="text-3xl font-black text-emerald-400">{calculateScore()}</span>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(5,150,105,0.4)] disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Confirm & Start Point'}
                </button>
              </div>
            )}
            <button 
              onClick={() => {
                if (location?.id?.startsWith('OB-')) setStep(2);
                else setResult(null);
              }}
              className="mt-6 text-sm text-slate-400 underline text-center"
            >
              Back to Previous Step
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PullTracker;
