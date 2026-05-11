-- ============================================================================
-- Phase 2 — Full-text search indexes
-- Adds tsvector columns and GIN indexes for messages, tasks, tickets.
-- Search is RLS-scoped: queries go through the user's session, not service role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- messages: search on body
-- ---------------------------------------------------------------------------
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(body, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS messages_search_idx ON messages USING gin(search_vector);

-- ---------------------------------------------------------------------------
-- tasks: search on title + description
-- ---------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS tasks_search_idx ON tasks USING gin(search_vector);

-- ---------------------------------------------------------------------------
-- tickets: search on title + description + ticket_number
-- ---------------------------------------------------------------------------
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(ticket_number, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS tickets_search_idx ON tickets USING gin(search_vector);
