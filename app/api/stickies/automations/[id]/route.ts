import { authorizeOwner } from "@/app/api/stickies/_auth";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}



type Params = { params: Promise<{ id: string }> };

// PATCH /api/stickies/automations/[id]
export async function PATCH(req: Request, { params }: Params) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { error } = await getSupabase()
        .from("automations")
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

// DELETE /api/stickies/automations/[id]
export async function DELETE(req: Request, { params }: Params) {
    if (!await authorizeOwner(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const { error } = await getSupabase().from("automations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
