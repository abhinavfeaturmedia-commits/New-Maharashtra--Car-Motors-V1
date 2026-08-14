-- ============================================================
-- MAHARASHTRA MOTORS — ADD CREATED_BY TO FOLLOW_UPS
-- Adds created_by and performed_by columns to public.follow_ups
-- ============================================================

ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
