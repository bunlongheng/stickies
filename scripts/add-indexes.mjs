#!/usr/bin/env node
/**
 * Add performance indexes to the notes table.
 * Safe to run multiple times — all use IF NOT EXISTS.
 *
 * Run: node scripts/add-indexes.mjs
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");

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

const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 15000,
});

const steps = [
    {
        label: "Enable pg_trgm extension",
        sql: `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
    },
    {
        label: "GIN trigram index on title (fast ILIKE search)",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS stickies_title_trgm
              ON stickies USING GIN (title gin_trgm_ops)`,
    },
    {
        label: "Index on folder_name for notes (folder view queries)",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS stickies_folder_name_idx
              ON stickies (folder_name) WHERE is_folder = false`,
    },
    {
        label: "Index on folder_id (folder drill-down)",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS stickies_folder_id_idx
              ON stickies (folder_id) WHERE folder_id IS NOT NULL AND is_folder = false`,
    },
    {
        label: "Index on updated_at DESC for ordering",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS stickies_updated_at_idx
              ON stickies (updated_at DESC) WHERE is_folder = false`,
    },
    {
        label: "Index on \"order\" for list ordering",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS stickies_order_idx
              ON stickies ("order")`,
    },
    {
        label: "Index on is_folder + folder_name (folder list queries)",
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS stickies_is_folder_name_idx
              ON stickies (is_folder, folder_name)`,
    },
];

async function run() {
    // CONCURRENTLY requires non-transaction mode
    const client = await pool.connect();
    try {
        for (const step of steps) {
            process.stdout.write(`  ${step.label}... `);
            try {
                await client.query(step.sql);
                console.log("✓");
            } catch (err) {
                console.log(`✗ ${err.message}`);
            }
        }
    } finally {
        client.release();
    }
    await pool.end();
    console.log("\nDone.");
}

run().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
});
