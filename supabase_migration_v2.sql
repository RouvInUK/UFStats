-- 1. Create teams table
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create profiles table linked to auth.users and teams
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    team_id UUID REFERENCES public.teams(id),
    is_system_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Update stats and players tables
ALTER TABLE public.stats ADD COLUMN team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.players ADD COLUMN team_id UUID REFERENCES public.teams(id);

-- 4. Create the Default/Test Team and migrate existing data
DO $$
DECLARE
    default_team_id UUID;
BEGIN
    INSERT INTO public.teams (name) VALUES ('Default Team (Migrated)') RETURNING id INTO default_team_id;
    
    -- Assign all current data to this default team
    UPDATE public.stats SET team_id = default_team_id WHERE team_id IS NULL;
    UPDATE public.players SET team_id = default_team_id WHERE team_id IS NULL;
END $$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
-- Profiles: Users can view their own profile.
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Teams: Users can view their own team. Admins can view all.
CREATE POLICY "Users can view their team" ON public.teams FOR SELECT USING (
    id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid()) OR 
    (SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true
);

-- Stats: Users can CRUD stats for their team. Admins can view all.
CREATE POLICY "Users can view stats for their team" ON public.stats FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid()) OR 
    (SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true
);
CREATE POLICY "Users can insert stats for their team" ON public.stats FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Users can update stats for their team" ON public.stats FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Users can delete stats for their team" ON public.stats FOR DELETE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Players: Users can CRUD players for their team. Admins can view all.
CREATE POLICY "Users can view players for their team" ON public.players FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid()) OR 
    (SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true
);
CREATE POLICY "Users can insert players for their team" ON public.players FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Users can update players for their team" ON public.players FOR UPDATE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);
CREATE POLICY "Users can delete players for their team" ON public.players FOR DELETE USING (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- 7. Trigger for auto-creating profile and assigning team on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    new_team_id UUID;
BEGIN
    -- Auto-create a team based on their email or generic
    INSERT INTO public.teams (name) VALUES (SPLIT_PART(NEW.email, '@', 1) || '''s Team') RETURNING id INTO new_team_id;
    
    INSERT INTO public.profiles (id, email, team_id, is_system_admin)
    VALUES (NEW.id, NEW.email, new_team_id, FALSE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
