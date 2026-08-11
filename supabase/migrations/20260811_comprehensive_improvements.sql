-- ==============================================================================
-- NEW MAHARASHTRA CAR MOTORS V1 — COMPREHENSIVE SUPABASE IMPROVEMENTS MIGRATION
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. FOREIGN KEY B-TREE INDEXES (Fixing Postgres Missing FK Indexes)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_inventory_id ON public.leads(inventory_id);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON public.leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_inventory_id ON public.sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_by ON public.sales(sold_by);
CREATE INDEX IF NOT EXISTS idx_sales_lead_id ON public.sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON public.follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned_to ON public.follow_ups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_vehicle_expenses_car_id ON public.vehicle_expenses(car_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inventory_id ON public.inspections(inventory_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON public.attendance_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_inventory_status_featured ON public.inventory(status, featured);

-- ─────────────────────────────────────────────────────────────
-- 2. UNIFIED BOOKINGS SCHEMA NORMALIZATION
-- ─────────────────────────────────────────────────────────────
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bookings') THEN
        CREATE TABLE public.bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_email TEXT,
            inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
            lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
            booking_type TEXT NOT NULL CHECK (booking_type IN ('test_drive', 'service', 'car_reservation')),
            preferred_date DATE NOT NULL,
            preferred_time TEXT,
            notes TEXT,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. ATOMIC STORED PROCEDURE: COMPLETE SALE (RPC)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_vehicle_sale(
    p_inventory_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT DEFAULT NULL,
    p_sale_price NUMERIC DEFAULT 0,
    p_sale_type TEXT DEFAULT 'purchased',
    p_lead_id UUID DEFAULT NULL,
    p_sold_by UUID DEFAULT NULL,
    p_payment_status TEXT DEFAULT 'paid',
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID;
    v_purchase_cost NUMERIC := 0;
    v_total_expenses NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_sale_id UUID;
    v_current_status TEXT;
BEGIN
    -- 1. Acquire row lock and check vehicle availability
    SELECT status, purchase_cost INTO v_current_status, v_purchase_cost
    FROM public.inventory
    WHERE id = p_inventory_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Vehicle not found.';
    END IF;

    IF v_current_status = 'sold' THEN
        RAISE EXCEPTION 'Vehicle is already marked as sold.';
    END IF;

    -- 2. Upsert Customer Record
    INSERT INTO public.customers (name, phone, email, lead_id)
    VALUES (p_customer_name, p_customer_phone, p_customer_email, p_lead_id)
    ON CONFLICT (phone) DO UPDATE 
    SET name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, customers.email),
        total_purchases = customers.total_purchases + 1
    RETURNING id INTO v_customer_id;

    -- 3. Compute total refurbishment expenses incurred on vehicle
    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
    FROM public.vehicle_expenses
    WHERE car_id = p_inventory_id;

    -- 4. Calculate Net Profit
    v_net_profit := p_sale_price - COALESCE(v_purchase_cost, 0) - v_total_expenses;

    -- 5. Insert Sale Record
    INSERT INTO public.sales (
        inventory_id,
        customer_name,
        customer_phone,
        customer_email,
        sale_price,
        sale_type,
        profit,
        purchase_cost_snapshot,
        lead_id,
        sold_by,
        status,
        payment_status,
        sale_date,
        notes
    ) VALUES (
        p_inventory_id,
        p_customer_name,
        p_customer_phone,
        p_customer_email,
        p_sale_price,
        p_sale_type,
        v_net_profit,
        v_purchase_cost,
        p_lead_id,
        p_sold_by,
        'completed',
        p_payment_status,
        CURRENT_DATE,
        p_notes
    ) RETURNING id INTO v_sale_id;

    -- 6. Update Vehicle Status
    UPDATE public.inventory
    SET status = 'sold',
        updated_at = now()
    WHERE id = p_inventory_id;

    -- 7. Update Lead Status if applicable
    IF p_lead_id IS NOT NULL THEN
        UPDATE public.leads
        SET status = 'won',
            updated_at = now()
        WHERE id = p_lead_id;
    END IF;

    RETURN v_sale_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS SECURITY POLICY HARDENING
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can create leads" ON public.leads;
DROP POLICY IF EXISTS "Staff & Admins full access leads" ON public.leads;
DROP POLICY IF EXISTS "Restricted leads access" ON public.leads;

-- Anyone can submit a lead (Public form submission)
CREATE POLICY "Public lead submission" 
ON public.leads FOR INSERT 
WITH CHECK (true);

-- Staff and Admins can view/manage leads
CREATE POLICY "Staff and Admin lead management" 
ON public.leads FOR ALL 
USING (public.is_admin() OR public.is_staff());

-- ─────────────────────────────────────────────────────────────
-- 5. ENABLE REALTIME PUBLICATION
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'leads'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
    END IF;
END $$;

COMMIT;
-- ==============================================================================
-- END OF COMPREHENSIVE MIGRATION
-- ==============================================================================
