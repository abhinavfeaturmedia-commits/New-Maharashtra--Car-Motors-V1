-- ==============================================================================
-- SALE CONVERSION CASCADE MIGRATION & TRIGGERS
-- New Maharashtra Car Motors — Admin Panel Fix
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- 1. Ensure sales table has customer_id index
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);

-- 2. Function to auto-create customer_deals record whenever a sale is inserted
CREATE OR REPLACE FUNCTION public.handle_sale_conversion_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id UUID := NEW.customer_id;
    v_car_make TEXT;
    v_car_model TEXT;
    v_car_year INT;
BEGIN
    -- If customer_id is missing but phone exists, attempt to lookup or create customer
    IF v_customer_id IS NULL AND NEW.customer_phone IS NOT NULL AND NEW.customer_phone <> '' THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE phone = NEW.customer_phone LIMIT 1;
        
        IF v_customer_id IS NULL AND NEW.customer_name IS NOT NULL AND NEW.customer_name <> '' THEN
            INSERT INTO public.customers (full_name, phone, email, created_at)
            VALUES (NEW.customer_name, NEW.customer_phone, NEW.customer_email, NOW())
            RETURNING id INTO v_customer_id;
        END IF;

        -- Update sales row with resolved customer_id
        IF v_customer_id IS NOT NULL THEN
            NEW.customer_id := v_customer_id;
        END IF;
    END IF;

    -- Fetch vehicle details if inventory_id is present
    IF NEW.inventory_id IS NOT NULL THEN
        SELECT make, model, year INTO v_car_make, v_car_model, v_car_year
        FROM public.inventory
        WHERE id = NEW.inventory_id;
    END IF;

    -- Auto-insert into customer_deals if customer_id exists & deal not already linked
    IF v_customer_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.customer_deals WHERE sale_id = NEW.id) THEN
            INSERT INTO public.customer_deals (
                customer_id,
                inventory_id,
                lead_id,
                sale_id,
                deal_type,
                deal_status,
                deal_date,
                handover_date,
                total_amount,
                advance_paid,
                balance_due,
                payment_mode,
                notes,
                created_at
            ) VALUES (
                v_customer_id,
                NEW.inventory_id,
                NEW.lead_id,
                NEW.id,
                COALESCE(NEW.sale_type, 'purchase'),
                'completed',
                COALESCE(NEW.sale_date, CURRENT_DATE),
                COALESCE(NEW.sale_date, CURRENT_DATE),
                COALESCE(NEW.final_price, NEW.sale_price, 0),
                COALESCE(NEW.final_price, NEW.sale_price, 0),
                0,
                'Paid',
                COALESCE(NEW.notes, 'Sale record completed'),
                NOW()
            );
        END IF;

        -- Auto-insert a customer note for the communication timeline
        IF NOT EXISTS (
            SELECT 1 FROM public.customer_notes 
            WHERE customer_id = v_customer_id 
              AND content ILIKE '%' || COALESCE(v_car_model, 'Vehicle') || '%'
        ) THEN
            INSERT INTO public.customer_notes (
                customer_id,
                note_type,
                content,
                created_at
            ) VALUES (
                v_customer_id,
                'general',
                '🎉 Vehicle Purchased: ' || COALESCE(v_car_year::TEXT, '') || ' ' || COALESCE(v_car_make, '') || ' ' || COALESCE(v_car_model, 'Car') || ' for ₹' || COALESCE(NEW.final_price, NEW.sale_price, 0)::TEXT,
                NOW()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_sale_conversion_cascade ON public.sales;
CREATE TRIGGER trigger_sale_conversion_cascade
    BEFORE INSERT ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_sale_conversion_cascade();

SELECT 'Sale conversion cascade triggers created successfully' AS status;
