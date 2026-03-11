/**
 * Find and delete notes with empty/blank content, and folders with no notes.
 * Run: node scripts/clean-empty.mjs
 * Run with --delete to actually delete (default is dry-run)
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = !process.argv.includes("--delete");
if (DRY_RUN) console.log("🔍 DRY RUN — pass --delete to actually delete\n");

function isEmpty(content) {
    if (!content) return true;
    const stripped = content
        .replace(/<br\s*\/?>/gi, "")          // <br>
        .replace(/<[^>]+>/g, "")              // all tags
        .replace(/&nbsp;/g, " ")
        .replace(/\u00a0/g, " ")              // non-breaking space
        .replace(/\u200b/g, "")               // zero-width space
        .trim();
    return stripped === "";
}

// ── 1. Empty notes ────────────────────────────────────────────────────────────
const { data: allNotes } = await sb.from("notes")
    .select("id, title, folder_name, content")
    .eq("is_folder", false);

// Debug: show notes with very short content
const shortNotes = (allNotes ?? []).filter(n => (n.content?.length ?? 0) < 50 && !isEmpty(n.content));
if (shortNotes.length > 0) {
    console.log(`\n⚠️  Notes with short but non-empty content (${shortNotes.length}):`);
    for (const n of shortNotes) {
        console.log(`   [${n.folder_name}] "${n.title}" → ${JSON.stringify(n.content)}`);
    }
}

const emptyNotes = (allNotes ?? []).filter(n => isEmpty(n.content));

console.log(`📝 Empty notes: ${emptyNotes.length}`);
for (const n of emptyNotes) {
    console.log(`   [${n.folder_name}] "${n.title}" (id: ${n.id})`);
}

if (!DRY_RUN && emptyNotes.length > 0) {
    const ids = emptyNotes.map(n => n.id);
    const { error } = await sb.from("notes").delete().in("id", ids);
    if (error) console.error("❌ Error deleting notes:", error.message);
    else console.log(`✅ Deleted ${ids.length} empty notes`);
}

// ── 2. Empty folders ──────────────────────────────────────────────────────────
const { data: allFolders } = await sb.from("notes")
    .select("id, folder_name, parent_folder_name")
    .eq("is_folder", true);

const { data: noteRows } = await sb.from("notes")
    .select("folder_name")
    .eq("is_folder", false);

const { data: subFolderRows } = await sb.from("notes")
    .select("parent_folder_name")
    .eq("is_folder", true)
    .not("parent_folder_name", "is", null);

const foldersWithNotes = new Set((noteRows ?? []).map(n => n.folder_name?.toLowerCase()));
const foldersWithChildren = new Set((subFolderRows ?? []).map(r => r.parent_folder_name?.toLowerCase()));

const emptyFolders = (allFolders ?? []).filter(f =>
    !foldersWithNotes.has(f.folder_name?.toLowerCase()) &&
    !foldersWithChildren.has(f.folder_name?.toLowerCase())
);

console.log(`\n📁 Empty folders: ${emptyFolders.length}`);
for (const f of emptyFolders) {
    const path = f.parent_folder_name ? `${f.parent_folder_name}/${f.folder_name}` : f.folder_name;
    console.log(`   "${path}" (id: ${f.id})`);
}

if (!DRY_RUN && emptyFolders.length > 0) {
    const ids = emptyFolders.map(f => f.id);
    const { error } = await sb.from("notes").delete().in("id", ids);
    if (error) console.error("❌ Error deleting folders:", error.message);
    else console.log(`✅ Deleted ${ids.length} empty folders`);
}

console.log("\nDone.");
