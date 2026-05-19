/**
 * Chromeless rich-note editor for embedding inside the native macOS app
 * (WKWebView). No header, no sidebar, no chrome — just the editor filling
 * the viewport.
 *
 * Auth: `?key=<STICKIES_API_KEY>` URL param. The native app holds this key
 * and passes it on the embed URL. The page validates server-side and hands
 * the key to the client for subsequent save calls.
 */
import { queryOne } from "@/lib/db-driver";
import EmbedNoteClient from "./EmbedNoteClient";

interface Note {
    id: string;
    title: string | null;
    content: string | null;
    format: "text" | "markdown" | "rich" | null;
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

    if (!key || key !== process.env.STICKIES_API_KEY) {
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
