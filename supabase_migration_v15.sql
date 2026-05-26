-- Migration v15: Secure Profiles Column-Level Write Access (Tamper Protection)

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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the tamper protection trigger to the profiles table
DROP TRIGGER IF EXISTS tr_protect_profile_tier_tampering ON public.profiles;
CREATE TRIGGER tr_protect_profile_tier_tampering
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_tier_tampering();

COMMENT ON FUNCTION public.protect_profile_tier_tampering IS 'Prevents standard non-admin users from updating their own tier, promo expiration, voice beta, or admin status directly from client-side JS.';
