-- Phase 1 CRM Migration SQL
-- Run this in your Supabase SQL Editor

-- 1. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: We do not enforce UNIQUE on phone initially to prevent migration errors, 
-- but it's highly recommended once data is clean.

-- 2. Create Sales (Deals) Table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  final_price NUMERIC NOT NULL,
  sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- 3. Create Bookings (Test Drives & Services) Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
  booking_type TEXT, -- 'test_drive' or 'service'
  booking_date DATE,
  booking_time TIME,
  status TEXT DEFAULT 'scheduled'
);

-- 4. Create Lead Activities (Follow-ups) Table
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- e.g. 'call', 'note', 'email', 'status_change'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT -- Could be user email or name
);

-- 5. Add RLS Policies so the frontend can interact with them
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Allow public access for now (or adjust to authenticated if using strict auth rules layer-wide)
CREATE POLICY "Enable all actions for public" ON public.customers FOR ALL USING (true);
CREATE POLICY "Enable all actions for public" ON public.sales FOR ALL USING (true);
CREATE POLICY "Enable all actions for public" ON public.bookings FOR ALL USING (true);
CREATE POLICY "Enable all actions for public" ON public.lead_activities FOR ALL USING (true);
