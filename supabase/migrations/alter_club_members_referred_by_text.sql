-- ==============================================================================
-- DATABASE MIGRATION: CHANGE REFERRED_BY COLUMN TO TEXT
-- ==============================================================================

-- 1. Drop foreign key constraint on referred_by if it exists
ALTER TABLE public.club_members DROP CONSTRAINT IF EXISTS club_members_referred_by_fkey;

-- 2. Alter column type to TEXT
ALTER TABLE public.club_members ALTER COLUMN referred_by TYPE TEXT;
