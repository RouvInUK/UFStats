-- Migration v23: Re-add team_id to players for tournament rosters

-- 1. Add team_id to public.players table referencing public.tournament_teams
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.tournament_teams(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.players.team_id IS 'Nullable reference to tournament_teams for tournament-specific player rosters';

-- 2. Create RLS policies on public.players for tournament roster isolation

-- A. SELECT (Public Read Access to tournament player lists)
DROP POLICY IF EXISTS "Allow public read access to tournament players" ON public.players;
CREATE POLICY "Allow public read access to tournament players" ON public.players 
    FOR SELECT TO public 
    USING (
        team_id IS NOT NULL
    );

-- B. ALL CRUD (Creators can manage players for their own tournaments)
DROP POLICY IF EXISTS "Allow creators to manage tournament players" ON public.players;
CREATE POLICY "Allow creators to manage tournament players" ON public.players 
    FOR ALL TO authenticated 
    USING (
        team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tournament_teams tt
            JOIN public.tournaments t ON tt.tournament_id = t.id
            WHERE tt.id = players.team_id 
              AND (t.created_by = auth.uid() OR (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true)
        )
    )
    WITH CHECK (
        team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.tournament_teams tt
            JOIN public.tournaments t ON tt.tournament_id = t.id
            WHERE tt.id = team_id 
              AND (t.created_by = auth.uid() OR (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true)
        )
    );
