import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

import { getLocalPoint, savePointLocally, addStatToLocalPoint, generateUUID, attemptSync } from './SyncEngine';

export const recordStatToDB = async (statData, currentTeamId) => {
  const { 
    player, 
    stat, 
    stat_type, 
    pointNumber, 
    point_number, 
    gameName, 
    game_name, 
    gameType, 
    game_type, 
    teamName, 
    team_name, 
    details, 
    timestamp 
  } = statData;

  const resolvedStatType = stat || stat_type;
  const resolvedPointNumber = pointNumber !== undefined ? pointNumber : point_number;
  const resolvedGameName = gameName || game_name || 'Unnamed Game';
  const resolvedGameType = gameType || game_type || 'grass';
  const resolvedTeamName = teamName || team_name || 'Default Team';

  const newStat = {
    player: player,
    stat_type: resolvedStatType,
    point_number: resolvedPointNumber,
    game_name: resolvedGameName,
    game_type: resolvedGameType,
    team_name: resolvedTeamName,
    team_id: currentTeamId,
    details: details || null,
    timestamp: timestamp || statData.timestamp || null
  };

  const enrichedStat = await addStatToLocalPoint(newStat.game_name, resolvedPointNumber, newStat);
  return enrichedStat;
};


export const recordLineup = async (players, pointNumber, gameName, gameType, teamName, currentTeamId) => {
  if (!players || players.length === 0) return;
  
  const insertData = players.map(player => ({
    id: generateUUID(),
    created_at: new Date().toISOString(),
    player: player,
    stat_type: 'Lineup',
    point_number: pointNumber,
    game_name: gameName || 'Unnamed Game',
    game_type: gameType || 'grass',
    team_name: teamName || 'Default Team',
    team_id: currentTeamId
  }));

  // Queue locally using thread-safe block
  const key = `point_${gameName || 'Unnamed Game'}_${pointNumber}`;
  import('./SyncEngine').then(async ({ getPointKey }) => {
     // I need to use the pointLocks from SyncEngine. But I can't import pointLocks easily.
     // So I will just use addStatToLocalPoint in a loop!
  });
  
  for (const stat of insertData) {
     await addStatToLocalPoint(gameName || 'Unnamed Game', pointNumber, stat);
  }

  return insertData;
};

// --- Roster & Lineup API Helpers ---

export const fetchAllTeamNames = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('teams')
    .select('name')
    .eq('owner_id', user.id)
    .order('name', { ascending: true });

  if (error) throw error;
  if (!data) return [];
  
  return data.map(t => t.name);
};

export const fetchPlayers = async (teamId) => {
  if (!teamId) return [];
  const { data, error } = await supabase
    .from('players')
    .select('*, team_players!inner(*)')
    .eq('team_players.team_id', teamId)
    .order('name', { ascending: true });
    
  if (error) throw error;
  
  // Flatten the is_active property from the junction table onto the player object
  return data.map(player => ({
    ...player,
    is_active: player.team_players[0]?.is_active || false
  }));
};

