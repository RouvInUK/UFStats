import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchDrills, insertDrill } from '../supabaseClient';
import { useAuth } from './AuthContext';

const DrillStateContext = createContext();

export const useDrillState = () => {
  const context = useContext(DrillStateContext);
  if (!context) {
    throw new Error('useDrillState must be used within a DrillStateProvider');
  }
  return context;
};

// Hardcoded fallback standards matching our Version 2.0 specs
const DEFAULT_DRILLS = [
  {
    id: 'system_drill_go',
    name: 'The "Go" Drill',
    category: 'Cutting',
    flow_type: 'rep_based',
    metrics: ['Leading Catch', 'Overthrow', 'Underthrow', 'Drop'],
    is_public: true,
    status: 'approved'
  },
  {
    id: 'system_drill_box',
    name: 'The Box Drill',
    category: 'Timing',
    flow_type: 'continuous',
    metrics: ['Leading Catch', 'Overthrow', 'Underthrow', 'Drop'],
    is_public: true,
    status: 'approved'
  },
  {
    id: 'system_drill_weave',
    name: 'The 3-Person Weave',
    category: 'Field Awareness',
    flow_type: 'continuous',
    metrics: ['Drop', 'Throwaway', 'Stall Out', 'Defence'],
    is_public: true,
    status: 'approved'
  },
  {
    id: 'system_drill_pull',
    name: 'Pull Practice',
    category: 'Special Teams',
    flow_type: 'continuous',
    metrics: ['Endzone', 'Field (Past Brick)', 'Out of Bounds/past brick', 'Short/out of bounce'],
    is_public: true,
    status: 'approved'
  }
];

export const DrillStateProvider = ({ children }) => {
  const { profile } = useAuth();
  const teamId = profile?.team_id || null;
  const userId = profile?.id || null;

  const [drills, setDrills] = useState(DEFAULT_DRILLS);
  const [activeDrill, setActiveDrill] = useState(DEFAULT_DRILLS[0]);
  const [isGhostScrimmage, setIsGhostScrimmage] = useState(() => {
    return localStorage.getItem('ufstats_is_ghost_scrimmage') === 'true';
  });

  const [lightShirtPlayers, setLightShirtPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem('ufstats_light_shirt_players');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [darkShirtPlayers, setDarkShirtPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem('ufstats_dark_shirt_players');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lockedThrowerId, setLockedThrowerId] = useState(null); // String name or ID of the locked thrower

  // Load drills from database on mount or team change
  useEffect(() => {
    const loadDrillsList = async () => {
      if (!teamId) return;
      try {
        const fetched = await fetchDrills(teamId);
        // Merge DB drills with our defaults safely, avoiding duplicates by name
        if (fetched && fetched.length > 0) {
          const merged = [...DEFAULT_DRILLS];
          fetched.forEach(dbDrill => {
            if (!merged.some(d => d.name.toLowerCase() === dbDrill.name.toLowerCase())) {
              merged.push(dbDrill);
            }
          });
          setDrills(merged);
        }
      } catch (err) {
        console.warn("Failed to load drills from Supabase, using local defaults.", err);
      }
    };
    loadDrillsList();
  }, [teamId]);

  // Persist settings locally
  useEffect(() => {
    localStorage.setItem('ufstats_is_ghost_scrimmage', isGhostScrimmage.toString());
  }, [isGhostScrimmage]);

  useEffect(() => {
    localStorage.setItem('ufstats_light_shirt_players', JSON.stringify(lightShirtPlayers));
  }, [lightShirtPlayers]);

  useEffect(() => {
    localStorage.setItem('ufstats_dark_shirt_players', JSON.stringify(darkShirtPlayers));
  }, [darkShirtPlayers]);

  const selectDrill = (drillNameOrId) => {
    const found = drills.find(d => d.id === drillNameOrId || d.name === drillNameOrId);
    if (found) {
      setActiveDrill(found);
      // Reset thrower lock when active drill changes
      setLockedThrowerId(null);
    }
  };

  const toggleLockedThrower = (playerName) => {
    setLockedThrowerId(prev => (prev === playerName ? null : playerName));
  };

  const createCustomDrill = async (drillData) => {
    try {
      const payload = {
        teamId,
        createdBy: userId,
        name: drillData.name,
        category: drillData.category,
        flowType: drillData.flowType,
        metrics: drillData.metrics,
        isPublic: drillData.isPublic
      };

      const saved = await insertDrill(payload);
      if (saved) {
        setDrills(prev => {
          if (!prev.some(d => d.id === saved.id)) {
            return [...prev, saved];
          }
          return prev;
        });
        setActiveDrill(saved);
        return { success: true, drill: saved };
      }
    } catch (err) {
      console.error("Failed to create custom drill:", err);
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Could not save drill.' };
  };

  return (
    <DrillStateContext.Provider
      value={{
        drills,
        activeDrill,
        isGhostScrimmage,
        lightShirtPlayers,
        darkShirtPlayers,
        lockedThrowerId,
        setIsGhostScrimmage,
        setLightShirtPlayers,
        setDarkShirtPlayers,
        selectDrill,
        toggleLockedThrower,
        setLockedThrowerId,
        createCustomDrill
      }}
    >
      {children}
    </DrillStateContext.Provider>
  );
};
