-- ==============================================================================
-- DATABASE MIGRATION: REPLACE POINTS LEDGER WITH SERVICE EXCHANGES
-- ==============================================================================

-- 1. Drop trigger and function for updating points on club_members
DROP TRIGGER IF EXISTS update_member_points_trigger ON public.club_points_transactions;
DROP FUNCTION IF EXISTS update_member_points();

-- 2. Drop the old points transactions table
DROP TABLE IF EXISTS public.club_points_transactions;

-- 3. Create the new club_service_exchanges table
CREATE TABLE IF NOT EXISTS public.club_service_exchanges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID REFERENCES public.club_members(id) ON DELETE CASCADE NOT NULL,
  exchange_type    VARCHAR(20) NOT NULL CHECK (exchange_type IN ('given_to_member', 'taken_from_member')),
  service_name     TEXT NOT NULL,
  equivalent_value NUMERIC(12,2) DEFAULT 0.00,
  notes            TEXT,
  transaction_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  added_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 4. Create index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_club_service_exchanges_member_id ON public.club_service_exchanges(member_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.club_service_exchanges ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for club_service_exchanges
DROP POLICY IF EXISTS "Admins have full access to club_service_exchanges" ON public.club_service_exchanges;
CREATE POLICY "Admins have full access to club_service_exchanges" 
  ON public.club_service_exchanges FOR ALL 
  USING (is_admin());

DROP POLICY IF EXISTS "Staff can view club_service_exchanges" ON public.club_service_exchanges;
CREATE POLICY "Staff can view club_service_exchanges" 
  ON public.club_service_exchanges FOR SELECT 
  USING (is_staff() AND staff_can_view('crm'));

DROP POLICY IF EXISTS "Staff can manage club_service_exchanges" ON public.club_service_exchanges;
CREATE POLICY "Staff can manage club_service_exchanges" 
  ON public.club_service_exchanges FOR INSERT 
  WITH CHECK (is_staff() AND staff_can_manage('crm'));
