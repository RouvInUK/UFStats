-- Migration v16: Secure User Deletion by System Admins

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_caller_admin BOOLEAN;
BEGIN
    -- 1. Verify if the calling user is an authorized System Administrator
    SELECT COALESCE(is_system_admin, FALSE) 
    INTO is_caller_admin 
    FROM public.profiles 
    WHERE id = auth.uid();

    IF is_caller_admin = FALSE THEN
        RAISE EXCEPTION 'Access Denied: Only global System Administrators can delete users.';
    END IF;

    -- 2. Execute the user deletion from auth.users (triggers cascading deletes to public tables)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.delete_user_by_admin IS 'Allows system admins to securely delete a user from auth.users, cascading to wipe all profiles, clubs, teams, and stats cleanly.';
