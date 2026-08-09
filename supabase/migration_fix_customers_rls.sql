-- Secure RLS policies for customers table
-- This ensures that only admins can delete customers. Staff can still create, read, and update.

DROP POLICY IF EXISTS "Enable all actions for public" ON public.customers;
DROP POLICY IF EXISTS "Admins have full access to customers" ON public.customers;
DROP POLICY IF EXISTS "All staff can view customers" ON public.customers;
DROP POLICY IF EXISTS "All staff can insert customers" ON public.customers;
DROP POLICY IF EXISTS "All staff can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admin only can delete customers" ON public.customers;

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 1. Read
CREATE POLICY "All staff can view customers" ON public.customers FOR SELECT USING (true);

-- 2. Insert
CREATE POLICY "All staff can insert customers" ON public.customers FOR INSERT WITH CHECK (true);

-- 3. Update
CREATE POLICY "All staff can update customers" ON public.customers FOR UPDATE USING (true);

-- 4. Delete
CREATE POLICY "Admin only can delete customers" ON public.customers FOR DELETE USING (is_admin());
