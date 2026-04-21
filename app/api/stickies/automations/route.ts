import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db-driver";

// GET /api/stickies/automations — list all automations with last_fired
export async function GET(req: Request) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const data = await query(
            `SELECT id, name, trigger_type, trigger_integration_id, condition,
                    action_type, action_integration_id, action_config, active,
                    created_at, updated_at
             FROM automations
             ORDER BY created_at ASC`
        );

        // Attach last_fired from automation_logs
        const ids = (data ?? []).map((a: any) => a.id);
        let lastFiredMap: Record<string, string> = {};
        if (ids.length > 0) {
            const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(", ");
            const logs = await query(
                `SELECT automation_id, triggered_at
                 FROM automation_logs
                 WHERE automation_id IN (${placeholders}) AND result = 'ok'
                 ORDER BY triggered_at DESC`,
                ids
            );
            for (const log of (logs ?? []) as any[]) {
                if (!lastFiredMap[log.automation_id]) lastFiredMap[log.automation_id] = log.triggered_at;
            }
        }

        const enriched = (data ?? []).map((a: any) => ({ ...a, last_fired: lastFiredMap[a.id] ?? null }));
        return NextResponse.json(enriched);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/stickies/automations — create a new automation
export async function POST(req: Request) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { name, trigger_type, trigger_integration_id, condition, action_type, action_integration_id, action_config } = body as any;
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    if (!trigger_type?.trim()) return NextResponse.json({ error: "trigger_type required" }, { status: 400 });
    if (!action_type?.trim()) return NextResponse.json({ error: "action_type required" }, { status: 400 });

    const now = new Date().toISOString();
    try {
        const row = await queryOne(
            `INSERT INTO automations (name, trigger_type, trigger_integration_id, condition,
                                      action_type, action_integration_id, action_config, active,
                                      created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                name.trim(),
                trigger_type.trim(),
                trigger_integration_id ?? null,
                JSON.stringify(condition ?? {}),
                action_type.trim(),
                action_integration_id ?? null,
                JSON.stringify(action_config ?? {}),
                true,
                now,
                now,
            ]
        );
        return NextResponse.json(row, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
