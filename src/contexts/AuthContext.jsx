/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase, setGlobalTeamId } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthContext: Mounting");
    
    // Safety net: force loading to false after 5 seconds
    const fallbackTimeout = setTimeout(() => {
      console.warn("AuthContext: Fallback timeout triggered! Forcing loading=false");
      setLoading(false);
    }, 5000);

    // Manually fetch session in case INITIAL_SESSION event doesn't trigger
    console.log("AuthContext: Calling getSession...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("AuthContext: getSession resolved. Session:", !!session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error("AuthContext: Auth initialization error:", err);
      setLoading(false);
    });

    // Listen for auth changes (this fires on login/logout)
    console.log("AuthContext: Setting up onAuthStateChange...");
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("AuthContext: onAuthStateChange fired! Event:", event, "Session:", !!session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setGlobalTeamId(null);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(fallbackTimeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    console.log("AuthContext: fetchProfile called for user:", userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('team_id, is_system_admin, teams(name)')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.warn("AuthContext: fetchProfile query error:", error.code);
        if (error.code === 'PGRST116') {
          console.log("AuthContext: Retrying profile fetch in 1s...");
          setTimeout(async () => {
            try {
              const { data: retryData, error: retryError } = await supabase
                .from('profiles')
                .select('team_id, is_system_admin, teams(name)')
                .eq('id', userId)
                .single();
              
              if (!retryError) {
                setProfile(retryData);
                if (retryData?.team_id) setGlobalTeamId(retryData.team_id);
              } else {
                console.warn('AuthContext: Profile retry failed:', retryError);
              }
            } catch (retryErr) {
              console.warn('AuthContext: Profile retry exception:', retryErr);
            } finally {
              console.log("AuthContext: setLoading(false) from retry finally");
              setLoading(false);
            }
          }, 1000);
          return;
        }
        throw error;
      }
      console.log("AuthContext: Profile fetched successfully:", data);
      setProfile(data);
      if (data?.team_id) setGlobalTeamId(data.team_id);
    } catch (err) {
      console.error('AuthContext: Error fetching profile:', err);
    } finally {
      console.log("AuthContext: setLoading(false) from main finally block");
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password) => {
    return supabase.auth.signUp({ email, password });
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("AuthContext: Error during sign out:", err);
    } finally {
      // Force clear any corrupted Supabase session keys from local storage
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      // Hard reload the browser to purge all React state and reset
      window.location.reload();
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
