import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testRLS() {
  console.log("Testing stats RLS insert anonymously...");
  const mockStat = {
    player: 'TestPlayer',
    stat_type: 'Pass',
    point_number: 1,
    game_name: 'tournament_match_cf704779-2a58-4b04-8a6d-63bba69eb13d',
    game_type: 'beach',
    team_name: 'Team Rain',
    team_id: 'e69c117b-d72b-426b-81d3-469b769f33b1',
    details: { pitch_code: 'P1-CF70' }
  };

  const { data, error } = await supabase
    .from('stats')
    .insert(mockStat)
    .select();

  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded!", data);
    // Cleanup
    const { error: delErr } = await supabase
      .from('stats')
      .delete()
      .eq('id', data[0].id);
    console.log("Cleanup delete error:", delErr);
  }
}
testRLS();
