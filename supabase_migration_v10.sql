-- =======================================================================================
-- MIGRATION V10: EXPLICITLY GRANT SELECT ON STATS FOR ANON TO ALLOW PUBLIC SPECTATOR
-- =======================================================================================

DO $$
BEGIN
  -- Grant select access to the anon role
  GRANT SELECT ON public.stats TO anon;
  
  -- Create a policy allowing anyone to read stats (if RLS is enabled)
  -- We catch the duplicate object error if the policy already exists
  BEGIN
    CREATE POLICY "Allow public read access to stats" 
    ON public.stats 
    FOR SELECT 
    USING (true);
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'Policy already exists. Skipping.';
  END;
END $$;
