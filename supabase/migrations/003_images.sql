-- Add images JSONB column to store image attachment metadata
ALTER TABLE users_stickies ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';
ALTER TABLE notes          ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]';
