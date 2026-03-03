/**
 * Production smoke test — Vercel + Netlify
 *
 * Tests sign-up flow, data isolation, and API auth on both prod URLs.
 * Both deployments share the same Supabase backend, so DB checks run once.
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 \
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key> \
 *   STICKIES_API_KEY=<api_key> \
 *   npx tsx tests/smoke-prod.ts
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { createClient } from "@supabase/supabase-js";

const VERCEL_URL  = "https://stickies-bheng.vercel.app";
const NETLIFY_URL = "https://stickies-bheng.netlify.app";

const SUPA_URL  = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const OWNER_KEY = process.env.STICKIES_API_KEY ?? "";

if (!SUPA_URL || !SUPA_KEY) {
    console.error("❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars");
    process.exit(1);
}

const admin = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// ── Result matrix ────────────────────────────────────────────────────────────
type Cell = "✅" | "❌" | "⚠️ " | "N/A";
const matrix: { check: string; db: Cell; vercel: Cell; netlify: Cell }[] = [];

function row(check: string, db: Cell = "N/A", vercel: Cell = "N/A", netlify: Cell = "N/A") {
    matrix.push({ check, db, vercel, netlify });
}

function set(check: string, col: "db" | "vercel" | "netlify", val: Cell) {
    const r = matrix.find((m) => m.check === check);
    if (r) r[col] = val;
}

function printMatrix() {
    const cols = [
        { key: "check",   label: "Check",                    w: 38 },
        { key: "db",      label: "DB (Supabase)",             w: 16 },
        { key: "vercel",  label: "Vercel",                    w: 10 },
        { key: "netlify", label: "Netlify",                   w: 10 },
    ];
    const sep = cols.map((c) => "─".repeat(c.w + 2)).join("┼");
    const header = cols.map((c) => ` ${c.label.padEnd(c.w)} `).join("│");
    console.log("\n┌" + cols.map((c) => "─".repeat(c.w + 2)).join("┬") + "┐");
    console.log("│" + header + "│");
    console.log("├" + sep + "┤");
    for (const r of matrix) {
        const cells = cols.map((c) => {
            const val = String((r as any)[c.key] ?? "");
            return ` ${val.padEnd(c.w)} `;
        });
        console.log("│" + cells.join("│") + "│");
    }
    console.log("└" + cols.map((c) => "─".repeat(c.w + 2)).join("┴") + "┘");
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function createTestUser(email: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, password: "SmokeTest@Prod1!" });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    const anon = createClient(SUPA_URL, ANON_KEY);
    const { data: session, error: signInErr } = await anon.auth.signInWithPassword({ email, password: "SmokeTest@Prod1!" });
    if (signInErr || !session.session) throw new Error(`signIn: ${signInErr?.message}`);
    return session.session.access_token;
}

async function deleteTestUser(email: string) {
    const { data } = await admin.auth.admin.listUsers();
    const user = data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
}

async function apiFetch(baseUrl: string, path: string, token: string, init?: RequestInit) {
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
        });
        return { status: res.status, body: await res.json().catch(() => ({})) };
    } catch (err: any) {
        return { status: 0, body: { error: err?.message ?? "network error" } };
    }
}

// ── Test user emails ─────────────────────────────────────────────────────────
const TS = Date.now();
const VERCEL_USER  = `smoke-vercel-${TS}@test.local`;
const NETLIFY_USER = `smoke-netlify-${TS}@test.local`;

// ── Pre-register rows ─────────────────────────────────────────────────────────
row("users_stickies table exists",         "N/A", "N/A", "N/A");
row("notes table intact (owner data)",     "N/A", "N/A", "N/A");
row("Sign-in page reachable",              "N/A", "N/A", "N/A");
row("Unauth API → 401",                    "N/A", "N/A", "N/A");
row("New user JWT obtained",               "N/A", "N/A", "N/A");
row("User can create a note",              "N/A", "N/A", "N/A");
row("User reads only own notes",           "N/A", "N/A", "N/A");
row("Cross-user data isolation",           "N/A", "N/A", "N/A");
row("Owner API key works",                 "N/A", "N/A", "N/A");

async function run() {
    console.log("\n🔥  Stickies PROD smoke test\n");
    console.log(`   Vercel  → ${VERCEL_URL}`);
    console.log(`   Netlify → ${NETLIFY_URL}`);
    console.log(`   DB      → ${SUPA_URL}\n`);

    // ── 1. DB table checks ────────────────────────────────────────────────
    console.log("── 1. DB table checks ──────────────────────────────────────");

    const { error: stickiesErr } = await admin.from("users_stickies").select("id").limit(1);
    set("users_stickies table exists", "db", stickiesErr ? "❌" : "✅");
    if (stickiesErr) {
        console.error("  ❌  users_stickies missing — run migration first!");
        printMatrix();
        process.exit(1);
    }
    console.log("  ✅  users_stickies exists");

    const { error: notesErr } = await admin.from("notes").select("id").limit(1);
    set("notes table intact (owner data)", "db", notesErr ? "❌" : "✅");
    console.log(notesErr ? "  ❌  notes table error" : "  ✅  notes table intact");

    // ── 2. Sign-in page reachable ─────────────────────────────────────────
    console.log("\n── 2. Sign-in page reachable ───────────────────────────────");
    for (const [label, url] of [["vercel", VERCEL_URL], ["netlify", NETLIFY_URL]] as const) {
        try {
            const res = await fetch(`${url}/sign-in`);
            const ok = res.status === 200;
            set("Sign-in page reachable", label, ok ? "✅" : "❌");
            console.log(`  ${ok ? "✅" : "❌"}  ${label}: ${res.status}`);
        } catch (e: any) {
            set("Sign-in page reachable", label, "❌");
            console.error(`  ❌  ${label}: ${e.message}`);
        }
    }

    // ── 3. Unauthenticated API → 401 ──────────────────────────────────────
    console.log("\n── 3. Unauthenticated API → 401 ────────────────────────────");
    for (const [label, url] of [["vercel", VERCEL_URL], ["netlify", NETLIFY_URL]] as const) {
        try {
            const res = await fetch(`${url}/api/stickies`);
            const ok = res.status === 401;
            set("Unauth API → 401", label, ok ? "✅" : "❌");
            console.log(`  ${ok ? "✅" : "❌"}  ${label}: ${res.status}`);
        } catch (e: any) {
            set("Unauth API → 401", label, "❌");
            console.error(`  ❌  ${label}: ${e.message}`);
        }
    }

    // ── 4. Create test users ──────────────────────────────────────────────
    console.log("\n── 4. Sign-up flow (new JWT users) ─────────────────────────");
    await deleteTestUser(VERCEL_USER);
    await deleteTestUser(NETLIFY_USER);

    let tokenV = "", tokenN = "";
    try {
        tokenV = await createTestUser(VERCEL_USER);
        set("New user JWT obtained", "vercel", "✅");
        console.log("  ✅  Vercel user JWT obtained");
    } catch (e: any) {
        set("New user JWT obtained", "vercel", "❌");
        console.error(`  ❌  Vercel user JWT: ${e.message}`);
    }
    try {
        tokenN = await createTestUser(NETLIFY_USER);
        set("New user JWT obtained", "netlify", "✅");
        console.log("  ✅  Netlify user JWT obtained");
    } catch (e: any) {
        set("New user JWT obtained", "netlify", "❌");
        console.error(`  ❌  Netlify user JWT: ${e.message}`);
    }

    // ── 5. Create notes ───────────────────────────────────────────────────
    console.log("\n── 5. User can create a note ───────────────────────────────");
    if (tokenV) {
        const r = await apiFetch(VERCEL_URL, "/api/stickies?raw=1", tokenV, {
            method: "POST",
            body: JSON.stringify({ title: "Vercel smoke note", content: "Hello from Vercel", folder_name: "Smoke", is_folder: false }),
        });
        const ok = r.status === 201;
        set("User can create a note", "vercel", ok ? "✅" : "❌");
        console.log(`  ${ok ? "✅" : "❌"}  Vercel: ${r.status} ${ok ? "" : JSON.stringify(r.body)}`);
    }
    if (tokenN) {
        const r = await apiFetch(NETLIFY_URL, "/api/stickies?raw=1", tokenN, {
            method: "POST",
            body: JSON.stringify({ title: "Netlify smoke note", content: "Hello from Netlify", folder_name: "Smoke", is_folder: false }),
        });
        const ok = r.status === 201;
        set("User can create a note", "netlify", ok ? "✅" : "❌");
        console.log(`  ${ok ? "✅" : "❌"}  Netlify: ${r.status} ${ok ? "" : JSON.stringify(r.body)}`);
    }

    // ── 6. Users read only their own notes ────────────────────────────────
    console.log("\n── 6. Users read only own notes ────────────────────────────");
    if (tokenV) {
        const r = await apiFetch(VERCEL_URL, "/api/stickies", tokenV);
        const notes = r.body.notes ?? [];
        const seesOwn    = notes.some((n: any) => n.title === "Vercel smoke note");
        const seesOther  = notes.some((n: any) => n.title === "Netlify smoke note");
        set("User reads only own notes",    "vercel", r.status === 200 && seesOwn && !seesOther ? "✅" : "❌");
        set("Cross-user data isolation",    "vercel", !seesOther ? "✅" : "❌");
        console.log(`  ${seesOwn ? "✅" : "❌"}  Vercel sees own note`);
        console.log(`  ${!seesOther ? "✅" : "❌"}  Vercel does NOT see Netlify note`);
    }
    if (tokenN) {
        const r = await apiFetch(NETLIFY_URL, "/api/stickies", tokenN);
        const notes = r.body.notes ?? [];
        const seesOwn   = notes.some((n: any) => n.title === "Netlify smoke note");
        const seesOther = notes.some((n: any) => n.title === "Vercel smoke note");
        set("User reads only own notes",    "netlify", r.status === 200 && seesOwn && !seesOther ? "✅" : "❌");
        set("Cross-user data isolation",    "netlify", !seesOther ? "✅" : "❌");
        console.log(`  ${seesOwn ? "✅" : "❌"}  Netlify sees own note`);
        console.log(`  ${!seesOther ? "✅" : "❌"}  Netlify does NOT see Vercel note`);
    }

    // ── 7. Owner API key backwards compat ─────────────────────────────────
    console.log("\n── 7. Owner API key ────────────────────────────────────────");
    if (OWNER_KEY) {
        for (const [label, url] of [["vercel", VERCEL_URL], ["netlify", NETLIFY_URL]] as const) {
            const r = await apiFetch(url, "/api/stickies", OWNER_KEY);
            const ok = r.status === 200;
            set("Owner API key works", label, ok ? "✅" : "❌");
            console.log(`  ${ok ? "✅" : "❌"}  ${label}: ${r.status} (${(r.body.notes ?? []).length} owner notes)`);
        }
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    console.log("\n── Cleanup ─────────────────────────────────────────────────");
    await deleteTestUser(VERCEL_USER);
    await deleteTestUser(NETLIFY_USER);
    console.log("  🧹  Test users deleted");

    // ── Matrix report ─────────────────────────────────────────────────────
    printMatrix();

    const totalFailed = matrix.reduce((n, r) => n + (Object.values(r).filter((v) => v === "❌").length), 0);
    console.log(totalFailed === 0
        ? "\n  🟢  All checks passed — prod is healthy\n"
        : `\n  🔴  ${totalFailed} check(s) failed\n`
    );
    process.exit(totalFailed > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error("\n💥  Prod smoke test crashed:", err);
    process.exit(1);
});
