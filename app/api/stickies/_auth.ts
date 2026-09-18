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
import { lanTrusted } from "@/lib/is-local";
import { query, execute } from "@/lib/db-driver";
import { hashApiKey } from "@/lib/api-keys";

export type CallerVia = "local" | "static" | "apikey" | "jwt" | null;

// Production lockdown — shared with app/api/stickies/route.ts's authenticate(). On
// Vercel prod the shared static key is rejected and only the allow-listed per-machine
// key passes; every other path (local/LAN, owner session) is unaffected because
// VERCEL_ENV is unset off-prod.
export const PROD_KEY_LABEL = process.env.STICKIES_PROD_KEY_LABEL?.trim() || "claude-routine";
export const isProdLocked = () => process.env.VERCEL_ENV === "production";

// Attribution label stamped on notes/requests authenticated via the shared static
// secret (as opposed to a per-machine key, which carries its own label).
export const STATIC_KEY_LABEL = "legacy";

export interface Caller {
    ok: boolean;
    via: CallerVia;
    keyId?: string;
    label?: string;
}

export type ApiKeyLookupResult =
    | { status: "match"; id: string; label: string }
    | { status: "not_found" }
    | { status: "prod_locked" };

/**
 * Look up a per-machine API key (api_keys table, sha-256 hash, active only) and apply
 * the prod-lockdown label gate. Shared by identifyCaller() below and
 * app/api/stickies/route.ts's authenticate() — this used to be two independent copies
 * of the same query that could silently drift out of sync (the HIGH-severity finding
 * this refactor addresses).
 */
export async function lookupApiKey(bearer: string): Promise<ApiKeyLookupResult> {
    try {
        const rows = await query<{ id: string; label: string }>(
            `SELECT id, label FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
            [hashApiKey(bearer)]
        );
        const row = rows[0];
        if (!row) return { status: "not_found" };
        if (isProdLocked() && row.label !== PROD_KEY_LABEL) return { status: "prod_locked" };
        // Fire-and-forget last-used bump — never block the request on it.
        execute(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [row.id]).catch(() => {});
        return { status: "match", id: row.id, label: row.label };
    } catch {
        return { status: "not_found" };
    }
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
        // 2. Static API key / password (timing-safe compare) → labeled 'legacy'.
        //    Rejected in production (prod lockdown) — the shared static key must not
        //    reach sub-routes like /backup on prod; it still works on local/LAN.
        if (!isProdLocked()) {
            const secrets = [process.env.STICKIES_API_KEY, process.env.STICKIES_PASSWORD].filter(Boolean) as string[];
            for (const secret of secrets) {
                const expected = `Bearer ${secret}`;
                if (auth_header.length === expected.length) {
                    try {
                        if (crypto.timingSafeEqual(Buffer.from(auth_header), Buffer.from(expected))) {
                            return { ok: true, via: "static", label: STATIC_KEY_LABEL };
                        }
                    } catch {}
                }
            }
        }

        // 3. Per-machine API key — sha-256 lookup against api_keys (active only).
        //    On prod only the allow-listed label passes; other keys fall through to
        //    the owner session check.
        const result = await lookupApiKey(bearer);
        if (result.status === "match") {
            return { ok: true, via: "apikey", keyId: result.id, label: result.label };
        }
        // not_found or prod_locked → fall through to the local/session checks below.
    }

    // Local/LAN bypass - keyless dev/owner convenience (only when no key matched).
    // NEVER trust the client-controlled Host header in production: on Vercel a
    // spoofed `Host: localhost` would otherwise authenticate as owner. lanTrusted()
    // only passes outside production, or on the M4 hub which opts in with
    // STICKIES_LAN_TRUST=1 to serve its production build keyless over the LAN.
    if (lanTrusted(req)) return { ok: true, via: "local" };

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
