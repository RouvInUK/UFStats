-- Migration v21: Tournament Tier Architecture, Alphanumeric Scorer Seats, and Gender Designations

-- 1. Extend profiles table with beta_tournament_tier flag
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS beta_tournament_tier BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN public.profiles.beta_tournament_tier IS 'Flag denoting access to the private Tournament Organizer beta features';

-- 2. Alter players table to add nullable gender_designation column
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS gender_designation VARCHAR(10) CHECK (gender_designation IN ('mmp', 'fmp'));

COMMENT ON COLUMN public.players.gender_designation IS 'Nullable match designation for mixed division audits (mmp = Male Matching Player, fmp = Female Matching Player)';

-- 3. Upgrade profiles tamper protection trigger to protect beta_tournament_tier column
CREATE OR REPLACE FUNCTION public.protect_profile_tier_tampering() 
RETURNS TRIGGER AS $$
DECLARE
    caller_is_admin BOOLEAN := FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-define the trigger function with is_system_admin checks
CREATE OR REPLACE FUNCTION public.protect_profile_tier_tampering() 
RETURNS TRIGGER AS $$
DECLARE
    caller_is_admin BOOLEAN := FALSE;
BEGIN
    -- 1. Grant authorization to system service roles (e.g. PayPal webhooks, edge functions)
    IF (auth.role() = 'service_role') THEN
        caller_is_admin := TRUE;
    ELSE
        -- 2. Inspect if the logged-in caller is an active System Administrator in profiles
        SELECT is_system_admin INTO caller_is_admin 
        FROM public.profiles 
        WHERE id = auth.uid();
    END IF;

    -- 3. If the caller is NOT a system admin (or service role), revert updates to restricted columns
    IF (caller_is_admin = FALSE OR caller_is_admin IS NULL) THEN
        NEW.tier := OLD.tier;
        NEW.pro_expires_at := OLD.pro_expires_at;
        NEW.is_system_admin := OLD.is_system_admin;
        NEW.beta_voice_pro := OLD.beta_voice_pro;
        NEW.is_test_account := OLD.is_test_account;
        NEW.beta_tournament_tier := OLD.beta_tournament_tier;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create Tournaments Table
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.tournaments IS 'Tournament organizer editions';

-- 5. Create Tournament Teams Table
CREATE TABLE IF NOT EXISTS public.tournament_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    division VARCHAR(50) DEFAULT 'Mixed', -- Mixed, Open, Women's
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.tournament_teams IS 'Teams rostered in tournaments';

-- 6. Create Tournament Matches Table
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    home_team_id UUID REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
    away_team_id UUID REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed')),
    pitch_number VARCHAR(50),
    start_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.tournament_matches IS 'Matches scheduled on pitches in tournaments';

-- 7. Create Scorer Seats Table (6-Digit Pitch Codes)
CREATE TABLE IF NOT EXISTS public.tournament_scorer_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
    match_id UUID REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    pitch_code VARCHAR(20) UNIQUE NOT NULL, -- e.g. "P1-A4B"
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.tournament_scorer_seats IS 'Authorized volunteer scorer seats keyed by alphanumeric pitch codes';

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_scorer_seats ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies
-- SELECT (Public Reads)
CREATE POLICY "Allow public read access to tournaments" ON public.tournaments FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to tournament teams" ON public.tournament_teams FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to tournament matches" ON public.tournament_matches FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to tournament scorer seats" ON public.tournament_scorer_seats FOR SELECT TO public USING (true);

-- Organizer full control of their tournaments
CREATE POLICY "Allow creator full control of tournaments" ON public.tournaments 
    FOR ALL TO authenticated 
    USING (auth.uid() = created_by OR (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true);

CREATE POLICY "Allow creators to manage tournament teams" ON public.tournament_teams 
    FOR ALL TO authenticated 
    USING (
        tournament_id IN (SELECT id FROM public.tournaments WHERE created_by = auth.uid()) OR
        (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
    );

CREATE POLICY "Allow creators to manage tournament matches" ON public.tournament_matches 
    FOR ALL TO authenticated 
    USING (
        tournament_id IN (SELECT id FROM public.tournaments WHERE created_by = auth.uid()) OR
        (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
    );

CREATE POLICY "Allow creators to manage tournament scorer seats" ON public.tournament_scorer_seats 
    FOR ALL TO authenticated 
    USING (
        tournament_id IN (SELECT id FROM public.tournaments WHERE created_by = auth.uid()) OR
        (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
    );

-- 10. Enable public volunteer scorer CRUD access to public.stats via valid active pitch codes
CREATE POLICY "Allow anonymous inserts to stats with active pitch code" ON public.stats 
    FOR INSERT TO public 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tournament_scorer_seats 
            WHERE pitch_code = (details->>'pitch_code') 
            AND active = true
        )
    );

CREATE POLICY "Allow anonymous updates to stats with active pitch code" ON public.stats 
    FOR UPDATE TO public 
    USING (
        EXISTS (
            SELECT 1 FROM public.tournament_scorer_seats 
            WHERE pitch_code = (details->>'pitch_code') 
            AND active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tournament_scorer_seats 
            WHERE pitch_code = (details->>'pitch_code') 
            AND active = true
        )
    );

CREATE POLICY "Allow anonymous deletes to stats with active pitch code" ON public.stats 
    FOR DELETE TO public 
    USING (
        EXISTS (
            SELECT 1 FROM public.tournament_scorer_seats 
            WHERE pitch_code = (details->>'pitch_code') 
            AND active = true
        )
    );
