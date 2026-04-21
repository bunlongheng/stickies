import { authorizeOwner } from "@/app/api/stickies/_auth";
import { query } from "@/lib/db-driver";
import { NextResponse } from "next/server";
import Pusher from "pusher";
import webpush from "web-push";

function getPusher() {
    return new Pusher({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.PUSHER_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: process.env.PUSHER_CLUSTER!,
        useTLS: true,
    });
}

export async function POST(req: Request) {
    if (!await authorizeOwner(req)) {
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
    const subs = await query(`SELECT endpoint, keys FROM push_subscriptions`);
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
