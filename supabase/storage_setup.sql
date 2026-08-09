-- ============================================================
-- SWAMI MOTORS — SUPABASE STORAGE SETUP
-- Run this script in: Supabase → SQL Editor → New Query
-- ============================================================

-- 1. Create "car-images" bucket if it doesn't exist (and make it public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row Level Security (RLS) on storage.objects just to be safe
-- 2. (Skipped: RLS is enabled by default. 'ALTER TABLE' can cause ownership errors)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any, to avoid conflicts (Optional but recommended)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Admin Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Admin Updates" ON storage.objects;
DROP POLICY IF EXISTS "Admin Deletions" ON storage.objects;

-- 4. Policy: Anyone can read/download images from "car-images"
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'car-images' );

-- 5. Policy: Only authenticated admins can upload images to "car-images"
CREATE POLICY "Admin Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'car-images' AND 
    public.is_admin()
);

-- 6. Policy: Only authenticated admins can update images in "car-images"
CREATE POLICY "Admin Updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'car-images' AND 
    public.is_admin()
);

-- 7. Policy: Only authenticated admins can delete images from "car-images"
CREATE POLICY "Admin Deletions"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'car-images' AND 
    public.is_admin()
);

-- ============================================================
-- DONE! Your inventory form will now be able to upload photos.
-- ============================================================
