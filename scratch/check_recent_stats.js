import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${data.length} recent stats rows in database:`);
    data.forEach(s => {
      console.log(`[${s.created_at}] Game: ${s.game_name} | Player: ${s.player} | Stat: ${s.stat_type} | Details:`, s.details);
    });
  }
}
check();
