-- =======================================================================================
-- MIGRATION V8: ADD BETA VOICE PRO OVERRIDE
-- =======================================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beta_voice_pro BOOLEAN DEFAULT FALSE;
