-- Rich-text format support
-- Adds per-note `format` (text|markdown|rich) and a JSONB `doc` column
-- holding the canonical ProseMirror document for rich notes.
--
-- `content` remains the source of truth for text/markdown notes and a
-- plain-text mirror for rich notes (search, CLI, ext API readability).
ALTER TABLE stickies
  ADD COLUMN IF NOT EXISTS format VARCHAR(16) NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS doc JSONB;
