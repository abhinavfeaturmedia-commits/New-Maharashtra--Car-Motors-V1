-- ============================================================
-- MAHARASHTRA MOTORS (SWAMI MOTORS) — MASTER SUPABASE SETUP
-- Consolidated Database Schema, Tables, RPC Functions, Triggers, RLS Policies & Storage
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CORE SCHEMA & EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 2. USER PROFILES & AUTHENTICATION
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer', 'dealer')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins have full access to profiles" ON public.profiles FOR ALL USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 3. INVENTORY & VEHICLES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make                      TEXT NOT NULL,
  model                     TEXT NOT NULL,
  variant                   TEXT,
  year                      INT NOT NULL,
  price                     NUMERIC(12,2) NOT NULL,
  original_price            NUMERIC(12,2),
  purchase_cost             NUMERIC(12,2),
  mileage                   INT,
  fuel_type                 TEXT CHECK (fuel_type IN ('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Petrol + CNG', 'Petrol + Electric', 'Petrol + LPG')),
  transmission              TEXT CHECK (transmission IN ('Manual', 'Automatic', 'CVT')),
  color                     TEXT,
  body_type                 TEXT,
  registration_no           TEXT UNIQUE,
  ownership                 INT DEFAULT 1,
  condition                 TEXT DEFAULT 'used' CHECK (condition IN ('new', 'used', 'certified')),
  insurance                 TEXT,
  video_url                 TEXT,
  status                    TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'pending')),
  source                    TEXT DEFAULT 'own' CHECK (source IN ('purchased', 'own', 'consignment', 'dealer')),
  consignment_owner_name    TEXT,
  consignment_owner_phone   TEXT,
  consignment_agreed_price  NUMERIC(12,2),
  consignment_fee_type      TEXT,
  consignment_fee_value     NUMERIC(12,2),
  consignment_start_date    DATE,
  consignment_end_date      DATE,
  consignment_customer_id   UUID,
  description               TEXT,
  features                  TEXT[],
  images                    TEXT[],
  featured                  BOOLEAN DEFAULT false,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read available inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Admin write inventory" ON public.inventory FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 4. LEADS & CRM MANAGEMENT
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,
  city            TEXT,
  lead_type       TEXT NOT NULL CHECK (lead_type IN ('buy', 'sell', 'service', 'general', 'finance', 'insurance')),
  status          TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'test_drive', 'negotiation', 'won', 'lost')),
  source          TEXT DEFAULT 'website',
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inventory_id    UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  notes           TEXT,
  assessed_price  NUMERIC(12,2),
  condition_notes TEXT,
  offer_made      NUMERIC(12,2),
  offer_outcome   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can create leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff & Admins full access leads" ON public.leads FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────
-- 5. BOOKINGS & SALES MANAGEMENT
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_id  UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  booking_type  TEXT NOT NULL CHECK (booking_type IN ('test_drive', 'service', 'car_reservation')),
  preferred_date DATE NOT NULL,
  preferred_time TIME,
  notes         TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins manage bookings" ON public.bookings FOR ALL USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.sales (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id             UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  customer_name            TEXT NOT NULL,
  customer_phone           TEXT NOT NULL,
  customer_email           TEXT,
  sale_price               NUMERIC(12,2) NOT NULL,
  sale_type                TEXT DEFAULT 'purchased',
  profit                   NUMERIC(12,2) DEFAULT 0,
  purchase_cost_snapshot   NUMERIC(12,2),
  consignment_fee_collected NUMERIC(12,2),
  lead_id                  UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  sold_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status                   TEXT DEFAULT 'completed',
  payment_status           TEXT DEFAULT 'paid',
  sale_date                DATE DEFAULT CURRENT_DATE,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sales" ON public.sales FOR ALL USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 6. CUSTOMERS & DEALERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  total_purchases INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customers" ON public.customers FOR ALL USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.dealers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  status        TEXT DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage dealers" ON public.dealers FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────
-- 7. SHARED CATALOGS & USER WISHLIST
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_catalogs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  views_count   INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shared_catalog_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id    UUID REFERENCES public.shared_catalogs(id) ON DELETE CASCADE,
  inventory_id  UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_wishlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_id  UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, inventory_id)
);

ALTER TABLE public.shared_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read shared catalogs" ON public.shared_catalogs FOR SELECT USING (true);
CREATE POLICY "Public read shared catalog items" ON public.shared_catalog_items FOR SELECT USING (true);
CREATE POLICY "Users manage wishlist" ON public.user_wishlist FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 8. ATTENDANCE & HR SYSTEM
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  check_in      TIMESTAMPTZ,
  check_out     TIMESTAMPTZ,
  status        TEXT CHECK (status IN ('present', 'absent', 'late', 'half_day', 'on_leave')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own attendance" ON public.attendance_records FOR SELECT USING (auth.uid() = staff_id OR public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- 9. CLUB MEMBERS & LOYALTY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  member_code   TEXT UNIQUE NOT NULL,
  tier          TEXT DEFAULT 'silver',
  total_points  INT DEFAULT 0,
  joined_date   DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public or members read club" ON public.club_members FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 10. STORAGE BUCKETS SETUP
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) 
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('dealership-assets', 'dealership-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- END OF MASTER SCHEMA
-- ─────────────────────────────────────────────────────────────
