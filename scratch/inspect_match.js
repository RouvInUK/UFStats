import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  console.log("Checking active matches...");
  const { data: matches, error: mErr } = await supabase
    .from('tournament_matches')
    .select('id, status, home_score, away_score, home_team:home_team_id(team_name), away_team:away_team_id(team_name)');
  
  if (mErr) {
    console.error("Matches error:", mErr);
  } else {
    console.log("Matches:", matches);
  }

  console.log("\nChecking active scorer seats...");
  const { data: seats, error: sErr } = await supabase
    .from('tournament_scorer_seats')
    .select('*');

  if (sErr) {
    console.error("Seats error:", sErr);
  } else {
    console.log("Seats:", seats);
  }
}
inspect();
