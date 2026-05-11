-- ============================================================================
-- Phase 2 — Threading, Reactions, Edit/Delete
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Threading: reply_to_id on messages
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON messages (reply_to_id) WHERE reply_to_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Edit/Delete: soft delete + edit tracking on messages
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- Reactions: 6 fixed emoji per message per user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       text NOT NULL CHECK (emoji IN ('👍', '❤️', '✅', '👀', '🎉', '🤔')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS reactions_message_idx ON message_reactions (message_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can read reactions on messages they can see (room membership)
CREATE POLICY "Read reactions via room membership"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = auth.uid()
      WHERE m.id = message_reactions.message_id
    )
  );

-- Users can add/remove their own reactions
CREATE POLICY "Users manage own reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
