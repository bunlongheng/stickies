import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("stickies").select("id, title, content").eq("type", "mermaid").order("title");
if (error) { console.error(error.message); process.exit(1); }

data.forEach(n => {
    const preview = (n.content || "").trim().slice(0, 120).replace(/\n/g, " | ");
    console.log(`${n.id} | "${n.title}" | ${preview}`);
});
console.log(`\nTotal: ${data.length}`);
