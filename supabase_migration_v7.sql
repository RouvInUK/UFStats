-- =======================================================================================
-- MIGRATION V7: FIX BETA KEY CLAIMING WHEN EMAIL CONFIRMATION IS ENABLED
-- =======================================================================================

-- When Email Confirmation is enabled, users are NOT logged in immediately after signing up.
-- Because of this, the frontend attempts to mark the beta key as 'used' while still acting as an Anonymous user.
-- If your beta_keys table has Row Level Security (RLS) enabled, it blocks Anonymous users from updating the table!

-- Enable RLS on beta_keys (if not already enabled)
ALTER TABLE public.beta_keys ENABLE ROW LEVEL SECURITY;

-- 1. Allow System Admins to do everything (CRUD)
DROP POLICY IF EXISTS "System Admins can CRUD beta keys" ON public.beta_keys;
CREATE POLICY "System Admins can CRUD beta keys" ON public.beta_keys 
FOR ALL 
USING (
    (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- 2. Allow ANYONE (including anonymous users) to READ unused beta keys to validate them
DROP POLICY IF EXISTS "Anyone can view unused beta keys" ON public.beta_keys;
CREATE POLICY "Anyone can view unused beta keys" ON public.beta_keys 
FOR SELECT 
USING (is_used = false);

-- 3. Allow ANYONE (including anonymous users) to CLAIM a beta key
-- They can only update it if it is currently unused, and they MUST set it to used.
DROP POLICY IF EXISTS "Anyone can claim unused beta keys" ON public.beta_keys;
CREATE POLICY "Anyone can claim unused beta keys" ON public.beta_keys 
FOR UPDATE 
USING (is_used = false)
WITH CHECK (is_used = true);
