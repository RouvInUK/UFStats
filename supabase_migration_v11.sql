-- Migration v11: Add managed_lines column to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS managed_lines JSONB DEFAULT '[]'::jsonb;
