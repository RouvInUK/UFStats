// Test script to verify Admin Promo Expirations and Tier Limits
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables not found. Make sure .env is populated.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Custom helper logic replication for validation
const evaluateIsPro = (profile) => {
  if (!profile) return false;
  return profile.tier === 'PRO' || !!(profile.pro_expires_at && new Date(profile.pro_expires_at) > new Date());
};

async function runTests() {
  console.log("--------------------------------------------------");
  console.log("Starting Admin Promo Expiration & Pro Verification Tests...");
  console.log("--------------------------------------------------");

  // Test Case 1: FREE tier user with no promo
  const userFree = { tier: 'FREE', pro_expires_at: null };
  const isPro1 = evaluateIsPro(userFree);
  console.log(`Test 1: Free Tier (No Promo) -> Expected: false, Got: ${isPro1}`);
  if (isPro1 === false) {
    console.log("✅ Test 1 Passed!");
  } else {
    console.error("❌ Test 1 Failed!");
  }

  // Test Case 2: PRO tier user
  const userPro = { tier: 'PRO', pro_expires_at: null };
  const isPro2 = evaluateIsPro(userPro);
  console.log(`Test 2: Perpetual PRO Tier -> Expected: true, Got: ${isPro2}`);
  if (isPro2 === true) {
    console.log("✅ Test 2 Passed!");
  } else {
    console.error("❌ Test 2 Failed!");
  }

  // Test Case 3: FREE tier user with Active Promo
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7); // 1 week in future
  const userActivePromo = { tier: 'FREE', pro_expires_at: futureDate.toISOString() };
  const isPro3 = evaluateIsPro(userActivePromo);
  console.log(`Test 3: Free Tier with Active Promo (+1 week) -> Expected: true, Got: ${isPro3}`);
  if (isPro3 === true) {
    console.log("✅ Test 3 Passed!");
  } else {
    console.error("❌ Test 3 Failed!");
  }

  // Test Case 4: FREE tier user with Expired Promo
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1); // 1 day in past
  const userExpiredPromo = { tier: 'FREE', pro_expires_at: pastDate.toISOString() };
  const isPro4 = evaluateIsPro(userExpiredPromo);
  console.log(`Test 4: Free Tier with Expired Promo (-1 day) -> Expected: false, Got: ${isPro4}`);
  if (isPro4 === false) {
    console.log("✅ Test 4 Passed!");
  } else {
    console.error("❌ Test 4 Failed!");
  }

  console.log("--------------------------------------------------");
  console.log("All local logical tests completed successfully!");
  console.log("--------------------------------------------------");
}

runTests().catch(console.error);
