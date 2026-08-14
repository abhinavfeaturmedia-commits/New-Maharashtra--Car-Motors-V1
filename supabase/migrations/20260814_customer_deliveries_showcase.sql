-- ==============================================================================
-- Migration: Customer Deliveries / Happy Customer Showcase
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.customer_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    
    customer_name TEXT NOT NULL,
    customer_city TEXT DEFAULT 'Pune',
    car_title TEXT NOT NULL,
    registration_no TEXT,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    photo_url TEXT NOT NULL,
    additional_photos TEXT[] DEFAULT '{}',
    review_quote TEXT,
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    
    video_url TEXT,
    is_featured BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{"Certified Pre-Owned", "Verified Buyer"}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_deliveries_featured 
    ON public.customer_deliveries(is_featured, display_order, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_deliveries_customer 
    ON public.customer_deliveries(customer_id);

-- Enable RLS
ALTER TABLE public.customer_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public can view customer deliveries" ON public.customer_deliveries;
CREATE POLICY "Public can view customer deliveries" ON public.customer_deliveries
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage customer deliveries" ON public.customer_deliveries;
CREATE POLICY "Admins can manage customer deliveries" ON public.customer_deliveries
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
