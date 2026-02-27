import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function getSupabase() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

async function isAuthed(): Promise<boolean> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
}

// POST /api/stickies/share — create a burn-after-read link (auth required)
export async function POST(req: Request) {
    if (!(await isAuthed())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content, color, folder_name } = body;

    if (!title && !content) {
        return NextResponse.json({ error: "Empty note" }, { status: 400 });
    }

    const token = crypto.randomUUID();

    const supabase = getSupabase();
    const { error } = await supabase.from("shared_notes").insert({
        token,
        title: title ?? "",
        content: content ?? "",
        color: color ?? "",
        folder_name: folder_name ?? "",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
        console.error("[share POST]", error);
        return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    return NextResponse.json({ token });
}

// GET /api/stickies/share?token=... — read only, does NOT burn
export async function GET(req: Request) {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("shared_notes")
        .select("*")
        .eq("token", token)
        .single();

    if (error || !data) {
        return NextResponse.json({ error: "burned" }, { status: 410 });
    }

    return NextResponse.json({
        title: data.title,
        content: data.content,
        color: data.color,
        folder_name: data.folder_name,
    });
}

