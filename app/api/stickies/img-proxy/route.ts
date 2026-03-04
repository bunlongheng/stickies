/**
 * GET /api/stickies/img-proxy?url=<encoded-url>
 *
 * Server-side image proxy — fetches an external image (e.g. Notion CDN)
 * and returns it as a base64 data URI. No storage. Pure pass-through.
 * Bypasses browser CORS restrictions on Notion/S3 signed URLs.
 */

import { NextResponse } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB limit

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");

    if (!url || !/^https?:\/\//i.test(url)) {
        return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Stickies/1.0)" },
        });

        if (!res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });

        const contentType = res.headers.get("content-type") ?? "image/png";
        if (!contentType.startsWith("image/")) {
            return NextResponse.json({ error: "Not an image" }, { status: 415 });
        }

        const buf = await res.arrayBuffer();
        if (buf.byteLength > MAX_BYTES) {
            return NextResponse.json({ error: "Image too large" }, { status: 413 });
        }

        const b64 = Buffer.from(buf).toString("base64");
        return new Response(`data:${contentType};base64,${b64}`, {
            headers: { "Content-Type": "text/plain", "Cache-Control": "private, max-age=3600" },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? "Proxy failed" }, { status: 500 });
    }
}
