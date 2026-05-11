import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) console.error(error);
  else console.log(data);
}
check();
