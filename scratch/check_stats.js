const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Querying stats in Supabase...");
  
  // 1. Query distinct team names in stats
  const { data: teamNames, error: teamErr } = await supabase
    .from('stats')
    .select('team_name')
    .order('team_name');
  
  if (teamErr) {
    console.error("Error fetching team names:", teamErr);
  } else {
    const distinctTeams = [...new Set((teamNames || []).map(t => t.team_name))];
    console.log("Distinct team names in stats:", distinctTeams);
  }

  // 2. Query stats for 'South Circular'
  const { data: southCircularStats, error: scErr } = await supabase
    .from('stats')
    .select('id, game_name, point_number, stat_type, player, team_name, team_id, created_at')
    .ilike('team_name', '%South Circular%')
    .order('created_at', { ascending: false });

  if (scErr) {
    console.error("Error fetching South Circular stats:", scErr);
  } else {
    console.log(`Found ${southCircularStats?.length || 0} stats for South Circular`);
    if (southCircularStats && southCircularStats.length > 0) {
      const distinctGames = [...new Set(southCircularStats.map(s => s.game_name))];
      console.log("Games logged for South Circular:", distinctGames);
      console.log("First 5 stats:", southCircularStats.slice(0, 5));
    }
  }

  // 3. Query stats logged by any user over the weekend
  const { data: weekendStats, error: wkErr } = await supabase
    .from('stats')
    .select('id, game_name, point_number, stat_type, player, team_name, team_id, created_at')
    .gte('created_at', '2026-05-29T00:00:00Z')
    .order('created_at', { ascending: false });

  if (wkErr) {
    console.error("Error fetching weekend stats:", wkErr);
  } else {
    console.log(`Found ${weekendStats?.length || 0} stats logged since Friday May 29`);
    const distinctWeekendTeams = [...new Set((weekendStats || []).map(t => t.team_name))];
    console.log("Distinct team names logged over weekend:", distinctWeekendTeams);
    const distinctWeekendGames = [...new Set((weekendStats || []).map(t => t.game_name))];
    console.log("Distinct game names logged over weekend:", distinctWeekendGames);
  }
}

run();
