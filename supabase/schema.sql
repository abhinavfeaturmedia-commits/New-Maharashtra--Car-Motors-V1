-- ============================================================
-- SWAMI MOTORS — SUPABASE DATABASE SCHEMA
-- Run this entire script in: Supabase → SQL Editor → New Query
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- TABLE: profiles  (must be FIRST — other functions depend on it)
-- Extended user data synced from auth.users
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  phone       TEXT,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────
-- HELPER: Admin check function (defined AFTER profiles table)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


-- RLS policies for profiles (defined AFTER is_admin exists)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL USING (is_admin());


-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block user creation if profile insert fails
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- TABLE: inventory
-- Car listings managed by admin
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make            TEXT NOT NULL,
  model           TEXT NOT NULL,
  variant         TEXT,
  year            INT NOT NULL,
  price           NUMERIC(12,2) NOT NULL,
  original_price  NUMERIC(12,2),
  mileage         INT,
  fuel_type       TEXT CHECK (fuel_type IN ('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'Petrol + CNG', 'Petrol + Electric', 'Petrol + LPG')),
  transmission    TEXT CHECK (transmission IN ('Manual', 'Automatic', 'CVT')),
  color           TEXT,
  body_type       TEXT,
  registration_no TEXT UNIQUE,
  ownership       INT DEFAULT 1,
  condition       TEXT DEFAULT 'used' CHECK (condition IN ('new', 'used', 'certified')),
  insurance       TEXT,
  video_url       TEXT,
  status          TEXT DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved', 'pending')),
  description     TEXT,
  features        TEXT[],
  images          TEXT[],
  thumbnail       TEXT,
  added_by        UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view available inventory"
  ON inventory FOR SELECT USING (status = 'available');

CREATE POLICY "Admins have full access to inventory"
  ON inventory FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: leads
-- All customer enquiries (contact, sell car, insurance, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL CHECK (type IN ('contact', 'sell_car', 'insurance', 'general', 'test_drive', 'service')),
  full_name    TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  message      TEXT,
  car_make     TEXT,
  car_model    TEXT,
  car_year     INT,
  car_mileage  INT,
  status       TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiation', 'closed_won', 'closed_lost')),
  assigned_to  UUID REFERENCES profiles(id),
  notes        TEXT,
  source       TEXT DEFAULT 'website',
  user_id      UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  lead_quality TEXT CHECK (lead_quality IN ('hot', 'warm', 'cold', 'cakewalk')),
  budget       TEXT
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert leads"
  ON leads FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to leads"
  ON leads FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: customers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  date_of_birth DATE,
  user_id       UUID REFERENCES profiles(id),
  tags          TEXT[],
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to customers"
  ON customers FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: service_bookings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id),
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  car_make         TEXT,
  car_model        TEXT,
  car_year         INT,
  car_reg_no       TEXT,
  service_type     TEXT NOT NULL,
  preferred_date   DATE NOT NULL,
  preferred_time   TEXT,
  description      TEXT,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  assigned_to      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert service bookings"
  ON service_bookings FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own service bookings"
  ON service_bookings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to service bookings"
  ON service_bookings FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: test_drive_bookings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_drive_bookings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id),
  customer_name    TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  car_id           UUID REFERENCES inventory(id),
  preferred_date   DATE NOT NULL,
  preferred_time   TEXT,
  driving_license  TEXT,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE test_drive_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert test drive bookings"
  ON test_drive_bookings FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own test drive bookings"
  ON test_drive_bookings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to test drive bookings"
  ON test_drive_bookings FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: follow_ups
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID REFERENCES leads(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id),
  assigned_to  UUID REFERENCES profiles(id),
  type         TEXT CHECK (type IN ('call', 'meeting', 'whatsapp', 'email', 'visit')),
  notes        TEXT,
  due_date     DATE,
  is_done      BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to follow_ups"
  ON follow_ups FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: vehicle_expenses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id       UUID REFERENCES inventory(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN ('purchase', 'repair', 'refurbishment', 'insurance', 'logistics', 'documentation', 'other')),
  amount       NUMERIC(10,2) NOT NULL,
  description  TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  added_by     UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vehicle_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to vehicle_expenses"
  ON vehicle_expenses FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TABLE: documents
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT CHECK (type IN ('RC', 'insurance', 'PUC', 'invoice', 'agreement', 'other')),
  file_path    TEXT NOT NULL,
  file_url     TEXT,
  car_id       UUID REFERENCES inventory(id),
  lead_id      UUID REFERENCES leads(id),
  customer_id  UUID REFERENCES customers(id),
  uploaded_by  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to documents"
  ON documents FOR ALL USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- UPDATED_AT auto-trigger function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON test_drive_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE: car-images BUCKET & RLS
-- ============================================================

-- 1. Create the bucket (safe to run multiple times with ON CONFLICT / ignore)
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage.objects (usually enabled by default, but safe to repeat)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow anyone to VIEW images (public bucket)
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'car-images');

-- 4. Policy: Allow authenticated users (Admins) to UPLOAD images
CREATE POLICY "Admins can upload images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'car-images' AND is_admin());

-- 5. Policy: Allow authenticated users (Admins) to UPDATE/DELETE images
CREATE POLICY "Admins can modify images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'car-images' AND is_admin());

CREATE POLICY "Admins can delete images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'car-images' AND is_admin());

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT DEFAULT 'todo',
  priority     TEXT,
  due_date     TIMESTAMPTZ,
  lead_id      UUID REFERENCES leads(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to tasks" ON tasks FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: inspections
-- ============================================================
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    UUID REFERENCES inventory(id) ON DELETE CASCADE,
  inspector_name  TEXT,
  status          TEXT,
  notes           TEXT,
  inspection_date TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to inspections" ON inspections FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: dealership_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS dealership_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dealership_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view dealership_settings" ON dealership_settings FOR SELECT USING (true);
CREATE POLICY "Admins can modify dealership_settings" ON dealership_settings FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: user_wishlist
-- ============================================================
CREATE TABLE IF NOT EXISTS user_wishlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  inventory_id  UUID REFERENCES inventory(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, inventory_id)
);

ALTER TABLE user_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can query their own wishlist" ON user_wishlist FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- DONE. Schema and Storage configured.
-- ============================================================
