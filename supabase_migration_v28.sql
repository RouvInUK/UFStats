-- Migration v28: Clean up legacy DEBUG_LOG rows from stats table
-- These rows were generated during the development and testing of the huck upgrade pipeline and telemetry features.

DELETE FROM public.stats
WHERE game_name = 'DEBUG_LOG' OR stat_type = 'Log';
