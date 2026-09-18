/**
 * Pass-through middleware.
 *
 * Auth is NOT enforced here — every protected route checks the session/key itself
 * (auth() + identifyCaller in app/api/stickies/_auth.ts). This file exists only to
 * pin the `matcher` exclusions so public assets and open routes like /share bypass
 * the middleware pipeline. It intentionally does no work per request.
 */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    return NextResponse.next({ request });
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|apple-icon\\.svg|api/|share|clip|raw|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
