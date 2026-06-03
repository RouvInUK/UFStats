-- Migration v30: Trainings Mode Admin Add-On Gating
-- 1. Extend profiles table with beta_trainings_tier flag
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS beta_trainings_tier BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN public.profiles.beta_trainings_tier IS 'Flag denoting access to the private Trainings Desk features';

-- 2. Upgrade profiles tamper protection trigger to protect beta_trainings_tier column
CREATE OR REPLACE FUNCTION public.protect_profile_tier_tampering() 
RETURNS TRIGGER AS $$
DECLARE
    caller_is_admin BOOLEAN := FALSE;
BEGIN
    -- 1. Grant authorization to system service roles (e.g. Edge functions, auth hooks)
    IF (auth.role() = 'service_role') THEN
        caller_is_admin := TRUE;
    ELSE
        -- 2. Inspect if the logged-in caller is an active System Administrator in profiles
        SELECT is_system_admin INTO caller_is_admin 
        FROM public.profiles 
        WHERE id = auth.uid();
    END IF;

    -- 3. If the caller is NOT a system admin (or service role), revert updates to restricted columns
    IF (caller_is_admin = FALSE OR caller_is_admin IS NULL) THEN
        NEW.tier := OLD.tier;
        NEW.pro_expires_at := OLD.pro_expires_at;
        NEW.is_system_admin := OLD.is_system_admin;
        NEW.beta_voice_pro := OLD.beta_voice_pro;
        NEW.is_test_account := OLD.is_test_account;
        NEW.beta_tournament_tier := OLD.beta_tournament_tier;
        NEW.beta_trainings_tier := OLD.beta_trainings_tier; -- Protect Trainings Beta column
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
