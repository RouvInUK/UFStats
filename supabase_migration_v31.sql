-- =======================================================================================
-- MIGRATION V31: ADD DRILL DESCRIPTIONS AND FIX RLS POLICIES FOR DYNAMIC DRILLS
-- =======================================================================================

-- 1. Add description column to drill_definitions table
ALTER TABLE public.drill_definitions 
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.drill_definitions.description IS 'Detailed explanation of the drill setup, objectives, and routing flow';

-- 2. Drop legacy category check constraint and recreate it to include 'Special Teams'
ALTER TABLE public.drill_definitions 
DROP CONSTRAINT IF EXISTS drill_definitions_category_check;

ALTER TABLE public.drill_definitions 
ADD CONSTRAINT drill_definitions_category_check 
CHECK (category IN ('Cutting', 'Timing', 'Field Awareness', 'Conditioning', 'Special Teams'));

-- 3. Populate descriptions for existing default system drills (team_id is NULL)
UPDATE public.drill_definitions 
SET description = 'A fundamental vertical cutting drill focusing on timing, quick under cuts, and deep throws. Standard reps consist of thrower to cutter sequences.'
WHERE name = 'The "Go" Drill' AND team_id IS NULL;

UPDATE public.drill_definitions 
SET description = 'A 4-corner passing and timing drill emphasizing sharp cutting angles, quick changes of direction, and throwing to space.'
WHERE name = 'The Box Drill' AND team_id IS NULL;

UPDATE public.drill_definitions 
SET description = 'A high-intensity continuous upfield flow drill utilizing quick lateral transitions, short dump passes, and hard centering cuts.'
WHERE name = 'The 3-Person Weave' AND team_id IS NULL;

-- 4. Safely insert "Pull Practice" as a system-level drill if it is missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.drill_definitions WHERE name = 'Pull Practice' AND team_id IS NULL) THEN
        INSERT INTO public.drill_definitions (name, description, category, flow_type, metrics, is_public, status)
        VALUES (
            'Pull Practice', 
            'Special teams drill targeting defensive pull distance, landing accuracy, brick-line coverage, and off-the-pull positioning.', 
            'Special Teams', 
            'continuous', 
            ARRAY['Endzone', 'Field (Past Brick)', 'Out of Bounds/past brick', 'Short/out of bounce'], 
            TRUE, 
            'approved'
        );
    END IF;
END $$;

-- 5. Recreate Row Level Security Policies using team ownership cascade
DROP POLICY IF EXISTS "Users can view relevant drills" ON public.drill_definitions;
DROP POLICY IF EXISTS "Users can create drills for their team" ON public.drill_definitions;

-- SELECT Policy: View approved public drills OR drills belonging to owned teams OR drills created by self OR if caller is admin
CREATE POLICY "Users can view relevant drills" ON public.drill_definitions 
FOR SELECT USING (
    (is_public = true AND status = 'approved') OR
    (public.user_owns_team(team_id)) OR
    (created_by = auth.uid()) OR
    ((SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true)
);

-- INSERT Policy: Create drills if the caller owns the team OR sets created_by = self. Non-admin users must submit as pending if requesting public status.
CREATE POLICY "Users can create drills for their team" ON public.drill_definitions 
FOR INSERT WITH CHECK (
    (public.user_owns_team(team_id) OR created_by = auth.uid()) AND
    (is_public = false OR status = 'pending' OR ((SELECT is_system_admin FROM public.profiles WHERE profiles.id = auth.uid()) = true))
);
