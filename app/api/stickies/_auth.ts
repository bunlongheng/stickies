/**
 * Shared owner-auth helper for /api/stickies/* routes.
 *
 * Accepts (in order):
 *  1. Local/LAN request → pass through (dev convenience)
 *  2. Static STICKIES_API_KEY / STICKIES_PASSWORD bearer (external scripts, AI agents)
 *  3. Per-machine API key bearer (api_keys table, sha-256 lookup)
 *  4. NextAuth session cookie whose user.email matches OWNER_EMAIL (browser owner)
 */
import crypto from "crypto";
import { auth } from "@/auth";
import { isLocal } from "@/lib/is-local";
import { query, execute } from "@/lib/db-driver";
import { hashApiKey } from "@/lib/api-keys";

export type CallerVia = "local" | "static" | "apikey" | "jwt" | null;

export interface Caller {
    ok: boolean;
    via: CallerVia;
    keyId?: string;
    label?: string;
}

/**
 * Identify the caller behind a request. Mirrors authorizeOwner's accept order
 * but also surfaces *how* the caller authenticated and (for per-machine keys)
 * which key was used, so routes can attribute notes and gate key management.
 */
export async function identifyCaller(req: Request): Promise<Caller> {
    const auth_header = req.headers.get("authorization") ?? "";
    const bearer = auth_header.startsWith("Bearer ") ? auth_header.slice(7) : "";

    // A presented bearer key is resolved BEFORE the LAN bypass so per-machine
    // attribution survives for same-machine callers (e.g. automations on M4
    // posting to localhost, which would otherwise be tagged 'local' with no key).
    if (bearer) {
        // 2. Static API key / password (timing-safe compare) → labeled 'legacy'
        const secrets = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
        for (const secret of secrets) {
            const expected = `Bearer ${secret}`;
            if (auth_header.length === expected.length) {
                try {
                    if (crypto.timingSafeEqual(Buffer.from(auth_header), Buffer.from(expected))) {
                        return { ok: true, via: "static", label: "legacy" };
                    }
                } catch {}
            }
        }

        // 3. Per-machine API key — sha-256 lookup against api_keys (active only)
        try {
            const hash = hashApiKey(bearer);
            const rows = await query<{ id: string; label: string }>(
                `SELECT id, label FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
                [hash]
            );
            if (rows[0]) {
                const { id, label } = rows[0];
                // Fire-and-forget last-used bump — never block the request on it.
                execute(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [id]).catch(() => {});
                return { ok: true, via: "apikey", keyId: id, label };
            }
        } catch {}
    }

    // Local/LAN bypass — keyless dev/owner convenience (only when no key matched).
    if (isLocal(req)) return { ok: true, via: "local" };

    // NextAuth session cookie → only the OWNER_EMAIL identity passes
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    if (ownerEmail) {
        const session = await auth();
        if (session?.user?.email?.toLowerCase() === ownerEmail) {
            return { ok: true, via: "jwt" };
        }
    }

    // 5. Otherwise — unauthenticated
    return { ok: false, via: null };
}

export async function authorizeOwner(req: Request): Promise<boolean> {
    return (await identifyCaller(req)).ok;
}
