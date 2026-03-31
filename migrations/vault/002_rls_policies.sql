-- ============================================================
-- VAULT — Migration 002: Row Level Security policies
-- ============================================================

ALTER TABLE vault_notes ENABLE ROW LEVEL SECURITY;

-- Owner can do everything with their own notes
CREATE POLICY "vault_notes_select" ON vault_notes
    FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "vault_notes_insert" ON vault_notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vault_notes_update" ON vault_notes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "vault_notes_delete" ON vault_notes
    FOR DELETE USING (auth.uid() = user_id);
