-- Migration v14: Add PayPal Subscriptions and Admin Promo Expiration Support

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR,
ADD COLUMN IF NOT EXISTS subscription_period VARCHAR,
ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment to explain columns
COMMENT ON COLUMN public.profiles.paypal_subscription_id IS 'Unique identifier for user PayPal subscriptions';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Status of active PayPal subscription (e.g., active, cancelled, suspended)';
COMMENT ON COLUMN public.profiles.subscription_period IS 'Billing period for PayPal subscription (monthly, yearly)';
COMMENT ON COLUMN public.profiles.pro_expires_at IS 'Expiration date for time-limited admin-granted Coach Pro promotions or free trials';
