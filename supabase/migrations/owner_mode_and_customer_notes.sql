-- ==============================================================================
-- CUSTOMER NOTES & OWNER MODE MIGRATION
-- New Maharashtra Car Motors — Owner Panel Enhancement
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: customer_notes
-- Unified notes per customer: calls, visits, WhatsApp messages, general notes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_notes (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    note_type       TEXT NOT NULL DEFAULT 'general'
                        CHECK (note_type IN ('call', 'visit', 'whatsapp', 'general')),
    content         TEXT NOT NULL,
    created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON public.customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_at  ON public.customer_notes(created_at DESC);

-- RLS: Anyone with admin/staff/owner role can manage notes
DROP POLICY IF EXISTS "notes_full_access" ON public.customer_notes;
CREATE POLICY "notes_full_access" ON public.customer_notes FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'staff', 'owner')
    ));

-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE EXISTING RLS POLICIES to include 'owner' role
-- Ensures the owner role can access customers, deals, documents
-- ─────────────────────────────────────────────────────────────────────────────

-- customers table
DROP POLICY IF EXISTS "admin_full_access_customers"  ON public.customers;
DROP POLICY IF EXISTS "owner_full_access_customers"  ON public.customers;
CREATE POLICY "admin_owner_full_access_customers" ON public.customers FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- customer_deals table (update existing policies)
DROP POLICY IF EXISTS "admin_full_access_deals" ON public.customer_deals;
CREATE POLICY "admin_full_access_deals" ON public.customer_deals FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- customer_documents table
DROP POLICY IF EXISTS "admin_full_access_docs" ON public.customer_documents;
CREATE POLICY "admin_full_access_docs" ON public.customer_documents FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- inventory table
DROP POLICY IF EXISTS "admin_full_access_inventory"  ON public.inventory;
DROP POLICY IF EXISTS "admin_owner_full_access_inventory" ON public.inventory;
CREATE POLICY "admin_owner_full_access_inventory" ON public.inventory FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- leads table
DROP POLICY IF EXISTS "admin_full_access_leads"  ON public.leads;
DROP POLICY IF EXISTS "admin_owner_full_access_leads" ON public.leads;
CREATE POLICY "admin_owner_full_access_leads" ON public.leads FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- sales table
DROP POLICY IF EXISTS "admin_full_access_sales"  ON public.sales;
DROP POLICY IF EXISTS "admin_owner_full_access_sales" ON public.sales;
CREATE POLICY "admin_owner_full_access_sales" ON public.sales FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for customer documents (run if bucket doesn't exist)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'customer-documents',
    'customer-documents',
    false,
    10485760,  -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for customer-documents bucket
DROP POLICY IF EXISTS "admin_staff_owner_upload_docs" ON storage.objects;
CREATE POLICY "admin_staff_owner_upload_docs" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'customer-documents'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'owner'))
    );

DROP POLICY IF EXISTS "admin_staff_owner_read_docs" ON storage.objects;
CREATE POLICY "admin_staff_owner_read_docs" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'customer-documents'
        AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'owner'))
    );

-- Done!
SELECT 'Migration complete: customer_notes table created, owner role policies applied.' AS status;
