import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from("stickies").select("id, title, type, content").eq("id", "c37ce2fb-6663-487b-93df-4aaca77c5493").single();
console.log("title:", data.title);
console.log("type:", data.type);
console.log("content:\n", data.content);
