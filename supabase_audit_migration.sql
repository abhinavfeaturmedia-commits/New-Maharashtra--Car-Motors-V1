-- ============================================================
-- Swami Motors — Audit Fix Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add lead_id to customers (links a customer back to originating lead)
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- 2. Add profit tracking columns to sales
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'purchased',
    ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS purchase_cost_snapshot NUMERIC,
    ADD COLUMN IF NOT EXISTS consignment_fee_collected NUMERIC,
    ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sold_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';

-- 3. Add assessment fields to leads (for sell_car inquiries)
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS assessed_price NUMERIC,
    ADD COLUMN IF NOT EXISTS condition_notes TEXT,
    ADD COLUMN IF NOT EXISTS offer_made NUMERIC,
    ADD COLUMN IF NOT EXISTS offer_outcome TEXT; -- 'accepted_purchase' | 'accepted_consignment' | 'rejected' | 'pending'

-- 4. Add purchase_cost & consignment columns to inventory if missing
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC,
    ADD COLUMN IF NOT EXISTS consignment_owner_name TEXT,
    ADD COLUMN IF NOT EXISTS consignment_owner_phone TEXT,
    ADD COLUMN IF NOT EXISTS consignment_agreed_price NUMERIC,
    ADD COLUMN IF NOT EXISTS consignment_fee_type TEXT,
    ADD COLUMN IF NOT EXISTS consignment_fee_value NUMERIC,
    ADD COLUMN IF NOT EXISTS consignment_start_date DATE,
    ADD COLUMN IF NOT EXISTS consignment_end_date DATE,
    ADD COLUMN IF NOT EXISTS consignment_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- 5. Allow 'consignment' as source value (update constraint if it exists)
-- Drop old constraint if it blocked 'consignment'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'inventory_source_check'
        AND table_name = 'inventory'
    ) THEN
        ALTER TABLE public.inventory DROP CONSTRAINT inventory_source_check;
    END IF;
END $$;

ALTER TABLE public.inventory
    ADD CONSTRAINT inventory_source_check
    CHECK (source IN ('purchased', 'own', 'consignment', 'dealer'));

-- 6. Grant required policies for new columns (all RLS already enabled)
-- No new tables, existing policies cover new columns automatically.

-- Done! ✓
