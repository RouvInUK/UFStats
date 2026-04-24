-- 1. Add Tier to Teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'FREE';

-- 2. Create Beta Keys Table
CREATE TABLE IF NOT EXISTS public.beta_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. RLS for Beta Keys
ALTER TABLE public.beta_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage beta keys" ON public.beta_keys FOR ALL USING (
    (SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true
);

CREATE POLICY "Anyone can read beta keys" ON public.beta_keys FOR SELECT USING (true);
CREATE POLICY "Anyone can update beta keys during signup" ON public.beta_keys FOR UPDATE USING (is_used = false);

-- 4. Create Global Health RPC
CREATE OR REPLACE FUNCTION get_actions_per_day_30d()
RETURNS TABLE(day DATE, action_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT DATE(created_at) as day, COUNT(*) as action_count
    FROM public.stats
    WHERE created_at >= (NOW() - INTERVAL '30 days')
    GROUP BY DATE(created_at)
    ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create Data Hygiene Pruning RPC
CREATE OR REPLACE FUNCTION prune_incomplete_games()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH games_to_delete AS (
        SELECT game_name, team_id
        FROM public.stats
        GROUP BY game_name, team_id
        HAVING 
            SUM(CASE WHEN stat_type NOT IN ('Lineup', 'Match Metadata', 'Start Offense', 'Start Defense', 'Half Time', 'Game Completed') THEN 1 ELSE 0 END) = 0
            AND MAX(created_at) < (NOW() - INTERVAL '48 hours')
    )
    DELETE FROM public.stats
    WHERE (game_name, team_id) IN (SELECT game_name, team_id FROM games_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Unlink any auto-generated teams from existing System Admins
UPDATE public.profiles
SET team_id = NULL
WHERE is_system_admin = true;

-- 7. Prune those abandoned admin teams from the database
DELETE FROM public.teams
WHERE id NOT IN (SELECT team_id FROM public.profiles WHERE team_id IS NOT NULL);
