import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  const { data: seats, error } = await supabase
    .from('tournament_scorer_seats')
    .select('*');
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Seats in database:", seats);
  }
}
inspect();
