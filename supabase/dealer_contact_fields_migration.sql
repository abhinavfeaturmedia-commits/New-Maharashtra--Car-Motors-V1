-- ============================================================
-- Swami Motors — Dealer Contact Fields Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Add new contact fields to the dealers table
ALTER TABLE public.dealers
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Done! ✓
-- These columns are nullable by default, so no existing records are affected.
