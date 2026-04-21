/**
 * GET /api/stickies/gdrive/status
 * Returns whether Google Drive is connected.
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeOwner } from "../../_auth";
import { queryOne } from "@/lib/db-driver";

export async function GET(req: NextRequest) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await queryOne<{ refresh_token: string | null; active: boolean }>(
        `SELECT refresh_token, active FROM integrations WHERE type = $1 LIMIT 1`,
        ["gdrive"]
    );

    return NextResponse.json({
        connected: !!(data?.refresh_token && data?.active),
    });
}
