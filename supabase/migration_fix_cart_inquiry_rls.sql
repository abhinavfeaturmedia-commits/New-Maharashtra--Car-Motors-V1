-- MIGRATION: Fix Enquiry Submissions, RLS & Create submit_public_lead RPC
-- Date: 2026-08-13

-- 1. Enable public INSERT policy on lead_inventory_items for guest inquiry submissions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'lead_inventory_items' AND policyname = 'Anyone can insert lead_inventory_items'
    ) THEN
        CREATE POLICY "Anyone can insert lead_inventory_items"
        ON public.lead_inventory_items FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 2. Create atomic stored procedure submit_cart_inquiry
CREATE OR REPLACE FUNCTION public.submit_cart_inquiry(
    p_full_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'general',
    p_source TEXT DEFAULT 'catalog_cart',
    p_inventory_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead_id UUID;
    v_inv_id UUID;
BEGIN
    IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RAISE EXCEPTION 'Phone number is required.';
    END IF;

    INSERT INTO public.leads (
        type,
        full_name,
        phone,
        email,
        message,
        source,
        status,
        created_at,
        updated_at
    )
    VALUES (
        COALESCE(NULLIF(TRIM(p_type), ''), 'general'),
        TRIM(p_full_name),
        TRIM(p_phone),
        NULLIF(TRIM(p_email), ''),
        p_message,
        COALESCE(NULLIF(TRIM(p_source), ''), 'catalog_cart'),
        'new',
        NOW(),
        NOW()
    )
    RETURNING id INTO v_lead_id;

    IF p_inventory_ids IS NOT NULL AND array_length(p_inventory_ids, 1) > 0 THEN
        FOREACH v_inv_id IN ARRAY p_inventory_ids LOOP
            IF v_inv_id IS NOT NULL THEN
                INSERT INTO public.lead_inventory_items (lead_id, inventory_id)
                VALUES (v_lead_id, v_inv_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'message', 'Inquiry submitted successfully.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 3. Create all-purpose submit_public_lead stored procedure
CREATE OR REPLACE FUNCTION public.submit_public_lead(
    p_full_name TEXT,
    p_phone TEXT,
    p_email TEXT DEFAULT NULL,
    p_message TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'general',
    p_source TEXT DEFAULT 'website',
    p_car_make TEXT DEFAULT NULL,
    p_car_model TEXT DEFAULT NULL,
    p_car_year INTEGER DEFAULT NULL,
    p_car_mileage INTEGER DEFAULT NULL,
    p_inventory_id UUID DEFAULT NULL,
    p_budget TEXT DEFAULT NULL,
    p_secondary_phone TEXT DEFAULT NULL,
    p_whatsapp_number TEXT DEFAULT NULL,
    p_personal_address TEXT DEFAULT NULL,
    p_inventory_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead_id UUID;
    v_inv_id UUID;
BEGIN
    IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RAISE EXCEPTION 'Phone number is required.';
    END IF;

    INSERT INTO public.leads (
        type,
        full_name,
        phone,
        email,
        message,
        source,
        status,
        car_make,
        car_model,
        car_year,
        car_mileage,
        inventory_id,
        budget,
        secondary_phone,
        whatsapp_number,
        personal_address,
        created_at,
        updated_at
    )
    VALUES (
        COALESCE(NULLIF(TRIM(p_type), ''), 'general'),
        TRIM(p_full_name),
        TRIM(p_phone),
        NULLIF(TRIM(p_email), ''),
        p_message,
        COALESCE(NULLIF(TRIM(p_source), ''), 'website'),
        'new',
        p_car_make,
        p_car_model,
        p_car_year,
        p_car_mileage,
        p_inventory_id,
        p_budget,
        p_secondary_phone,
        p_whatsapp_number,
        p_personal_address,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_lead_id;

    IF p_inventory_ids IS NOT NULL AND array_length(p_inventory_ids, 1) > 0 THEN
        FOREACH v_inv_id IN ARRAY p_inventory_ids LOOP
            IF v_inv_id IS NOT NULL THEN
                INSERT INTO public.lead_inventory_items (lead_id, inventory_id)
                VALUES (v_lead_id, v_inv_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    ELSIF p_inventory_id IS NOT NULL THEN
        INSERT INTO public.lead_inventory_items (lead_id, inventory_id)
        VALUES (v_lead_id, p_inventory_id)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'message', 'Lead submitted successfully.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 4. Grant EXECUTE permissions
GRANT EXECUTE ON FUNCTION public.submit_cart_inquiry TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_lead TO anon, authenticated, service_role;
