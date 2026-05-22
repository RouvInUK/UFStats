-- Migration to add current_session_id to profiles table for custom session enforcement

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_session_id UUID;

-- Future-proofing: This column allows us to enforce single-session limits 
-- natively by having devices poll the DB to ensure their local session ID 
-- still matches the one in the DB.
