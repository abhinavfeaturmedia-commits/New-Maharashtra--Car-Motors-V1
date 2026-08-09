c-- ==============================================================================
-- DATABASE MIGRATION: CREATE CLUB MEMBERS & POINTS TRANSACTIONS TABLES
-- ==============================================================================

-- 1. Create club_members table
CREATE TABLE IF NOT EXISTS public.club_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  full_name      TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT,
  membership_no  TEXT UNIQUE NOT NULL,
  tier           TEXT NOT NULL DEFAULT 'Silver' CHECK (tier IN ('Silver', 'Gold', 'Platinum', 'VIP')),
  status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Expired')),
  points         INT NOT NULL DEFAULT 0 CHECK (points >= 0),
  joining_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date    DATE,
  total_spent    NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  referred_by    UUID REFERENCES public.club_members(id) ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_club_members_customer_id ON public.club_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_club_members_membership_no ON public.club_members(membership_no);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for club_members
DROP POLICY IF EXISTS "Admins have full access to club_members" ON public.club_members;
CREATE POLICY "Admins have full access to club_members" 
  ON public.club_members FOR ALL 
  USING (is_admin());

DROP POLICY IF EXISTS "Staff can view club_members" ON public.club_members;
CREATE POLICY "Staff can view club_members" 
  ON public.club_members FOR SELECT 
  USING (is_staff() AND staff_can_view('crm'));

DROP POLICY IF EXISTS "Staff can manage club_members" ON public.club_members;
CREATE POLICY "Staff can manage club_members" 
  ON public.club_members FOR ALL 
  USING (is_staff() AND staff_can_manage('crm'));

-- 5. Create club_points_transactions table
CREATE TABLE IF NOT EXISTS public.club_points_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        UUID REFERENCES public.club_members(id) ON DELETE CASCADE NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust')),
  points           INT NOT NULL CHECK (points != 0),
  description      TEXT NOT NULL,
  transaction_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  added_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_club_points_transactions_member_id ON public.club_points_transactions(member_id);

-- Enable RLS for transactions
ALTER TABLE public.club_points_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for transactions
DROP POLICY IF EXISTS "Admins have full access to club_points_transactions" ON public.club_points_transactions;
CREATE POLICY "Admins have full access to club_points_transactions" 
  ON public.club_points_transactions FOR ALL 
  USING (is_admin());

DROP POLICY IF EXISTS "Staff can view club_points_transactions" ON public.club_points_transactions;
CREATE POLICY "Staff can view club_points_transactions" 
  ON public.club_points_transactions FOR SELECT 
  USING (is_staff() AND staff_can_view('crm'));

DROP POLICY IF EXISTS "Staff can manage club_points_transactions" ON public.club_points_transactions;
CREATE POLICY "Staff can manage club_points_transactions" 
  ON public.club_points_transactions FOR INSERT 
  WITH CHECK (is_staff() AND staff_can_manage('crm'));

-- 6. Trigger to auto-update updated_at timestamp on club_members
DROP TRIGGER IF EXISTS set_updated_at ON public.club_members;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Trigger/Function to automatically update club_members points when transactions occur
CREATE OR REPLACE FUNCTION update_member_points()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.club_members
    SET points = points + NEW.points
    WHERE id = NEW.member_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.club_members
    SET points = points - OLD.points
    WHERE id = OLD.member_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.club_members
    SET points = points - OLD.points + NEW.points
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_member_points_trigger ON public.club_points_transactions;
CREATE TRIGGER update_member_points_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.club_points_transactions
FOR EACH ROW EXECUTE FUNCTION update_member_points();

-- 8. Seed default configurations in dealership_settings if not already present
INSERT INTO public.dealership_settings (setting_key, setting_value)
VALUES ('club_settings', '{"name": "Royal Club", "prefix": "RC"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
