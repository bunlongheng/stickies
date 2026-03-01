import crypto from "crypto";
import { NextResponse } from "next/server";
import Pusher from "pusher";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

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

function getPusher() {
    return new Pusher({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.PUSHER_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: process.env.PUSHER_CLUSTER!,
        useTLS: true,
    });
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { url, title, senderSocketId, senderEndpoint } = await req.json();
    if (!url || typeof url !== "string") {
        return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // 1) Pusher — wakes active browser tabs
    try {
        await getPusher().trigger("stickies", "navigate-to", { url }, { socket_id: senderSocketId });
    } catch { /* non-fatal */ }

    // 2) Web Push — wakes backgrounded browsers
    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT!,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!,
    );
    const sb = getSupabase();
    const { data: subs } = await sb.from("push_subscriptions").select("endpoint, keys");
    const payload = JSON.stringify({ title: title || "Stickies", body: "Tap to open", url });
    await Promise.allSettled(
        (subs ?? [])
            .filter((s: any) => s.endpoint !== senderEndpoint)
            .map((s: any) =>
                webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload)
            )
    );

    return NextResponse.json({ ok: true });
}
