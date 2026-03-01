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
    const candidates = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try { if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true; } catch {}
    }
    return false;
}

export async function POST(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { subscription } = await req.json();
    if (!subscription?.endpoint) {
        return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
    }
    const sb = getSupabase();
    await sb.from("push_subscriptions").upsert(
        { endpoint: subscription.endpoint, keys: subscription.keys, updated_at: new Date().toISOString() },
        { onConflict: "endpoint" }
    );
    return NextResponse.json({ ok: true });
}
