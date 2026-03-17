import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ids = ["85b1a22c-1d91-4e2b-8044-e7239810713f", "e0a9036f-d5a4-408e-ae25-9a7ac296c737"];
for (const id of ids) {
    const { data } = await sb.from("stickies").select("id, title, type, content").eq("id", id).single();
    console.log(`\n=== ${data.title} ===`);
    console.log("type:", data.type);
    console.log("content:\n", data.content);
}
