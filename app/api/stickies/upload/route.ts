import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

async function isAuthorized(req: Request): Promise<boolean> {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const candidates = [
        process.env.STICKIES_API_KEY,
        process.env.STICKIES_PASSWORD,
    ].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try {
            if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true;
        } catch {}
    }
    if (bearer) {
        try {
            const { data: { user } } = await getSupabase().auth.getUser(bearer);
            if (user) return true;
        } catch {}
    }
    return false;
}

export async function POST(req: Request) {
    if (!await isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const noteId = formData.get("noteId") as string | null;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${noteId ?? "unsorted"}/${Date.now()}-${safeName}`;

    const supabase = getSupabase();
    const { error } = await supabase.storage
        .from("stickies-files")
        .upload(path, await file.arrayBuffer(), {
            contentType: file.type || "application/octet-stream",
            upsert: false,
        });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage
        .from("stickies-files")
        .getPublicUrl(path);

    return NextResponse.json({ url: publicUrl, filename: file.name, type: file.type });
}
