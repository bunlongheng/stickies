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

// GET /api/stickies/automation-logs
// ?automation_id=<uuid>  → logs for one automation
// ?limit=<n>             → max results (default 20, max 100)
export async function GET(req: Request) {
    if (!authorize(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const automationId = searchParams.get("automation_id");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

    let query = getSupabase()
        .from("automation_logs")
        .select("id, automation_id, automation_name, triggered_at, result, detail, via, trigger_payload")
        .order("triggered_at", { ascending: false })
        .limit(limit);

    if (automationId) query = query.eq("automation_id", automationId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}
