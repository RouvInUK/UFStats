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

export const fetchPlayers = async (teamIdentifier) => {
  let query = supabase.from('players').select('*').order('name', { ascending: true });
  
  if (teamIdentifier) {
    // Check if it's a UUID (team_id) or a team_name string
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

export const addPlayer = async (name, teamName, currentTeamId) => {
  const { data, error } = await supabase
    .from('players')
    .insert([{ 
      name, 
      is_active: false, 
      team_name: teamName || 'Default Team', 
      team_id: currentTeamId 
    }])
    .select();

  if (error) {
    console.error("Supabase Insert Error:", error);
    throw error;
  }
  return data[0];
};

export const removePlayer = async (id) => {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const togglePlayerActiveStatus = async (id, currentStatus) => {
  const { data, error } = await supabase
    .from('players')
    .update({ is_active: !currentStatus })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
};

export const clearActiveLineup = async (teamName) => {
  let query = supabase.from('players').update({ is_active: false }).eq('is_active', true);
  if (teamName) {
    if (teamName === 'Default Team') {
      query = query.or('team_name.eq.Default Team,team_name.is.null');
    } else {
      query = query.eq('team_name', teamName);
    }
  }
  const { error } = await query;

  if (error) throw error;
};

export const fetchStats = async () => {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .limit(100000)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchAllGameNames = async (teamName) => {
  let query = supabase
    .from('stats')
    .select('game_name')
    .limit(100000);

  if (teamName) {
    if (teamName === 'Default Team') {
      query = query.or('team_name.eq.Default Team,team_name.is.null');
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
  // We only need a few columns to derive active games
  let query = supabase
    .from('stats')
    .select('game_name, stat_type, point_number')
    .limit(100000);

  if (teamName) {
    if (teamName === 'Default Team') {
      query = query.or('team_name.eq.Default Team,team_name.is.null');
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

export const fetchGameStats = async (gameNames) => {
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

  if (error) throw error;
};

export const fetchLastStatForGame = async (gameName, teamName) => {
  let query = supabase
    .from('stats')
    .select('*')
    .eq('game_name', gameName)
    .neq('stat_type', 'Lineup')
    .order('created_at', { ascending: false })
    .limit(1);

  if (teamName && teamName !== 'Default Team') {
    query = query.eq('team_name', teamName);
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
  let query = supabase
    .from('stats')
    .select('player')
    .eq('game_name', gameName)
    .eq('point_number', pointNumber)
    .eq('stat_type', 'Lineup');

  if (teamName && teamName !== 'Default Team') {
    query = query.eq('team_name', teamName);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) return [];

  const activePlayers = data.map(d => d.player);

  let updateQuery = supabase.from('players').update({ is_active: true }).in('name', activePlayers);
  if (teamName && teamName !== 'Default Team') {
    updateQuery = updateQuery.eq('team_name', teamName);
  }

  await updateQuery;

  return activePlayers;
};
