import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { Target, AlertTriangle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { getLegalPath } from '../constants/legal';

const AuthScreen = ({ onBack, initialMode = 'login' }) => {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [betaKey, setBetaKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${getLegalPath('/update-password')}`,
        });
        if (resetError) throw resetError;
        setMessage('Check your email for the password reset link.');
        setLoading(false);
        return;
      }

      if (!isLogin) {
        if (!betaKey || betaKey.length !== 6) {
          throw new Error("A valid 6-character Beta Key is required to create a workspace.");
        }
        
        // Validate Beta Key
        const { data: keyData, error: keyError } = await supabase
          .from('beta_keys')
          .select('*')
          .eq('key', betaKey)
          .eq('is_used', false)
          .single();
          
        if (keyError || !keyData) {
          throw new Error("Invalid or already claimed Beta Key.");
        }
      }

      const { data: authData, error: authError } = isLogin 
        ? await signIn(email, password)
        : await signUp(email, password);

      if (authError) throw authError;

      if (!isLogin && authData?.user) {
        // Mark Beta Key as used
        const { error: updateError } = await supabase
          .from('beta_keys')
          .update({ is_used: true, used_by: authData.user.id })
          .eq('key', betaKey);
          
        if (updateError) {
          console.error("Failed to mark beta key as used:", updateError);
        }
          
        alert('Signup successful! Check your email if email confirmation is enabled, otherwise you should be logged in automatically.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 pb-32">
      {onBack && (
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-400 text-sm font-bold transition-colors self-center">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      )}
      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="text-3xl font-black text-white lowercase tracking-widest flex items-center gap-3 mb-2">
            <img src="/logo.png" alt="ustats.pro logo" className="w-10 h-10 rounded-full" />
            <span>ustats<span className="text-indigo-500 font-light">.pro</span></span>
          </div>
          <p className="text-slate-400 text-sm font-medium tracking-wide">
            {isLogin ? 'Welcome back, Coach.' : 'Create your Team Workspace.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
              <Target className="w-5 h-5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {isForgotPassword ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
                placeholder="coach@team.com"
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 block">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
              placeholder="coach@team.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-2 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-12 py-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors shadow-inner"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-500 uppercase tracking-widest pl-2 block">
                Beta Access Key
              </label>
              <input
                type="text"
                value={betaKey}
                onChange={(e) => setBetaKey(e.target.value.toUpperCase())}
                required={!isLogin}
                maxLength={6}
                className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-3 text-amber-400 font-mono tracking-widest outline-none focus:border-amber-400 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                placeholder="XXXXXX"
              />
            </div>
          )}

              <button
                type="submit"
                disabled={loading}
                className="w-full group relative flex items-center justify-center gap-2 px-6 py-4 border border-indigo-500/50 text-sm font-black rounded-2xl text-white bg-indigo-600/80 hover:bg-indigo-500 backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-indigo-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest mt-4"
              >
                {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Create Team'}
                {!loading && <Target className="w-4 h-4 text-indigo-300" />}
              </button>
            </>
          )}

          {isForgotPassword && (
            <button
              type="submit"
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-2 px-6 py-4 border border-indigo-500/50 text-sm font-black rounded-2xl text-white bg-indigo-600/80 hover:bg-indigo-500 backdrop-blur-md focus:outline-none focus:ring-4 focus:ring-indigo-500/50 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest mt-4"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          )}
        </form>

        <div className="mt-8 text-center space-y-4 flex flex-col">
          {isForgotPassword ? (
            <button
              onClick={() => { setIsForgotPassword(false); setMessage(''); setError(''); }}
              className="text-slate-500 hover:text-indigo-400 text-sm font-bold transition-colors"
            >
              Back to Login
            </button>
          ) : (
            <>
              {isLogin && (
                <button
                  onClick={() => setIsForgotPassword(true)}
                  className="text-slate-500 hover:text-indigo-400 text-sm font-bold transition-colors"
                >
                  Forgot Password?
                </button>
              )}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-slate-500 hover:text-indigo-400 text-sm font-bold transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
