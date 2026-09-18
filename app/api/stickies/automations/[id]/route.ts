import { authorizeOwner } from "@/app/api/stickies/_auth";
import { NextResponse } from "next/server";
import { execute } from "@/lib/db-driver";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/stickies/automations/[id]
export async function PATCH(req: Request, { params }: Params) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    // Build dynamic SET clause from body keys
    const allowed = ["name", "trigger_type", "trigger_integration_id", "condition",
                     "action_type", "action_integration_id", "action_config", "active"];
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of allowed) {
        if (key in body) {
            const val = (key === "condition" || key === "action_config")
                ? JSON.stringify(body[key] ?? {})
                : body[key];
            setClauses.push(`${key} = $${idx++}`);
            values.push(val);
        }
    }

    setClauses.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());
    values.push(id);

    try {
        await execute(
            `UPDATE automations SET ${setClauses.join(", ")} WHERE id = $${idx}`,
            values
        );
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/stickies/automations/[id]
export async function DELETE(req: Request, { params }: Params) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    try {
        await execute(`DELETE FROM automations WHERE id = $1`, [id]);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
