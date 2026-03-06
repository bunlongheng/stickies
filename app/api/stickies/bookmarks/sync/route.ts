import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import os from "os";
import path from "path";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

function parseBookmarks(node: any, folder = ""): { title: string; url: string; folder: string }[] {
    const results: { title: string; url: string; folder: string }[] = [];
    if (node.type === "url") {
        const url = (node.url || "").trim();
        if (url.startsWith("http")) {
            results.push({ title: (node.name || "").trim(), url, folder: folder.trim() });
        }
    } else {
        const skipNames = new Set(["Bookmarks bar", "Other bookmarks", "Mobile bookmarks"]);
        const name = node.name || "";
        const nextFolder = name && !skipNames.has(name)
            ? folder ? `${folder}/${name}` : name
            : folder;
        for (const child of node.children || []) {
            results.push(...parseBookmarks(child, nextFolder));
        }
    }
    return results;
}

export async function POST(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chromePath = path.join(
        os.homedir(),
        "Library/Application Support/Google/Chrome/Default/Bookmarks",
    );

    let raw: string;
    try {
        raw = fs.readFileSync(chromePath, "utf8");
    } catch {
        return NextResponse.json({ error: "Chrome bookmarks file not found on this machine" }, { status: 404 });
    }

    const data = JSON.parse(raw);
    const bookmarks: { title: string; url: string; folder: string }[] = [];
    const seen = new Set<string>();

    for (const root of Object.values(data.roots || {}) as any[]) {
        for (const bm of parseBookmarks(root)) {
            if (!seen.has(bm.url)) {
                seen.add(bm.url);
                bookmarks.push(bm);
            }
        }
    }

    const sb = getSupabase();
    const { error } = await sb
        .from("bookmarks")
        .upsert(bookmarks, { onConflict: "url" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, synced: bookmarks.length });
}
