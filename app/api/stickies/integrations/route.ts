import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

function authorize(req: Request): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const candidates = [
        process.env.STICKIES_API_KEY,
        process.env.STICKIES_PASSWORD,
    ].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length === expected.length) {
            try {
                if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true;
            } catch {}
        }
    }
    return false;
}

export async function GET(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data, error } = await getSupabase()
        .from("integrations")
        .select("id,trigger,condition,type,config,name")
        .eq("active", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}
