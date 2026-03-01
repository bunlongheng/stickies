import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabase() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function authorize(req: Request): boolean {
    const auth = req.headers.get("authorization") ?? "";
    const candidates = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try { if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true; } catch {}
    }
    return false;
}

// GET /api/stickies/automations — list all automations with last_fired
export async function GET(req: Request) {
    if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("automations")
        .select(`
            id, name, trigger_type, trigger_integration_id, condition,
            action_type, action_integration_id, action_config, active,
            created_at, updated_at
        `)
        .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Attach last_fired from automation_logs
    const ids = (data ?? []).map((a: any) => a.id);
    let lastFiredMap: Record<string, string> = {};
    if (ids.length > 0) {
        const { data: logs } = await supabase
            .from("automation_logs")
            .select("automation_id, triggered_at")
            .in("automation_id", ids)
            .eq("result", "ok")
            .order("triggered_at", { ascending: false });
        for (const log of logs ?? []) {
            if (!lastFiredMap[log.automation_id]) lastFiredMap[log.automation_id] = log.triggered_at;
        }
    }

    const enriched = (data ?? []).map((a: any) => ({ ...a, last_fired: lastFiredMap[a.id] ?? null }));
    return NextResponse.json(enriched);
}

// POST /api/stickies/automations — create a new automation
export async function POST(req: Request) {
    if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { name, trigger_type, trigger_integration_id, condition, action_type, action_integration_id, action_config } = body as any;
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
    if (!trigger_type?.trim()) return NextResponse.json({ error: "trigger_type required" }, { status: 400 });
    if (!action_type?.trim()) return NextResponse.json({ error: "action_type required" }, { status: 400 });

    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
        .from("automations")
        .insert([{
            name: name.trim(),
            trigger_type: trigger_type.trim(),
            trigger_integration_id: trigger_integration_id ?? null,
            condition: condition ?? {},
            action_type: action_type.trim(),
            action_integration_id: action_integration_id ?? null,
            action_config: action_config ?? {},
            active: true,
            created_at: now,
            updated_at: now,
        }])
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
