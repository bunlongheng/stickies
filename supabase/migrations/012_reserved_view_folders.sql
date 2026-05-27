-- "Today" / "Yesterday" are virtual, time-based views (a group-by of notes by
-- recency), never real storage folders. This constraint guarantees no row -- folder
-- or note -- can ever be persisted under those names, so the virtual view can never
-- collide with a real folder again. App-level guards (client + API) give friendly
-- errors; this is the last-resort backstop against rogue scripts and direct writes.
ALTER TABLE "stickies"
  ADD CONSTRAINT stickies_no_reserved_view_folder
  CHECK (folder_name IS NULL OR lower(folder_name) NOT IN ('today', 'yesterday'));