export const fetchClubPlayers = async (clubId) => {
  if (!clubId) return [];
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('club_id', clubId)
    .order('name', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const addPlayerToClub = async (name, clubId, shirtNumber, genderDesignation = null) => {
  const { data, error } = await supabase
    .from('players')
    .insert([{ 
      name, 
      club_id: clubId,
      shirt_number: shirtNumber || null,
      gender_designation: genderDesignation || null
    }])
    .select();

  if (error) {
    console.error("Supabase Insert Error:", error);
    throw error;
  }
  return data[0];
};

export const updatePlayerInClub = async (playerId, name, shirtNumber, genderDesignation = null) => {
  const { data, error } = await supabase
    .from('players')
    .update({ 
      name, 
      shirt_number: shirtNumber || null,
      gender_designation: genderDesignation || null
    })
    .eq('id', playerId)
    .select();

  if (error) {
    console.error("Supabase Update Error:", error);
    throw error;
  }
  return data[0];
};

export const togglePlayerOnTeam = async (playerId, teamId, isAdding) => {
  if (isAdding) {
    const { error } = await supabase
      .from('team_players')
      .insert([{ player_id: playerId, team_id: teamId, is_active: false }]);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('team_players')
      .delete()
      .match({ player_id: playerId, team_id: teamId });
    if (error) throw error;
  }
};

export const removePlayerGlobally = async (playerId) => {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId);

  if (error) throw error;
};

export const togglePlayerActiveStatus = async (playerId, teamId, currentStatus) => {
  const { data, error } = await supabase
    .from('team_players')
    .update({ is_active: !currentStatus })
    .eq('player_id', playerId)
    .eq('team_id', teamId)
    .select();

  if (error) throw error;
  return data[0];
};

export const clearActiveLineup = async (teamId) => {
  if (!teamId) return;
  const { error } = await supabase
    .from('team_players')
    .update({ is_active: false })
    .eq('team_id', teamId)
    .eq('is_active', true);

  if (error) throw error;
};

export const setLineupActiveStatus = async (playerIds, teamId) => {
  if (!teamId) return;
  
  const { error: clearError } = await supabase
    .from('team_players')
    .update({ is_active: false })
    .eq('team_id', teamId)
    .eq('is_active', true);
    
  if (clearError) throw clearError;

  if (playerIds.length > 0) {
    const { error: setActiveError } = await supabase
      .from('team_players')
      .update({ is_active: true })
      .in('player_id', playerIds)
      .eq('team_id', teamId);
      
    if (setActiveError) throw setActiveError;
  }
};

export const fetchStats = async (teamIdentifier) => {
  if (!teamIdentifier) return [];
  
  let allData = [];
  let fetchMore = true;
  let page = 0;
  const PAGE_SIZE = 1000;

  while (fetchMore) {
      let query = supabase
        .from('stats')
        .select('*')
        .order('created_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (teamIdentifier) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamIdentifier);
        if (isUUID) {
          query = query.eq('team_id', teamIdentifier);
        } else if (teamIdentifier === 'Default Team' || teamIdentifier === 'Default Team (Migrated)') {
          query = query.or(`team_name.eq.${teamIdentifier},team_name.is.null`);
        } else {
          query = query.eq('team_name', teamIdentifier);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      allData = allData.concat(data || []);
      
      if (!data || data.length < PAGE_SIZE) {
          fetchMore = false;
      } else {
          page++;
      }
  }
  return allData;
};

export const fetchAllGameNames = async (teamName) => {
  if (!teamName) return [];
  
  let allData = [];
  let fetchMore = true;
  let page = 0;
  const PAGE_SIZE = 1000;

  while (fetchMore) {
      let query = supabase
        .from('stats')
        .select('game_name')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (teamName) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamName);
        if (isUUID) {
          query = query.eq('team_id', teamName);
        } else if (teamName === 'Default Team' || teamName === 'Default Team (Migrated)') {
          query = query.or(`team_name.eq.${teamName},team_name.is.null`);
        } else {
          query = query.eq('team_name', teamName);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      allData = allData.concat(data || []);
      
      if (!data || data.length < PAGE_SIZE) {
          fetchMore = false;
      } else {
          page++;
      }
  }
  
  return [...new Set(allData.map(s => s.game_name))].filter(name => name && name !== 'DEBUG_LOG');
};

export const fetchActiveGames = async (teamName) => {
  if (!teamName) return [];
  // We only need a few columns to derive active games
  let allData = [];
  let fetchMore = true;
  let page = 0;
  const PAGE_SIZE = 1000;

  while (fetchMore) {
      let query = supabase
        .from('stats')
        .select('game_name, stat_type, point_number')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (teamName) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamName);
        if (isUUID) {
          query = query.eq('team_id', teamName);
        } else if (teamName === 'Default Team' || teamName === 'Default Team (Migrated)') {
          query = query.or(`team_name.eq.${teamName},team_name.is.null`);
        } else {
          query = query.eq('team_name', teamName);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      
      allData = allData.concat(data || []);
      
      if (!data || data.length < PAGE_SIZE) {
          fetchMore = false;
      } else {
          page++;
      }
  }

  const data = allData;

  const gameStatus = {};

  data.forEach(stat => {
    if (!stat.game_name) return;

    if (!gameStatus[stat.game_name]) {
      gameStatus[stat.game_name] = { isCompleted: false, maxPoint: 1, maxPointHasGoal: false };
    }

    // Event-sourcing check for completion
    if (stat.stat_type === 'Game Completed') {
      gameStatus[stat.game_name].isCompleted = true;
    }

    // Track highest point
    if (stat.point_number > gameStatus[stat.game_name].maxPoint) {
      gameStatus[stat.game_name].maxPoint = stat.point_number;
      gameStatus[stat.game_name].maxPointHasGoal = false; // Reset for new high point
    }

    // Check if the current highest point has already been scored
    if (stat.point_number === gameStatus[stat.game_name].maxPoint && stat.stat_type === 'Point') {
      gameStatus[stat.game_name].maxPointHasGoal = true;
    }
  });

  // Filter out completed matches and return map of name to calculated current Point
  return Object.entries(gameStatus)
    .filter(([name, info]) => name !== 'DEBUG_LOG' && !info.isCompleted)
    .map(([name, info]) => ({ 
      name, 
      maxPoint: info.maxPoint
    }));
};

export const fetchGameStats = async (gameNames, teamIdentifier) => {
  if (!teamIdentifier) return [];
  const isArray = Array.isArray(gameNames);
  if (isArray && gameNames.length === 0) return [];

  let serverData = [];
  if (navigator.onLine) {
    let fetchMore = true;
    let page = 0;
    const PAGE_SIZE = 1000;

    while (fetchMore) {
        let query = supabase
          .from('stats')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (isArray) {
          query = query.in('game_name', gameNames);
        } else {
          query = query.eq('game_name', gameNames);
        }

        if (teamIdentifier) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamIdentifier);
          if (isUUID) {
            query = query.eq('team_id', teamIdentifier);
          } else if (teamIdentifier === 'Default Team' || teamIdentifier === 'Default Team (Migrated)') {
            query = query.or(`team_name.eq.${teamIdentifier},team_name.is.null`);
          } else {
            query = query.eq('team_name', teamIdentifier);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        
        serverData = serverData.concat(data || []);
        
        if (!data || data.length < PAGE_SIZE) {
            fetchMore = false;
        } else {
            page++;
        }
    }
  }

  // Merge with local unsynced stats
  try {
    const { keys, get } = await import('idb-keyval');
    const allKeys = await keys();
    const gameNameArray = isArray ? gameNames : [gameNames];
    
    let localStats = [];
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith('point_')) {
        const pointData = await get(key);
        if (pointData && pointData.stats && !pointData.synced && gameNameArray.includes(pointData.gameName)) {
           // Ensure it belongs to this team
           const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamIdentifier);
           const filteredStats = pointData.stats.filter(s => {
             if (isUUID) return s.team_id === teamIdentifier;
             return s.team_name === teamIdentifier || s.team_name === 'Default Team' || !s.team_name;
           });
           localStats.push(...filteredStats);
        }
      }
    }

    // Merge logic: Overwrite server data with unsynced local stats (which contain pending edits like huck upgrades)
    const serverMap = new Map(serverData.map(s => [s.id, s]));
    for (const ls of localStats) {
       serverMap.set(ls.id, ls);
    }
    serverData = Array.from(serverMap.values());
    
    // Re-sort descending
    serverData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  } catch (e) {
    console.warn("Could not merge local stats", e);
  }

  return serverData;
};

