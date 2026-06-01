import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectProfiles() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*');

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("--- PROFILES IN DATABASE ---");
  profiles.forEach(p => {
    console.log(`ID: ${p.id} | Email: ${p.email} | Tier: ${p.tier} | Pro Expires At: ${p.pro_expires_at} | Admin: ${p.is_system_admin}`);
  });
}

inspectProfiles();
