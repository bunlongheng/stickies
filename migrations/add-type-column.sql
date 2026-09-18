-- Add `type` column to stickies note tables
-- NULL = legacy note, falls back to client-side detection
-- Run on both tables if users_stickies exists

ALTER TABLE notes           ADD COLUMN IF NOT EXISTS type TEXT DEFAULT NULL;
ALTER TABLE users_stickies  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT NULL;

-- Valid values: text, markdown, html, json, mermaid,
--               javascript, typescript, python, css, sql, bash, voice
