import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectClubTimestamps() {
  const { data: stats, error } = await supabase
    .from('stats')
    .select('id, player, stat_type, created_at')
    .eq('game_name', 'Test Game after intro of Tournament Mode')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Error fetching stats:", error);
    return;
  }

  console.log("--- TIMESTAMPS FOR Test Game after intro of Tournament Mode ---");
  stats.forEach((s, i) => {
    console.log(`Index: ${i} | ID: ${s.id} | Player: ${s.player} | Type: ${s.stat_type} | CreatedAt: ${s.created_at} | MS: ${new Date(s.created_at).getTime()}`);
  });
}

inspectClubTimestamps();
