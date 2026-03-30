import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    const noteId = new URL(req.url).searchParams.get("noteId");
    if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 });

    const { data, error } = await supabase
        .from("notes")
        .select("title, content, type, folder_color")
        .eq("id", noteId)
        .is("trashed_at", null)
        .single();

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(data);
}
