/**
 * NextAuth-aware middleware.
 *
 * Skips auth on local/LAN requests so dev mode keeps the existing zero-friction flow.
 * For everything else, the underlying `auth()` helper (in app/api/stickies/route.ts and
 * elsewhere) reads the session from the cookie. This middleware mainly exists to keep
 * the matcher exclusions consistent with the rest of the app — public routes like /share
 * stay open.
 */
import { NextResponse, type NextRequest } from "next/server";
import { isLocal } from "@/lib/is-local";

export function middleware(request: NextRequest) {
    if (isLocal(request)) return NextResponse.next({ request });
    return NextResponse.next({ request });
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|apple-icon\\.svg|api/|share|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
