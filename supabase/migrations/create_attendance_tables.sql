-- ==============================================================================
-- ATTENDANCE MODULE MIGRATION — SWAMI MOTORS
-- Run this in: Supabase → SQL Editor → New Query
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────
-- HELPER: is_staff() — used in RLS policies
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- TABLE: shift_config
-- Defines work shifts per department (or per user override)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,                        -- e.g. "Morning Shift"
  department      TEXT,                                 -- NULL = applies to all
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- NULL = department-level
  start_time      TIME NOT NULL DEFAULT '09:30:00',     -- Shift start
  end_time        TIME NOT NULL DEFAULT '18:30:00',     -- Shift end
  late_threshold  INT  NOT NULL DEFAULT 15,             -- Minutes grace before marking late
  half_day_hours  NUMERIC(4,2) NOT NULL DEFAULT 4.5,   -- Hours below which = half day
  is_default      BOOLEAN DEFAULT false,                -- One default shift
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shift_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to shift_config"
  ON public.shift_config FOR ALL USING (is_admin());
CREATE POLICY "Staff can read shift_config"
  ON public.shift_config FOR SELECT USING (is_staff());

-- Seed a default shift
INSERT INTO public.shift_config (name, start_time, end_time, late_threshold, half_day_hours, is_default)
VALUES ('Standard Shift', '09:30:00', '18:30:00', 15, 4.5, true)
ON CONFLICT DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- TABLE: attendance_holidays
-- Public/company holidays — days auto-marked as paid off
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  date          DATE NOT NULL UNIQUE,
  type          TEXT NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'company', 'optional')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attendance_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to attendance_holidays"
  ON public.attendance_holidays FOR ALL USING (is_admin());
CREATE POLICY "Staff can read attendance_holidays"
  ON public.attendance_holidays FOR SELECT USING (is_staff());


-- ─────────────────────────────────────────────────────────────
-- TABLE: leave_balances
-- Running leave quota and usage per user
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year            INT NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INT,
  casual_total    INT NOT NULL DEFAULT 12,
  casual_used     INT NOT NULL DEFAULT 0,
  sick_total      INT NOT NULL DEFAULT 12,
  sick_used       INT NOT NULL DEFAULT 0,
  earned_total    INT NOT NULL DEFAULT 15,
  earned_used     INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to leave_balances"
  ON public.leave_balances FOR ALL USING (is_admin());
CREATE POLICY "Staff can read own leave_balances"
  ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert own leave_balances"
  ON public.leave_balances FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- TABLE: leave_requests
-- Staff apply for leave; admin approves/rejects
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type      TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'unpaid', 'comp_off')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  days            INT NOT NULL DEFAULT 1,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  admin_note      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to leave_requests"
  ON public.leave_requests FOR ALL USING (is_admin());
CREATE POLICY "Staff can read own leave_requests"
  ON public.leave_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert own leave_requests"
  ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can cancel own pending leave_requests"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- TABLE: attendance_records
-- One row per staff per date — the source of truth for attendance
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in              TIMESTAMPTZ,
  clock_out             TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'absent'
                          CHECK (status IN ('present', 'absent', 'half_day', 'late', 'on_leave', 'holiday', 'weekend')),
  total_hours_worked    NUMERIC(5,2) DEFAULT 0,    -- Computed from clock_in/out
  total_session_minutes INT DEFAULT 0,              -- Active system time (heartbeats)
  break_minutes         INT DEFAULT 0,              -- Total break time in minutes
  overtime_minutes      INT DEFAULT 0,              -- Minutes beyond shift end
  is_late               BOOLEAN DEFAULT false,
  is_early_departure    BOOLEAN DEFAULT false,
  leave_request_id      UUID REFERENCES public.leave_requests(id),
  shift_id              UUID REFERENCES public.shift_config(id),
  admin_note            TEXT,
  override_by           UUID REFERENCES public.profiles(id),   -- Admin who manually edited
  override_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to attendance_records"
  ON public.attendance_records FOR ALL USING (is_admin());
CREATE POLICY "Staff can read own attendance_records"
  ON public.attendance_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert own attendance_records"
  ON public.attendance_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can update own attendance_records"
  ON public.attendance_records FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────────────────────
-- TABLE: attendance_sessions
-- Every login = one session row; heartbeat updates last_seen
-- Multiple sessions per day are collapsed into total_session_minutes
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  session_start   TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_end     TIMESTAMPTZ,
  last_seen       TIMESTAMPTZ DEFAULT now(),
  duration_minutes INT DEFAULT 0,   -- Computed on session_end or heartbeat
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to attendance_sessions"
  ON public.attendance_sessions FOR ALL USING (is_admin());
