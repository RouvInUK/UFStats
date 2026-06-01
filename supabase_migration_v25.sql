-- Migration v25: Enable anonymous volunteer scorer updates to matches and seats

-- 1. Grant table-level update permissions to anon and authenticated
GRANT UPDATE ON public.tournament_matches TO anon, authenticated;
GRANT UPDATE ON public.tournament_scorer_seats TO anon, authenticated;

-- 2. Create RLS policy for anonymous match updates
DROP POLICY IF EXISTS "Allow anonymous match score updates via active scorer seat" ON public.tournament_matches;
CREATE POLICY "Allow anonymous match score updates via active scorer seat" ON public.tournament_matches
    FOR UPDATE TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.tournament_scorer_seats 
            WHERE match_id = tournament_matches.id 
            AND active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tournament_scorer_seats 
            WHERE match_id = tournament_matches.id 
            AND active = true
        )
    );

-- 3. Create RLS policy for anonymous seat deactivation
DROP POLICY IF EXISTS "Allow anonymous deactivation of scorer seats" ON public.tournament_scorer_seats;
CREATE POLICY "Allow anonymous deactivation of scorer seats" ON public.tournament_scorer_seats
    FOR UPDATE TO public
    USING (active = true)
    WITH CHECK (active = false);
