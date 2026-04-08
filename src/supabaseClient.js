import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const recordStatToDB = async (statData) => {
  const { player, stat, pointNumber, gameName } = statData;
  
  const { data, error } = await supabase
    .from('stats')
    .insert([
      { 
        player: player, 
        stat_type: stat, 
        point_number: pointNumber,
        game_name: gameName || 'Unnamed Game'
      }
    ]);

  if (error) {
    throw error;
  }
  return data;
};

// --- Roster & Lineup API Helpers ---

export const fetchPlayers = async () => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('name', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const addPlayer = async (name) => {
  const { data, error } = await supabase
    .from('players')
    .insert([{ name, is_active: false }])
    .select();
    
  if (error) throw error;
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

export const fetchStats = async () => {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .order('created_at', { ascending: true });
    
  if (error) throw error;
  return data || [];
};

export const fetchActiveGames = async () => {
  // We only need a few columns to derive active games
  const { data, error } = await supabase
    .from('stats')
    .select('game_name, stat_type, point_number');
    
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
    .filter(([name, info]) => !info.isCompleted)
    .map(([name, info]) => ({ 
      name, 
      maxPoint: info.maxPointHasGoal ? info.maxPoint + 1 : info.maxPoint 
    }));
};

export const fetchGameStats = async (gameName) => {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .eq('game_name', gameName)
    .order('created_at', { ascending: false });
    
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
