-- ─── Video Reviews Table ──────────────────────────────────────────────────────
-- Stores YouTube video testimonials (full videos and Shorts) managed from admin.
-- Admins can add, edit, reorder, and toggle visibility of reviews.

CREATE TABLE IF NOT EXISTS video_reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    video_url    TEXT NOT NULL,
    customer_name TEXT,
    rating       SMALLINT NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
    video_type   TEXT NOT NULL DEFAULT 'video' CHECK (video_type IN ('video', 'short')),
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast ordered listing
CREATE INDEX IF NOT EXISTS video_reviews_sort_order_idx ON video_reviews (sort_order ASC, created_at DESC);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE video_reviews ENABLE ROW LEVEL SECURITY;

-- Public can read active reviews (for Home page testimonials section)
CREATE POLICY "Public can read active video reviews"
    ON video_reviews FOR SELECT
    USING (is_active = TRUE);

-- Admins (authenticated users with admin role) can do everything
CREATE POLICY "Admins can manage video reviews"
    ON video_reviews FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );
