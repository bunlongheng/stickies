import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// find notes whose title has any emoji
const { data } = await sb.from("notes").select("id, title, type").order("title");
const withEmoji = data?.filter(n => /\p{Emoji_Presentation}/u.test(n.title ?? ""));
withEmoji?.forEach(n => console.log(`${n.type?.padEnd(12)} | "${n.title}"`));
