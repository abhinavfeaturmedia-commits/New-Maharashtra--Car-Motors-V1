-- Secure RLS policies for Lead-related tables
-- This ensures that only admins or the staff member assigned to a lead can edit related records.
-- All staff members can view all records.

-- 1. lead_activities
DROP POLICY IF EXISTS "Enable all actions for public" ON public.lead_activities;
DROP POLICY IF EXISTS "All staff can view lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Admin or assignee can insert lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Admin or assignee can update lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Admin or assignee can delete lead_activities" ON public.lead_activities;

CREATE POLICY "All staff can view lead_activities" ON public.lead_activities FOR SELECT USING (true);
CREATE POLICY "Admin or assignee can insert lead_activities" ON public.lead_activities FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);
CREATE POLICY "Admin or assignee can update lead_activities" ON public.lead_activities FOR UPDATE USING (
  is_admin() OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);
CREATE POLICY "Admin or assignee can delete lead_activities" ON public.lead_activities FOR DELETE USING (
  is_admin() OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);

-- 2. lead_car_interests
DROP POLICY IF EXISTS "Enable all actions for public" ON public.lead_car_interests;
DROP POLICY IF EXISTS "All staff can view lead_car_interests" ON public.lead_car_interests;
DROP POLICY IF EXISTS "Admin or assignee can insert lead_car_interests" ON public.lead_car_interests;
DROP POLICY IF EXISTS "Admin or assignee can update lead_car_interests" ON public.lead_car_interests;
DROP POLICY IF EXISTS "Admin or assignee can delete lead_car_interests" ON public.lead_car_interests;

CREATE POLICY "All staff can view lead_car_interests" ON public.lead_car_interests FOR SELECT USING (true);
CREATE POLICY "Admin or assignee can insert lead_car_interests" ON public.lead_car_interests FOR INSERT WITH CHECK (
  is_admin() OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);
CREATE POLICY "Admin or assignee can update lead_car_interests" ON public.lead_car_interests FOR UPDATE USING (
  is_admin() OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);
CREATE POLICY "Admin or assignee can delete lead_car_interests" ON public.lead_car_interests FOR DELETE USING (
  is_admin() OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())
);

-- 3. follow_ups
DROP POLICY IF EXISTS "Enable all actions for public" ON public.follow_ups;
DROP POLICY IF EXISTS "Admins have full access to follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "All staff can view follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Admin or assignee can insert follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Admin or assignee can update follow_ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Admin or assignee can delete follow_ups" ON public.follow_ups;

CREATE POLICY "All staff can view follow_ups" ON public.follow_ups FOR SELECT USING (true);
CREATE POLICY "Admin or assignee can insert follow_ups" ON public.follow_ups FOR INSERT WITH CHECK (
  is_admin() OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid()))
);
CREATE POLICY "Admin or assignee can update follow_ups" ON public.follow_ups FOR UPDATE USING (
  is_admin() OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid()))
);
CREATE POLICY "Admin or assignee can delete follow_ups" ON public.follow_ups FOR DELETE USING (
  is_admin() OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid()))
);

-- 4. tasks
DROP POLICY IF EXISTS "Admins have full access to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable all actions for public" ON public.tasks;
DROP POLICY IF EXISTS "All staff can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin or assignee can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin or assignee can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin or assignee can delete tasks" ON public.tasks;

CREATE POLICY "All staff can view tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Admin or assignee can insert tasks" ON public.tasks FOR INSERT WITH CHECK (
  is_admin() OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid()))
);
CREATE POLICY "Admin or assignee can update tasks" ON public.tasks FOR UPDATE USING (
  is_admin() OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid()))
);
CREATE POLICY "Admin or assignee can delete tasks" ON public.tasks FOR DELETE USING (
  is_admin() OR (lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid()))
);
