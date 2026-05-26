-- Migration v20: Correct profiles tamper protection trigger to inspect caller permissions

-- Re-define the trigger function to dynamically check caller authority
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
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind the trigger to guarantee updates are applied
DROP TRIGGER IF EXISTS tr_protect_profile_tier_tampering ON public.profiles;
CREATE TRIGGER tr_protect_profile_tier_tampering
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_tier_tampering();

COMMENT ON FUNCTION public.protect_profile_tier_tampering IS 'Prevents standard non-admin users from updating restricted columns, while allowing system admins and service roles full control.';
