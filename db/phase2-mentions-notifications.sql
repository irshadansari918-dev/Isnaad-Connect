-- ============================================================================
-- Phase 2 — Mentions & Notifications
-- Tables for tracking @mentions and in-app notifications.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- notifications — in-app notification feed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL, -- 'mention', 'ticket_update', 'task_assigned', 'sla_breach'
  title       text NOT NULL,
  body        text,
  link        text, -- relative URL to navigate to
  read_at     timestamptz,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can insert notifications (via service role or trigger)
-- No INSERT policy for authenticated — notifications created server-side only
