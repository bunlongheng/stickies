import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { query } from "@/lib/db-driver";

// GET /api/stickies/automation-logs
// ?automation_id=<uuid>  → logs for one automation
// ?limit=<n>             → max results (default 20, max 100)
export async function GET(req: Request) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const automationId = searchParams.get("automation_id");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

    try {
        let sql = `SELECT id, automation_id, automation_name, triggered_at, result, detail, via, trigger_payload
                    FROM automation_logs`;
        const params: any[] = [];

        if (automationId) {
            sql += ` WHERE automation_id = $1`;
            params.push(automationId);
        }

        sql += ` ORDER BY triggered_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const data = await query(sql, params);
        return NextResponse.json(data ?? []);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
