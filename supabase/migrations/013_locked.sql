-- Write-protect lock: locked notes refuse PATCH/DELETE until the owner
-- explicitly toggles locked back to false. UI also goes read-only.
ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;
