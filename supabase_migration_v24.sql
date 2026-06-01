-- Migration v24: Add game_type column and grant stats write permissions to anon
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS game_type VARCHAR(50) DEFAULT 'grass';

COMMENT ON COLUMN public.tournaments.game_type IS 'Game format: grass (7v7), beach (5v5), or indoor (5v5)';

-- Grant table-level write permissions on stats to the anon role to enable anonymous volunteer scorer entries
GRANT INSERT, UPDATE, DELETE ON public.stats TO anon;
