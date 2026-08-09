-- ==============================================================================
-- DATABASE MIGRATION: ALTER CLUB MEMBERS (ADD WHATSAPP, ALTERNATIVE PHONE, ADDRESSES)
-- ==============================================================================

ALTER TABLE public.club_members
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
ADD COLUMN IF NOT EXISTS home_address TEXT,
ADD COLUMN IF NOT EXISTS business_address TEXT;
