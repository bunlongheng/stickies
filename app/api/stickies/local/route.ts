import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function isLocal(req: Request): boolean {
    const host = req.headers.get("host") ?? "";
    return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

// POST /api/stickies/local
// No auth required — localhost only.
// Content-Type: text/markdown  →  first # H1 = title, rest = content
// Content-Type: application/json → { title, content, folder? }
// ?folder=CLAUDE  (default: CLAUDE)
export async function POST(req: Request) {
    if (!isLocal(req)) {
        return NextResponse.json({ error: "Local only" }, { status: 403 });
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

    const sb = getSupabase();
    const now = new Date().toISOString();

    const { data: maxRow } = await sb.from("notes").select("order").eq("is_folder", false).order("order", { ascending: false }).limit(1).single();
    const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;

    const { data, error } = await sb.from("notes").insert([{
        title, content, folder_name, is_folder: false,
        folder_color: "#B0B0B8",
        order: nextOrder, created_at: now, updated_at: now,
    }]).select().single();

    if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
    return NextResponse.json({ note: data }, { status: 201 });
}
