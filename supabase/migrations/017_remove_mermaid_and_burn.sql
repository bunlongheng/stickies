-- 017_remove_mermaid_and_burn.sql
-- Mermaid note-type support and the burn-after-read (shared_notes) sharing
-- system were both removed 2026-07-29. This migration migrates the data:
--   1. Existing mermaid notes become plain text (content preserved verbatim).
--      Backed up to backups/mermaid-notes-backup-20260729.json before this ran.
--   2. The shared_notes table is dropped (the burn feature never expired or
--      burned - a broken privacy promise). Backed up to
--      backups/shared_notes-backup-20260729.json before this ran.

UPDATE stickies SET type = 'text' WHERE type = 'mermaid';

DROP TABLE IF EXISTS shared_notes;
