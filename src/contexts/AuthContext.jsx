/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem('ufstats_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchProfile = async (userId, attempt = 1) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_system_admin, tier, beta_voice_pro')
        .eq('id', userId)
        .single();
        
      if (error) throw error;
      
      setProfile(data);
      localStorage.setItem('ufstats_cached_profile', JSON.stringify(data));
      setAuthError(null);
    } catch (err) {
      console.warn(`AuthContext: Profile fetch failed (Attempt ${attempt})`, err);
      if (err.code === 'PGRST116' && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        return await fetchProfile(userId, attempt + 1);
      }
      setAuthError(`DB Error ${err.code || 'UNKNOWN'}: ${err.message || 'Failed to sync profile.'}`);
    }
  };

  useEffect(() => {
    let mounted = true;

    const fallbackTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 10000);

    // Initial fast-check for cold starts
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && mounted) {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const hasCache = !!localStorage.getItem('ufstats_cached_profile');
          if (!hasCache) {
            setLoading(true);
          } else {
            setLoading(false);
          }
          
          setUser(session.user);
          
          // Fire and forget the profile sync! 
          // AWAITING HERE DEADLOCKS THE SUPABASE AUTH QUEUE IF IT HANGS!
          fetchProfile(session.user.id).finally(() => {
            if (mounted && !hasCache) setLoading(false);
          });
          
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem('ufstats_cached_profile');
          if (mounted) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('ufstats_cached_profile');
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 15-Minute Auto-Logout Timer (Robust for Mobile/Sleep)
  useEffect(() => {
    // Do not purge timestamps or initialize timers while auth is still hydrating
    if (loading) return;

    if (!user) {
      // Failsafe: If the user is definitively on the login screen, ensure the timer is purged
      localStorage.removeItem('ufstats_last_activity');
      return;
    }

    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes in milliseconds
    const STORAGE_KEY = 'ufstats_last_activity';

    const updateActivity = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };

    const checkInactivity = () => {
      const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (lastActivity && (Date.now() - lastActivity > INACTIVITY_LIMIT)) {
        console.warn("AuthContext: Auto-logging out due to 15m inactivity (background check).");
        signOut();
        return true;
      }
      return false;
    };

    // Initialize
    if (!checkInactivity()) {
      updateActivity();
    }

    // Check periodically (every 10 seconds)
    const intervalId = setInterval(checkInactivity, 10000);

    // Also check immediately when the browser tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    // Throttle the localstorage writes so we aren't writing 60 times a second
    let isThrottled = false;
    const handleActivityEvent = () => {
      if (!isThrottled) {
        if (checkInactivity()) return;
        updateActivity();
        isThrottled = true;
        setTimeout(() => { isThrottled = false; }, 2000);
      }
    };

    events.forEach(event => window.addEventListener(event, handleActivityEvent, { passive: true }));

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      events.forEach(event => window.removeEventListener(event, handleActivityEvent));
    };
  }, [user, loading]);

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password) => {
    return supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
  };

  const signOut = async () => {
    // Fire and forget the official signout so it doesn't hang the UI
    supabase.auth.signOut().catch(err => {
      console.warn("AuthContext: Background signout error:", err);
    });

    // Instantly force clear any Supabase session keys from local storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.startsWith('ufstats_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Hard reload the browser to purge all React state and reset immediately
    window.location.reload();
  };

  const value = {
    user,
    profile,
    loading,
    authError,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
