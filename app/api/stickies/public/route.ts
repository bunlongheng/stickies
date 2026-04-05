import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const noteId = new URL(req.url).searchParams.get("noteId");
    if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 });

    const row = await queryOne<{ title: string; content: string; type: string; folder_color: string }>(
        `SELECT title, content, type, folder_color FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(row);
}
