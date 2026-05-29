import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";

/**
 * GET /api/stickies/public/raw?noteId=...
 * Returns raw content for public notes. HTML notes render as a webpage
 * (Content-Type: text/html); everything else serves as text/plain, like
 * GitHub Gist raw or Pastebin raw - no UI, just content.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    const forceText = url.searchParams.get("as") === "text";
    if (!noteId) return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

    const row = await queryOne<{ title: string; content: string; type: string | null; is_public: boolean }>(
        `SELECT title, content, type, is_public FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );

    if (!row || !row.is_public) return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

    const isHtml = !forceText && row.type === "html";
    const contentType = isHtml ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
    const body = isHtml && !/<html[\s>]/i.test(row.content) && !/^\s*<!DOCTYPE/i.test(row.content)
        ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(row.title || "Stickies")}</title></head><body>${row.content}</body></html>`
        : row.content;

    return new NextResponse(body, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "X-Note-Title": encodeURIComponent(row.title),
            "Cache-Control": "public, max-age=60",
        },
    });
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
