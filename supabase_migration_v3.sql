-- 1. Add Tier to Profiles and remove deprecated team_id
ALTER TABLE public.profiles ADD COLUMN tier TEXT DEFAULT 'FREE';
ALTER TABLE public.profiles DROP COLUMN IF EXISTS team_id CASCADE;

-- 2. Create Clubs Table
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Modify Teams Table
ALTER TABLE public.teams ADD COLUMN club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;
ALTER TABLE public.teams ADD COLUMN owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.teams DROP COLUMN IF EXISTS tier;

-- Ensure Stats and Players cascade on Team delete (if not already)
-- Since they currently reference teams(id), we can drop and re-add the constraint to be sure
ALTER TABLE public.stats DROP CONSTRAINT IF EXISTS stats_team_id_fkey;
ALTER TABLE public.stats ADD CONSTRAINT stats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_team_id_fkey;
ALTER TABLE public.players ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- 4. Update Row Level Security (RLS) Policies

-- Clubs
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own clubs" ON public.clubs FOR ALL USING (
    owner_id = auth.uid() OR 
    (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Teams
DROP POLICY IF EXISTS "Users can view their team" ON public.teams;
CREATE POLICY "Users can CRUD their own teams" ON public.teams FOR ALL USING (
    owner_id = auth.uid() OR 
    (SELECT is_system_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- Stats & Players RLS (Cascade ownership access)
DROP POLICY IF EXISTS "Users can view stats for their team" ON public.stats;
DROP POLICY IF EXISTS "Users can insert stats for their team" ON public.stats;
DROP POLICY IF EXISTS "Users can update stats for their team" ON public.stats;
DROP POLICY IF EXISTS "Users can delete stats for their team" ON public.stats;
DROP POLICY IF EXISTS "Users can CRUD stats for their owned teams" ON public.stats;

-- Create a robust security definer function to avoid nested RLS bugs during INSERT
CREATE OR REPLACE FUNCTION public.user_owns_team(target_team_id UUID)
RETURNS boolean AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.teams 
    WHERE id = target_team_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can CRUD stats for their owned teams" ON public.stats FOR ALL USING (
    public.user_owns_team(team_id)
) WITH CHECK (
    public.user_owns_team(team_id)
);

DROP POLICY IF EXISTS "Users can view players for their team" ON public.players;
DROP POLICY IF EXISTS "Users can insert players for their team" ON public.players;
DROP POLICY IF EXISTS "Users can update players for their team" ON public.players;
DROP POLICY IF EXISTS "Users can delete players for their team" ON public.players;
DROP POLICY IF EXISTS "Users can CRUD players for their owned teams" ON public.players;

CREATE POLICY "Users can CRUD players for their owned teams" ON public.players FOR ALL USING (
    public.user_owns_team(team_id)
) WITH CHECK (
    public.user_owns_team(team_id)
);

-- 5. Update New User Trigger (Do NOT create default team anymore)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, is_system_admin, tier)
    VALUES (NEW.id, NEW.email, FALSE, 'FREE');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update Profiles RLS so admins can view all users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(is_system_admin, false) FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT USING (
    auth.uid() = id OR 
    public.is_admin()
);
