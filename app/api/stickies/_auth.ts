/**
 * Shared owner-auth helper for /api/stickies/* routes.
 *
 * Accepts (in order):
 *  1. Local/LAN request → pass through (dev convenience)
 *  2. Static STICKIES_API_KEY / STICKIES_PASSWORD bearer (external scripts, AI agents)
 *  3. NextAuth session cookie whose user.email matches OWNER_EMAIL (browser owner)
 */
import crypto from "crypto";
import { auth } from "@/auth";
import { isLocal } from "@/lib/is-local";

export async function authorizeOwner(req: Request): Promise<boolean> {
    // 1. Local/LAN bypass — no login needed in dev
    if (isLocal(req)) return true;

    // 2. Static API key / password (only static-secret callers reach this branch)
    const auth_header = req.headers.get("authorization") ?? "";
    if (auth_header.startsWith("Bearer ")) {
        const secrets = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
        for (const secret of secrets) {
            const expected = `Bearer ${secret}`;
            if (auth_header.length === expected.length) {
                try {
                    if (crypto.timingSafeEqual(Buffer.from(auth_header), Buffer.from(expected))) return true;
                } catch {}
            }
        }
    }

    // 3. NextAuth session cookie → only the OWNER_EMAIL identity passes
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    if (!ownerEmail) return false;
    const session = await auth();
    return session?.user?.email?.toLowerCase() === ownerEmail;
}