CREATE POLICY "Staff can read own sessions"
  ON public.attendance_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert own sessions"
  ON public.attendance_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can update own sessions"
  ON public.attendance_sessions FOR UPDATE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- TABLE: attendance_breaks
-- Individual break entries per attendance record
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_breaks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id       UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  break_start     TIMESTAMPTZ NOT NULL DEFAULT now(),
  break_end       TIMESTAMPTZ,
  duration_minutes INT,
  break_type      TEXT DEFAULT 'short' CHECK (break_type IN ('lunch', 'short', 'personal')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access to attendance_breaks"
  ON public.attendance_breaks FOR ALL USING (is_admin());
CREATE POLICY "Staff can read own breaks"
  ON public.attendance_breaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can insert own breaks"
  ON public.attendance_breaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can update own breaks"
  ON public.attendance_breaks FOR UPDATE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- FUNCTION: compute_attendance_stats(p_user_id, p_month, p_year)
-- Returns monthly summary stats for a given user
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_attendance_stats(
  p_user_id UUID,
  p_month   INT,
  p_year    INT
)
RETURNS TABLE (
  working_days        INT,
  present_days        INT,
  absent_days         INT,
  late_days           INT,
  half_days           INT,
  leave_days          INT,
  total_hours         NUMERIC,
  avg_hours_per_day   NUMERIC,
  attendance_pct      NUMERIC,
  total_overtime_hrs  NUMERIC,
  total_session_hrs   NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_working INT;
  v_present INT;
  v_absent  INT;
  v_late    INT;
  v_half    INT;
  v_leave   INT;
  v_hours   NUMERIC;
  v_ot_mins INT;
  v_sess_mins INT;
BEGIN
  -- Count working days (exclude weekends + holidays) in given month
  SELECT COUNT(*)::INT INTO v_working
  FROM generate_series(
    make_date(p_year, p_month, 1),
    (make_date(p_year, p_month, 1) + INTERVAL '1 month - 1 day')::DATE,
    '1 day'::INTERVAL
  ) AS d(day)
  WHERE EXTRACT(DOW FROM d.day) NOT IN (0, 1)   -- Exclude Sun(0) and Mon(1)→ adjust to Sat(6),Sun(0)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_holidays h WHERE h.date = d.day::DATE
    );

  -- Override: Exclude Sun(0) and Sat(6) only
  SELECT COUNT(*)::INT INTO v_working
  FROM generate_series(
    make_date(p_year, p_month, 1),
    (make_date(p_year, p_month, 1) + INTERVAL '1 month - 1 day')::DATE,
    '1 day'::INTERVAL
  ) AS d(day)
  WHERE EXTRACT(DOW FROM d.day) NOT IN (0, 6)
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance_holidays h WHERE h.date = d.day::DATE
    );

  SELECT
    COUNT(*) FILTER (WHERE status = 'present')::INT,
    COUNT(*) FILTER (WHERE status = 'absent')::INT,
    COUNT(*) FILTER (WHERE status = 'late')::INT,
    COUNT(*) FILTER (WHERE status = 'half_day')::INT,
    COUNT(*) FILTER (WHERE status = 'on_leave')::INT,
    COALESCE(SUM(total_hours_worked), 0),
    COALESCE(SUM(overtime_minutes), 0),
    COALESCE(SUM(total_session_minutes), 0)
  INTO v_present, v_absent, v_late, v_half, v_leave, v_hours, v_ot_mins, v_sess_mins
  FROM public.attendance_records
  WHERE user_id = p_user_id
    AND EXTRACT(MONTH FROM date) = p_month
    AND EXTRACT(YEAR  FROM date) = p_year;

  RETURN QUERY SELECT
    v_working,
    COALESCE(v_present, 0),
    COALESCE(v_absent,  0),
    COALESCE(v_late,    0),
    COALESCE(v_half,    0),
    COALESCE(v_leave,   0),
    COALESCE(v_hours,   0),
    CASE WHEN COALESCE(v_present, 0) > 0
         THEN ROUND(COALESCE(v_hours, 0) / v_present, 2)
         ELSE 0 END,
    CASE WHEN v_working > 0
         THEN ROUND(((COALESCE(v_present, 0) + COALESCE(v_half, 0) * 0.5) / v_working) * 100, 1)
         ELSE 0 END,
    ROUND(COALESCE(v_ot_mins, 0)::NUMERIC / 60, 2),
    ROUND(COALESCE(v_sess_mins, 0)::NUMERIC / 60, 2);
END;
$$;

-- ==============================================================================
-- DONE. Run this entire script in Supabase SQL Editor.
-- ==============================================================================
