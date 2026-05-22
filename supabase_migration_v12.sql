-- Migration to add max_sessions to profiles table for Tier-Based Session Enforcement

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS max_sessions INTEGER DEFAULT 1;

-- Future-proofing: The max_sessions column allows us to define concurrent login limits
-- on a per-user basis. By default, it's 1 for Free and Pro users, but can be scaled 
-- to 5 or Unlimited later for a potential Club Tier.
