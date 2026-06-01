import React, { useState, useEffect } from 'react';
import { validatePitchCode } from '../supabaseClient';
import { Target, AlertTriangle, ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';

const VolunteerScorerLogin = ({ onBack, onLoginSuccess }) => {
  const [pitchCodeStr, setPitchCodeStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successSeat, setSuccessSeat] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam && codeParam.trim()) {
      const cleanCode = codeParam.trim().toUpperCase();
      setPitchCodeStr(cleanCode);
      
      const autoSubmit = async () => {
        setLoading(true);
        setError('');
        try {
          const result = await validatePitchCode(cleanCode);
          if (result.valid) {
            setSuccessSeat(result.seat);
            setTimeout(() => {
              onLoginSuccess(result.seat);
            }, 1200);
          } else {
            setError(result.error || 'Invalid or inactive Pitch Code.');
          }
        } catch (err) {
          setError(err.message || 'An error occurred during verification.');
        } finally {
          setLoading(false);
        }
      };
      autoSubmit();
    }
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pitchCodeStr.trim()) {
      setError('Please enter a valid Pitch Code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await validatePitchCode(pitchCodeStr.trim().toUpperCase());
      if (result.valid) {
        setSuccessSeat(result.seat);
        setTimeout(() => {
          onLoginSuccess(result.seat);
        }, 1200);
      } else {
        setError(result.error || 'Invalid or inactive Pitch Code.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = pitchCodeStr.trim().length >= 4;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 pb-32">
      {onBack && !successSeat && (
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-400 text-sm font-bold transition-colors self-center">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      )}

      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        {successSeat ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="p-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 animate-bounce">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider">Access Granted</h3>
            <p className="text-sm text-slate-300 font-bold max-w-xs leading-relaxed">
              Match successfully unlocked! Loading the neutral scorer console for:
              </p>
            <div className="bg-slate-950/80 px-5 py-4 border border-slate-800 rounded-2xl w-full text-center">
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-black">Pitch {successSeat.tournament_matches?.pitch_number || '1'}</span>
              <div className="text-lg font-black text-white mt-1">
                {successSeat.tournament_matches?.home_team?.team_name || 'Home Team'} 
                <span className="text-slate-500 font-medium px-2">vs</span> 
                {successSeat.tournament_matches?.away_team?.team_name || 'Away Team'}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="flex items-center gap-3.5 mb-2">
                <img src="/logo_icon.png" alt="ustats.pro logo" className="w-10 h-10 rounded-full" />
                <div className="flex flex-col">
                  <span className="text-xl font-black text-white lowercase tracking-widest leading-none">ustats.pro</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1 leading-none">tournament tier</span>
                </div>
              </div>
              <h2 className="text-lg font-black text-slate-200 uppercase tracking-widest mt-4">Volunteer Login</h2>
              <p className="text-slate-500 text-xs font-bold tracking-wider mt-1 uppercase">Enter Pitch Access Code</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
                  <span className="font-bold">{error}</span>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 block text-center">
                  Pitch Code
                </label>
                <input
                  type="text"
                  value={pitchCodeStr}
                  onChange={(e) => setPitchCodeStr(e.target.value.toUpperCase())}
                  placeholder="e.g. P1-E74A"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl py-4 px-6 text-center text-xl font-mono font-black text-indigo-400 outline-none transition-colors shadow-inner uppercase tracking-wider"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !isComplete}
                className={`w-full group relative flex items-center justify-center gap-2 px-6 py-4 border text-sm font-black rounded-2xl text-white transition-all uppercase tracking-widest ${
                  isComplete && !loading
                    ? 'bg-indigo-600/80 hover:bg-indigo-500 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-[0.98]'
                    : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                }`}
              >
                {loading ? 'Verifying Code...' : 'Access Pitch Console'}
                {!loading && <ShieldCheck className="w-4 h-4 text-indigo-300" />}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-800/80 pt-6 flex items-start gap-3 bg-indigo-950/10 p-4 rounded-2xl border border-indigo-500/10">
              <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0" />
              <p className="text-[10px] text-slate-400 font-medium leading-normal">
                <span className="font-bold text-indigo-300">Volunteer Scorer Info:</span> Pitch Codes are generated by the Tournament Organizer. Verify your code with the organizer if access is rejected.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VolunteerScorerLogin;
