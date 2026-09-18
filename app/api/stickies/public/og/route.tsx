import { ImageResponse } from "next/og";
import { queryOne } from "@/lib/db-driver";
import { ogPreviewLines } from "@/lib/note-format";

/**
 * GET /api/stickies/public/og?noteId=...
 * Renders a 1200x630 social-preview card for a public note. Open notes show a
 * title + details card; locked notes show a "black safe" card (no content leak).
 * Used as og:image / twitter:image for /raw links. Non-public or missing notes
 * fall back to a generic Stickies card so the request never errors.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
    const noteId = new URL(req.url).searchParams.get("noteId");
    let title = "Stickies";
    let locked = false;
    let color = "#facc15";
    const details: string[] = [];
    let bodyLines: string[] = [];
    if (noteId) {
        const row = await queryOne<{ title: string; is_public: boolean; folder_name: string | null; folder_color: string | null; type: string | null; updated_at: Date | null; locked: boolean; content: string | null }>(
            `SELECT title, is_public, folder_name, folder_color, type, updated_at, locked, content FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
            [noteId]
        ).catch(() => null);
        if (row?.is_public && row.title) title = row.title;
        locked = !!row?.locked;
        if (row?.folder_color && /^#[0-9a-f]{6}$/i.test(row.folder_color)) color = row.folder_color;
        if (row?.folder_name) details.push(row.folder_name);
        if (row?.type) details.push(row.type.toUpperCase());
        if (row?.updated_at) {
            details.push(new Date(row.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
        // Only public, unlocked notes reveal their real body shape in the preview.
        if (row?.is_public && !row.locked && row.content) bodyLines = ogPreviewLines(row.content);
    }

    const card = locked ? safeCard(title, color) : openCard(title, details, color, bodyLines);
    return new ImageResponse(card, { width: 1200, height: 630 });
}

// Blend a #rrggbb hex toward black by `f` (0..1) - used to derive the deep base tint.
function darken(hex: string, f: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * (1 - f));
    const g = Math.round(((n >> 8) & 255) * (1 - f));
    const b = Math.round((n & 255) * (1 - f));
    return `rgb(${r},${g},${b})`;
}

function brand() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#facc15", display: "flex" }} />
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: "#a1a1aa" }}>STICKIES</div>
        </div>
    );
}

function openCard(title: string, details: string[], color: string, bodyLines: string[] = []) {
    // Soft, out-of-focus backdrop derived from the note's own folder color:
    // large radial "orbs" that fade to transparent read as blurred depth (satori
    // has no blur filter, so the softness comes from wide gradient falloff), a dark
    // scrim for legibility, and the note's REAL first lines ghosted behind the card
    // so the preview silhouette matches the actual content (falls back to nothing).
    // Fixed-width bars stand in only when the note has no extractable text.
    const ghost = bodyLines.length
        ? bodyLines.map((line, i) => (
            <div key={i} style={{ display: "flex", fontSize: 30, color: "#ffffff" }}>{line}</div>
        ))
        : [760, 900, 640, 820, 520].map((w, i) => (
            <div key={i} style={{ width: w, height: 20, borderRadius: 20, background: "#ffffff", display: "flex" }} />
        ));
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                position: "relative",
                background: darken(color, 0.78),
                fontFamily: "sans-serif",
            }}
        >
            {/* out-of-focus color orbs */}
            <div style={{ position: "absolute", top: -220, left: -160, width: 760, height: 760, borderRadius: 760, background: `radial-gradient(circle at center, ${color} 0%, ${color}00 68%)`, opacity: 0.55, display: "flex" }} />
            <div style={{ position: "absolute", bottom: -300, right: -140, width: 820, height: 820, borderRadius: 820, background: `radial-gradient(circle at center, ${color} 0%, ${color}00 66%)`, opacity: 0.4, display: "flex" }} />
            {/* dark scrim so the title stays crisp over the color */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.75) 100%)", display: "flex" }} />
            {/* ghosted content lines - the real note (or fallback bars) behind the card */}
            <div style={{ position: "absolute", left: 80, bottom: 96, display: "flex", flexDirection: "column", gap: bodyLines.length ? 14 : 22, opacity: 0.16, maxWidth: 1040 }}>
                {ghost}
            </div>
            {/* foreground content */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "72px 80px",
                    color: "#ffffff",
                }}
            >
                {brand()}
                <div
                    style={{
                        fontSize: title.length > 60 ? 62 : 78,
                        fontWeight: 800,
                        lineHeight: 1.1,
                        letterSpacing: -1.5,
                        display: "flex",
                        maxWidth: 1000,
                        textShadow: "0 4px 30px rgba(0,0,0,0.55)",
                    }}
                >
                    {title.length > 140 ? title.slice(0, 137) + "..." : title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#e4e4e7" }}>
                    <div style={{ width: 16, height: 16, borderRadius: 5, background: color, display: "flex" }} />
                    {(details.length ? details : ["Shared note"]).map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            {i > 0 ? <div style={{ width: 6, height: 6, borderRadius: 6, background: "#a1a1aa", display: "flex" }} /> : null}
                            <div style={{ display: "flex" }}>{d}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// "Black safe" card for locked notes - mirrors the /raw unlock gate so the
// social preview reveals a vault, not the note's content. The sticky's own color
// lights the vault (status dot + contents accent) as a signature without leaking
// any content. The top-right LOCKED indicator is the only lock cue - no passcode row.
function safeCard(title: string, color: string) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
                background: `radial-gradient(ellipse at 50% 35%, ${darken(color, 0.74)} 0%, #000 82%)`,
                fontFamily: "sans-serif",
            }}
        >
            {/* faint color haze so the note's color reads even through the vault */}
            <div style={{ position: "absolute", top: -160, left: 240, width: 720, height: 720, borderRadius: 720, background: `radial-gradient(circle at center, ${color} 0%, ${color}00 70%)`, opacity: 0.22, display: "flex" }} />
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    width: 760,
                    padding: "44px 48px",
                    borderRadius: 26,
                    background: "linear-gradient(145deg,#1c1c1e 0%,#0e0e0e 40%,#050505 100%)",
                    border: `1px solid ${color}22`,
                    color: "#bdbdbd",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, fontWeight: 700, letterSpacing: 4, color: "#9c9c9c" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 13, height: 9, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderTop: `3px solid ${color}`, borderLeft: `3px solid ${color}`, borderRight: `3px solid ${color}`, display: "flex" }} />
                            <div style={{ width: 20, height: 15, borderRadius: 4, background: color, display: "flex" }} />
                        </div>
                        LOCKED
                    </div>
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        background: "linear-gradient(180deg,#0a0a0a,#020202)",
                        border: "1px solid #1a1a1a",
                        borderRadius: 14,
                        padding: "26px 28px",
                    }}
                >
                    <div style={{ display: "flex", fontSize: title.length > 38 ? 40 : 52, fontWeight: 700, color: "#f4f4f4", lineHeight: 1.15 }}>
                        {title.length > 80 ? title.slice(0, 77) + "..." : title}
                    </div>
                </div>
            </div>
        </div>
    );
}
