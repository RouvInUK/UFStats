/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Safety net
    const fallbackTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 15000);

    const initializeAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          // It's normal to get a AuthSessionMissingError if not logged in
          if (error.name !== 'AuthSessionMissingError') {
             console.warn("Auth initialization getUser error:", error);
          }
          if (mounted) setLoading(false);
          return;
        }

        if (user && mounted) {
          setUser(user);
          await fetchProfile(user.id);
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Critical Auth Init Error:", err);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext: onAuthStateChange event:", event);
      if (event === 'SIGNED_IN' && mounted) {
        setLoading(true);
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT' && mounted) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId, attempt = 1) => {
    console.log(`AuthContext: fetchProfile called for user: ${userId} (Attempt ${attempt})`);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('team_id, is_system_admin, teams(name)')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.warn("AuthContext: fetchProfile query error:", error.code);
        if (error.code === 'PGRST116' && attempt < 5) {
          console.log(`AuthContext: Retrying profile fetch in ${attempt}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          return await fetchProfile(userId, attempt + 1);
        }
        setAuthError(error.message || JSON.stringify(error));
        setLoading(false);
        throw error;
      }
      
      console.log("AuthContext: Profile fetched successfully:", data);
      setProfile(data);
      setAuthError(null);
      setLoading(false);
    } catch (err) {
      console.error('AuthContext: Error fetching profile:', err);
      setAuthError(err.message || 'Unknown fetch error');
      setLoading(false);
    }
  };

  // 15-Minute Auto-Logout Timer (Robust for Mobile/Sleep)
  useEffect(() => {
    if (!user) {
      // Failsafe: If the user is on the login screen, ensure the inactivity timer is purged
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
  }, [user]);

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password) => {
    return supabase.auth.signUp({ email, password });
  };

  const signOut = async () => {
    // Fire and forget the official signout so it doesn't hang the UI
    supabase.auth.signOut().catch(err => {
      console.warn("AuthContext: Background signout error:", err);
    });

    // Instantly force clear any Supabase session keys from local storage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
    localStorage.removeItem('ufstats_last_activity');
    
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
