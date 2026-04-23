/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase, setGlobalTeamId } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Manually fetch session in case INITIAL_SESSION event doesn't trigger
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error("Auth initialization error:", err);
      setLoading(false);
    });

    // Listen for auth changes (this fires on login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      // Small delay might be needed for the trigger to insert the profile on first signup
      const { data, error } = await supabase
        .from('profiles')
        .select('team_id, is_system_admin, teams(name)')
        .eq('id', userId)
        .single();
        
      if (error) {
        // If profile isn't found immediately after signup, retry once after 1 second
        if (error.code === 'PGRST116') {
          setTimeout(async () => {
            const { data: retryData } = await supabase
              .from('profiles')
              .select('team_id, is_system_admin, teams(name)')
              .eq('id', userId)
              .single();
            setProfile(retryData);
            if (retryData?.team_id) setGlobalTeamId(retryData.team_id);
            setLoading(false);
          }, 1000);
          return;
        }
        throw error;
      }
      setProfile(data);
      if (data?.team_id) setGlobalTeamId(data.team_id);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
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
    return supabase.auth.signOut();
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
