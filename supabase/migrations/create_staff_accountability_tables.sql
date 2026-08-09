-- Create staff_commitments table
CREATE TABLE IF NOT EXISTS staff_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    deal INTEGER NOT NULL DEFAULT 0,
    calls INTEGER NOT NULL DEFAULT 0,
    crm_lead INTEGER NOT NULL DEFAULT 0,
    crm_car_post INTEGER NOT NULL DEFAULT 0,
    olx_car_post INTEGER NOT NULL DEFAULT 0,
    fb_marketplace INTEGER NOT NULL DEFAULT 0,
    reel_creation INTEGER NOT NULL DEFAULT 0,
    visits INTEGER NOT NULL DEFAULT 0,
    add_new_dealer_list INTEGER NOT NULL DEFAULT 0,
    add_new_club_member INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT staff_commitments_user_id_date_key UNIQUE (user_id, date)
);

-- Create staff_daily_reports table
CREATE TABLE IF NOT EXISTS staff_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    calling INTEGER NOT NULL DEFAULT 0,
    follow_up INTEGER NOT NULL DEFAULT 0,
    walking INTEGER NOT NULL DEFAULT 0,
    hot INTEGER NOT NULL DEFAULT 0,
    total_success INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT staff_daily_reports_user_id_date_key UNIQUE (user_id, date)
);

-- Enable RLS on both tables
ALTER TABLE staff_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_daily_reports ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (to make re-runnable)
DROP POLICY IF EXISTS "Admins have full access to staff_commitments" ON staff_commitments;
DROP POLICY IF EXISTS "Users can view own commitments" ON staff_commitments;
DROP POLICY IF EXISTS "Users can insert own commitments" ON staff_commitments;
DROP POLICY IF EXISTS "Users can update own commitments" ON staff_commitments;

DROP POLICY IF EXISTS "Admins have full access to staff_daily_reports" ON staff_daily_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON staff_daily_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON staff_daily_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON staff_daily_reports;

-- Create policies for staff_commitments
CREATE POLICY "Admins have full access to staff_commitments" 
    ON staff_commitments FOR ALL 
    USING (is_admin());

CREATE POLICY "Users can view own commitments" 
    ON staff_commitments FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commitments" 
    ON staff_commitments FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commitments" 
    ON staff_commitments FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create policies for staff_daily_reports
CREATE POLICY "Admins have full access to staff_daily_reports" 
    ON staff_daily_reports FOR ALL 
    USING (is_admin());

CREATE POLICY "Users can view own reports" 
    ON staff_daily_reports FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports" 
    ON staff_daily_reports FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" 
    ON staff_daily_reports FOR UPDATE 
    USING (auth.uid() = user_id);
