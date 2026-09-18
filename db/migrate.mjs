#!/usr/bin/env node
/**
 * Minimal migration runner. Applies unrun supabase/migrations/*.sql in order and
 * tracks them in a schema_migrations table.
 *
 * SAFE FIRST RUN: if the ledger is empty but the schema already exists (the
 * `stickies` table is present - i.e. the DB was hand-migrated before this runner
 * existed), it BASELINES every current migration file as applied WITHOUT running
 * any SQL. That prevents re-running non-idempotent historical migrations against
 * prod. From then on, only genuinely new migration files are applied.
 *
 * Usage: DATABASE_URL=... npm run migrate
 * TLS mirrors lib/db.ts sslConfig (verified cert when DATABASE_CA_CERT is set).
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "supabase", "migrations");

function sslConfig() {
    const conn = process.env.DATABASE_URL ?? "";
    if (conn.includes("@localhost")) return false;
    const raw = process.env.DATABASE_CA_CERT?.trim();
    if (raw) {
        const ca = raw.includes("BEGIN CERTIFICATE") ? raw : Buffer.from(raw, "base64").toString("utf8");
        return { ca, rejectUnauthorized: true };
    }
    return { rejectUnauthorized: false };
}

async function main() {
    const conn = process.env.DATABASE_URL;
    if (!conn) { console.error("[migrate] DATABASE_URL not set"); process.exit(1); }
    const client = new pg.Client({ connectionString: conn, ssl: sslConfig() });
    await client.connect();
    try {
        await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
        const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
        const { rows } = await client.query(`SELECT filename FROM schema_migrations`);
        const applied = new Set(rows.map((r) => r.filename));

        if (applied.size === 0) {
            const { rows: reg } = await client.query(`SELECT to_regclass('public.stickies') AS t`);
            if (reg[0] && reg[0].t) {
                for (const f of files) await client.query(`INSERT INTO schema_migrations(filename) VALUES ($1) ON CONFLICT DO NOTHING`, [f]);
                console.log(`[migrate] baselined ${files.length} existing migrations (schema already present); ran no SQL`);
                return;
            }
        }

        const pending = files.filter((f) => !applied.has(f));
        if (pending.length === 0) { console.log("[migrate] up to date, nothing to apply"); return; }
        for (const f of pending) {
            const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query(`INSERT INTO schema_migrations(filename) VALUES ($1)`, [f]);
                await client.query("COMMIT");
                console.log(`[migrate] applied ${f}`);
            } catch (e) {
                await client.query("ROLLBACK");
                console.error(`[migrate] FAILED on ${f}: ${e.message}`);
                process.exit(1);
            }
        }
        console.log(`[migrate] applied ${pending.length} migration(s)`);
    } finally {
        await client.end();
    }
}

main().catch((e) => { console.error("[migrate]", e.message); process.exit(1); });
