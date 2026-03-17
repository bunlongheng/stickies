import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CODE_TYPES = new Set(["javascript","typescript","python","css","sql","bash","json","mermaid","voice","checklist","html"]);
const MERMAID_KW = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im;

function looksLikeHtml(content) {
    const t = (content ?? "").trim();
    if (!t) return false;
    if (/^<[a-z][^>]*>/i.test(t)) return true;
    if (/<style[\s>]/i.test(t) || /<script[\s>]/i.test(t)) return true;
    return false;
}

function isMermaid(content) {
    const t = (content ?? "").trim().replace(/^```(?:mermaid)?\s*\n?/, "").replace(/```\s*$/, "").trim();
    return MERMAID_KW.test(t);
}

async function fixTable(table) {
    console.log(`\n── ${table} ──`);
    const { data, error } = await sb.from(table).select("id, title, type, content, folder_name").eq("is_folder", false);
    if (error) { console.error(error.message); return; }

    let fixed = 0;
    for (const n of data ?? []) {
        if (CODE_TYPES.has(n.type)) continue;
        const c = (n.content ?? "").trim();
        if (!c || c.startsWith('{"_type":"voice"')) continue;
        if (isMermaid(c)) continue;
        if ((c.startsWith("{") || c.startsWith("[")) ) { try { JSON.parse(c); continue; } catch {} }
        if (!looksLikeHtml(c)) continue;

        const { error: upErr } = await sb.from(table).update({ type: "html" }).eq("id", n.id);
        if (upErr) console.error(`  ✗ ${n.title}: ${upErr.message}`);
        else { console.log(`  ✓ ${n.folder_name}/${n.title}`); fixed++; }
    }
    if (!fixed) console.log("  (nothing to fix)");
}

await fixTable("stickies");
await fixTable("users_stickies");
