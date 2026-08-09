-- =============================================================
-- FIX: Staff RLS Access for Incentives & Announcements
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================
-- Problem: staff_incentives and staff_announcements tables had
-- no RLS policies allowing staff users to read their own data.
-- Staff with 'incentives' view permission were blocked at DB level.
-- =============================================================

-- ─── Create tables if they don't exist yet ───────────────────

CREATE TABLE IF NOT EXISTS public.staff_incentives (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    reason         TEXT NOT NULL,
    incentive_type TEXT NOT NULL DEFAULT 'bonus',
    month          TEXT NOT NULL,
    notes          TEXT,
    created_by     UUID REFERENCES public.profiles(id),
    created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_announcements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    priority   TEXT NOT NULL DEFAULT 'normal',
    is_pinned  BOOLEAN NOT NULL DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Enable RLS ──────────────────────────────────────────────

ALTER TABLE public.staff_incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_announcements ENABLE ROW LEVEL SECURITY;

-- ─── staff_incentives policies ───────────────────────────────

-- Admins have full access
DROP POLICY IF EXISTS "Admins have full access to staff_incentives" ON public.staff_incentives;
CREATE POLICY "Admins have full access to staff_incentives"
    ON public.staff_incentives FOR ALL
    USING (is_admin());

-- Staff with incentives view permission can read ALL incentives
-- (so leaderboard works — they see the full team)
DROP POLICY IF EXISTS "Staff can view staff_incentives" ON public.staff_incentives;
CREATE POLICY "Staff can view staff_incentives"
    ON public.staff_incentives FOR SELECT
    USING (is_staff() AND staff_can_view('incentives'));

-- ─── staff_announcements policies ────────────────────────────

-- Admins have full access
DROP POLICY IF EXISTS "Admins have full access to staff_announcements" ON public.staff_announcements;
CREATE POLICY "Admins have full access to staff_announcements"
    ON public.staff_announcements FOR ALL
    USING (is_admin());

-- Staff with incentives view permission can read announcements
DROP POLICY IF EXISTS "Staff can view staff_announcements" ON public.staff_announcements;
CREATE POLICY "Staff can view staff_announcements"
    ON public.staff_announcements FOR SELECT
    USING (is_staff() AND staff_can_view('incentives'));

-- ─── Also ensure profiles are readable by staff ──────────────
-- (Needed for the staff:profiles!staff_id join in StaffIncentivesView)
-- This policy was added in fix_staff_leads_access.sql, but recreate safely:
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
CREATE POLICY "Staff can view profiles"
    ON public.profiles FOR SELECT
    USING (is_staff() OR auth.uid() = id);

-- =============================================================
-- DONE. Staff with incentives permission can now view their data.
-- =============================================================
