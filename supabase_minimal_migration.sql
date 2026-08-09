-- Swami Motors Audit Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'purchased';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS profit NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS purchase_cost_snapshot NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS consignment_fee_collected NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS lead_id UUID;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sold_by UUID;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assessed_price NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS condition_notes TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offer_made NUMERIC;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offer_outcome TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_owner_name TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_owner_phone TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_agreed_price NUMERIC;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_fee_type TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_fee_value NUMERIC;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_start_date DATE;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_end_date DATE;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS consignment_customer_id UUID;

ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_source_check;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_source_check CHECK (source IN ('purchased','own','consignment','dealer'));

-- Done!