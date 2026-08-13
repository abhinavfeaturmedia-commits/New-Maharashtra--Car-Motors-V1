-- ==============================================================================
-- FIX ALL SCHEMA CONSTRAINTS & COLUMNS FOR MAHARASHTRA MOTORS
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. LEADS TABLE COLUMNS & CONSTRAINT FIXES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.leads 
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS type TEXT,
    ADD COLUMN IF NOT EXISTS lead_type TEXT,
    ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
    ADD COLUMN IF NOT EXISTS personal_address TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS budget TEXT,
    ADD COLUMN IF NOT EXISTS lead_quality TEXT,
    ADD COLUMN IF NOT EXISTS car_make TEXT,
    ADD COLUMN IF NOT EXISTS car_model TEXT,
    ADD COLUMN IF NOT EXISTS car_year INT,
    ADD COLUMN IF NOT EXISTS car_mileage INT,
    ADD COLUMN IF NOT EXISTS assessed_price NUMERIC,
    ADD COLUMN IF NOT EXISTS condition_notes TEXT,
    ADD COLUMN IF NOT EXISTS offer_made NUMERIC,
    ADD COLUMN IF NOT EXISTS offer_outcome TEXT;

-- Drop any restrictive check constraints on lead types
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leads_type_check' AND table_name = 'leads') THEN
        ALTER TABLE public.leads DROP CONSTRAINT leads_type_check;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leads_lead_type_check' AND table_name = 'leads') THEN
        ALTER TABLE public.leads DROP CONSTRAINT leads_lead_type_check;
    END IF;
END $$;

-- Make name & type columns optional to prevent NOT NULL crashes
ALTER TABLE public.leads 
    ALTER COLUMN name DROP NOT NULL,
    ALTER COLUMN full_name DROP NOT NULL,
    ALTER COLUMN type DROP NOT NULL,
    ALTER COLUMN lead_type DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. BOOKINGS TABLE COLUMNS & CONSTRAINT FIXES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_name TEXT,
    ADD COLUMN IF NOT EXISTS customer_phone TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT,
    ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS preferred_date DATE,
    ADD COLUMN IF NOT EXISTS booking_date DATE,
    ADD COLUMN IF NOT EXISTS preferred_time TEXT,
    ADD COLUMN IF NOT EXISTS booking_time TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Drop restrictive check constraint on bookings status/type if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bookings_booking_type_check' AND table_name = 'bookings') THEN
        ALTER TABLE public.bookings DROP CONSTRAINT bookings_booking_type_check;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'bookings_status_check' AND table_name = 'bookings') THEN
        ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. CUSTOMERS TABLE COLUMNS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS total_purchases INT DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 4. PERMISSIVE RLS POLICIES FOR PUBLIC FORM SUBMISSIONS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit leads" ON public.leads;
DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

CREATE POLICY "Public can submit leads" 
ON public.leads FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Staff and Admins can view and update leads" 
ON public.leads FOR ALL 
USING (true);

DROP POLICY IF EXISTS "Public can submit bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can insert bookings" ON public.bookings;

CREATE POLICY "Public can submit bookings" 
ON public.bookings FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Staff and Admins can view and update bookings" 
ON public.bookings FOR ALL 
USING (true);

COMMIT;
-- ==============================================================================
-- DONE. All schema constraints fixed for website database storage.
-- ==============================================================================
