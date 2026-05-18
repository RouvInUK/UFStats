import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShieldCheck, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';

export default function UpdatePassword({ onComplete }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validate the password
  const isValid = password.length >= 8 && /\d/.test(password);
  const isMatch = password === confirmPassword;

  useEffect(() => {
    // Check if the user is actually authenticated (Supabase should have processed the token)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError('Invalid or expired recovery link. Please try resetting your password again.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || !isMatch) return;
    
    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;
      
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-emerald-500/20 p-8 rounded-3xl shadow-2xl text-center">
          <div className="inline-flex p-4 bg-emerald-500/10 rounded-full mb-6">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Password Updated</h2>
          <p className="text-slate-400 mb-8">Your password has been securely updated. You are now logged in.</p>
          <button 
            onClick={onComplete}
            className="w-full px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-colors"
          >
            Continue to App
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl font-black text-white lowercase tracking-widest flex items-center gap-3 mb-2">
            <ShieldCheck className="w-10 h-10 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-black text-white">Reset Password</h2>
          <p className="text-slate-400 text-sm font-medium tracking-wide mt-2">
            Enter your new secure password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 block">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
              placeholder="••••••••"
            />
            <div className="px-2 flex gap-4 text-xs font-medium">
              <span className={password.length >= 8 ? 'text-emerald-400' : 'text-slate-500'}>
                ✓ Min 8 chars
              </span>
              <span className={/\d/.test(password) ? 'text-emerald-400' : 'text-slate-500'}>
                ✓ At least 1 number
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 block">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
              placeholder="••••••••"
            />
            {confirmPassword.length > 0 && !isMatch && (
              <p className="text-rose-400 text-xs px-2 mt-1">Passwords do not match.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isValid || !isMatch || !!error}
            className="w-full group relative flex items-center justify-center gap-2 px-6 py-4 border border-indigo-500/50 text-sm font-black rounded-2xl text-white bg-indigo-600/80 hover:bg-indigo-500 backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-indigo-500/50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest mt-4"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
