const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://rktfovbzhqehqjulmwuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdGZvdmJ6aHFlaHFqdWxtd3VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTE2NDQsImV4cCI6MjA5MDE2NzY0NH0.HwG5BV_HUT4PrfvPPeOwLo1e_68VpNNgR1Q-SQ3vrtU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Querying profiles, clubs and teams in Supabase...");

  // 1. Fetch profiles matching the emails
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .or("email.eq.katjaulbrich@gmail.com,email.eq.rouve@ustats.pro");

  if (pErr) {
    console.error("Error fetching profiles:", pErr);
  } else {
    console.log("Found profiles:", profiles);
  }

  // 2. Fetch all teams to see if there is any team matching 'South Circular' or owned by these users
  const userIds = (profiles || []).map(p => p.id);
  
  if (userIds.length > 0) {
    const { data: teams, error: tErr } = await supabase
      .from('teams')
      .select('*')
      .in('owner_id', userIds);

    if (tErr) {
      console.error("Error fetching teams for users:", tErr);
    } else {
      console.log("Teams currently owned by these users:", teams);
    }
  }

  // 3. Fetch all clubs owned by these users
  if (userIds.length > 0) {
    const { data: clubs, error: cErr } = await supabase
      .from('clubs')
      .select('*')
      .in('owner_id', userIds);

    if (cErr) {
      console.error("Error fetching clubs for users:", cErr);
    } else {
      console.log("Clubs owned by these users:", clubs);
    }
  }
}

run();
