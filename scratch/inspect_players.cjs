const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Querying players for South Circular in players table...");

  const { data: players, error: pErr } = await supabase
    .from('players')
    .select('*')
    .or("team_id.eq.b2e5d668-35c2-4a5e-9a73-dbb01bcc8ea5,team_id.eq.47606d63-877c-4c3f-950e-e05d4a52078f");

  if (pErr) {
    console.error("Error fetching players:", pErr);
  } else {
    console.log(`Found ${players?.length || 0} orphaned players:`, players);
  }
}

run();
