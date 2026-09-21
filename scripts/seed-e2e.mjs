#!/usr/bin/env node
/**
 * Seed the minimum data the e2e suite assumes exists.
 *
 * Most specs create what they need and clean up after themselves, but the shared
 * navigation helpers (tests/e2e/nav-helpers.ts) need a real folder on the root grid
 * to click into. A migration-fresh database has none, so CI would fail on an empty
 * board rather than on a real regression.
 *
 * Usage: E2E_BASE_URL=http://localhost:4444 node scripts/seed-e2e.mjs
 * Safe to re-run: folders are created only when missing.
 */
const BASE = process.env.E2E_BASE_URL || "http://localhost:4444";

const FOLDERS = [
    { name: "Work", color: "#FF3B30" },
    { name: "Ideas", color: "#FF9500" },
    { name: "Reading", color: "#34C759" },
];

const NOTES = [
    { folder: "Work", title: "Sprint planning", content: "[x] Draft the milestone\n[ ] Size the backlog" },
    { folder: "Work", title: "API notes", content: "GET /api/stickies?folder=Work" },
    { folder: "Ideas", title: "Architecture idea", content: "Move the sync layer behind a queue." },
    { folder: "Reading", title: "Reading list", content: "- A Philosophy of Software Design" },
];

async function post(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${(await res.text()).slice(0, 120)}`);
    return res.json();
}

async function main() {
    const existing = await fetch(`${BASE}/api/stickies?folders=1`).then((r) => r.json()).catch(() => ({}));
    const have = new Set(((existing.notes || existing.folders || [])).map((f) => f.folder_name));

    for (const f of FOLDERS) {
        if (have.has(f.name)) { console.log(`  folder exists: ${f.name}`); continue; }
        await post("/api/stickies?raw=1", { is_folder: true, folder_name: f.name, folder_color: f.color, title: f.name });
        console.log(`  folder created: ${f.name}`);
    }
    for (const n of NOTES) {
        await post("/api/stickies?raw=1", { folder_name: n.folder, type: "text", title: n.title, content: n.content });
        console.log(`  note created: ${n.title}`);
    }
    console.log("seed complete");
}

main().catch((err) => { console.error("seed failed:", err.message); process.exit(1); });
