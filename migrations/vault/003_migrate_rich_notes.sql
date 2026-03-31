-- ============================================================
-- VAULT — Migration 003: Copy rich notes from stickies → vault
--
-- Run this AFTER 001 + 002 on the vault Supabase project.
--
-- Strategy: direct INSERT from stickies notes table.
-- Uses postgres_fdw (Foreign Data Wrapper) to read from stickies
-- DB without touching the REST API — zero quota impact.
-- ============================================================

-- Step 1: Enable the foreign data wrapper extension
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Step 2: Point to the stickies database
-- Replace <STICKIES_DB_HOST> with: db.erhdiqjagmqbtmjblpbo.supabase.co
CREATE SERVER IF NOT EXISTS stickies_db
    FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (
        host 'db.erhdiqjagmqbtmjblpbo.supabase.co',
        port '5432',
        dbname 'postgres'
    );

-- Step 3: Map your vault postgres user to stickies credentials
-- Replace <STICKIES_PG_PASSWORD> with your stickies DB password
CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER
    SERVER stickies_db
    OPTIONS (
        user 'postgres',
        password 'Stickies2026!Secure#DB'
    );

-- Step 4: Import the stickies notes table as a foreign table
CREATE FOREIGN TABLE IF NOT EXISTS stickies_notes_foreign (
    id              UUID,
    user_id         UUID,
    title           TEXT,
    content         TEXT,
    folder_name     TEXT,
    folder_id       UUID,
    folder_color    TEXT,
    is_folder       BOOLEAN,
    parent_folder_name TEXT,
    is_public       BOOLEAN,
    trashed_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
)
SERVER stickies_db
OPTIONS (schema_name 'public', table_name 'notes');

-- Step 5: Copy ALL notes + folders from stickies → vault
-- Includes: folders (is_folder=true), rich notes (type='rich'),
--           and all other notes so vault has full folder structure.
-- Adjust the WHERE clause if you only want rich notes.
INSERT INTO vault_notes (
    id, user_id, title, content,
    folder_name, folder_id, folder_color,
    is_folder, parent_folder_name,
    is_public, trashed_at, created_at, updated_at
)
SELECT
    id, user_id, title, content,
    folder_name, folder_id, folder_color,
    is_folder, parent_folder_name,
    is_public, trashed_at, created_at, updated_at
FROM stickies_notes_foreign
ON CONFLICT (id) DO NOTHING;

-- Step 6: Cleanup foreign objects (optional, keep if you want ongoing sync)
-- DROP FOREIGN TABLE stickies_notes_foreign;
-- DROP USER MAPPING FOR CURRENT_USER SERVER stickies_db;
-- DROP SERVER stickies_db;

-- Verify
SELECT
    COUNT(*) FILTER (WHERE is_folder = FALSE) AS notes,
    COUNT(*) FILTER (WHERE is_folder = TRUE)  AS folders
FROM vault_notes;