export const updateStat = async (id, newStatType) => {
  const { data, error } = await supabase
    .from('stats')
    .update({ stat_type: newStatType })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
};

export const deleteStat = async (id) => {
  // Try removing locally first
  import('./SyncEngine').then(({ removeStatLocally, attemptSync }) => {
    removeStatLocally(id).then((removed) => {
       if (removed && navigator.onLine) {
         attemptSync();
       }
    });
  });

  if (navigator.onLine) {
    const { error } = await supabase
      .from('stats')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Supabase Delete Error:", error);
      throw error;
    }
  }
};

export const deleteGame = async (gameName, teamId) => {
  try {
    const { keys, del } = await import('idb-keyval');
    const allKeys = await keys();
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(`point_${gameName}_`)) {
        await del(key);
      }
    }
  } catch (e) {
    console.warn("Could not delete game locally", e);
  }

  if (navigator.onLine) {
    const { error } = await supabase
      .from('stats')
      .delete()
      .eq('game_name', gameName)
      .eq('team_id', teamId);

    if (error) {
      console.error("Supabase Delete Game Error:", error);
      throw error;
    }
  }
};

export const deletePoint = async (gameName, teamId, pointNumber) => {
  // Clear local queue first
  try {
    const { getPointKey } = await import('./SyncEngine');
    const { del } = await import('idb-keyval');
    const key = getPointKey(gameName, pointNumber);
    await del(key);
  } catch (e) {
    console.warn("Could not delete point locally", e);
  }

  if (navigator.onLine) {
    const { error } = await supabase
      .from('stats')
      .delete()
      .eq('game_name', gameName)
      .eq('team_id', teamId)
      .eq('point_number', pointNumber);

    if (error) {
      console.error("Supabase Delete Point Error:", error);
      throw error;
    }
  }
};

