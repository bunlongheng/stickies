/**
 * GET /api/stickies/gdrive/callback
 * Receives OAuth code from Google, exchanges for tokens, stores in integrations table.
 */
import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db-driver";

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

        // Check if gdrive integration already exists
        const existing = await queryOne<{ id: string }>(
            `SELECT id FROM integrations WHERE type = $1 LIMIT 1`,
            ["gdrive"]
        );

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        if (existing) {
            await execute(
                `UPDATE integrations SET access_token = $1, refresh_token = $2, token_expires_at = $3, active = true WHERE id = $4`,
                [tokens.access_token, tokens.refresh_token, expiresAt, existing.id]
            );
        } else {
            await execute(
                `INSERT INTO integrations (name, type, trigger, condition, config, active, access_token, refresh_token, token_expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                ["Google Drive", "gdrive", "upload", "{}", "{}", true, tokens.access_token, tokens.refresh_token, expiresAt]
            );
        }

        return NextResponse.redirect(`${baseUrl}/?gdrive=connected`);
    } catch (err: any) {
        console.error("[gdrive callback]", err);
        return NextResponse.redirect(`${baseUrl}/?gdrive=error&msg=${encodeURIComponent(err?.message || "unknown")}`);
    }
}
