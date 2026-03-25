import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

type AuthResult = { type: "apikey" } | { type: "user"; userId: string };

async function authenticate(req: Request): Promise<AuthResult | null> {
    if (process.env.NODE_ENV === "development") return { type: "user", userId: process.env.OWNER_USER_ID?.trim() ?? "" };
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return null;

    const apiKey = process.env.STICKIES_API_KEY;
    if (apiKey) {
        const expected = `Bearer ${apiKey}`;
        if (auth.length === expected.length) {
            try {
                if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return { type: "apikey" };
            } catch {}
        }
    }

    const { data: { user } } = await getSupabase().auth.getUser(bearer);
    if (user) {
        const ownerUserId = process.env.OWNER_USER_ID?.trim();
        if (ownerUserId && user.id === ownerUserId) return { type: "apikey" };
        return { type: "user", userId: user.id };
    }
    return null;
}

// GET /api/stickies/folder-icon — read all folder icons { [folderName]: emoji }
export async function GET(req: Request) {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    let q = supabase.from("stickies").select("folder_name, content").eq("is_folder", true);
    if (auth.type === "user") q = (q as any).eq("user_id", (auth as any).userId);
    const { data, error } = await q;

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
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    let q = supabase.from("stickies").update({ content: icon, updated_at: new Date().toISOString() }).eq("is_folder", true).eq("folder_name", folderName);
    if (auth.type === "user") q = (q as any).eq("user_id", (auth as any).userId);
    const { error } = await q;

    if (error) {
        console.error("[stickies/folder-icon PATCH]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
