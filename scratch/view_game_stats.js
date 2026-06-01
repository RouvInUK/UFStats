import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .eq('game_name', 'tournament_match_cf704779-2a58-4b04-8a6d-63bba69eb13d')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${data.length} stats rows for this game.`);
    const gameplay = data.filter(s => s.stat_type !== 'Lineup');
    console.log("Gameplay events:");
    gameplay.forEach(s => {
      console.log(`P${s.point_number} - [${s.stat_type}] by ${s.player} (${s.team_name}) - details:`, s.details);
    });
  }
}
check();
