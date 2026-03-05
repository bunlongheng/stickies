-- ============================================================
-- Multi-user support: NEW users_stickies table
-- Your existing `notes` table is completely untouched.
-- Run this once in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS users_stickies (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL DEFAULT '',
  content          TEXT         NOT NULL DEFAULT '',
  folder_name      TEXT         NOT NULL DEFAULT 'General',
  folder_color     TEXT         NOT NULL DEFAULT '#007AFF',
  is_folder        BOOLEAN      NOT NULL DEFAULT false,
  "order"          INTEGER      NOT NULL DEFAULT 0,
  parent_folder_name TEXT,
  list_mode        BOOLEAN               DEFAULT false,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_stickies_user_id_idx ON users_stickies(user_id);
CREATE INDEX IF NOT EXISTS users_stickies_folder_idx  ON users_stickies(user_id, folder_name);

-- Enable RLS so the anon client can never leak rows across users
ALTER TABLE users_stickies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_notes" ON users_stickies;
CREATE POLICY "users_own_notes" ON users_stickies
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── push_subscriptions: scope to user (unchanged table, just add user_id) ──
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
