/**
 * Shared owner-auth helper for all /api/stickies/* routes.
 *
 * Accepts either:
 *  - Static STICKIES_API_KEY / STICKIES_PASSWORD  (legacy)
 *  - Supabase JWT whose user.id matches OWNER_USER_ID  (Google OAuth owner)
 */
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { isLocal } from "@/lib/is-local";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function authorizeOwner(req: Request): Promise<boolean> {
    // Local/LAN bypass: no login needed for local requests
    if (isLocal(req)) return true;

    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return false;

    // 1. Static API key / password
    const secrets = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
    for (const secret of secrets) {
        const expected = `Bearer ${secret}`;
        if (auth.length === expected.length) {
            try {
                if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return true;
            } catch {}
        }
    }

    // 2. Supabase JWT — accept if user.id matches OWNER_USER_ID
    const ownerUserId = process.env.OWNER_USER_ID?.trim();
    if (ownerUserId) {
        const { data: { user } } = await getSupabase().auth.getUser(bearer);
        if (user?.id === ownerUserId) return true;
    }

    return false;
}
