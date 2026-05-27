/**
 * /api/stickies/keys — owner-only API-key management (mint / list / revoke).
 *
 * Management is OWNER-ONLY and must reject machine auth: a static or per-machine
 * API key can authenticate to post notes, but it must NOT be able to mint or
 * revoke keys. Only `via: 'local'` (dev) or `via: 'jwt'` (browser owner) pass.
 *
 * Keys are stored as sha-256 hashes; the plaintext is returned ONCE on create.
 */
import { NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db-driver";
import { identifyCaller } from "@/app/api/stickies/_auth";
import { generateApiKey } from "@/lib/api-keys";

/** Ensure the api_keys table exists (matches the user_preferences ensure-on-use style). */
async function ensureTable() {
    try {
        await execute(
            `CREATE TABLE IF NOT EXISTS api_keys (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), label TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, key_prefix TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, user_id UUID NOT NULL)`
        );
    } catch {}
}

/** Owner-only gate: allow local dev or owner JWT; reject machine (static/apikey) auth with 403. */
async function ownerGate(req: Request): Promise<NextResponse | null> {
    const caller = await identifyCaller(req);
    if (!caller.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (caller.via !== "local" && caller.via !== "jwt") {
        return NextResponse.json({ error: "Key management is owner-only. Machine keys cannot manage keys." }, { status: 403 });
    }
    return null;
}

export async function GET(req: Request) {
    const denied = await ownerGate(req);
    if (denied) return denied;
    await ensureTable();
    const keys = await query<{
        id: string; label: string; key_prefix: string;
        created_at: string; last_used_at: string | null; revoked_at: string | null;
    }>(
        `SELECT id, label, key_prefix, created_at, last_used_at, revoked_at FROM api_keys ORDER BY created_at DESC`
    );
    return NextResponse.json({ keys });
}

export async function POST(req: Request) {
    const denied = await ownerGate(req);
    if (denied) return denied;

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });

    await ensureTable();
    const { plaintext, hash, prefix } = generateApiKey();
    const row = await queryOne<{ id: string; label: string }>(
        `INSERT INTO api_keys (label, key_hash, key_prefix, user_id) VALUES ($1, $2, $3, $4) RETURNING id, label`,
        [label, hash, prefix, process.env.OWNER_USER_ID?.trim() ?? ""]
    );
    if (!row) return NextResponse.json({ error: "Database error" }, { status: 500 });

    // Plaintext is returned ONCE — it is never stored or shown again.
    return NextResponse.json({ id: row.id, label: row.label, key: plaintext, prefix }, { status: 201 });
}

export async function DELETE(req: Request) {
    const denied = await ownerGate(req);
    if (denied) return denied;

    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await ensureTable();
    const count = await execute(`UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
    if (count === 0) return NextResponse.json({ error: "Key not found" }, { status: 404 });
    return NextResponse.json({ ok: true, revoked: id });
}
