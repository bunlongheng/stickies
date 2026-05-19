/**
 * GET /api/auth/native-callback
 *
 * OAuth callback for the native macOS app (stickies-native).
 *
 * NOTE: This route was built around Supabase's session exchange. The Supabase
 * migration removed that mechanism; reworking the native flow is tracked
 * separately (see project_rich_text.md notes on native integration).
 *
 * Interim contract: the native app should keep using STICKIES_API_KEY for any
 * /api/stickies/ext calls. This route returns a clear 503 so the native app's
 * error surface is obvious instead of silently failing or returning an empty {}.
 */
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json(
        {
            error: "native_callback_unimplemented",
            message:
                "Native OAuth callback is being reworked after the move from Supabase to NextAuth. Use STICKIES_API_KEY for API access in the meantime; rich notes embed in WKWebView via /embed/note/[id]?key=<STICKIES_API_KEY>.",
        },
        { status: 503 },
    );
}
