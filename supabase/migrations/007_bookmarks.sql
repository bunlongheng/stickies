CREATE TABLE IF NOT EXISTS bookmarks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL DEFAULT '',
  url        TEXT        NOT NULL,
  folder     TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
