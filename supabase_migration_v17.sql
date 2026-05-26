-- Migration v17: Cascade Delete support for used Beta Keys

-- 1. Drop the restrictive foreign key constraint
ALTER TABLE public.beta_keys 
DROP CONSTRAINT IF EXISTS beta_keys_used_by_fkey;

-- 2. Re-add the constraint with ON DELETE CASCADE to allow seamless user deletion
ALTER TABLE public.beta_keys 
ADD CONSTRAINT beta_keys_used_by_fkey 
FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT beta_keys_used_by_fkey ON public.beta_keys IS 'Allows cascading deletion of beta key usage logs when the corresponding auth user is deleted.';
