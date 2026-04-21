import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db-driver";

export async function GET(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const rows = await query(
            `SELECT id, trigger, condition, type, config, name FROM integrations WHERE active = true`
        );
        return NextResponse.json(rows ?? []);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { type, name, trigger, condition, config } = body as any;
    if (!type?.trim()) return NextResponse.json({ error: "type required" }, { status: 400 });

    const now = new Date().toISOString();
    try {
        const row = await queryOne(
            `INSERT INTO integrations (type, name, trigger, condition, config, active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, trigger, condition, type, config, name`,
            [
                type.trim(),
                name?.trim() ?? type.trim(),
                trigger ?? null,
                JSON.stringify(condition ?? {}),
                JSON.stringify(config ?? {}),
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