export const updateUserTier = async (userId, tier) => {
  const updates = { tier };
  if (tier === 'PRO+') {
    updates.beta_trainings_tier = true;
    updates.beta_tournament_tier = false;
  } else if (tier === 'TOURNAMENT') {
    updates.beta_trainings_tier = true;
    updates.beta_tournament_tier = true;
  } else if (tier === 'PRO') {
    updates.beta_trainings_tier = false;
    updates.beta_tournament_tier = false;
  } else if (tier === 'FREE') {
    updates.beta_trainings_tier = false;
    updates.beta_tournament_tier = false;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select();

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Update failed. You may lack permission (check Supabase RLS policies).");
  }
  return data[0];
};

export const updateUserProExpiration = async (userId, pro_expires_at) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ pro_expires_at: pro_expires_at || null })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data ? data[0] : null;
};

export const updateUserBetaVoicePro = async (userId, beta_voice_pro) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ beta_voice_pro })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data ? data[0] : null;
};

export const updateUserIsTestAccount = async (userId, is_test_account) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_test_account })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data ? data[0] : null;
};

export const updateUserBetaTournamentTier = async (userId, beta_tournament_tier) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ beta_tournament_tier })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data ? data[0] : null;
};

export const updateUserBetaTrainingsTier = async (userId, beta_trainings_tier) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ beta_trainings_tier })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data ? data[0] : null;
};

export const updateUserDisableClubTrack = async (userId, disable_club_track) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ disable_club_track })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data ? data[0] : null;
};

export const fetchUserHierarchy = async (userId) => {
  if (!userId) return { clubs: [], teams: [] };
  
  const { data: clubs, error: clubError } = await supabase
    .from('clubs')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
    
  if (clubError) throw clubError;
  
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
    
  if (teamError) throw teamError;
  
  return { clubs: clubs || [], teams: teams || [] };
};

export const checkTierLimits = async (userId) => {
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('tier, pro_expires_at')
    .eq('id', userId)
    .single();
    
  if (pError) throw pError;
  
  const tier = profile.tier;
  const isExpiredPro = profile.pro_expires_at && new Date(profile.pro_expires_at) < new Date();
  
  const isUnlimited = tier === 'PRO+' || tier === 'TOURNAMENT';
  const isPro = tier === 'PRO' || isUnlimited || (!!profile.pro_expires_at && !isExpiredPro);
  
  const { count: clubCount, error: cError } = await supabase
    .from('clubs')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
    
  const { count: teamCount, error: tError } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
    
  if (cError || tError) throw new Error("Failed to check tier limits");
  
  if (isUnlimited) {
    return {
      canAddClub: true, // Unlimited clubs
      canAddTeam: true, // Unlimited teams
      isPro: true
    };
  }
  
  if (isPro) {
    return {
      canAddClub: clubCount < 1,
      canAddTeam: teamCount < 5,
      isPro: true
    };
  }

  return {
    canAddClub: clubCount < 1,
    canAddTeam: teamCount < 2,
    isPro: false
  };
};

