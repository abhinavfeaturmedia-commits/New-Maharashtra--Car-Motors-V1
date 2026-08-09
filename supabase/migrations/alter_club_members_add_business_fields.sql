-- ==============================================================================
-- DATABASE MIGRATION: ALTER CLUB MEMBERS (ADD BUSINESS FIELDS, REMOVE TIER)
-- ==============================================================================

-- 1. Add business details columns
ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS business_services TEXT;

-- 2. Drop the tier column (and its associated check constraints/defaults)
ALTER TABLE public.club_members
DROP COLUMN IF EXISTS tier;
