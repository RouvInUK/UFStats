-- Migration v27: Open explicit PostgreSQL table-level SELECT grants to anon for public tables

-- 1. Ensure anon and authenticated roles have SELECT access to players and tournament tables
GRANT SELECT ON public.players TO anon, authenticated;
GRANT SELECT ON public.tournament_teams TO anon, authenticated;
GRANT SELECT ON public.tournament_matches TO anon, authenticated;
GRANT SELECT ON public.tournament_scorer_seats TO anon, authenticated;

-- 2. Explicitly grant SELECT along with write privileges to anon for the stats table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stats TO anon, authenticated;
