/**
 * POST /api/stickies/upload
 * Proxies file uploads to Google Drive via /api/stickies/gdrive.
 * Auth: STICKIES_API_KEY / STICKIES_PASSWORD bearer OR a NextAuth owner session cookie.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

async function isAuthorized(req: Request): Promise<boolean> {
    const authHeader = req.headers.get("authorization") ?? "";
    const candidates = [
        process.env.STICKIES_API_KEY,
        process.env.STICKIES_PASSWORD,
    ].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (authHeader.length !== expected.length) continue;
        try {
            if (crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) return true;
        } catch {}
    }
    // NextAuth session — only the owner email passes.
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    if (!ownerEmail) return false;
    const session = await auth();
    return session?.user?.email?.toLowerCase() === ownerEmail;
}

export async function POST(req: Request) {
    if (!await isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:4444";

    const res = await fetch(`${baseUrl}/api/stickies/gdrive`, {
        method: "POST",
        headers: { Authorization: req.headers.get("authorization") || "" },
        body: formData,
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
}
