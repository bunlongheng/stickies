/**
 * POST /api/stickies/upload
 * Proxies file uploads to Google Drive via /api/stickies/gdrive.
 * Auth: STICKIES_API_KEY / STICKIES_PASSWORD bearer OR a NextAuth owner session cookie.
 */
import { NextResponse } from "next/server";
import { authorizeOwner } from "../_auth";

export async function POST(req: Request) {
    // Shared owner auth (static key + per-machine keys + owner session + prod lockdown),
    // instead of a second hand-rolled copy that skipped per-machine keys + the lockdown.
    if (!await authorizeOwner(req)) {
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
