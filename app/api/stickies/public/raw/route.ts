import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";

/**
 * GET /api/stickies/public/raw?noteId=...
 * Returns raw plain text content for public notes.
 * Like GitHub Gist raw or Pastebin raw - no UI, just text.
 */
export async function GET(req: Request) {
    const noteId = new URL(req.url).searchParams.get("noteId");
    if (!noteId) return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

    const row = await queryOne<{ title: string; content: string; is_public: boolean }>(
        `SELECT title, content, is_public FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );

    if (!row || !row.is_public) return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

    return new NextResponse(row.content, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Note-Title": encodeURIComponent(row.title),
            "Cache-Control": "public, max-age=60",
        },
    });
}
