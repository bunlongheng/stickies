import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const renames = [
    // WS → full descriptive title
    { id: "c37ce2fb-6663-487b-93df-4aaca77c5493", title: "WebSocket Session Flow — Axum Server" },
    // tested_mermaid → descriptive
    { id: "61e0e2f9-257f-4cc1-83f2-7b70935d7284", title: "Simple Flowchart — Decision Branch" },
];

for (const { id, title } of renames) {
    const { error } = await sb.from("stickies").update({ title }).eq("id", id);
    if (error) console.error(`✗ ${id}: ${error.message}`);
    else console.log(`✓ ${id} → "${title}"`);
}
