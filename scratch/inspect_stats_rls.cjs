const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Simulating CoachDashboard data fetching...");

  const teamName = "South Circular";
  const teamId = "47606d63-877c-4c3f-950e-e05d4a52078f";

  // 1. fetchAllGameNames
  console.log(`\nCalling fetchAllGameNames for '${teamName}'...`);
  const { data: gameNamesData, error: gnErr } = await supabase
    .from('stats')
    .select('game_name')
    .eq('team_name', teamName);

  if (gnErr) {
    console.error("Error in fetchAllGameNames:", gnErr);
  } else {
    console.log(`fetchAllGameNames found ${gameNamesData?.length || 0} rows.`);
    const distinctGames = [...new Set((gameNamesData || []).map(s => s.game_name))].filter(Boolean);
    console.log("Distinct game names:", distinctGames);
  }

  // 2. fetchGameStats for one of the games
  const testGames = ['Beach Nationals Game 7'];
  console.log(`\nCalling fetchGameStats for game ${testGames} and team ID ${teamId}...`);
  const { data: statsData, error: sErr } = await supabase
    .from('stats')
    .select('*')
    .in('game_name', testGames)
    .eq('team_id', teamId);

  if (sErr) {
    console.error("Error in fetchGameStats:", sErr);
  } else {
    console.log(`fetchGameStats found ${statsData?.length || 0} rows.`);
    if (statsData && statsData.length > 0) {
      console.log("First stat details:", statsData[0]);
    }
  }
}

run();
