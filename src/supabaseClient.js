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
