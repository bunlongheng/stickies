/**
 * Backfill `type` column for all existing notes that have type = NULL.
 * Run: node scripts/backfill-type.mjs
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MERMAID_KW = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im;

function detectType(content, title) {
    const t = (content ?? "").trim();
    if (!t) return "text";
    if (t.startsWith('{"_type":"voice"')) {
        try { if (JSON.parse(t)?._type === "voice") return "voice"; } catch {}
    }
    // Fenced mermaid
    if (/^```(?:mermaid)?\s*\n[\s\S]*?```\s*$/im.test(t)) return "mermaid";
    // Bare mermaid
    const stripped = t.replace(/^```(?:mermaid)?\s*\n?/, "").replace(/```\s*$/, "").trim();
    if (MERMAID_KW.test(stripped)) return "mermaid";
    // JSON
    if ((t.startsWith("{") || t.startsWith("[")) ) {
        try { JSON.parse(t); return "json"; } catch {}
    }
    // Title extension
    if (title) {
        const ext = title.split(".").pop()?.toLowerCase() ?? "";
        const map = { js:"javascript", ts:"typescript", py:"python", css:"css", sql:"sql", sh:"bash", bash:"bash", md:"markdown", markdown:"markdown", html:"html", htm:"html", json:"json", mermaid:"mermaid", mmd:"mermaid" };
        if (map[ext]) return map[ext];
    }
    if (/^\s*<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t)) return "html";
    if (/^#{1,6}\s|^\*\*|^>\s/m.test(t) && !/<[a-z][^>]*>/i.test(t)) return "markdown";
    return "text";
}

async function backfill(table) {
    console.log(`\n── ${table} ──`);
    const { data, error } = await sb.from(table).select("id, title, content").is("type", null).eq("is_folder", false);
    if (error) { console.error("Fetch error:", error.message); return; }
    if (!data?.length) { console.log("Nothing to backfill."); return; }

    console.log(`Found ${data.length} notes to backfill...`);
    let updated = 0, failed = 0;

    for (const note of data) {
        const type = detectType(note.content, note.title);
        const { error: upErr } = await sb.from(table).update({ type }).eq("id", note.id);
        if (upErr) { console.error(`  ✗ ${note.id}: ${upErr.message}`); failed++; }
        else { console.log(`  ✓ ${note.title?.slice(0,40)?.padEnd(40)} → ${type}`); updated++; }
    }
    console.log(`Done: ${updated} updated, ${failed} failed.`);
}

await backfill("stickies");
await backfill("users_stickies");
