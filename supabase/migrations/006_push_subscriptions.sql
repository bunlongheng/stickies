-- ============================================================
-- 006: push_subscriptions — web push endpoint registry
-- Note: user_id column was added via 002_multi_user.sql
--       (ALTER TABLE ... ADD COLUMN IF NOT EXISTS user_id ...)
--       This migration creates the base table for fresh installs.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    TEXT         NOT NULL UNIQUE,
  keys        JSONB        NOT NULL DEFAULT '{}',
  user_id     UUID         REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx  ON push_subscriptions (user_id);
