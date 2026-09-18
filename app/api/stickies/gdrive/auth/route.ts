/**
 * GET /api/stickies/gdrive/auth
 * Redirects to Google OAuth consent screen for Drive access.
 * Owner-only, and mints a CSRF state cookie the callback verifies.
 */
import { NextResponse } from "next/server";
import { authorizeOwner } from "../../_auth";
import { GDRIVE_STATE_COOKIE, GDRIVE_STATE_MAX_AGE, newOAuthState } from "../_oauth-state";

export async function GET(req: Request) {
    if (!(await authorizeOwner(req))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:4444";
    const redirectUri = `${baseUrl}/api/stickies/gdrive/callback`;
    const state = newOAuthState();

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
        state,
    });

    const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    res.cookies.set(GDRIVE_STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/stickies/gdrive",
        maxAge: GDRIVE_STATE_MAX_AGE,
    });
    return res;
}
