import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function authorize(req: Request): boolean {
    const apiKey = process.env.STICKIES_API_KEY;
    if (!apiKey) return false;
    const auth = req.headers.get("authorization") ?? "";
    return auth === `Bearer ${apiKey}`;
}

// GET /api/stickies/folder-icon — read all folder icons { [folderName]: emoji }
export async function GET(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("notes")
        .select("folder_name, content")
        .eq("is_folder", true);

    if (error) {
        console.error("[stickies/folder-icon GET]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const icons: Record<string, string> = {};
    (data ?? []).forEach((row: any) => {
        if (row.folder_name && row.content && row.content.trim()) {
            icons[String(row.folder_name)] = row.content.trim();
        }
    });
    return NextResponse.json({ icons });
}

// PATCH /api/stickies/folder-icon — save emoji icon for a folder
export async function PATCH(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let folderName: string, icon: string;
    try {
        const body = await req.json();
        folderName = String(body.folderName ?? "").trim();
        icon = String(body.icon ?? "").trim();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!folderName) {
        return NextResponse.json({ error: "folderName required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
        .from("notes")
        .update({ content: icon, updated_at: new Date().toISOString() })
        .eq("is_folder", true)
        .eq("folder_name", folderName);

    if (error) {
        console.error("[stickies/folder-icon PATCH]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
