-- ============================================================
-- MIGRATION: Fix leads table constraints
-- Run this in: Supabase → SQL Editor → New Query
-- ============================================================

-- Step 1: Drop the old (incorrect) type constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_type_check;

-- Step 2: Re-add type constraint with all required values
ALTER TABLE leads ADD CONSTRAINT leads_type_check
  CHECK (type IN ('contact', 'sell_car', 'insurance', 'general', 'test_drive', 'service'));

-- Step 3: Drop the old (mismatched) status constraint  
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Step 4: Re-add status constraint matching the frontend ('negotiation' not 'negotiating')
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'contacted', 'qualified', 'negotiation', 'closed_won', 'closed_lost'));

-- Verify: Check existing data won't violate new constraints (should return empty)
SELECT id, type, status FROM leads
  WHERE type NOT IN ('contact', 'sell_car', 'insurance', 'general', 'test_drive', 'service')
     OR status NOT IN ('new', 'contacted', 'qualified', 'negotiation', 'closed_won', 'closed_lost');
