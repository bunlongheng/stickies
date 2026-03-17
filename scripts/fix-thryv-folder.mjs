#!/usr/bin/env node
/**
 * Fix Thryv ghost folder — run once.
 *
 * Ghost row:  5c45ba74-ab91-4417-99e3-d507cd80a6d4  (folder_name = '🧳 Thryv')
 * Real row:   ab28a9b2-5fa8-4c2f-91c8-dc3f654412df  (EVERNOTE sub-folder)
 *
 * Batch 1: 313 notes where folder_id = ghost ID  → set to real ID
 * Batch 2: 376 notes where folder_name = 'Thryv' AND folder_id IS NULL → set to real ID
 * Final:   DELETE ghost row
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");

// Load .env.local
try {
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split("\n")) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
    }
} catch {
    console.error("Could not load .env.local — ensure DATABASE_URL is set");
    process.exit(1);
}

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const GHOST_ID = "5c45ba74-ab91-4417-99e3-d507cd80a6d4";
const REAL_ID  = "ab28a9b2-5fa8-4c2f-91c8-dc3f654412df";
const BATCH    = 50;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 10000,
});

async function batchUpdate(label, sql, params) {
    let total = 0;
    while (true) {
        const result = await pool.query(sql, params);
        const n = result.rowCount ?? 0;
        total += n;
        process.stdout.write(`\r  ${label}: ${total} updated...`);
        if (n === 0) break;
    }
    console.log(`\r  ${label}: ${total} rows updated ✓`);
    return total;
}

async function run() {
    const client = await pool.connect();
    try {
        // Verify ghost row exists
        const ghost = await client.query(
            `SELECT id, folder_name FROM stickies WHERE id = $1 AND is_folder = true LIMIT 1`,
            [GHOST_ID]
        );
        if (ghost.rowCount === 0) {
            console.log("Ghost row not found — already cleaned up or wrong ID.");
        } else {
            console.log(`Found ghost row: "${ghost.rows[0].folder_name}" (${GHOST_ID})`);
        }

        // Verify real row exists
        const real = await client.query(
            `SELECT id, folder_name FROM stickies WHERE id = $1 AND is_folder = true LIMIT 1`,
            [REAL_ID]
        );
        if (real.rowCount === 0) {
            console.error(`Real folder ${REAL_ID} not found — aborting.`);
            process.exit(1);
        }
        console.log(`Real folder: "${real.rows[0].folder_name}" (${REAL_ID})\n`);

        // Count what needs fixing
        const c1 = await client.query(
            `SELECT COUNT(*) AS cnt FROM stickies WHERE folder_id = $1 AND is_folder = false`,
            [GHOST_ID]
        );
        const c2 = await client.query(
            `SELECT COUNT(*) AS cnt FROM stickies WHERE folder_name = 'Thryv' AND folder_id IS NULL AND is_folder = false`
        );
        console.log(`Notes with ghost folder_id:      ${c1.rows[0].cnt}`);
        console.log(`Notes with folder_name=Thryv,NULL: ${c2.rows[0].cnt}\n`);

        client.release();
    } catch (err) {
        client.release();
        throw err;
    }

    // Batch 1: fix ghost folder_id
    await batchUpdate(
        "Batch 1 (ghost folder_id)",
        `UPDATE stickies SET folder_id = $1 WHERE id IN (
            SELECT id FROM stickies WHERE folder_id = $2 AND is_folder = false LIMIT ${BATCH}
         )`,
        [REAL_ID, GHOST_ID]
    );

    // Batch 2: fix NULL folder_id for Thryv notes
    await batchUpdate(
        "Batch 2 (Thryv NULL folder_id)",
        `UPDATE stickies SET folder_id = $1 WHERE id IN (
            SELECT id FROM stickies WHERE folder_name = 'Thryv' AND folder_id IS NULL AND is_folder = false LIMIT ${BATCH}
         )`,
        [REAL_ID]
    );

    // Final: delete ghost row (safe now — no child rows pointing to it)
    const del = await pool.query(
        `DELETE FROM stickies WHERE id = $1 AND is_folder = true`,
        [GHOST_ID]
    );
    console.log(`\nDeleted ghost row: ${del.rowCount} row(s) removed`);

    // Verify
    const remaining = await pool.query(
        `SELECT COUNT(*) AS cnt FROM stickies WHERE folder_id = $1`,
        [GHOST_ID]
    );
    console.log(`Remaining notes pointing to ghost: ${remaining.rows[0].cnt} (should be 0)`);

    await pool.end();
    console.log("\nDone.");
}

run().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
