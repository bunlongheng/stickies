/**
 * GET /api/stickies/gdrive/auth
 * Redirects to Google OAuth consent screen for Drive access.
 */
import { NextResponse } from "next/server";

export async function GET() {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:4444";
    const redirectUri = `${baseUrl}/api/stickies/gdrive/callback`;

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
