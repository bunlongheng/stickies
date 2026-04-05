/**
 * GET /api/stickies/gdrive/status
 * Returns whether Google Drive is connected.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authorizeOwner } from "../../_auth";

export async function GET(req: NextRequest) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
        .from("integrations")
        .select("refresh_token, active")
        .eq("type", "gdrive")
        .single();

    return NextResponse.json({
        connected: !!(data?.refresh_token && data?.active),
    });
}
