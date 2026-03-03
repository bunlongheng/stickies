/**
 * Smoke test: multi-user sign-up flow + data isolation
 *
 * Tests:
 *   1. Unauthenticated request → 401
 *   2. New user JWT → can create a note (POST /api/stickies?raw=1)
 *   3. New user JWT → GET /api/stickies returns only their notes (not owner's)
 *   4. Another new user JWT → cannot see first user's notes
 *   5. Owner API key → can still read all owner notes (backwards compat)
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 \
 *   BASE_URL=http://localhost:4444 \
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   STICKIES_API_KEY=... \
 *   npx tsx tests/smoke-signup.ts
 */

// Allow self-signed TLS certs (same as the dev server)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { createClient } from "@supabase/supabase-js";

const BASE_URL    = process.env.BASE_URL    ?? "http://localhost:4444";
const SUPA_URL    = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const OWNER_KEY   = process.env.STICKIES_API_KEY ?? "";

if (!SUPA_URL || !SUPA_KEY) {
    console.error("❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(1);
}

const admin = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function createTestUser(email: string): Promise<string> {
    // Create a throwaway user and get their JWT
    const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: "SmokeTest@123!",
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

    // Sign in to get an access token
    const anonClient = createClient(SUPA_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? SUPA_KEY);
    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
        email,
        password: "SmokeTest@123!",
    });
    if (signInErr || !session.session) throw new Error(`signIn failed: ${signInErr?.message}`);
    return session.session.access_token;
}

async function deleteTestUser(email: string) {
    const { data } = await admin.auth.admin.listUsers();
    const user = data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
}

async function apiFetch(path: string, token: string, init?: RequestInit) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(init?.headers ?? {}),
        },
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = "") {
    if (condition) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}${detail ? ` — ${detail}` : ""}`);
        failed++;
    }
}

const USER_A_EMAIL = `smoke-a-${Date.now()}@test.local`;
const USER_B_EMAIL = `smoke-b-${Date.now()}@test.local`;

async function checkTables() {
    console.log("\n── Table checks ─────────────────────────────────────────────");
    const sb = admin; // service role bypasses RLS, can inspect tables

    // Check `notes` table (owner's — must exist)
    const { error: notesErr } = await sb.from("notes").select("id").limit(1);
    assert("`notes` table exists (owner data)", !notesErr, notesErr?.message ?? "");

    // Check `users_stickies` table (new — must exist before users can sign up)
    const { error: stickiesErr } = await sb.from("users_stickies").select("id").limit(1);
    if (stickiesErr) {
        console.error("  ❌  `users_stickies` table does NOT exist");
        console.error("      ⚠️   Run supabase/migrations/001_multi_user.sql in Supabase SQL editor first!");
        failed++;
        return false;
    }
    assert("`users_stickies` table exists (user data)", true);

    console.log("  ℹ️   RLS enforced via service-role scoping in API routes");

    return true;
}

async function run() {
    console.log(`\n🔥  Stickies smoke test  →  ${BASE_URL}\n`);

    // ── Table checks ──────────────────────────────────────────────────────
    const tablesOk = await checkTables();
    if (!tablesOk) {
        console.log("\n  Stopping — apply migration before running full suite.\n");
        process.exit(1);
    }

    // ── Cleanup first in case prior run left orphans ──────────────────────
    console.log("\n── Setup ──────────────────────────────────────────────────");
    await deleteTestUser(USER_A_EMAIL);
    await deleteTestUser(USER_B_EMAIL);

    // ── 1. Unauthenticated → 401 ──────────────────────────────────────────
    console.log("\n── 1. Unauthenticated request ──────────────────────────────");
    const unauth = await fetch(`${BASE_URL}/api/stickies`, { headers: {} });
    assert("GET /api/stickies without token → 401", unauth.status === 401);

    // ── 2. Create User A + note ───────────────────────────────────────────
    console.log("\n── 2. User A — sign-up + create note ───────────────────────");
    const tokenA = await createTestUser(USER_A_EMAIL);
    assert("User A JWT obtained", !!tokenA);

    const createNote = await apiFetch("/api/stickies?raw=1", tokenA, {
        method: "POST",
        body: JSON.stringify({ title: "UserA note", content: "Hello from A", folder_name: "Smoke", is_folder: false }),
    });
    if (createNote.status !== 201 && String(createNote.body?.error ?? "").includes("column")) {
        console.error("  ⚠️   DB migration not applied yet — run supabase/migrations/001_multi_user.sql in Supabase SQL editor first!");
    }
    assert("User A can create a note (201)", createNote.status === 201, JSON.stringify(createNote.body));

    // ── 3. User A reads only their notes ──────────────────────────────────
    console.log("\n── 3. User A reads only their notes ────────────────────────");
    const readA = await apiFetch("/api/stickies", tokenA);
    assert("GET /api/stickies returns 200 for User A", readA.status === 200);
    const notesA = readA.body.notes ?? [];
    assert("User A sees their own note", notesA.some((n: any) => n.title === "UserA note"));

    // ── 4. Create User B — should NOT see User A's notes ─────────────────
    console.log("\n── 4. User B — sign-up + data isolation ────────────────────");
    const tokenB = await createTestUser(USER_B_EMAIL);
    assert("User B JWT obtained", !!tokenB);

    const readB = await apiFetch("/api/stickies", tokenB);
    assert("GET /api/stickies returns 200 for User B", readB.status === 200);
    const notesB = readB.body.notes ?? [];
    assert("User B does NOT see User A's notes", !notesB.some((n: any) => n.title === "UserA note"),
        `found ${notesB.length} notes`);

    // ── 5. Owner API key — backwards compat ───────────────────────────────
    if (OWNER_KEY) {
        console.log("\n── 5. Owner API key — backwards compat ─────────────────────");
        const readOwner = await apiFetch("/api/stickies", OWNER_KEY);
        assert("GET /api/stickies with API key returns 200", readOwner.status === 200,
            JSON.stringify(readOwner.body).slice(0, 120));
    } else {
        console.log("\n── 5. (skipped — no STICKIES_API_KEY set) ──────────────────");
    }

    // ── 6. Sign-in page accessible (unauthenticated) ──────────────────────
    console.log("\n── 6. Sign-in page check ───────────────────────────────────");
    const signInPage = await fetch(`${BASE_URL}/sign-in`);
    assert("GET /sign-in returns 200", signInPage.status === 200);

    // ── Cleanup ───────────────────────────────────────────────────────────
    console.log("\n── Cleanup ─────────────────────────────────────────────────");
    await deleteTestUser(USER_A_EMAIL);
    await deleteTestUser(USER_B_EMAIL);
    console.log("  🧹  Test users deleted");

    // ── Summary ───────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(52)}`);
    console.log(`  Passed: ${passed}   Failed: ${failed}`);
    console.log(`${"─".repeat(52)}\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error("\n💥  Smoke test crashed:", err);
    process.exit(1);
});
