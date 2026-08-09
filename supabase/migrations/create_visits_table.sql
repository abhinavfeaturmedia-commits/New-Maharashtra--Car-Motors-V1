-- ==============================================================================
-- DATABASE MIGRATION: CREATE VISITS TABLE & CONFIGURE RLS
-- ==============================================================================

-- 1. Create visits table
CREATE TABLE IF NOT EXISTS public.visits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  staff_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  visit_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  purpose        TEXT NOT NULL, -- 'Test Drive', 'Valuation', 'Document Collection', 'Showroom', 'General'
  location       TEXT,          -- Visit location details
  notes          TEXT,
  outcome        TEXT NOT NULL CHECK (outcome IN ('successful', 'unsuccessful', 'pending')),
  status         TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  approved_by    UUID REFERENCES public.profiles(id),
  approved_at    TIMESTAMPTZ,
  admin_remarks  TEXT,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Add a constraint ensuring it is linked to either a lead or a customer
  CONSTRAINT visits_target_check CHECK (lead_id IS NOT NULL OR customer_id IS NOT NULL)
);

-- 2. Enable Row Level Security
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Admins have full access to visits" ON public.visits;
CREATE POLICY "Admins have full access to visits" 
  ON public.visits FOR ALL 
  USING (is_admin());

DROP POLICY IF EXISTS "Staff can view all visits" ON public.visits;
CREATE POLICY "Staff can view all visits" 
  ON public.visits FOR SELECT 
  USING (is_staff());

DROP POLICY IF EXISTS "Staff can insert own visits" ON public.visits;
CREATE POLICY "Staff can insert own visits" 
  ON public.visits FOR INSERT 
  WITH CHECK (is_staff() AND staff_id = auth.uid());

DROP POLICY IF EXISTS "Staff can update own visits" ON public.visits;
CREATE POLICY "Staff can update own visits" 
  ON public.visits FOR UPDATE 
  USING (is_staff() AND staff_id = auth.uid());

-- 4. Trigger to auto-update updated_at timestamp
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
