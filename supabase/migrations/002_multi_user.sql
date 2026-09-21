-- ============================================================
-- Multi-user support: NEW users_stickies table
-- Your existing `notes` table is completely untouched.
-- Originally run against Supabase; the auth.users FK and RLS policies were
-- dropped when Supabase Auth was replaced by NextAuth v5 (2026-05-19).
-- ============================================================

CREATE TABLE IF NOT EXISTS users_stickies (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL,
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

-- RLS policies removed with Supabase Auth: every query now runs server-side
-- through the owner gate in app/api/stickies/_auth.ts, never from an anon client.

-- ── push_subscriptions: scope to user (unchanged table, just add user_id) ──
-- push_subscriptions is created later (006). On a fresh database this ALTER would
-- fail, so it only runs when the table already exists; 006 creates it with user_id.
DO $$ BEGIN
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID;
  END IF;
END $$;
