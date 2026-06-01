const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Querying all distinct team_ids for South Circular in stats...");

  const { data: stats, error: sErr } = await supabase
    .from('stats')
    .select('team_id, team_name, created_at')
    .ilike('team_name', '%South Circular%');

  if (sErr) {
    console.error("Error fetching stats:", sErr);
    return;
  }

  const map = new Map();
  for (const row of stats) {
    const key = `${row.team_id} | ${row.team_name.trim()}`;
    if (!map.has(key)) {
      map.set(key, { count: 0, latest: row.created_at });
    }
    const val = map.get(key);
    val.count++;
    if (new Date(row.created_at) > new Date(val.latest)) {
      val.latest = row.created_at;
    }
  }

  console.log("Distinct team_id and team_name pairs in stats:");
  for (const [key, val] of map.entries()) {
    console.log(`- ${key}: ${val.count} rows, latest created at ${val.latest}`);
  }
}

run();
