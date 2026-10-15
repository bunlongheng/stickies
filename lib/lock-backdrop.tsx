import { ImageResponse } from "next/og";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { htmlToPlainLines } from "@/lib/note-format";

/**
 * The frosted sheet behind the passcode lock: the note's REAL text, drawn
 * server-side as a document, then shrunk and blurred BEFORE it leaves the
 * server. The browser only ever receives a 480px-wide smear where a line of
 * 15px type is under 6px tall, so removing the page's CSS blur, saving the
 * image or reading the source shows shapes and colours, never a word. Falls
 * back to null (plain gradient) if rendering fails.
 */
const W = 1280, H = 800, SHEET = 800, PAD = 56, LINE = 15, GAP = 9, MAX_LINES = 30;

const cache = new Map<string, string>();

export async function lockBackdropImage(noteId: string, title: string, content: string | null, folderColor: string | null): Promise<string | null> {
    const lines = htmlToPlainLines(content || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, MAX_LINES);
    if (!lines.length) return null;
    const key = `${noteId}:${createHash("sha1").update(`${title}\n${folderColor}\n${lines.join("\n")}`).digest("hex")}`;
    const hit = cache.get(key);
    if (hit) return hit;
    try {
        const accent = folderColor && /^#[0-9a-f]{6}$/i.test(folderColor) ? folderColor : "#c7cbe3";
        const png = Buffer.from(await new ImageResponse(sheet(title, lines, accent), { width: W, height: H }).arrayBuffer());
        const jpg = await sharp(png).resize(480).blur(2.2).jpeg({ quality: 60 }).toBuffer();
        const uri = `data:image/jpeg;base64,${jpg.toString("base64")}`;
        if (cache.size > 200) cache.clear();
        cache.set(key, uri);
        return uri;
    } catch (e) {
        console.error("[stickies] lock backdrop render", e);
        return null;
    }
}

function sheet(title: string, lines: string[], accent: string) {
    const left = (W - SHEET) / 2;
    return (
        <div style={{ width: W, height: H, display: "flex", background: "#f4f5fa", fontFamily: "sans-serif" }}>
            <div style={{ position: "absolute", left, top: 0, width: SHEET, height: H, background: "#ffffff", display: "flex" }} />
            <div style={{ position: "absolute", left, top: 0, width: SHEET, height: 22, background: accent, display: "flex" }} />
            <div style={{ position: "absolute", left: left + PAD, top: 52, width: SHEET - PAD * 2, display: "flex", flexDirection: "column", gap: GAP }}>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>{title}</div>
                {lines.map((line, i) => {
                    const heading = line.length < 28 && !/[.,;:]$/.test(line);
                    return (
                        <div key={i} style={{ display: "flex", fontSize: heading ? 20 : LINE, fontWeight: heading ? 700 : 400, color: heading ? "#1e2235" : "#3b4258", marginTop: heading && i ? 10 : 0 }}>
                            {line}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
