const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Querying teams in Supabase...");
  
  // 1. Query teams for 'South Circular'
  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('*')
    .ilike('name', '%South Circular%');

  if (tErr) {
    console.error("Error fetching teams:", tErr);
  } else {
    console.log(`Found ${teams?.length || 0} teams matching 'South Circular':`, teams);
  }

  // 2. Query team with ID '47606d63-877c-4c3f-950e-e05d4a52078f'
  const { data: teamById, error: tbErr } = await supabase
    .from('teams')
    .select('*')
    .eq('id', '47606d63-877c-4c3f-950e-e05d4a52078f');

  if (tbErr) {
    console.error("Error fetching team by ID:", tbErr);
  } else {
    console.log(`Found team with ID '47606d63-877c-4c3f-950e-e05d4a52078f':`, teamById);
  }
}

run();
