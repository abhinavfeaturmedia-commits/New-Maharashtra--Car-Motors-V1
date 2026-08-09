-- =============================================================
-- FIX: Staff RLS Access for Leads and Other Modules
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================
-- Problem: Staff users with 'leads' permission granted in user_permissions
-- could NOT see leads because the RLS policy only checked is_admin()
-- or auth.uid() = user_id (the public customer's user_id, not staff).
-- This script adds a staff check function and fixes RLS policies.
-- =============================================================


-- ─── Step 0: Ensure user_permissions table exists (with RLS) ────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_manage BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, module)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all permissions
DROP POLICY IF EXISTS "Admins have full access to user_permissions" ON user_permissions;
CREATE POLICY "Admins have full access to user_permissions"
  ON user_permissions FOR ALL USING (is_admin());


-- ─── Step 1: Create helper function to check if current user is an active staff member ───
-- This checks the profiles table for 'staff' role and is_active = true
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'staff' AND is_active = true
  );
END;
$$;

-- ─── Step 2: Create helper function to check staff permission for a given module ───
-- This queries the user_permissions table for the current user
CREATE OR REPLACE FUNCTION staff_can_view(module_name TEXT)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid() AND module = module_name AND can_view = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION staff_can_manage(module_name TEXT)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_permissions
    WHERE user_id = auth.uid() AND module = module_name AND can_manage = true
  );
END;
$$;

-- ─── Step 3: Fix LEADS table RLS policies ───────────────────────────────────────────
-- Drop the old admin-only select policy and replace with one that includes staff
DROP POLICY IF EXISTS "Admins have full access to leads" ON leads;
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Staff can view leads" ON leads;
DROP POLICY IF EXISTS "Staff can manage leads" ON leads;
DROP POLICY IF EXISTS "Admins and Staff can view leads" ON leads;
DROP POLICY IF EXISTS "Admins and Staff can manage leads" ON leads;

-- Admins retain full access
CREATE POLICY "Admins have full access to leads"
  ON leads FOR ALL USING (is_admin());

-- Customers can view their own submitted leads (via website)
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT USING (auth.uid() = user_id);

-- Staff with view permission can see ALL leads
CREATE POLICY "Staff can view leads"
  ON leads FOR SELECT
  USING (is_staff() AND staff_can_view('leads'));

-- Staff with manage permission can update leads (change status, assign, etc.)
CREATE POLICY "Staff can update leads"
  ON leads FOR UPDATE
  USING (is_staff() AND staff_can_manage('leads'));

-- Staff with manage permission can insert leads
CREATE POLICY "Staff can insert leads"
  ON leads FOR INSERT
  WITH CHECK (is_staff() AND staff_can_manage('leads'));

-- Staff with manage permission can delete leads
CREATE POLICY "Staff can delete leads"
  ON leads FOR DELETE
  USING (is_staff() AND staff_can_manage('leads'));


-- ─── Step 4: Fix TASKS table RLS for staff ───────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can manage tasks" ON tasks;

CREATE POLICY "Staff can view tasks"
  ON tasks FOR SELECT
  USING (is_staff() AND staff_can_view('leads'));

CREATE POLICY "Staff can manage tasks"
  ON tasks FOR ALL
  USING (is_staff() AND staff_can_manage('leads'));


-- ─── Step 5: Fix BOOKINGS tables for staff ──────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view service bookings" ON service_bookings;
DROP POLICY IF EXISTS "Staff can manage service bookings" ON service_bookings;
DROP POLICY IF EXISTS "Staff can view test drive bookings" ON test_drive_bookings;
DROP POLICY IF EXISTS "Staff can manage test drive bookings" ON test_drive_bookings;

CREATE POLICY "Staff can view service bookings"
  ON service_bookings FOR SELECT
  USING (is_staff() AND staff_can_view('bookings'));

CREATE POLICY "Staff can manage service bookings"
  ON service_bookings FOR ALL
  USING (is_staff() AND staff_can_manage('bookings'));

CREATE POLICY "Staff can view test drive bookings"
  ON test_drive_bookings FOR SELECT
  USING (is_staff() AND staff_can_view('bookings'));

CREATE POLICY "Staff can manage test drive bookings"
  ON test_drive_bookings FOR ALL
  USING (is_staff() AND staff_can_manage('bookings'));


-- ─── Step 6: Fix INVENTORY table for staff ──────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view inventory" ON inventory;
DROP POLICY IF EXISTS "Staff can manage inventory" ON inventory;

CREATE POLICY "Staff can view inventory"
  ON inventory FOR SELECT
  USING (is_staff() AND staff_can_view('inventory'));

CREATE POLICY "Staff can manage inventory"
  ON inventory FOR ALL
  USING (is_staff() AND staff_can_manage('inventory'));


-- ─── Step 7: Fix CUSTOMERS table for staff ──────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view customers" ON customers;
DROP POLICY IF EXISTS "Staff can manage customers" ON customers;

CREATE POLICY "Staff can view customers"
  ON customers FOR SELECT
  USING (is_staff() AND staff_can_view('crm'));

CREATE POLICY "Staff can manage customers"
  ON customers FOR ALL
  USING (is_staff() AND staff_can_manage('crm'));


-- ─── Step 8: Fix FOLLOW_UPS table for staff ─────────────────────────────────────────
DROP POLICY IF EXISTS "Staff can view follow_ups" ON follow_ups;
DROP POLICY IF EXISTS "Staff can manage follow_ups" ON follow_ups;

CREATE POLICY "Staff can view follow_ups"
  ON follow_ups FOR SELECT
  USING (is_staff() AND staff_can_view('crm'));

CREATE POLICY "Staff can manage follow_ups"
  ON follow_ups FOR ALL
  USING (is_staff() AND staff_can_manage('crm'));


-- ─── Step 9: Grant staff read access to profiles (needed for user lists in dropdowns) ─
DROP POLICY IF EXISTS "Staff can view profiles" ON profiles;

CREATE POLICY "Staff can view profiles"
  ON profiles FOR SELECT
  USING (is_staff());


-- ─── Step 10: Staff can read their own permissions ───────────────────────────────────
DROP POLICY IF EXISTS "Staff can read own permissions" ON user_permissions;

CREATE POLICY "Staff can read own permissions"
  ON user_permissions FOR SELECT
  USING (auth.uid() = user_id);


-- =============================================================
-- DONE. Staff members with leads permission can now see leads.
-- =============================================================
