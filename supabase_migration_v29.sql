-- =======================================================================================
-- MIGRATION V29: ADD DYNAMIC DRILL DEFINITIONS FOR TRAININGS MODE
-- =======================================================================================

CREATE TABLE IF NOT EXISTS public.drill_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE, -- NULL for system-default/global drills
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Cutting', 'Timing', 'Field Awareness', 'Conditioning')),
    flow_type TEXT NOT NULL DEFAULT 'continuous' CHECK (flow_type IN ('continuous', 'rep_based')), -- Differentiates continuous play vs. rapid rep-by-rep resets
    metrics TEXT[] NOT NULL, -- Array of button label strings
    is_public BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.drill_definitions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplicate conflicts
DROP POLICY IF EXISTS "Users can view relevant drills" ON public.drill_definitions;
DROP POLICY IF EXISTS "Users can create drills for their team" ON public.drill_definitions;
DROP POLICY IF EXISTS "Admins can update all drills" ON public.drill_definitions;

-- 1. Select policy: User can see approved public drills OR their own team's drills OR if they are system admins
CREATE POLICY "Users can view relevant drills" ON public.drill_definitions 
FOR SELECT USING (
    (is_public = true AND status = 'approved') OR
    (team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())) OR
    ((SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true)
);

-- 2. Insert policy: User can insert drills for their own team
CREATE POLICY "Users can create drills for their team" ON public.drill_definitions 
FOR INSERT WITH CHECK (
    team_id IN (SELECT team_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- 3. Admin update policy: Only admins can update drills (approve/reject public requests)
CREATE POLICY "Admins can update all drills" ON public.drill_definitions 
FOR UPDATE USING (
    ((SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true)
);

-- Pre-populate default system-level drills (team_id is NULL, is_public = true, status = 'approved')
INSERT INTO public.drill_definitions (name, category, flow_type, metrics, is_public, status)
VALUES 
('The "Go" Drill', 'Cutting', 'rep_based', ARRAY['Leading Catch', 'Overthrow', 'Underthrow', 'Drop'], TRUE, 'approved'),
('The Box Drill', 'Timing', 'continuous', ARRAY['Leading Catch', 'Overthrow', 'Underthrow', 'Drop'], TRUE, 'approved'),
('The 3-Person Weave', 'Field Awareness', 'continuous', ARRAY['Drop', 'Throwaway', 'Stall Out', 'Defence'], TRUE, 'approved')
ON CONFLICT DO NOTHING;
