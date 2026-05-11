-- =======================================================================================
-- MIGRATION V5: ADD DETAILS TO STATS FOR COMPLEX EVENTS (LIKE PULL TRACKING)
-- =======================================================================================

ALTER TABLE public.stats ADD COLUMN IF NOT EXISTS details JSONB;
