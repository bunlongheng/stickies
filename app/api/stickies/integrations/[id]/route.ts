import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { execute } from "@/lib/db-driver";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();

    // Build dynamic SET clause from body keys
    const allowed = ["type", "name", "trigger", "condition", "config", "active"];
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
        if (key in body) {
            setClauses.push(`${key} = $${idx++}`);
            const val = body[key];
            // JSON-stringify object fields for Postgres jsonb columns
            values.push(typeof val === "object" && val !== null ? JSON.stringify(val) : val);
        }
    }

    setClauses.push(`updated_at = $${idx}`);
    values.push(new Date().toISOString());
    values.push(id); // for WHERE clause

    try {
        await execute(
            `UPDATE integrations SET ${setClauses.join(", ")} WHERE id = $${idx + 1}`,
            values
        );
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    if (!await authorizeOwner(_req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    try {
        await execute(`DELETE FROM integrations WHERE id = $1`, [id]);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
