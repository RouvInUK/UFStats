-- Migration v22: Add disable_club_track to profiles table

-- 1. Add disable_club_track column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS disable_club_track BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN public.profiles.disable_club_track IS 'Flag to turn off standard Club Track mode features for a tournament-only user';

-- 2. Upgrade profiles tamper protection trigger to protect disable_club_track column
CREATE OR REPLACE FUNCTION public.protect_profile_tier_tampering() 
RETURNS TRIGGER AS $$
DECLARE
    caller_is_admin BOOLEAN := FALSE;
BEGIN
    -- 1. Grant authorization to system service roles (e.g. PayPal webhooks, edge functions)
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
        NEW.disable_club_track := OLD.disable_club_track;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
