-- Hot-path indexes for the stickies table. Every list/counts/today/search query
-- filters by user_id and folder_name/trashed_at and sorts by updated_at/created_at,
-- but no index covered those predicates. All idempotent (IF NOT EXISTS) and safe to
-- re-run; applied by db/migrate.mjs.

-- Folder browsing + counts: (user_id, folder_name) with the updated_at sort.
CREATE INDEX IF NOT EXISTS stickies_user_folder_updated_idx
    ON stickies (user_id, folder_name, updated_at DESC);

-- "All"/"Today" live-notes views: non-trashed notes newest-first.
CREATE INDEX IF NOT EXISTS stickies_user_live_created_idx
    ON stickies (user_id, created_at DESC)
    WHERE trashed_at IS NULL AND is_folder = false;

-- TRASH auto-expiry sweep predicate.
CREATE INDEX IF NOT EXISTS stickies_trash_expiry_idx
    ON stickies (user_id, trashed_at)
    WHERE folder_name = 'TRASH' AND trashed_at IS NOT NULL;
