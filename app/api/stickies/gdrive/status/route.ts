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

    const localConnected = !!(data?.refresh_token && data?.active);
    // On Vercel, only local connection counts. Locally, the prod-proxy is a valid path too,
    // so report connected when STICKIES_API_KEY is available (the proxy will use it).
    const proxyAvailable = !process.env.VERCEL && !!process.env.STICKIES_API_KEY;

    return NextResponse.json({
        connected: localConnected || proxyAvailable,
        via: localConnected ? "local" : proxyAvailable ? "proxy" : "none",
    });
}
