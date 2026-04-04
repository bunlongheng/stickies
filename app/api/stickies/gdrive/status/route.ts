/**
 * GET /api/stickies/gdrive/status
 * Returns whether Google Drive is connected.
 */
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const candidates = [
        process.env.STICKIES_API_KEY,
        process.env.STICKIES_PASSWORD,
    ].filter(Boolean) as string[];
    for (const secret of candidates) {
        const expected = `Bearer ${secret}`;
        if (auth.length !== expected.length) continue;
        try {
            if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true;
        } catch {}
    }
    if (bearer) {
        try {
            const { data: { user } } = await getSupabase().auth.getUser(bearer);
            if (user) return true;
        } catch {}
    }
    return false;
}

export async function GET(req: NextRequest) {
    if (!await isAuthorized(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await getSupabase()
        .from("integrations")
        .select("refresh_token, active")
        .eq("type", "gdrive")
        .single();

    return NextResponse.json({
        connected: !!(data?.refresh_token && data?.active),
    });
}
