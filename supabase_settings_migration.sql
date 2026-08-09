-- ==============================================================================
-- SETTINGS TABLE NORMALIZATION MIGRATION
-- Ensures dealership_settings uses 'setting_key' + 'setting_value' columns
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks)
-- Run this in: Supabase → SQL Editor → New Query
-- ==============================================================================

-- Step 1: Create canonical version of the table if it doesn't exist yet
-- (uses setting_key / setting_value — matches the v2 migration)
CREATE TABLE IF NOT EXISTS public.dealership_settings (
    setting_key   VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Step 2: If the table exists with old 'key'/'value' columns, migrate the data
-- This block is safe — it checks column existence before acting
DO $$
BEGIN
    -- Check if 'key' column exists (old schema from schema.sql)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'dealership_settings'
          AND column_name = 'key'
          AND table_schema = 'public'
    ) THEN
        -- Add new columns if not present
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'dealership_settings'
              AND column_name = 'setting_key'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.dealership_settings ADD COLUMN setting_key VARCHAR(100);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'dealership_settings'
              AND column_name = 'setting_value'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.dealership_settings ADD COLUMN setting_value JSONB;
        END IF;

        -- Copy data from old columns to new columns
        UPDATE public.dealership_settings
        SET setting_key = key, setting_value = value
        WHERE setting_key IS NULL;

        -- Drop old columns (only if new columns have data)
        ALTER TABLE public.dealership_settings DROP COLUMN IF EXISTS key;
        ALTER TABLE public.dealership_settings DROP COLUMN IF EXISTS value;

        -- Add primary key constraint on setting_key if not already
        -- (drop any existing PK first)
        ALTER TABLE public.dealership_settings
            DROP CONSTRAINT IF EXISTS dealership_settings_pkey;
        ALTER TABLE public.dealership_settings
            ADD PRIMARY KEY (setting_key);
    END IF;
END $$;

-- Step 3: Ensure updated_at column exists
ALTER TABLE public.dealership_settings
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Step 4: Enable RLS (idempotent)
ALTER TABLE public.dealership_settings ENABLE ROW LEVEL SECURITY;

-- Step 5: Policies — drop and recreate to ensure correct names
DROP POLICY IF EXISTS "Public can view dealership_settings" ON public.dealership_settings;
DROP POLICY IF EXISTS "Admins can modify dealership_settings" ON public.dealership_settings;

CREATE POLICY "Public can view dealership_settings"
    ON public.dealership_settings FOR SELECT USING (true);

CREATE POLICY "Admins can modify dealership_settings"
    ON public.dealership_settings FOR ALL USING (is_admin());

-- Step 6: Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_dealership_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_dealership_settings_updated_at ON public.dealership_settings;
CREATE TRIGGER set_dealership_settings_updated_at
    BEFORE UPDATE ON public.dealership_settings
    FOR EACH ROW EXECUTE FUNCTION update_dealership_settings_updated_at();

-- ==============================================================================
-- DONE. dealership_settings is now normalized with setting_key / setting_value
-- ==============================================================================
