/**
 * Find and delete notes with empty/blank content, and folders with no notes.
 * Run: node scripts/clean-empty.mjs
 * Run with --delete to actually delete (default is dry-run)
 */
import pg from "pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const DRY_RUN = !process.argv.includes("--delete");
if (DRY_RUN) console.log("🔍 DRY RUN — pass --delete to actually delete\n");

function isEmpty(content) {
    if (!content) return true;
    const stripped = content
        .replace(/<br\s*\/?>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\u00a0/g, " ")
        .replace(/\u200b/g, "")
        .trim();
    return stripped === "";
}

// ── 1. Empty notes ────────────────────────────────────────────────────────────
const { rows: allNotes } = await pool.query(
    `SELECT id, title, folder_name, content FROM "stickies" WHERE is_folder = false`
);

const shortNotes = allNotes.filter(n => (n.content?.length ?? 0) < 50 && !isEmpty(n.content));
if (shortNotes.length > 0) {
    console.log(`\n⚠️  Notes with short but non-empty content (${shortNotes.length}):`);
    for (const n of shortNotes) {
        console.log(`   [${n.folder_name}] "${n.title}" → ${JSON.stringify(n.content)}`);
    }
}

const emptyNotes = allNotes.filter(n => isEmpty(n.content));

console.log(`📝 Empty notes: ${emptyNotes.length}`);
for (const n of emptyNotes) {
    console.log(`   [${n.folder_name}] "${n.title}" (id: ${n.id})`);
}

if (!DRY_RUN && emptyNotes.length > 0) {
    const ids = emptyNotes.map(n => n.id);
    await pool.query(`DELETE FROM "stickies" WHERE id = ANY($1::uuid[])`, [ids]);
    console.log(`✅ Deleted ${ids.length} empty notes`);
}

// ── 2. Empty folders ──────────────────────────────────────────────────────────
const { rows: allFolders } = await pool.query(
    `SELECT id, folder_name, parent_folder_name FROM "stickies" WHERE is_folder = true`
);

const { rows: noteRows } = await pool.query(
    `SELECT DISTINCT folder_name FROM "stickies" WHERE is_folder = false`
);

const { rows: subFolderRows } = await pool.query(
    `SELECT DISTINCT parent_folder_name FROM "stickies" WHERE is_folder = true AND parent_folder_name IS NOT NULL`
);

const foldersWithNotes = new Set(noteRows.map(n => n.folder_name?.toLowerCase()));
const foldersWithChildren = new Set(subFolderRows.map(r => r.parent_folder_name?.toLowerCase()));

const emptyFolders = allFolders.filter(f =>
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
    await pool.query(`DELETE FROM "stickies" WHERE id = ANY($1::uuid[])`, [ids]);
    console.log(`✅ Deleted ${ids.length} empty folders`);
}

console.log("\nDone.");
await pool.end();
