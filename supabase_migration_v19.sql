-- Migration v19: Add is_test_account Flag with write protection and auto-signup triggers

-- 1. Alter profiles table to add is_test_account column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Upgrade protect_profile_tier_tampering trigger function to prevent client-side overrides
CREATE OR REPLACE FUNCTION public.protect_profile_tier_tampering() 
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the update is being made by a regular client (non-system admin)
    -- We verify this by inspecting the system admin flag of the OLD record
    IF (OLD.is_system_admin = FALSE) THEN
        -- Securely revert any client-side attempts to elevate their own privileges
        NEW.tier := OLD.tier;
        NEW.pro_expires_at := OLD.pro_expires_at;
        NEW.is_system_admin := OLD.is_system_admin;
        NEW.beta_voice_pro := OLD.beta_voice_pro;
        NEW.is_test_account := OLD.is_test_account;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind the tamper protection trigger
DROP TRIGGER IF EXISTS tr_protect_profile_tier_tampering ON public.profiles;
CREATE TRIGGER tr_protect_profile_tier_tampering
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_tier_tampering();

COMMENT ON FUNCTION public.protect_profile_tier_tampering IS 'Prevents standard non-admin users from updating their own tier, promo expiration, voice beta, test status, or admin status directly from client-side JS.';

-- 3. Upgrade public.handle_new_user() trigger function to automatically flag testing email domains
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    is_test BOOLEAN := FALSE;
BEGIN
    -- Check if the new user's email belongs to a designated testing domain
    IF (NEW.email LIKE '%@ufstats-test.com' OR NEW.email LIKE '%@test.com' OR NEW.email LIKE '%@qa.local') THEN
        is_test := TRUE;
    END IF;

    INSERT INTO public.profiles (id, email, is_system_admin, tier, pro_expires_at, is_test_account)
    VALUES (NEW.id, NEW.email, FALSE, 'FREE', NOW() + INTERVAL '7 days', is_test);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function to automatically create a new user profile on signup, grant a 7-day free trial of Coach Pro, and automatically identify test accounts.';