export const createClub = async (name, ownerId) => {
  const limits = await checkTierLimits(ownerId);
  if (!limits.canAddClub) throw new Error("Limit Reached: Maximum 1 Club allowed.");
  
  const { data, error } = await supabase
    .from('clubs')
    .insert([{ name, owner_id: ownerId }])
    .select();
    
  if (error) throw error;
  return data[0];
};

export const createTeam = async (name, clubId, ownerId) => {
  const limits = await checkTierLimits(ownerId);
  if (!limits.canAddTeam) {
    throw new Error(`Limit Reached: Maximum ${limits.isPro ? 5 : 2} Teams allowed.`);
  }
  
  const { data, error } = await supabase
    .from('teams')
    .insert([{ name, club_id: clubId, owner_id: ownerId }])
    .select();
    
  if (error) throw error;
  return data[0];
};

export const deleteClub = async (clubId) => {
  const { error } = await supabase
    .from('clubs')
    .delete()
    .eq('id', clubId);
    
  if (error) throw error;
};

export const deleteTeam = async (teamId) => {
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId);
    
  if (error) throw error;
};

export const fetchBetaKeys = async () => {
  const { data, error } = await supabase
    .from('beta_keys')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const generateBetaKey = async () => {
  const randomKey = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await supabase
    .from('beta_keys')
    .insert([{ key: randomKey }])
    .select();

  if (error) throw error;
  return data[0];
};

export const pruneIncompleteGames = async () => {
  const { data, error } = await supabase.rpc('prune_incomplete_games');
  if (error) throw error;
  return data;
};

export const fetchActionsPerDay = async () => {
  const { data, error } = await supabase.rpc('get_actions_per_day_30d');
  if (error) throw error;
  return data || [];
};

export const fetchLastStatForGame = async (gameName, teamName) => {
  if (!teamName) return null;
  
  try {
    const { getLastLocalStat } = await import('./SyncEngine');
    const localStat = await getLastLocalStat(gameName);
    if (localStat) return localStat;
  } catch (e) {
    console.warn("Could not fetch local stat:", e);
  }

  if (!navigator.onLine) return null;

  let query = supabase
    .from('stats')
    .select('*')
    .eq('game_name', gameName)
    .neq('stat_type', 'Lineup')
    .order('created_at', { ascending: false })
    .limit(1);

  if (teamName) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamName);
    if (isUUID) {
      query = query.eq('team_id', teamName);
    } else if (teamName === 'Default Team' || teamName === 'Default Team (Migrated)') {
      query = query.or(`team_name.eq.${teamName},team_name.is.null`);
    } else {
      query = query.eq('team_name', teamName);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
};

export const checkIfHalfTimeLogged = async (gameName) => {
  const { data, error } = await supabase
    .from('stats')
    .select('id')
    .eq('game_name', gameName)
    .eq('stat_type', 'Half Time')
    .limit(1);
    
  if (error) throw error;
  return data && data.length > 0;
};

export const restoreLineupForPoint = async (gameName, pointNumber, teamName) => {
  if (!teamName) return [];
  
  try {
    const { getLocalPoint } = await import('./SyncEngine');
    const localPoint = await getLocalPoint(gameName, pointNumber);
    if (localPoint && localPoint.stats) {
      const lineupStats = localPoint.stats.filter(s => s.stat_type === 'Lineup');
      if (lineupStats.length > 0) {
        return lineupStats.map(s => s.player);
      }
    }
  } catch (e) {
    console.warn("Could not fetch local lineup:", e);
  }

  if (!navigator.onLine) return [];

  let query = supabase
    .from('stats')
    .select('player')
    .eq('game_name', gameName)
    .eq('point_number', pointNumber)
    .eq('stat_type', 'Lineup');

  if (teamName) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamName);
    if (isUUID) {
      query = query.eq('team_id', teamName);
    } else if (teamName === 'Default Team' || teamName === 'Default Team (Migrated)') {
      query = query.or(`team_name.eq.${teamName},team_name.is.null`);
    } else {
      query = query.eq('team_name', teamName);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) return [];

  const activePlayers = data.map(d => d.player);

  let updateQuery = supabase.from('players').update({ is_active: true }).in('name', activePlayers);
  if (teamName) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamName);
    if (isUUID) {
      updateQuery = updateQuery.eq('team_id', teamName);
    } else if (teamName === 'Default Team' || teamName === 'Default Team (Migrated)') {
      updateQuery = updateQuery.or(`team_name.eq.${teamName},team_name.is.null`);
    } else {
      updateQuery = updateQuery.eq('team_name', teamName);
    }
  }

  await updateQuery;

  return activePlayers;
};

