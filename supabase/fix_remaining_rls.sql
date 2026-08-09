-- =============================================================
-- FIX: Staff RLS Access for Remaining Modules
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================

-- ─── Step 1: Fix OPERATIONS tables for staff ──────────────────────────────────
-- Tables: inspections, vehicle_expenses, documents

DROP POLICY IF EXISTS "Staff can view inspections" ON inspections;
DROP POLICY IF EXISTS "Staff can manage inspections" ON inspections;
CREATE POLICY "Staff can view inspections" ON inspections FOR SELECT USING (is_staff() AND staff_can_view('operations'));
CREATE POLICY "Staff can manage inspections" ON inspections FOR ALL USING (is_staff() AND staff_can_manage('operations'));

DROP POLICY IF EXISTS "Staff can view vehicle_expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "Staff can manage vehicle_expenses" ON vehicle_expenses;
CREATE POLICY "Staff can view vehicle_expenses" ON vehicle_expenses FOR SELECT USING (is_staff() AND staff_can_view('operations'));
CREATE POLICY "Staff can manage vehicle_expenses" ON vehicle_expenses FOR ALL USING (is_staff() AND staff_can_manage('operations'));

DROP POLICY IF EXISTS "Staff can view documents" ON documents;
DROP POLICY IF EXISTS "Staff can manage documents" ON documents;
CREATE POLICY "Staff can view documents" ON documents FOR SELECT USING (is_staff() AND staff_can_view('operations'));
CREATE POLICY "Staff can manage documents" ON documents FOR ALL USING (is_staff() AND staff_can_manage('operations'));

-- ─── Step 2: Fix SALES table for staff ────────────────────────────────────────
-- Tables: sales

-- Note: wrap in DO block in case the table doesn't exist yet, to prevent script errors
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales') THEN
        DROP POLICY IF EXISTS "Staff can view sales" ON sales;
        DROP POLICY IF EXISTS "Staff can manage sales" ON sales;
        
        -- Create policies
        EXECUTE 'CREATE POLICY "Staff can view sales" ON sales FOR SELECT USING (is_staff() AND staff_can_view(''sales''))';
        EXECUTE 'CREATE POLICY "Staff can manage sales" ON sales FOR ALL USING (is_staff() AND staff_can_manage(''sales''))';
    END IF;
END $$;

-- ─── Step 3: Fix FINANCE tables for staff ──────────────────────────────────────
-- Tables: accounts, commissions, tax_records (if exist)

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounts') THEN
        DROP POLICY IF EXISTS "Staff can view accounts" ON accounts;
        DROP POLICY IF EXISTS "Staff can manage accounts" ON accounts;
        EXECUTE 'CREATE POLICY "Staff can view accounts" ON accounts FOR SELECT USING (is_staff() AND staff_can_view(''finance''))';
        EXECUTE 'CREATE POLICY "Staff can manage accounts" ON accounts FOR ALL USING (is_staff() AND staff_can_manage(''finance''))';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'commissions') THEN
        DROP POLICY IF EXISTS "Staff can view commissions" ON commissions;
        DROP POLICY IF EXISTS "Staff can manage commissions" ON commissions;
        EXECUTE 'CREATE POLICY "Staff can view commissions" ON commissions FOR SELECT USING (is_staff() AND staff_can_view(''finance''))';
        EXECUTE 'CREATE POLICY "Staff can manage commissions" ON commissions FOR ALL USING (is_staff() AND staff_can_manage(''finance''))';
    END IF;
END $$;

-- ─── Step 4: Fix DEALERS table for staff ──────────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dealers') THEN
        DROP POLICY IF EXISTS "Staff can view dealers" ON dealers;
        DROP POLICY IF EXISTS "Staff can manage dealers" ON dealers;
        EXECUTE 'CREATE POLICY "Staff can view dealers" ON dealers FOR SELECT USING (is_staff() AND staff_can_view(''dealers''))';
        EXECUTE 'CREATE POLICY "Staff can manage dealers" ON dealers FOR ALL USING (is_staff() AND staff_can_manage(''dealers''))';
    END IF;
END $$;

-- ─── Step 5: Fix CONSIGNMENTS table for staff ──────────────────────────────────
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'consignments') THEN
        DROP POLICY IF EXISTS "Staff can view consignments" ON consignments;
        DROP POLICY IF EXISTS "Staff can manage consignments" ON consignments;
        EXECUTE 'CREATE POLICY "Staff can view consignments" ON consignments FOR SELECT USING (is_staff() AND staff_can_view(''inventory''))';
        EXECUTE 'CREATE POLICY "Staff can manage consignments" ON consignments FOR ALL USING (is_staff() AND staff_can_manage(''inventory''))';
    END IF;
END $$;

-- =============================================================
-- DONE. Staff members now have appropriate RLS access to remaining modules.
-- =============================================================
