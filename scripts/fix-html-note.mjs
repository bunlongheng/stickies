import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await sb.from("notes").update({ type: "html" }).eq("title", "Stickies API — URL Params & Posting Guide");
if (error) console.error(error.message);
else console.log("✓ fixed");
