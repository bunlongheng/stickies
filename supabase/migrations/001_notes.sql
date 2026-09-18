-- ============================================================
-- 001: notes — the core table (predates all other migrations)
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT         NOT NULL DEFAULT '',
  content          TEXT         NOT NULL DEFAULT '',
  folder_name      TEXT         NOT NULL DEFAULT 'General',
  folder_color     TEXT         NOT NULL DEFAULT '#007AFF',
  folder_id        UUID,                                         -- optional FK to self (folder row)
  parent_folder_name TEXT,
  is_folder        BOOLEAN      NOT NULL DEFAULT false,
  list_mode        BOOLEAN               DEFAULT false,
  "order"          INTEGER      NOT NULL DEFAULT 0,
  images           JSONB        NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_folder_name_idx ON notes (folder_name);
CREATE INDEX IF NOT EXISTS notes_folder_id_idx   ON notes (folder_id);
CREATE INDEX IF NOT EXISTS notes_order_idx        ON notes ("order");
