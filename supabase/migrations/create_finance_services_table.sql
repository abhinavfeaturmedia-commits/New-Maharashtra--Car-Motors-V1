-- ==============================================================================
-- DATABASE MIGRATION: CREATE FINANCE SERVICES TABLE (LOANS & INSURANCE)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.finance_services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT NOT NULL CHECK (type IN ('loan', 'insurance')),
  customer_id       UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  car_id            UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  full_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  -- For Loan: 'pending', 'docs_submitted', 'bank_processing', 'approved', 'disbursed', 'rejected', 'cancelled'
  -- For Insurance: 'pending', 'quote_sent', 'payment_pending', 'policy_issued', 'cancelled'
  
  -- Service Provider Details
  provider_name     TEXT, -- e.g., HDFC Bank, SBI, ICICI Lombard, TATA AIG
  
  -- Financial Fields
  amount            NUMERIC(12,2), -- Loan Amount or Insurance IDV / Cover Amount
  tenure_months     INT, -- For loans (e.g. 36, 60 months)
  interest_rate     NUMERIC(5,2), -- For loans (e.g. 9.50)
  premium_amount    NUMERIC(10,2), -- For insurance
  policy_number     TEXT, -- For insurance
  commission_earned NUMERIC(10,2) DEFAULT 0.00,
  
  -- Administrative Fields
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_finance_services_customer ON public.finance_services(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_services_car ON public.finance_services(car_id);
CREATE INDEX IF NOT EXISTS idx_finance_services_type_status ON public.finance_services(type, status);

-- Enable RLS
ALTER TABLE public.finance_services ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins have full access to finance_services" ON public.finance_services;
CREATE POLICY "Admins have full access to finance_services"
  ON public.finance_services FOR ALL
  USING (is_admin());

DROP POLICY IF EXISTS "Staff can view finance_services" ON public.finance_services;
CREATE POLICY "Staff can view finance_services"
  ON public.finance_services FOR SELECT
  USING (is_staff() AND staff_can_view('finance'));

DROP POLICY IF EXISTS "Staff can manage finance_services" ON public.finance_services;
CREATE POLICY "Staff can manage finance_services"
  ON public.finance_services FOR ALL
  USING (is_staff() AND staff_can_manage('finance'));

-- Public/Client policy: allow users to view their own records matched by phone/email/customer_id
DROP POLICY IF EXISTS "Users can view their own finance_services" ON public.finance_services;
CREATE POLICY "Users can view their own finance_services"
  ON public.finance_services FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )) OR
    phone IN (
      SELECT phone FROM public.profiles WHERE id = auth.uid()
    ) OR
    email IN (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.finance_services;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.finance_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
