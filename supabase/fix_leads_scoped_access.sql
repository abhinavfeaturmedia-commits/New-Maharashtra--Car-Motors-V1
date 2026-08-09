-- =============================================================
-- FIX: Scoped Lead Access — Staff see only their own leads
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================
-- Logic:
--   Admin → sees ALL leads (no restriction)
--   Staff → sees ONLY leads where:
--              created_by = auth.uid()   (they manually created the lead)
--           OR assigned_to = auth.uid()  (admin assigned it to them)
-- =============================================================

-- ─── Step 1: Add created_by column to leads table ───────────────────────────
-- This tracks which staff/admin manually created the lead
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;


-- ─── Step 2: Drop previous staff lead policies (from fix_staff_leads_access.sql) ───
DROP POLICY IF EXISTS "Staff can view leads"   ON leads;
DROP POLICY IF EXISTS "Staff can update leads" ON leads;
DROP POLICY IF EXISTS "Staff can insert leads" ON leads;
DROP POLICY IF EXISTS "Staff can delete leads" ON leads;


-- ─── Step 3: Recreate staff policies with SCOPED access ────────────────────

-- Staff can VIEW only leads they created OR are assigned to
CREATE POLICY "Staff can view leads"
  ON leads FOR SELECT
  USING (
    is_staff()
    AND staff_can_view('leads')
    AND (
      created_by  = auth.uid()
      OR assigned_to = auth.uid()
    )
  );

-- Staff can UPDATE only leads they created OR are assigned to (if manage perm)
CREATE POLICY "Staff can update leads"
  ON leads FOR UPDATE
  USING (
    is_staff()
    AND staff_can_manage('leads')
    AND (
      created_by  = auth.uid()
      OR assigned_to = auth.uid()
    )
  );

-- Staff can INSERT new leads (created_by will be set to their ID by the app)
CREATE POLICY "Staff can insert leads"
  ON leads FOR INSERT
  WITH CHECK (
    is_staff()
    AND staff_can_manage('leads')
  );

-- Staff can DELETE only leads they created OR are assigned to (if manage perm)
CREATE POLICY "Staff can delete leads"
  ON leads FOR DELETE
  USING (
    is_staff()
    AND staff_can_manage('leads')
    AND (
      created_by  = auth.uid()
      OR assigned_to = auth.uid()
    )
  );


-- ─── Step 4: Keep Admin policy untouched (already correct from previous fix) ──
-- "Admins have full access to leads" ON leads FOR ALL USING (is_admin())
-- This was set in fix_staff_leads_access.sql — no change needed.


-- =============================================================
-- DONE.
-- =============================================================
