import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectClubGame() {
  const { data: stats, error } = await supabase
    .from('stats')
    .select('id, game_name, player, stat_type, team_id, team_name, details')
    .eq('game_name', 'Test Game after intro of Tournament Mode')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Error fetching stats:", error);
    return;
  }

  console.log("--- STATS FOR Test Game after intro of Tournament Mode ---");
  stats.forEach(s => {
    console.log(`ID: ${s.id} | Player: ${s.player} | Type: ${s.stat_type} | TeamID: ${s.team_id} | TeamName: ${s.team_name} | Huck: ${s.details?.is_huck}`);
  });
}

inspectClubGame();
