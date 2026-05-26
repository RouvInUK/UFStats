import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPAL_API_URL = Deno.env.get("PAYPAL_MODE") === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time",
      }
    });
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // 1. Retrieve PayPal cryptographic verification headers
    const authAlgo = req.headers.get("paypal-auth-algo");
    const certUrl = req.headers.get("paypal-cert-url");
    const transmissionId = req.headers.get("paypal-transmission-id");
    const transmissionSig = req.headers.get("paypal-transmission-sig");
    const transmissionTime = req.headers.get("paypal-transmission-time");
    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID") ?? "";

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      console.warn("PayPal Webhook signature headers missing. Proceeding with caution (Sandbox bypass available).");
    } else {
      // 2. Obtain PayPal Access Token to verify signature
      const clientId = Deno.env.get("PAYPAL_CLIENT_ID") ?? "";
      const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "";
      
      const authRes = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Language": "en_US",
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials"
      });
      const authData = await authRes.json();
      const accessToken = authData.access_token;

      // 3. Request PayPal to verify the signature
      const verifyRes = await fetch(`${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: payload
        })
      });
      const verifyData = await verifyRes.json();
      
      if (verifyData.verification_status !== "SUCCESS") {
        console.error("PayPal webhook signature verification failed!", verifyData);
        return new Response("Invalid signature", { status: 401 });
      }
      console.log("PayPal webhook signature verified successfully!");
    }

    // 4. Decode payload and process the event
    const eventType = payload.event_type;
    const resource = payload.resource;
    
    // In PayPal subscription webhooks, the user's ID is passed as custom_id
    const userId = resource.custom_id;
    const subscriptionId = resource.id;
    const status = resource.status;

    if (!userId) {
      console.warn("PayPal Webhook: Event received without user custom_id. Exiting.", eventType);
      return new Response("No user ID found in event", { status: 200 });
    }

    // 5. Initialize Supabase Admin client with service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Processing Webhook: ${eventType} for User: ${userId}, Subscription: ${subscriptionId}`);

    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "BILLING.SUBSCRIPTION.RENEWED") {
      // Determine subscription period (monthly or yearly) based on plan metadata if available
      const planId = resource.plan_id;
      const isYearly = planId && planId.includes("YEARLY");
      const period = isYearly ? "yearly" : "monthly";

      const { error } = await supabase
        .from("profiles")
        .update({
          tier: "PRO",
          paypal_subscription_id: subscriptionId,
          subscription_status: "active",
          subscription_period: period
        })
        .eq("id", userId);

      if (error) throw error;
      console.log(`User ${userId} successfully upgraded to PRO via Webhook.`);

    } else if (
      eventType === "BILLING.SUBSCRIPTION.CANCELLED" || 
      eventType === "BILLING.SUBSCRIPTION.EXPIRED" ||
      eventType === "BILLING.SUBSCRIPTION.SUSPENDED" ||
      eventType === "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
    ) {
      const { error } = await supabase
        .from("profiles")
        .update({
          tier: "FREE",
          paypal_subscription_id: null,
          subscription_status: status.toLowerCase(),
          subscription_period: null
        })
        .eq("id", userId);

      if (error) throw error;
      console.log(`User ${userId} subscription status updated to ${status}. Tier reset to FREE.`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Edge Function Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
