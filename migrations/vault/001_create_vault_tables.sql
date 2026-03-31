-- ============================================================
-- VAULT — Migration 001: Create vault_notes table
-- Run in: Supabase SQL Editor (vault project)
-- ============================================================

-- Main notes table (folders + rich notes share this table via is_folder flag)
CREATE TABLE IF NOT EXISTS vault_notes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT        NOT NULL DEFAULT '',
    content         TEXT        NOT NULL DEFAULT '',   -- TipTap JSON
    folder_name     TEXT,
    folder_id       UUID,                              -- parent folder row id
    folder_color    TEXT        DEFAULT '#007AFF',
    is_folder       BOOLEAN     NOT NULL DEFAULT FALSE,
    parent_folder_name TEXT,
    is_public       BOOLEAN     NOT NULL DEFAULT FALSE,
    trashed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION vault_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vault_notes_updated_at ON vault_notes;
CREATE TRIGGER vault_notes_updated_at
    BEFORE UPDATE ON vault_notes
    FOR EACH ROW EXECUTE FUNCTION vault_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS vault_notes_user_id        ON vault_notes (user_id);
CREATE INDEX IF NOT EXISTS vault_notes_folder_name    ON vault_notes (folder_name);
CREATE INDEX IF NOT EXISTS vault_notes_folder_id      ON vault_notes (folder_id);
CREATE INDEX IF NOT EXISTS vault_notes_is_folder      ON vault_notes (is_folder);
CREATE INDEX IF NOT EXISTS vault_notes_updated_at     ON vault_notes (updated_at DESC);
CREATE INDEX IF NOT EXISTS vault_notes_trashed_at     ON vault_notes (trashed_at) WHERE trashed_at IS NOT NULL;
