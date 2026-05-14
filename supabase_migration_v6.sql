-- =======================================================================================
-- MIGRATION V6: ALLOW SYSTEM ADMINS TO UPDATE PROFILES (BUG-001 FIX)
-- =======================================================================================

-- Currently, the public.profiles table only allows users to update their own profile:
-- CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- This blocks System Admins from updating the `tier` column for other users in the Admin Dashboard.

-- Add a new policy allowing System Admins to update any profile
CREATE POLICY "System Admins can update any profile" ON public.profiles
FOR UPDATE 
USING (
    (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
);
