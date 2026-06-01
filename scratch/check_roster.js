import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', '24b6e81e-f4fe-471b-818c-c7a7cb6e4bcd');
  
  if (error) {
    console.error(error);
  } else {
    console.log("Roster for Team Rain:");
    console.log(data.map(p => ({ id: p.id, name: p.name })));
  }
}
check();
