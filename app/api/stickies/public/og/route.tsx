import { ImageResponse } from "next/og";
import { queryOne } from "@/lib/db-driver";

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
    const details: string[] = [];
    if (noteId) {
        const row = await queryOne<{ title: string; is_public: boolean; folder_name: string | null; type: string | null; updated_at: Date | null; locked: boolean }>(
            `SELECT title, is_public, folder_name, type, updated_at, locked FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
            [noteId]
        ).catch(() => null);
        if (row?.is_public && row.title) title = row.title;
        locked = !!row?.locked;
        if (row?.folder_name) details.push(row.folder_name);
        if (row?.type) details.push(row.type.toUpperCase());
        if (row?.updated_at) {
            details.push(new Date(row.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
    }

    const card = locked ? safeCard(title) : openCard(title, details);
    return new ImageResponse(card, { width: 1200, height: 630 });
}

function brand() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#facc15", display: "flex" }} />
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: "#a1a1aa" }}>STICKIES</div>
        </div>
    );
}

function openCard(title: string, details: string[]) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "linear-gradient(135deg,#1c1c1e 0%,#000 100%)",
                padding: "72px 80px",
                color: "#f4f4f4",
                fontFamily: "sans-serif",
            }}
        >
            {brand()}
            <div
                style={{
                    fontSize: title.length > 60 ? 60 : 76,
                    fontWeight: 800,
                    lineHeight: 1.12,
                    letterSpacing: -1.5,
                    display: "flex",
                    maxWidth: 1040,
                }}
            >
                {title.length > 140 ? title.slice(0, 137) + "..." : title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26, color: "#a1a1aa" }}>
                {(details.length ? details : ["Shared note"]).map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {i > 0 ? <div style={{ width: 6, height: 6, borderRadius: 6, background: "#52525b", display: "flex" }} /> : null}
                        <div style={{ display: "flex" }}>{d}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// "Black safe" card for locked notes - mirrors the /raw unlock gate so the
// social preview reveals a vault, not the note's content.
function safeCard(title: string) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "radial-gradient(ellipse at 50% 35%,#181818 0%,#000 80%)",
                fontFamily: "sans-serif",
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: 760,
                    padding: "44px 48px",
                    borderRadius: 26,
                    background: "linear-gradient(145deg,#1c1c1e 0%,#0e0e0e 40%,#050505 100%)",
                    border: "1px solid #222",
                    color: "#bdbdbd",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                    <div style={{ display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: 6, color: "#6c6c6c" }}>
                        STICKIES · SAFE 01
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, fontWeight: 700, letterSpacing: 4, color: "#9c9c9c" }}>
                        <div style={{ width: 14, height: 14, borderRadius: 14, background: "#fff", display: "flex" }} />
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
                    <div style={{ display: "flex", fontSize: 20, letterSpacing: 6, color: "#5a5a5a", fontWeight: 700, marginBottom: 14 }}>
                        CONTENTS
                    </div>
                    <div style={{ display: "flex", fontSize: title.length > 38 ? 40 : 52, fontWeight: 700, color: "#f4f4f4", lineHeight: 1.15 }}>
                        {title.length > 80 ? title.slice(0, 77) + "..." : title}
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28, marginTop: 30 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 78,
                            height: 78,
                            borderRadius: 18,
                            background: "linear-gradient(180deg,#f4f4f4,#9c9c9c)",
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 30, height: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTop: "7px solid #1a1a1a", borderLeft: "7px solid #1a1a1a", borderRight: "7px solid #1a1a1a", display: "flex" }} />
                            <div style={{ width: 44, height: 32, borderRadius: 8, background: "#1a1a1a", display: "flex" }} />
                        </div>
                    </div>
                    <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: "#7a7a7a" }}>
                        Enter passcode to unlock
                    </div>
                </div>
            </div>
        </div>
    );
}
