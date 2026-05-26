-- Migration v18: Set 7-day Free Coach Pro Trial on Signup

-- Alter the handle_new_user() trigger function to default pro_expires_at to 7 days in the future
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, is_system_admin, tier, pro_expires_at)
    VALUES (NEW.id, NEW.email, FALSE, 'FREE', NOW() + INTERVAL '7 days');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function to automatically create a new user profile on signup and grant a 7-day free trial of Coach Pro.';
