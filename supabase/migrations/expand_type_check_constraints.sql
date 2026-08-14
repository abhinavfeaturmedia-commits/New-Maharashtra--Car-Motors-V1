-- ============================================================
-- MAHARASHTRA MOTORS — EXPAND TYPE CHECK CONSTRAINTS
-- Expands follow_ups_type_check and lead_activities_type_check
-- ============================================================

-- 1. Update follow_ups_type_check
ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_type_check;
ALTER TABLE public.follow_ups 
ADD CONSTRAINT follow_ups_type_check 
CHECK (type = ANY (ARRAY['call'::text, 'meeting'::text, 'whatsapp'::text, 'email'::text, 'visit'::text, 'followup'::text, 'note'::text, 'task'::text, 'sms'::text, 'other'::text]));

-- 2. Update lead_activities_type_check
ALTER TABLE public.lead_activities DROP CONSTRAINT IF EXISTS lead_activities_type_check;
ALTER TABLE public.lead_activities 
ADD CONSTRAINT lead_activities_type_check 
CHECK (type = ANY (ARRAY['call'::text, 'whatsapp'::text, 'email'::text, 'visit'::text, 'test_drive'::text, 'note'::text, 'status_change'::text, 'document'::text, 'offer'::text, 'task'::text, 'meeting'::text, 'followup'::text, 'sms'::text, 'other'::text]));

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
