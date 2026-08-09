-- Add verification columns to staff_commitments
ALTER TABLE public.staff_commitments 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add verification columns to staff_daily_reports
ALTER TABLE public.staff_daily_reports 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Drop and replace UPDATE policies for staff members to prevent editing verified records
DROP POLICY IF EXISTS "Users can update own commitments" ON staff_commitments;
CREATE POLICY "Users can update own commitments" 
    ON staff_commitments FOR UPDATE 
    USING (auth.uid() = user_id AND is_verified = FALSE);

DROP POLICY IF EXISTS "Users can update own reports" ON staff_daily_reports;
CREATE POLICY "Users can update own reports" 
    ON staff_daily_reports FOR UPDATE 
    USING (auth.uid() = user_id AND is_verified = FALSE);