// ==========================================
// MANAGED LINES (Line Templates)
// ==========================================

export const fetchManagedLines = async (teamId) => {
  if (!navigator.onLine) return null;
  if (!teamId || !(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId))) return null;

  try {
    const { data, error } = await supabase
      .from('teams')
      .select('managed_lines')
      .eq('id', teamId)
      .single();

    if (error) {
      console.warn("Failed to fetch managed lines:", error);
      return null;
    }
    return data?.managed_lines || [];
  } catch (err) {
    console.warn("Exception fetching managed lines:", err);
    return null;
  }
};

export const saveManagedLines = async (teamId, lines) => {
  if (!navigator.onLine) return false;
  if (!teamId || !(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId))) return false;

  try {
    const { error } = await supabase
      .from('teams')
      .update({ managed_lines: lines })
      .eq('id', teamId);
      
    if (error) {
      console.error("Failed to save managed lines to cloud:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Exception saving managed lines:", err);
    return false;
  }
};

// ==========================================
// TOURNAMENT TIER CLIENT HELPERS (Phase 2)
// ==========================================

export const fetchTournaments = async () => {
  if (!navigator.onLine) return [];
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const createTournament = async (name, start_date, end_date, creatorId, gameType = 'grass') => {
  if (!navigator.onLine) throw new Error("Offline. Cannot create tournament.");
  
  // Try inserting with game_type column first
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      start_date: start_date || null,
      end_date: end_date || null,
      created_by: creatorId,
      game_type: gameType
    })
    .select()
    .single();

  if (error) {
    // If column doesn't exist in schema cache, fallback to inserting without it
    if (error.message?.includes('game_type') || error.code === 'PGRST204') {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('tournaments')
        .insert({
          name,
          start_date: start_date || null,
          end_date: end_date || null,
          created_by: creatorId
        })
        .select()
        .single();
      if (fallbackError) throw fallbackError;
      return fallbackData;
    }
    throw error;
  }
  return data;
};

export const updateTournament = async (tournamentId, name, start_date, end_date, gameType = 'grass') => {
  if (!navigator.onLine) throw new Error("Offline. Cannot update tournament.");
  
  // Try updating with game_type column first
  const { data, error } = await supabase
    .from('tournaments')
    .update({
      name,
      start_date: start_date || null,
      end_date: end_date || null,
      game_type: gameType
    })
    .eq('id', tournamentId)
    .select()
    .single();

  if (error) {
    // If column doesn't exist in schema cache, fallback to updating without it
    if (error.message?.includes('game_type') || error.code === 'PGRST204') {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('tournaments')
        .update({
          name,
          start_date: start_date || null,
          end_date: end_date || null
        })
        .eq('id', tournamentId)
        .select()
        .single();
      if (fallbackError) throw fallbackError;
      return fallbackData;
    }
    throw error;
  }
  return data;
};

