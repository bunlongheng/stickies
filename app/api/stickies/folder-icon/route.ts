import { NextResponse } from "next/server";
import { query, execute } from "@/lib/db-driver";
import { authorizeOwner } from "@/app/api/stickies/_auth";

const OWNER = () => process.env.OWNER_USER_ID?.trim() ?? "";

// GET /api/stickies/folder-icon — read all folder icons
export async function GET(req: Request) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await query<{ folder_name: string; content: string }>(
        `SELECT folder_name, content FROM "stickies" WHERE is_folder = true AND user_id = $1`,
        [OWNER()]
    );

    const icons: Record<string, string> = {};
    rows.forEach((row) => {
        if (row.folder_name && row.content && row.content.trim()) {
            icons[String(row.folder_name)] = row.content.trim();
        }
    });
    return NextResponse.json({ icons });
}

// PATCH /api/stickies/folder-icon — save icon for a folder
export async function PATCH(req: Request) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let folderName: string, icon: string;
    try {
        const body = await req.json();
        folderName = String(body.folderName ?? "").trim();
        icon = String(body.icon ?? "").trim();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!folderName) return NextResponse.json({ error: "folderName required" }, { status: 400 });

    await execute(
        `UPDATE "stickies" SET content = $1, updated_at = $2 WHERE is_folder = true AND folder_name = $3 AND user_id = $4`,
        [icon, new Date().toISOString(), folderName, OWNER()]
    );

    return NextResponse.json({ ok: true });
}
