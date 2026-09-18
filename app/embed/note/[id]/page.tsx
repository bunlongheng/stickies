/**
 * Chromeless rich-note editor for embedding inside the native macOS app
 * (WKWebView). No header, no sidebar, no chrome — just the editor filling
 * the viewport.
 *
 * Auth: `?key=<STICKIES_API_KEY>` URL param. The native app holds this key
 * and passes it on the embed URL. The page validates server-side and hands
 * the key to the client for subsequent save calls.
 */
import { timingSafeEqual } from "node:crypto";
import { queryOne } from "@/lib/db-driver";
import EmbedNoteClient from "./EmbedNoteClient";

// Never send a Referer from this page - the key rides the URL, so no-referrer
// stops it leaking to any embedded asset's host. (Full fix: a short-lived scoped
// embed token instead of the master key in the URL - needs a native-app change.)
export const metadata = { referrer: "no-referrer" as const };

// Constant-time key compare so the check can't be brute-forced by timing.
function keysMatch(a: string, b: string): boolean {
    if (!a || !b) return false;
    const ab = Buffer.from(a), bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
}

interface Note {
    id: string;
    title: string | null;
    content: string | null;
    format: "text" | "rich" | null;
    doc: unknown;
    folder_color: string | null;
}

export default async function EmbedNotePage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ key?: string }>;
}) {
    const { id } = await params;
    const { key } = await searchParams;

    if (!key || !keysMatch(key, process.env.STICKIES_API_KEY ?? "")) {
        return (
            <div style={{ padding: 24, color: "#a1a1aa", fontFamily: "system-ui", fontSize: 13 }}>
                Unauthorized. Pass <code>?key=&lt;STICKIES_API_KEY&gt;</code>.
            </div>
        );
    }

    const note = await queryOne<Note>(
        `SELECT id, title, content, format, doc, folder_color FROM stickies WHERE id = $1 AND is_folder = false LIMIT 1`,
        [id]
    );

    if (!note) {
        return (
            <div style={{ padding: 24, color: "#a1a1aa", fontFamily: "system-ui", fontSize: 13 }}>
                Note not found.
            </div>
        );
    }

    return <EmbedNoteClient note={note} apiKey={key} />;
}
