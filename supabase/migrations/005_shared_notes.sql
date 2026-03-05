-- ============================================================
-- 005: shared_notes — burn-after-read share links
-- ============================================================

CREATE TABLE IF NOT EXISTS shared_notes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  token        TEXT         NOT NULL UNIQUE,
  title        TEXT         NOT NULL DEFAULT '',
  content      TEXT         NOT NULL DEFAULT '',
  color        TEXT         NOT NULL DEFAULT '',
  folder_name  TEXT         NOT NULL DEFAULT '',
  expires_at   TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_notes_token_idx      ON shared_notes (token);
CREATE INDEX IF NOT EXISTS shared_notes_expires_at_idx ON shared_notes (expires_at);
