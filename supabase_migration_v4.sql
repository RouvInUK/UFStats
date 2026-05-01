-- 1. Wipe database to start fresh
TRUNCATE TABLE public.stats CASCADE;
TRUNCATE TABLE public.players CASCADE;

-- 2. Add shirt_number to players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS shirt_number TEXT DEFAULT NULL;

-- 3. Create unique constraint on team_id + shirt_number
-- Using a partial index so that multiple NULL shirt_numbers are allowed, but actual numbers are unique per team.
-- Alternatively, if we just use a standard constraint with NULL, Postgres allows multiple NULLs by default.
CREATE UNIQUE INDEX IF NOT EXISTS players_team_id_shirt_number_idx 
ON public.players (team_id, shirt_number) 
WHERE shirt_number IS NOT NULL;
