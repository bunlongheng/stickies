-- ============================================================
-- The `stickies` table: every note and folder in the app.
--
-- This is the primary table, but it predates the migration runner and was never
-- captured in a migration, so `npm run migrate` could not build a database from
-- scratch - it died at 010 with `relation "stickies" does not exist`. Numbered 000
-- so it is created before the migrations that alter it.
--
-- Everything is IF NOT EXISTS: on an existing database this is a no-op.
--
-- user_id is TEXT (not UUID) and carries no default on purpose. Each deployment
-- supplies its own owner id through OWNER_USER_ID; see .env.example.
-- ============================================================

-- Trigram index on title needs this extension.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS stickies (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT          DEFAULT 'Untitled',
  content             TEXT          DEFAULT '',
  folder_name         TEXT          DEFAULT 'General',
  folder_color        TEXT          DEFAULT '#FF3B30',
  is_folder           BOOLEAN       DEFAULT false,
  "order"             INTEGER       DEFAULT 0,
  updated_at          TIMESTAMPTZ   DEFAULT now(),
  created_at          TIMESTAMPTZ   DEFAULT now(),
  parent_folder_name  TEXT,
  list_mode           BOOLEAN       DEFAULT false,
  folder_id           UUID,
  parent_folder_id    UUID,
  type                TEXT,
  tags                TEXT[],
  user_id             TEXT,
  is_public           BOOLEAN       DEFAULT false,
  trashed_at          TIMESTAMPTZ,
  icon                TEXT,
  format              VARCHAR       DEFAULT 'text',
  doc                 JSONB,
  created_by_key      TEXT,
  locked              BOOLEAN       DEFAULT false,
  lock_password_hash  TEXT,
  created_by_machine  TEXT,
  frozen              BOOLEAN       DEFAULT false
);

-- Hot paths: the board lists by user + folder, and sorts by recency.
CREATE INDEX IF NOT EXISTS idx_stickies_user_folder     ON stickies (user_id, folder_name);
CREATE INDEX IF NOT EXISTS idx_stickies_user_folder_id  ON stickies (user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_stickies_user_is_folder  ON stickies (user_id, is_folder);
CREATE INDEX IF NOT EXISTS idx_stickies_user_updated    ON stickies (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS notes_folder_name_idx        ON stickies (folder_name) WHERE (is_folder = false);
CREATE INDEX IF NOT EXISTS notes_is_folder_name_idx     ON stickies (is_folder, folder_name);
CREATE INDEX IF NOT EXISTS notes_order_idx              ON stickies ("order");
CREATE INDEX IF NOT EXISTS notes_updated_at_idx         ON stickies (updated_at DESC) WHERE (is_folder = false);
CREATE INDEX IF NOT EXISTS notes_folder_id_idx          ON stickies (folder_id) WHERE (folder_id IS NOT NULL);

-- Search: substring match on title without a leading-wildcard scan.
CREATE INDEX IF NOT EXISTS notes_title_trgm ON stickies USING gin (title gin_trgm_ops);

-- One folder name per level, per owner.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_folder_name_per_level
  ON stickies (user_id, folder_name, COALESCE(parent_folder_name, ''))
  WHERE (is_folder = true);
