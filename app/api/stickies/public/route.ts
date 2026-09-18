import { queryOne } from "@/lib/db-driver";
import { NextResponse } from "next/server";
import { verifyUnlockCookie, unlockCookieName } from "@/lib/lock-password";

// Minimal cookie reader (mirrors app/api/stickies/public/raw/route.ts) so a
// passcode-locked public note is gated here too, not just on /raw.
function readCookie(req: Request, name: string): string | undefined {
    const raw = req.headers.get("cookie") || "";
    for (const part of raw.split(/;\s*/)) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
    }
    return undefined;
}

export async function GET(req: Request) {
    const noteId = new URL(req.url).searchParams.get("noteId");
    if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 });

    const row = await queryOne<{ title: string; content: string; type: string; folder_color: string; is_public: boolean; locked: boolean; lock_password_hash: string | null }>(
        `SELECT title, content, type, folder_color, is_public, locked, lock_password_hash FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
        [noteId]
    );

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!row.is_public) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Locked + password set: require the same valid unlock cookie the /raw gate issues
    // before serving the body. Otherwise return {locked:true} with NO content, so a
    // passcode-protected public note is never readable (or curl-able) through this route.
    if (row.locked && row.lock_password_hash) {
        const cookie = readCookie(req, unlockCookieName(noteId));
        if (!verifyUnlockCookie(noteId, row.lock_password_hash, cookie)) {
            return NextResponse.json({ locked: true, title: row.title, folder_color: row.folder_color });
        }
    }

    return NextResponse.json({ title: row.title, content: row.content, type: row.type, folder_color: row.folder_color });
}
