-- ============================================================
-- 003: integrations + automations tables
-- Captures the schema that was hand-created in the Supabase
-- dashboard. Safe to run on a fresh DB or skip if tables exist.
-- ============================================================

-- ── integrations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT         NOT NULL,                        -- e.g. "hue"
  name              TEXT         NOT NULL DEFAULT '',
  active            BOOLEAN      NOT NULL DEFAULT true,
  trigger           TEXT,                                         -- e.g. "note_created"
  condition         JSONB        NOT NULL DEFAULT '{}',
  config            JSONB        NOT NULL DEFAULT '{}',           -- bridge_ip, app_key, group_id, mode …
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integrations_type_active_idx ON integrations (type, active);

-- No RLS — access is controlled exclusively via service-role key
-- (never exposed to the browser; all routes authenticate via STICKIES_API_KEY).

-- ── automations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automations (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT         NOT NULL,
  trigger_type             TEXT         NOT NULL,                 -- e.g. "note_created"
  trigger_integration_id   UUID         REFERENCES integrations(id) ON DELETE SET NULL,
  condition                JSONB        NOT NULL DEFAULT '{}',
  action_type              TEXT         NOT NULL,                 -- e.g. "hue_flash"
  action_integration_id    UUID         REFERENCES integrations(id) ON DELETE SET NULL,
  action_config            JSONB        NOT NULL DEFAULT '{}',
  active                   BOOLEAN      NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_active_idx ON automations (active);

-- ── automation_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_logs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID         NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  triggered_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  result          TEXT         NOT NULL DEFAULT 'ok',             -- "ok" | "error"
  detail          JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS automation_logs_automation_id_idx ON automation_logs (automation_id, triggered_at DESC);
