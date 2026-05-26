// Local PayPal Webhook Simulator for Testing Database State Transitions
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase environment variables not found.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function simulateWebhook(eventType, userId, subscriptionId = 'SUB-MOCK-12345') {
  console.log(`\n[Simulating Webhook Event: ${eventType}]`);
  console.log(`Targeting User: ${userId}`);

  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        tier: 'PRO',
        paypal_subscription_id: subscriptionId,
        subscription_status: 'active',
        subscription_period: 'monthly'
      })
      .eq('id', userId)
      .select();

    if (error) {
      console.error("❌ Failed to update subscription status:", error.message);
    } else {
      console.log("✅ Webhook Simulated successfully: User Tier set to PRO!");
      console.log("Updated Profile details:", data[0]);
    }
  } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED') {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        tier: 'FREE',
        paypal_subscription_id: null,
        subscription_status: 'cancelled',
        subscription_period: null
      })
      .eq('id', userId)
      .select();

    if (error) {
      console.error("❌ Failed to clear subscription status:", error.message);
    } else {
      console.log("✅ Webhook Simulated successfully: User Tier demoted to FREE!");
      console.log("Updated Profile details:", data[0]);
    }
  }
}

// To run this simulator, provide a test User UUID as an argument:
// node scratch/simulate_paypal_webhook.js <USER_UUID>
const args = process.argv.slice(2);
const testUserUuid = args[0];

if (!testUserUuid) {
  console.log("Usage guide: node scratch/simulate_paypal_webhook.js <USER_UUID>");
  console.log("Please provide a valid test user ID from your Supabase profiles table to execute this.");
} else {
  // Run sandbox updates sequentially for testing
  (async () => {
    await simulateWebhook('BILLING.SUBSCRIPTION.ACTIVATED', testUserUuid);
    await new Promise(r => setTimeout(r, 2000));
    await simulateWebhook('BILLING.SUBSCRIPTION.CANCELLED', testUserUuid);
  })();
}
