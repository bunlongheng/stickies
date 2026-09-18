/**
 * GET /api/stickies/gdrive/callback
 * Receives OAuth code from Google, exchanges for tokens, stores in integrations table.
 */
import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db-driver";
import { GDRIVE_STATE_COOKIE, verifyOAuthState } from "../_oauth-state";

// Redirect back to the app while clearing the one-shot CSRF state cookie.
function done(baseUrl: string, query: string) {
    const res = NextResponse.redirect(`${baseUrl}/?${query}`);
    res.cookies.set(GDRIVE_STATE_COOKIE, "", { path: "/api/stickies/gdrive", maxAge: 0 });
    return res;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const returnedState = searchParams.get("state");
    const cookieState = req.cookies?.get?.(GDRIVE_STATE_COOKIE)?.value;
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:4444";

    // CSRF: the state Google echoes back must match the cookie the owner's browser got
    // when it STARTED the flow. Without this, a lured click could bind an attacker's
    // Drive account into the integration (or hijack the owner's). Check before anything.
    if (!verifyOAuthState(returnedState, cookieState)) {
        return done(baseUrl, "gdrive=error&msg=bad_state");
    }

    if (error || !code) {
        return done(baseUrl, `gdrive=error&msg=${encodeURIComponent(error || "no_code")}`);
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
            return done(baseUrl, "gdrive=error&msg=no_refresh_token");
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

        return done(baseUrl, "gdrive=connected");
    } catch (err: any) {
        console.error("[gdrive callback]", err);
        return done(baseUrl, `gdrive=error&msg=${encodeURIComponent(err?.message || "unknown")}`);
    }
}
