-- ==============================================================================
-- CUSTOMER DEALS & DOCUMENTS MIGRATION
-- New Maharashtra Car Motors — Admin Panel Enhancement
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: customer_deals
-- Tracks every buy/sell/exchange deal with all key dates and linkages
-- Per-deal approach: a customer who both buys and sells has separate deal rows
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_deals (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Core relationships
    customer_id         UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    seller_customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
        -- ^ If it's a purchase deal: customer_id = buyer, seller_customer_id = previous owner (if in our system)
        -- ^ If it's a sell deal: customer_id = the person selling TO us, seller_customer_id = NULL
    inventory_id        UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    lead_id             UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    sale_id             UUID REFERENCES public.sales(id) ON DELETE SET NULL,

    -- Deal metadata
    deal_type           TEXT NOT NULL DEFAULT 'purchase'
                            CHECK (deal_type IN ('purchase', 'sell_to_us', 'exchange', 'consignment')),
    deal_status         TEXT NOT NULL DEFAULT 'in_progress'
                            CHECK (deal_status IN ('in_progress', 'completed', 'cancelled', 'on_hold')),

    -- Key Dates (the heart of the tracking system)
    inquiry_date        DATE,       -- When customer first inquired
    deal_date           DATE,       -- Date deal was finalised / agreed
    rto_date            DATE,       -- RC transfer / RTO processing date
    delivery_date       DATE,       -- Scheduled delivery date
    handover_date       DATE,       -- Actual physical handover date
    hypothecation_clearance_date DATE, -- When loan/hypothecation was cleared

    -- Financial summary
    total_amount        NUMERIC(14, 2),
    advance_paid        NUMERIC(14, 2) DEFAULT 0,
    balance_due         NUMERIC(14, 2) DEFAULT 0,
    payment_mode        TEXT,       -- Cash, Cheque, Online, Finance

    -- Notes
    notes               TEXT,
    internal_notes      TEXT,

    -- Audit
    created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_deals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_deals_customer_id   ON public.customer_deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_deals_inventory_id  ON public.customer_deals(inventory_id);
CREATE INDEX IF NOT EXISTS idx_customer_deals_lead_id       ON public.customer_deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_customer_deals_deal_status   ON public.customer_deals(deal_status);
CREATE INDEX IF NOT EXISTS idx_customer_deals_deal_date     ON public.customer_deals(deal_date DESC);

-- RLS: Admin full access, Staff can view
DROP POLICY IF EXISTS "admin_full_access_deals"  ON public.customer_deals;
DROP POLICY IF EXISTS "staff_view_deals"         ON public.customer_deals;
DROP POLICY IF EXISTS "staff_insert_deals"       ON public.customer_deals;

CREATE POLICY "admin_full_access_deals" ON public.customer_deals FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "staff_view_deals" ON public.customer_deals FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')));

CREATE POLICY "staff_insert_deals" ON public.customer_deals FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')));

CREATE POLICY "staff_update_deals" ON public.customer_deals FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')));


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: customer_documents
-- All documents per customer, grouped per deal + per party role
-- Supports expiry date tracking for alerts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_documents (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Relationships
    customer_id     UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    deal_id         UUID REFERENCES public.customer_deals(id) ON DELETE SET NULL,
        -- ^ NULL deal_id = general customer document (e.g. ID proof stored at account level)
        -- ^ Non-NULL deal_id = document belongs to a specific deal

    -- Document type classification
    doc_type        TEXT NOT NULL CHECK (doc_type IN (
                        'aadhaar', 'pan', 'voter_id', 'passport', 'driving_license',
                        'rc_book', 'insurance', 'puc', 'noc',
                        'form_20', 'form_21', 'form_29', 'form_30',
                        'hypothecation_letter', 'loan_noc', 'bank_noc',
                        'delivery_receipt', 'sales_invoice', 'rto_receipt',
                        'agreement', 'cheque_copy', 'other'
                    )),
    doc_label       TEXT,           -- Custom label override (e.g. "Wife's Aadhaar")

    -- Party role: who this document belongs to in the context of the deal
    party_role      TEXT NOT NULL DEFAULT 'buyer'
                        CHECK (party_role IN ('buyer', 'seller', 'general')),
        -- buyer   = document of the person buying the car
        -- seller  = document of the person selling the car (to us or their old car)
        -- general = general customer identity doc not tied to a deal side

    -- File storage
    file_name       TEXT,           -- Original filename
    file_url        TEXT,           -- Supabase Storage URL OR external URL
    file_size_kb    INTEGER,

    -- Dates
    issue_date      DATE,           -- When the document was issued
    expiry_date     DATE,           -- NULL = no expiry (e.g. Aadhaar); set for insurance, PUC, etc.

    -- Status & notes
    is_verified     BOOLEAN DEFAULT false,
    notes           TEXT,

    -- Audit
    uploaded_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_docs_customer_id ON public.customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_deal_id     ON public.customer_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_expiry      ON public.customer_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_docs_doc_type    ON public.customer_documents(doc_type);

-- RLS
DROP POLICY IF EXISTS "admin_full_access_docs"  ON public.customer_documents;
DROP POLICY IF EXISTS "staff_view_docs"         ON public.customer_documents;
DROP POLICY IF EXISTS "staff_insert_docs"       ON public.customer_documents;
DROP POLICY IF EXISTS "staff_update_docs"       ON public.customer_documents;

CREATE POLICY "admin_full_access_docs" ON public.customer_documents FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "staff_view_docs" ON public.customer_documents FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')));

CREATE POLICY "staff_insert_docs" ON public.customer_documents FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')));

CREATE POLICY "staff_update_docs" ON public.customer_documents FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff')));


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: get_expiring_documents
-- Returns all documents expiring within the next N days, joined with customer info
-- Used by CustomerAlerts page and smart notification engine
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_expiring_documents(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
    doc_id          UUID,
    customer_id     UUID,
    customer_name   TEXT,
    customer_phone  TEXT,
    deal_id         UUID,
    deal_type       TEXT,
    doc_type        TEXT,
    doc_label       TEXT,
    party_role      TEXT,
    expiry_date     DATE,
    days_remaining  INTEGER,
    is_expired      BOOLEAN,
    file_url        TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cd.id                                                   AS doc_id,
        cd.customer_id,
        c.full_name                                             AS customer_name,
        c.phone                                                 AS customer_phone,
        cd.deal_id,
        deals.deal_type,
        cd.doc_type,
        cd.doc_label,
        cd.party_role,
        cd.expiry_date,
        (cd.expiry_date - CURRENT_DATE)::INTEGER                AS days_remaining,
        (cd.expiry_date < CURRENT_DATE)                         AS is_expired,
        cd.file_url
    FROM public.customer_documents cd
    LEFT JOIN public.customers c        ON c.id  = cd.customer_id
    LEFT JOIN public.customer_deals deals ON deals.id = cd.deal_id
    WHERE
        cd.expiry_date IS NOT NULL
        AND cd.expiry_date <= (CURRENT_DATE + days_ahead)
    ORDER BY
        cd.expiry_date ASC;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_expiring_documents(INTEGER) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-update updated_at timestamps
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_customer_deals ON public.customer_deals;
CREATE TRIGGER set_updated_at_customer_deals
    BEFORE UPDATE ON public.customer_deals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_customer_documents ON public.customer_documents;
CREATE TRIGGER set_updated_at_customer_documents
    BEFORE UPDATE ON public.customer_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: customer-documents bucket (metadata only — create bucket manually in Supabase dashboard if not existing)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('customer-documents', 'customer-documents', false) ON CONFLICT DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────

-- Done!
SELECT 'Migration complete: customer_deals, customer_documents tables created.' AS status;
