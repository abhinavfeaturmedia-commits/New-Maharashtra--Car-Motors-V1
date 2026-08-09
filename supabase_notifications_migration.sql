-- ============================================================
-- Smart Notifications System Migration
-- Run in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS smart_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('critical', 'insight', 'staff', 'inventory', 'workflow')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT DEFAULT 'notifications',
  color TEXT DEFAULT 'blue',
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 4),
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  action_url TEXT,
  action_label TEXT,
  related_entity_type TEXT,
  related_entity_id TEXT,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  dedup_key TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_smart_notif_active ON smart_notifications(is_dismissed) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_smart_notif_priority ON smart_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_smart_notif_created_at ON smart_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_notif_dedup_key ON smart_notifications(dedup_key);
CREATE INDEX IF NOT EXISTS idx_smart_notif_assigned ON smart_notifications(assigned_to_user_id);

-- RLS
ALTER TABLE smart_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view_relevant_notifications" ON smart_notifications;
DROP POLICY IF EXISTS "insert_notifications" ON smart_notifications;
DROP POLICY IF EXISTS "update_relevant_notifications" ON smart_notifications;

-- SELECT: Admin sees all; Staff sees only their assigned notifications
CREATE POLICY "view_relevant_notifications"
  ON smart_notifications FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR assigned_to_user_id = auth.uid()
  );

-- INSERT: Any authenticated user can create
CREATE POLICY "insert_notifications"
  ON smart_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- UPDATE: Admin can update all; Staff can update their own
CREATE POLICY "update_relevant_notifications"
  ON smart_notifications FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR assigned_to_user_id = auth.uid()
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE smart_notifications;
