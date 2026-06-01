import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  const { data: stats, error } = await supabase
    .from('stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching stats:", error);
    return;
  }

  console.log("--- LATEST 50 STATS ---");
  stats.forEach(s => {
    console.log(`ID: ${s.id} | Game: ${s.game_name} | Player: ${s.player} | Type: ${s.stat_type} | Details: ${JSON.stringify(s.details)} | CreatedAt: ${s.created_at}`);
  });
}

inspect();
