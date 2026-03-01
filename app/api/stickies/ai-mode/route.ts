import crypto from "crypto";
import { NextResponse } from "next/server";
import Pusher from "pusher";

function getPusher() {
    return new Pusher({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.PUSHER_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: process.env.PUSHER_CLUSTER!,
        useTLS: true,
    });
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

// POST /api/stickies/ai-mode — broadcast AI cleanup start
// Optional body: { message?, duration? }
// duration (seconds) — if provided, auto-fires ai-mode-end after that delay (max 30s)
export async function POST(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const message = body.message ?? "AI is organizing your stickies…";
    const duration = typeof body.duration === "number" ? Math.min(Math.max(body.duration, 1), 30) : null;
    await getPusher().trigger("stickies", "ai-mode-start", { message, startedAt: new Date().toISOString() });
    if (duration) {
        await new Promise((r) => setTimeout(r, duration * 1000));
        await getPusher().trigger("stickies", "ai-mode-end", { endedAt: new Date().toISOString() });
        return NextResponse.json({ ok: true, event: "ai-mode-start", auto_ended_after: duration });
    }
    return NextResponse.json({ ok: true, event: "ai-mode-start" });
}

// DELETE /api/stickies/ai-mode — broadcast AI cleanup end
export async function DELETE(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await getPusher().trigger("stickies", "ai-mode-end", { endedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, event: "ai-mode-end" });
}
