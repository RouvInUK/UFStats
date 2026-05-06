-- =======================================================================================
-- MIGRATION V4: GLOBAL CLUB PLAYER ARCHITECTURE
-- =======================================================================================

-- 1. Add club_id to players
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- 2. Create team_players junction table
CREATE TABLE IF NOT EXISTS public.team_players (
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (team_id, player_id)
);

-- 3. Data Migration: Backfill club_id and populate team_players
UPDATE public.players p
SET club_id = t.club_id
FROM public.teams t
WHERE p.team_id = t.id AND p.club_id IS NULL;

-- Insert existing player-team links into the junction table
INSERT INTO public.team_players (team_id, player_id, is_active)
SELECT team_id, id, is_active FROM public.players
WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Clean up players table
-- Drop team_id, team_name, and is_active from players
ALTER TABLE public.players DROP COLUMN IF EXISTS team_id CASCADE;
ALTER TABLE public.players DROP COLUMN IF EXISTS team_name CASCADE;
ALTER TABLE public.players DROP COLUMN IF EXISTS is_active CASCADE;

-- 5. Update Row Level Security (RLS)

-- A. TEAM_PLAYERS
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD team_players for their owned teams" ON public.team_players;
CREATE POLICY "Users can CRUD team_players for their owned teams" ON public.team_players FOR ALL USING (
    public.user_owns_team(team_id)
) WITH CHECK (
    public.user_owns_team(team_id)
);

-- B. PLAYERS
-- We need a function to check if the user owns the club
CREATE OR REPLACE FUNCTION public.user_owns_club(target_club_id UUID)
RETURNS boolean AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.clubs 
    WHERE id = target_club_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can CRUD players for their owned teams" ON public.players;
DROP POLICY IF EXISTS "Users can CRUD players for their owned clubs" ON public.players;

CREATE POLICY "Users can CRUD players for their owned clubs" ON public.players FOR ALL USING (
    public.user_owns_club(club_id)
) WITH CHECK (
    public.user_owns_club(club_id)
);

-- Note on Stats:
-- Stats table still has team_id and player_id. 
-- Stats should continue to be owned by the team_id. 
-- public.user_owns_team(team_id) is still perfectly valid for stats.
