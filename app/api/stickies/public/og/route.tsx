import { ImageResponse } from "next/og";
import { queryOne } from "@/lib/db-driver";

/**
 * GET /api/stickies/public/og?noteId=...
 * Renders a 1200x630 social-preview card for a public note (title + brand).
 * Used as og:image / twitter:image for /raw links. Non-public or missing notes
 * fall back to a generic Stickies card so the request never errors.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
    const noteId = new URL(req.url).searchParams.get("noteId");
    let title = "Stickies";
    const details: string[] = [];
    if (noteId) {
        const row = await queryOne<{ title: string; is_public: boolean; folder_name: string | null; type: string | null; updated_at: Date | null }>(
            `SELECT title, is_public, folder_name, type, updated_at FROM "stickies" WHERE id = $1 AND trashed_at IS NULL`,
            [noteId]
        ).catch(() => null);
        if (row?.is_public && row.title) title = row.title;
        if (row?.folder_name) details.push(row.folder_name);
        if (row?.type) details.push(row.type.toUpperCase());
        if (row?.updated_at) {
            details.push(new Date(row.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
    }

    return new ImageResponse(
        (
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
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "#facc15",
                            display: "flex",
                        }}
                    />
                    <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: "#a1a1aa" }}>
                        STICKIES
                    </div>
                </div>
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
        ),
        { width: 1200, height: 630 }
    );
}
