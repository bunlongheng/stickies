#!/usr/bin/env node
/**
 * sync-supabase-to-linode.mjs
 *
 * Syncs notes from Supabase → Linode PostgreSQL.
 * Uses Supabase Management API as source (no PostgREST quota burn).
 * Uses direct pg pool as target.
 *
 * Usage:
 *   node scripts/sync-supabase-to-linode.mjs           # dry run (show diff only)
 *   node scripts/sync-supabase-to-linode.mjs --apply   # actually insert missing rows
 *   node scripts/sync-supabase-to-linode.mjs --full    # full upsert (overwrite if content differs)
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.join(__dirname, "../.env.local");

// Load .env.local
try {
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split("\n")) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
    }
} catch {
    console.error("Could not load .env.local");
    process.exit(1);
}

const require  = createRequire(import.meta.url);
const { Pool } = require("pg");

const MGMT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;
const SB_REF     = process.env.SUPABASE_PROJECT_REF;
const APPLY      = process.argv.includes("--apply");
const FULL       = process.argv.includes("--full");
const BATCH_SIZE = 200;

if (!MGMT_TOKEN || !SB_REF) {
    console.error("Missing SUPABASE_MANAGEMENT_TOKEN or SUPABASE_PROJECT_REF in .env.local");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10000,
});

// ── Supabase query via Management API ────────────────────────────────────────
async function sbQuery(sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${SB_REF}/database/query`, {
        method:  "POST",
        headers: {
            "Authorization": `Bearer ${MGMT_TOKEN}`,
            "Content-Type":  "application/json",
        },
        body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase API error ${res.status}: ${text}`);
    }
    return res.json();
}

// ── Bulk upsert into Linode ───────────────────────────────────────────────────
async function upsertBatch(rows) {
    if (rows.length === 0) return 0;
    const cols = Object.keys(rows[0]);
    const placeholders = rows.map((_, ri) =>
        `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`
    ).join(", ");
    const values = rows.flatMap(row => cols.map(c => row[c] ?? null));
    const setClauses = cols
        .filter(c => c !== "id")
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(", ");

    const sql = `
        INSERT INTO stickies (${cols.map(c => `"${c}"`).join(", ")})
        VALUES ${placeholders}
        ON CONFLICT (id) DO ${FULL ? `UPDATE SET ${setClauses}` : "NOTHING"}
    `;
    const result = await pool.query(sql, values);
    return result.rowCount ?? 0;
}

async function run() {
    const mode = FULL ? "full upsert" : APPLY ? "insert missing" : "dry run";
    console.log(`\nSync: Supabase → Linode  [${mode}]\n`);

    // ── 1. Count both sides ───────────────────────────────────────────────────
    const [sbCount, liCount] = await Promise.all([
        sbQuery("SELECT COUNT(*) AS cnt FROM stickies").then(r => Number(r[0].cnt)),
        pool.query("SELECT COUNT(*) AS cnt FROM stickies").then(r => Number(r.rows[0].cnt)),
    ]);
    console.log(`  Supabase: ${sbCount} rows`);
    console.log(`  Linode:   ${liCount} rows`);
    console.log(`  Delta:    ${sbCount - liCount} rows Supabase has that Linode may not\n`);

    // ── 2. Find IDs missing on Linode ─────────────────────────────────────────
    console.log("  Finding IDs missing on Linode...");
    const sbIds = await sbQuery("SELECT id::text AS id FROM stickies ORDER BY id");
    const liIds = await pool.query("SELECT id::text AS id FROM stickies ORDER BY id");

    const liSet = new Set(liIds.rows.map(r => r.id));
    const sbSet = new Set(sbIds.map(r => r.id));

    const missingOnLinode = sbIds.filter(r => !liSet.has(r.id)).map(r => r.id);
    const extraOnLinode   = liIds.rows.filter(r => !sbSet.has(r.id)).map(r => r.id);

    console.log(`  Missing on Linode:  ${missingOnLinode.length} rows`);
    console.log(`  Extra on Linode:    ${extraOnLinode.length} rows (not in Supabase)\n`);

    if (missingOnLinode.length === 0 && !FULL) {
        console.log("  Already in sync. Nothing to do.");
        await pool.end();
        return;
    }

    if (!APPLY && !FULL) {
        // Show sample of missing
        if (missingOnLinode.length > 0) {
            const sample = await sbQuery(
                `SELECT id, title, folder_name, created_at FROM stickies WHERE id::text IN (${missingOnLinode.slice(0, 10).map(id => `'${id}'`).join(",")}) ORDER BY created_at DESC`
            );
            console.log("  Sample of missing notes:");
            sample.forEach(r => console.log(`    [${r.folder_name}] ${r.title}  (${String(r.created_at).slice(0, 10)})`));
        }
        console.log("\n  Run with --apply to insert missing rows, or --full for full upsert.");
        await pool.end();
        return;
    }

    // ── 3. Fetch and insert missing rows in batches ───────────────────────────
    const targetIds = FULL
        ? sbIds.map(r => r.id)  // all rows
        : missingOnLinode;

    let inserted = 0;
    for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
        const batchIds = targetIds.slice(i, i + BATCH_SIZE);
        const idList   = batchIds.map(id => `'${id}'`).join(",");

        const rows = await sbQuery(
            `SELECT * FROM stickies WHERE id::text IN (${idList})`
        );

        const n = await upsertBatch(rows);
        inserted += n;
        process.stdout.write(`\r  Synced: ${inserted} / ${targetIds.length}...`);
    }

    console.log(`\r  Synced: ${inserted} rows written ✓                    `);

    // ── 4. Final count ────────────────────────────────────────────────────────
    const finalCount = await pool.query("SELECT COUNT(*) AS cnt FROM stickies").then(r => Number(r.rows[0].cnt));
    console.log(`\n  Linode now has: ${finalCount} rows`);

    await pool.end();
    console.log("\nDone.\n");
}

run().catch(err => {
    console.error("Error:", err.message);
    process.exit(1);
});
