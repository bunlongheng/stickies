/**
 * Comprehensive smoke test: all pages + all API routes
 *
 * Checks every URL in the app returns a non-500 status and
 * every API endpoint handles unauthenticated requests gracefully (no crash).
 *
 * Usage:
 *   sh -c 'set -a && . .env.local && set +a && \
 *     NODE_TLS_REJECT_UNAUTHORIZED=0 \
 *     BASE_URL=http://localhost:4444 \
 *     npx tsx tests/smoke-pages.ts'
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { createClient } from "@supabase/supabase-js";

const BASE   = process.env.BASE_URL   ?? "http://localhost:4444";
const SUPA_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const OWNER_KEY = process.env.STICKIES_API_KEY ?? "";
const ANON_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPA_URL || !SUPA_KEY) {
    console.error("❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const admin = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Counters ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures: string[] = [];

function ok(label: string) { console.log(`  ✅  ${label}`); passed++; }
function fail(label: string, detail = "") {
    const msg = `${label}${detail ? `  —  ${detail}` : ""}`;
    console.error(`  ❌  ${msg}`);
    failures.push(msg);
    failed++;
}
function check(label: string, cond: boolean, detail = "") { cond ? ok(label) : fail(label, detail); }

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function get(path: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
        const r = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
        return { status: r.status, ok: r.status < 500 };
    } catch (e: any) {
        return { status: 0, ok: false, err: e.message };
    }
}

async function post(path: string, body: unknown, token?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
        const r = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
        return { status: r.status, ok: r.status < 500 };
    } catch (e: any) {
        return { status: 0, ok: false, err: e.message };
    }
}

// ── Create / cleanup a test user ──────────────────────────────────────────────
const TEST_EMAIL = `pages-smoke-${Date.now()}@test.local`;
let userToken = "";

async function setupTestUser() {
    await cleanupTestUser();
    const { data, error } = await admin.auth.admin.createUser({
        email: TEST_EMAIL, email_confirm: true, password: "SmokePages@123!",
    });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    const anon = createClient(SUPA_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: session, error: signInErr } = await anon.auth.signInWithPassword({ email: TEST_EMAIL, password: "SmokePages@123!" });
    if (signInErr || !session.session) throw new Error(`signIn: ${signInErr?.message}`);
    userToken = session.session.access_token;
}

async function cleanupTestUser() {
    const { data } = await admin.auth.admin.listUsers();
    const u = data?.users.find(u => u.email === TEST_EMAIL);
    if (u) await admin.auth.admin.deleteUser(u.id);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
    console.log(`\n🔥  Stickies page + API smoke test  →  ${BASE}\n`);

    // Setup
    console.log("── Setup ───────────────────────────────────────────────────");
    await setupTestUser();
    ok(`Test user created (${TEST_EMAIL})`);

    // ── 1. UI Pages ───────────────────────────────────────────────────────────
    console.log("\n── 1. UI Pages ─────────────────────────────────────────────");

    const pages: [string, string][] = [
        ["/",                   "Main app (redirects to sign-in if not authed)"],
        ["/sign-in",            "Sign-in page"],
        ["/stickies-share",     "Share page (no token)"],
        ["/tools/stickies",     "Legacy redirect → /"],
    ];

    for (const [path, label] of pages) {
        const r = await get(path);
        // Pages should return 200, 301, 302, 307, or 308 — never 500
        const acceptable = r.status >= 200 && r.status < 500;
        check(`GET ${path} — ${label}`, acceptable, `got ${r.status}`);
    }

    // ── 2. API routes: unauthenticated → must NOT 500 ─────────────────────────
    console.log("\n── 2. API routes — unauthenticated (expect 401, not 500) ──");

    // [path, expected statuses (any acceptable), label]
    const unauthGets: [string, number[], string][] = [
        ["/api/stickies",                  [401],       "notes → 401"],
        ["/api/stickies?folders=1",        [401],       "folders → 401"],
        ["/api/stickies?q=test",           [401],       "search → 401"],
        ["/api/stickies/folder-icon",      [401],       "folder-icon → 401"],
        ["/api/stickies/integrations",     [401],       "integrations → 401"],
        ["/api/stickies/automations",      [401],       "automations → 401"],
        ["/api/stickies/automation-logs",  [401],       "automation-logs → 401"],
        ["/api/stickies/backup",           [401],       "backup → 401"],
        ["/api/stickies/share",            [400, 401],  "share → 400 (missing token param)"],
        ["/api/stickies/push-subscribe",   [401, 405],  "push-subscribe → 401/405 (POST-only)"],
        ["/api/stickies/push-nav",         [401, 405],  "push-nav → 401/405 (POST-only)"],
        ["/api/stickies/local",            [401, 405],  "local → 401/405 (POST-only)"],
        ["/api/hue/groups",                [200, 401],  "hue/groups → no crash"],
        ["/api/hue/trigger",               [401, 405],  "hue/trigger → no crash"],
    ];

    for (const [path, expected, label] of unauthGets) {
        const r = await get(path);
        check(`GET ${path} — no crash`, r.ok, `got ${r.status}`);
        check(`GET ${path} — ${label}`, expected.includes(r.status), `got ${r.status}, expected one of [${expected}]`);
    }

    // ── 3. API routes: authenticated user (regular) ───────────────────────────
    console.log("\n── 3. API routes — authenticated regular user ──────────────");

    // integrations + automations are owner-only — regular users get 401
    const authGets: [string, number[], string][] = [
        ["/api/stickies",               [200],       "GET notes → 200"],
        ["/api/stickies?folders=1",     [200],       "GET folders → 200"],
        ["/api/stickies?q=hello",       [200],       "GET search → 200"],
        ["/api/stickies/folder-icon",   [200],       "GET folder icons → 200"],
        ["/api/stickies/integrations",  [200, 401],  "GET integrations (owner-only, 401 for users)"],
        ["/api/stickies/automations",   [200, 401],  "GET automations (owner-only, 401 for users)"],
    ];

    for (const [path, expected, label] of authGets) {
        const r = await get(path, userToken);
        check(`GET ${path} — ${label}`, expected.includes(r.status), `got ${r.status}`);
    }

    // ── 4. API routes: authenticated owner (STICKIES_API_KEY) ────────────────
    if (OWNER_KEY) {
        console.log("\n── 4. API routes — owner API key ───────────────────────────");

        const ownerGets: [string, string][] = [
            ["/api/stickies",              "GET owner notes → 200"],
            ["/api/stickies?folders=1",    "GET owner folders → 200"],
            ["/api/stickies/folder-icon",  "GET folder icons → 200"],
            ["/api/stickies/integrations", "GET integrations → 200"],
            ["/api/stickies/automations",  "GET automations → 200"],
            ["/api/stickies/backup",       "GET backup → 200"],
        ];

        for (const [path, label] of ownerGets) {
            const r = await get(path, OWNER_KEY);
            check(`GET ${path} — ${label}`, r.status === 200, `got ${r.status}`);
        }
    } else {
        console.log("\n── 4. (skipped — no STICKIES_API_KEY) ─────────────────────");
    }

    // ── 5. POST endpoints — unauthenticated (no crash) ───────────────────────
    console.log("\n── 5. POST endpoints — unauthenticated (no crash) ──────────");

    const unauthPosts: [string, unknown][] = [
        ["/api/stickies",                  { title: "x", content: "y", folder_name: "Test" }],
        ["/api/stickies/folder-icon",      { folderName: "Test", icon: "📁" }],
        ["/api/stickies/integrations",     { type: "test" }],
        ["/api/stickies/push-subscribe",   { subscription: {} }],
    ];

    for (const [path, body] of unauthPosts) {
        const r = await post(path, body);
        check(`POST ${path} — no crash (unauth)`, r.ok, `got ${r.status}`);
    }

    // ── 6. POST endpoints — authenticated user (no crash) ────────────────────
    console.log("\n── 6. POST endpoints — authenticated user (no crash) ───────");

    // Create a note
    const noteRes = await post("/api/stickies?raw=1", { title: "Smoke Note", content: "test", folder_name: "Smoke", is_folder: false }, userToken);
    check("POST /api/stickies — create note (201)", noteRes.status === 201, `got ${noteRes.status}`);

    // Create a folder
    const folderRes = await post("/api/stickies?raw=1", { title: "SmokeFolder", folder_name: "SmokeFolder", is_folder: true }, userToken);
    check("POST /api/stickies — create folder (201)", folderRes.status === 201, `got ${folderRes.status}`);

    // Folder icon
    const iconRes = await post("/api/stickies/folder-icon", { folderName: "SmokeFolder", icon: "🗂️" }, userToken);
    check("POST /api/stickies/folder-icon — no crash", iconRes.ok, `got ${iconRes.status}`);

    // ── 7. Share page with token param ────────────────────────────────────────
    console.log("\n── 7. Share page with query params ─────────────────────────");
    const shareRes = await get("/stickies-share?token=fakeinvalidtoken");
    // Should render page (not 500) even with bad token
    check("GET /stickies-share?token=invalid — no crash", shareRes.ok, `got ${shareRes.status}`);

    // ── 8. 404 for unknown routes ─────────────────────────────────────────────
    console.log("\n── 8. Unknown routes → 404, not 500 ───────────────────────");
    const unknownRoutes = ["/does-not-exist", "/api/stickies/nonexistent", "/admin"];
    for (const path of unknownRoutes) {
        const r = await get(path);
        check(`GET ${path} — 404 not 500`, r.status === 404 || r.status === 307 || r.status === 308, `got ${r.status}`);
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    console.log("\n── Cleanup ─────────────────────────────────────────────────");
    await cleanupTestUser();
    ok("Test user deleted");

    // ── Summary ───────────────────────────────────────────────────────────────
    const bar = "─".repeat(54);
    console.log(`\n${bar}`);
    if (failures.length) {
        console.log("  Failures:");
        failures.forEach(f => console.log(`    ❌  ${f}`));
        console.log();
    }
    console.log(`  Passed: ${passed}   Failed: ${failed}`);
    console.log(`${bar}\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error("\n💥  Smoke test crashed:", err);
    process.exit(1);
});
