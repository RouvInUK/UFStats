-- Migration v26: Drop foreign key constraint on stats.team_id to enable tournament player stats
ALTER TABLE public.stats DROP CONSTRAINT IF EXISTS stats_team_id_fkey;

COMMENT ON COLUMN public.stats.team_id IS 'UUID referencing either public.teams(id) for standard club matches or public.tournament_teams(id) for tournament matches';
