const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Inspecting exact team_names in stats table...");
  
  const { data: stats, error: sErr } = await supabase
    .from('stats')
    .select('team_name, game_name')
    .ilike('team_name', '%South Circular%')
    .limit(10);

  if (sErr) {
    console.error(sErr);
    return;
  }

  console.log("Sample stats team names and game names:");
  for (const row of stats) {
    console.log(`- team_name: [${row.team_name}], game_name: [${row.game_name}]`);
  }
}

run();
