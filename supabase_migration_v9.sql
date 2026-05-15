-- =======================================================================================
-- MIGRATION V9: ENABLE REALTIME FOR SPECTATOR MODE
-- =======================================================================================

-- Enable realtime for the stats table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'stats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stats;
  END IF;
END $$;
