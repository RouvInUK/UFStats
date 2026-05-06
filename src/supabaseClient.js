import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const recordStatToDB = async (statData, currentTeamId) => {
  const { player, stat, pointNumber, gameName, gameType, teamName } = statData;

  const { data, error } = await supabase
    .from('stats')
    .insert([
      {
        player: player,
        stat_type: stat,
        point_number: pointNumber,
        game_name: gameName || 'Unnamed Game',
        game_type: gameType || 'grass',
        team_name: teamName || 'Default Team',
        team_id: currentTeamId
      }
    ]);

  if (error) {
    throw error;
  }
  return data;
};

export const recordLineup = async (players, pointNumber, gameName, gameType, teamName, currentTeamId) => {
  if (!players || players.length === 0) return;
  
  const insertData = players.map(player => ({
    player: player,
    stat_type: 'Lineup',
    point_number: pointNumber,
    game_name: gameName || 'Unnamed Game',
    game_type: gameType || 'grass',
    team_name: teamName || 'Default Team',
    team_id: currentTeamId
  }));

  const { data, error } = await supabase
    .from('stats')
    .insert(insertData);

  if (error) {
    throw error;
  }
  return data;
};

// --- Roster & Lineup API Helpers ---

export const fetchAllTeamNames = async () => {
  const { data, error } = await supabase
    .from('players')
    .select('team_name')
    .limit(100000);

  if (error) throw error;
  if (!data) return [];
  
  return [...new Set(data.map(p => p.team_name))].filter(Boolean);
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

export const addPlayerToClub = async (name, clubId, shirtNumber) => {
  const { data, error } = await supabase
    .from('players')
    .insert([{ 
      name, 
      club_id: clubId,
      shirt_number: shirtNumber || null
    }])
    .select();

  if (error) {
    console.error("Supabase Insert Error:", error);
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

export const fetchStats = async (teamIdentifier) => {
  if (!teamIdentifier) return [];
  let query = supabase
    .from('stats')
    .select('*')
    .limit(100000)
    .order('created_at', { ascending: true });

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
  return data || [];
};

export const fetchAllGameNames = async (teamName) => {
  if (!teamName) return [];
  let query = supabase
    .from('stats')
    .select('game_name')
    .limit(100000);

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
  if (!data) return [];
  
  return [...new Set(data.map(s => s.game_name))].filter(Boolean);
};

export const fetchActiveGames = async (teamName) => {
  if (!teamName) return [];
  // We only need a few columns to derive active games
  let query = supabase
    .from('stats')
    .select('game_name, stat_type, point_number')
    .limit(100000);

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
  if (!data) return [];

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
    .filter(([, info]) => !info.isCompleted)
    .map(([name, info]) => ({ 
      name, 
      maxPoint: info.maxPoint
    }));
};

export const fetchGameStats = async (gameNames, teamIdentifier) => {
  if (!teamIdentifier) return [];
  const isArray = Array.isArray(gameNames);
  if (isArray && gameNames.length === 0) return [];

  let query = supabase
    .from('stats')
    .select('*')
    .limit(100000)
    .order('created_at', { ascending: false });

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
  return data || [];
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
  const { error } = await supabase
    .from('stats')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Supabase Delete Error:", error);
    throw error;
  }
};

export const deleteGame = async (gameName, teamId) => {
  const { error } = await supabase
    .from('stats')
    .delete()
    .eq('game_name', gameName)
    .eq('team_id', teamId);

  if (error) {
    console.error("Supabase Delete Game Error:", error);
    throw error;
  }
};

export const updateUserTier = async (userId, tier) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ tier })
    .eq('id', userId)
    .select();

  if (error) throw error;
  return data[0];
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
    .select('tier')
    .eq('id', userId)
    .single();
    
  if (pError) throw pError;
  const isPro = profile.tier === 'PRO';
  
  if (isPro) {
    return { canAddClub: true, canAddTeam: true, isPro: true };
  }
  
  const { count: clubCount, error: cError } = await supabase
    .from('clubs')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
    
  const { count: teamCount, error: tError } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);
    
  if (cError || tError) throw new Error("Failed to check tier limits");
  
  return {
    canAddClub: clubCount < 1,
    canAddTeam: teamCount < 3,
    isPro: false
  };
};

export const createClub = async (name, ownerId) => {
  const limits = await checkTierLimits(ownerId);
  if (!limits.canAddClub) throw new Error("Free Tier Limit Reached: Maximum 1 Club allowed.");
  
  const { data, error } = await supabase
    .from('clubs')
    .insert([{ name, owner_id: ownerId }])
    .select();
    
  if (error) throw error;
  return data[0];
};

export const createTeam = async (name, clubId, ownerId) => {
  const limits = await checkTierLimits(ownerId);
  if (!limits.canAddTeam) throw new Error("Free Tier Limit Reached: Maximum 3 Teams allowed.");
  
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
