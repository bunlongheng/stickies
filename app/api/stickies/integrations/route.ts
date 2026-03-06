import crypto from "crypto";
import { authorizeOwner } from "@/app/api/stickies/_auth";
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
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data, error } = await getSupabase()
        .from("integrations")
        .select("id,trigger,condition,type,config,name")
        .eq("active", true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { type, name, trigger, condition, config } = body as any;
    if (!type?.trim()) return NextResponse.json({ error: "type required" }, { status: 400 });

    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
        .from("integrations")
        .insert([{
            type: type.trim(),
            name: name?.trim() ?? type.trim(),
            trigger: trigger ?? null,
            condition: condition ?? {},
            config: config ?? {},
            active: true,
            created_at: now,
            updated_at: now,
        }])
        .select("id,trigger,condition,type,config,name")
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
