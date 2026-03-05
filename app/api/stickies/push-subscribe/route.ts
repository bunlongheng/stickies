import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

type AuthResult = { type: "apikey" } | { type: "user"; userId: string };

async function authenticate(req: Request): Promise<AuthResult | null> {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return null;

    const candidates = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try { if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return { type: "apikey" }; } catch {}
    }

    const { data: { user } } = await getSupabase().auth.getUser(bearer);
    if (user) {
        const ownerUserId = process.env.OWNER_USER_ID;
        if (ownerUserId && user.id === ownerUserId) return { type: "apikey" };
        return { type: "user", userId: user.id };
    }
    return null;
}

export async function POST(req: Request) {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { subscription } = await req.json();
    if (!subscription?.endpoint) {
        return NextResponse.json({ error: "Missing subscription" }, { status: 400 });
    }
    const sb = getSupabase();
    await sb.from("push_subscriptions").upsert(
        {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            updated_at: new Date().toISOString(),
            ...(auth.type === "user" ? { user_id: auth.userId } : {}),
        },
        { onConflict: "endpoint" }
    );
    return NextResponse.json({ ok: true });
}
