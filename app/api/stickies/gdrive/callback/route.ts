/**
 * GET /api/stickies/gdrive/callback
 * Receives OAuth code from Google, exchanges for tokens, stores in integrations table.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:4444";

    if (error || !code) {
        return NextResponse.redirect(`${baseUrl}/?gdrive=error&msg=${encodeURIComponent(error || "no_code")}`);
    }

    try {
        const redirectUri = `${baseUrl}/api/stickies/gdrive/callback`;

        // Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        const tokens = await tokenRes.json();
        if (!tokens.refresh_token) {
            console.error("[gdrive callback] No refresh token:", tokens);
            return NextResponse.redirect(`${baseUrl}/?gdrive=error&msg=no_refresh_token`);
        }

        const supabase = getSupabase();

        // Check if gdrive integration already exists
        const { data: existing } = await supabase
            .from("integrations")
            .select("id")
            .eq("type", "gdrive")
            .single();

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        if (existing) {
            await supabase
                .from("integrations")
                .update({
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: expiresAt,
                    active: true,
                })
                .eq("id", existing.id);
        } else {
            await supabase
                .from("integrations")
                .insert({
                    name: "Google Drive",
                    type: "gdrive",
                    trigger: "upload",
                    condition: {},
                    config: {},
                    active: true,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expires_at: expiresAt,
                });
        }

        return NextResponse.redirect(`${baseUrl}/?gdrive=connected`);
    } catch (err: any) {
        console.error("[gdrive callback]", err);
        return NextResponse.redirect(`${baseUrl}/?gdrive=error&msg=${encodeURIComponent(err?.message || "unknown")}`);
    }
}
