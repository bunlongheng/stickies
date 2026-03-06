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

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { error } = await getSupabase()
        .from("integrations")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
    if (!authorize(_req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { error } = await getSupabase().from("integrations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
