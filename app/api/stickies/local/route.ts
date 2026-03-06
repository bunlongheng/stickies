import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeOwner } from "@/app/api/stickies/_auth";
import Pusher from "pusher";

// Module-level flash queue — serializes Hue + Pusher so each cycle
// completes before the next one starts (important for rapid-fire posts).
let flashQueue: Promise<void> = Promise.resolve();

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
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// Two valid tokens:
//   1. STICKIES_API_KEY                        — AI / server-to-server
//   2. STICKIES_API_KEY + STICKIES_LOCAL_SALT  — FE (salt is env-only, never exposed)
function authorize(req: Request): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return false;

    const apiKey  = process.env.STICKIES_API_KEY ?? "";
    const salt    = process.env.STICKIES_LOCAL_SALT ?? "";
    const feToken = apiKey + salt;

    const safe = (a: string, b: string): boolean => {
        if (!a || !b) return false;
        try { return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
        catch { return false; }
    };

    return safe(bearer, apiKey) || safe(bearer, feToken);
}

// POST /api/stickies/local
// Auth: Bearer <STICKIES_API_KEY>
//    or Bearer <STICKIES_API_KEY><STICKIES_LOCAL_SALT>  (FE)
// Content-Type: text/markdown  →  first # H1 = title, rest = content
// Content-Type: application/json → { title, content, folder? }
// ?folder=CLAUDE  (default: CLAUDE)
export async function POST(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const folderParam = url.searchParams.get("folder")?.trim() || "CLAUDE";
    const contentType = req.headers.get("content-type") ?? "";

    let title = "";
    let content = "";
    let folder_name = folderParam;

    if (/text\/(plain|markdown|x-markdown)/i.test(contentType)) {
        const raw = await req.text();
        const lines = raw.split("\n");
        const h1 = lines.findIndex((l) => /^#\s+/.test(l));
        if (h1 !== -1) {
            title = lines[h1].replace(/^#\s+/, "").trim();
            content = [...lines.slice(0, h1), ...lines.slice(h1 + 1)].join("\n").trim();
        } else {
            title = (lines.find((l) => l.trim()) ?? "Untitled").replace(/^#+\s*/, "").trim();
            content = raw.trim();
        }
    } else {
        let body: Record<string, unknown>;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }
        title = String(body.title ?? "").trim();
        content = String(body.content ?? "").trim();
        folder_name = String(body.folder ?? body.folder_name ?? folderParam).trim() || "CLAUDE";
    }

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

    const color = url.searchParams.get("color")?.trim() || "#B0B0B8";

    const sb = getSupabase();
    const now = new Date().toISOString();

    const { data: maxRow } = await sb.from("notes").select("order").eq("is_folder", false).order("order", { ascending: false }).limit(1).single();
    const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;

    const { data, error } = await sb.from("notes").insert([{
        title, content, folder_name, is_folder: false,
        folder_color: color,
        order: nextOrder, created_at: now, updated_at: now,
    }]).select().single();

    if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });

    // Enqueue flash: Hue + Pusher run sequentially per-request so rapid-fire
    // posts don't overlap. Hue starts first (~300ms head-start) so the light
    // and screen flash arrive at roughly the same time.
    flashQueue = flashQueue.then(async () => {
        const hueReady = fetch("http://localhost:3000/api/hue/trigger", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ color }),
        }).catch(() => {});

        await new Promise(r => setTimeout(r, 300));
        try { await getPusher().trigger("stickies", "note-created", data); } catch {}
        await hueReady;
    });

    return NextResponse.json({ note: data }, { status: 201 });
}
