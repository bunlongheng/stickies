import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MERMAID_FIRST = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/i;

const { data } = await sb.from("stickies").select("id, title, content").eq("type","mermaid").eq("is_folder", false);

let fixed = 0, skipped = 0;
for (const n of data) {
    const c = (n.content ?? "").trim();
    // Only fix notes whose content starts directly with a mermaid keyword (no front-matter)
    if (!MERMAID_FIRST.test(c)) { skipped++; continue; }

    // Strip emoji from title for clean diagram title
    const cleanTitle = (n.title ?? "").replace(/^\p{Emoji_Presentation}+\s*/u, "").trim();
    const newContent = `---\ntitle: ${cleanTitle}\n---\n${c}`;

    const { error } = await sb.from("stickies").update({ content: newContent }).eq("id", n.id);
    if (error) console.error(`  ✗ "${n.title}": ${error.message}`);
    else { console.log(`  ✓ "${n.title}"`); fixed++; }
}
console.log(`\nDone: ${fixed} updated, ${skipped} skipped (already have front-matter or non-keyword start)`);