export const fetchTournamentTeams = async (tournamentId) => {
  if (!navigator.onLine) return [];
  const { data, error } = await supabase
    .from('tournament_teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('team_name', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createTournamentTeam = async (tournamentId, team_name, division = 'Mixed') => {
  if (!navigator.onLine) throw new Error("Offline. Cannot create team.");
  const { data, error } = await supabase
    .from('tournament_teams')
    .insert({ tournament_id: tournamentId, team_name, division })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchTournamentMatches = async (tournamentId) => {
  if (!navigator.onLine) return [];
  const { data, error } = await supabase
    .from('tournament_matches')
    .select(`
      *,
      home_team:tournament_teams!home_team_id(*),
      away_team:tournament_teams!away_team_id(*),
      tournament_scorer_seats(*)
    `)
    .eq('tournament_id', tournamentId)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createTournamentMatch = async (tournamentId, homeTeamId, awayTeamId, pitchNumber, startTime) => {
  if (!navigator.onLine) throw new Error("Offline. Cannot schedule match.");
  
  let formattedStartTime = null;
  if (startTime) {
    try {
      formattedStartTime = new Date(startTime).toISOString();
    } catch (e) {
      formattedStartTime = startTime;
    }
  }

  const { data, error } = await supabase
    .from('tournament_matches')
    .insert({
      tournament_id: tournamentId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      pitch_number: pitchNumber || null,
      start_time: formattedStartTime,
      status: 'scheduled'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateTournamentMatchScore = async (matchId, homeScore, awayScore) => {
  const { data, error } = await supabase
    .from('tournament_matches')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateTournamentMatchStatus = async (matchId, status) => {
  const { data, error } = await supabase
    .from('tournament_matches')
    .update({ status })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const validatePitchCode = async (code) => {
  if (!navigator.onLine) return { valid: false, error: 'Offline. Cannot validate Pitch Code.' };
  
  try {
    const cleanedCode = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from('tournament_scorer_seats')
      .select(`
        *,
        tournament_matches (
          *,
          home_team:tournament_teams!home_team_id(*),
          away_team:tournament_teams!away_team_id(*),
          tournament:tournaments(*)
        )
      `)
      .eq('pitch_code', cleanedCode)
      .eq('active', true)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Invalid or inactive Pitch Code. Please check with the organizer.' };
    }
    return { valid: true, seat: data };
  } catch (err) {
    return { valid: false, error: err.message || 'Validation failed.' };
  }
};

export const createTournamentScorerSeat = async (tournamentId, matchId, pitchCode) => {
  if (!navigator.onLine) throw new Error("Offline. Cannot provision scorer seat.");
  const { data, error } = await supabase
    .from('tournament_scorer_seats')
    .insert({
      tournament_id: tournamentId,
      match_id: matchId,
      pitch_code: pitchCode.trim().toUpperCase(),
      active: true
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deactivateTournamentScorerSeat = async (seatId) => {
  const { error } = await supabase
    .from('tournament_scorer_seats')
    .update({ active: false })
    .eq('id', seatId);
  if (error) throw error;
  return true;
};

export const updatePlayerGenderDesignation = async (playerId, genderDesignation) => {
  if (!navigator.onLine) throw new Error("Offline. Cannot save player settings.");
  const { data, error } = await supabase
    .from('players')
    .update({ gender_designation: genderDesignation || null })
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

// --- Dynamic Drill Definitions API helpers for Trainings Mode ---

export const fetchDrills = async (teamId) => {
  if (!navigator.onLine) {
    // If offline, return empty list or fallback to default templates in context
    return [];
  }
  
  // Select approved global drills OR drills created by/for the user's specific team
  const { data, error } = await supabase
    .from('drill_definitions')
    .select('*')
    .or(`team_id.is.null,team_id.eq.${teamId}`)
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const insertDrill = async (drillData) => {
  if (!navigator.onLine) throw new Error("Offline. Cannot create drills.");
  
  const { data, error } = await supabase
    .from('drill_definitions')
    .insert({
      team_id: drillData.teamId,
      created_by: drillData.createdBy,
      name: drillData.name,
      description: drillData.description,
      category: drillData.category,
      flow_type: drillData.flowType || 'continuous',
      metrics: drillData.metrics,
      is_public: drillData.isPublic || false,
      status: drillData.isPublic ? 'pending' : 'approved'
    })
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

export const fetchPendingDrills = async () => {
  if (!navigator.onLine) return [];
  const { data, error } = await supabase
    .from('drill_definitions')
    .select('*, teams:team_id(name)')
    .eq('is_public', true)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const updateDrillStatus = async (drillId, status) => {
  if (!navigator.onLine) throw new Error("Offline. Cannot update drill status.");
  const { data, error } = await supabase
    .from('drill_definitions')
    .update({ status })
    .eq('id', drillId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
};

