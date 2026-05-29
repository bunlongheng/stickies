-- Per-note password gate for /raw share links. Hash is set when the user
-- flips Lock on with a password; cleared on unlock.
ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS lock_password_hash text;
