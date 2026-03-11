import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from("notes").select("id, title, content").ilike("title", "%💣%");
const { data: d2 } = await sb.from("notes").select("id, title").ilike("content", "%💣%");
console.log("title match:", data);
console.log("content match:", d2?.map(n=>n.title));
