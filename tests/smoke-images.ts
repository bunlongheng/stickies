/**
 * Smoke test: image attachment feature
 *
 * Tests:
 *   0. Schema check  — `images` column exists on `notes` + `users_stickies`
 *   1. Upload auth   — unauthenticated upload → 401
 *   2. Upload PNG    — valid JWT + real PNG → 200, returns { url, filename, type }
 *   3. Upload multi  — two files in sequence → two public URLs
 *   4. Save images   — PATCH note with images array → 200, data round-trips
 *   5. Persist load  — GET note → images array matches what was saved
 *   6. Remove image  — PATCH with one image removed → smaller array persists
 *   7. Clear images  — PATCH with empty array → images: [] persists
 *   8. API-key auth  — owner API key can also upload (backwards compat)
 *
 * Usage:
 *   npm run smoke:images
 *   — or —
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 BASE_URL=http://localhost:4444 npx tsx tests/smoke-images.ts
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { createClient } from "@supabase/supabase-js";

const BASE_URL  = process.env.BASE_URL  ?? "http://localhost:4444";
const SUPA_URL  = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const OWNER_KEY = process.env.STICKIES_API_KEY ?? "";

if (!SUPA_URL || !SUPA_KEY) {
    console.error("❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const admin = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail = "") {
    if (condition) {
        console.log(`  ✅  ${label}`);
        passed++;
    } else {
        console.error(`  ❌  ${label}${detail ? `  —  ${detail}` : ""}`);
        failed++;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a 1×1 red PNG as a Uint8Array (minimal valid PNG, 67 bytes). */
function tiny1x1Png(): Uint8Array {
    const buf = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108020000009001" +
        "2e00000000c4944415478016360f8cfc00000000200016e21bc330000000049454e44ae426082",
        "hex"
    );
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

async function createTestUser(email: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: "SmokeImg@123!",
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    const anonClient = createClient(SUPA_URL, ANON_KEY || SUPA_KEY);
    const { data: session, error: signInErr } = await anonClient.auth.signInWithPassword({
        email,
        password: "SmokeImg@123!",
    });
    if (signInErr || !session.session) throw new Error(`signIn failed: ${signInErr?.message}`);
    return session.session.access_token;
}

async function deleteTestUser(email: string) {
    const { data } = await admin.auth.admin.listUsers();
    const user = data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
}

async function uploadFile(token: string, filename: string, noteId?: string): Promise<{ status: number; body: any }> {
    const form = new FormData();
    const blob = new Blob([tiny1x1Png()], { type: "image/png" });
    form.append("file", blob, filename);
    if (noteId) form.append("noteId", noteId);
    const res = await fetch(`${BASE_URL}/api/stickies/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
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

// ── Test runner ───────────────────────────────────────────────────────────────

const TEST_EMAIL = `smoke-img-${Date.now()}@test.local`;

async function checkSchema() {
    console.log("\n── 0. Schema check ─────────────────────────────────────────────");

    const { data: notesRow, error: notesErr } = await admin
        .from("notes")
        .select("images")
        .limit(1);
    if (notesErr && notesErr.message.includes("column")) {
        console.error("  ❌  `images` column missing on `notes`");
        console.error("      ▶  Run supabase/migrations/002_images.sql in Supabase SQL editor first!");
        failed++;
        return false;
    }
    assert("`notes.images` column exists", !notesErr || notesRow !== null, notesErr?.message ?? "");

    const { data: userRow, error: userErr } = await admin
        .from("users_stickies")
        .select("images")
        .limit(1);
    if (userErr && userErr.message.includes("column")) {
        console.error("  ❌  `images` column missing on `users_stickies`");
        console.error("      ▶  Run supabase/migrations/002_images.sql in Supabase SQL editor first!");
        failed++;
        return false;
    }
    assert("`users_stickies.images` column exists", !userErr || userRow !== null, userErr?.message ?? "");

    return true;
}

async function run() {
    console.log(`\n🖼   Image attachment smoke test  →  ${BASE_URL}\n`);

    const schemaOk = await checkSchema();
    if (!schemaOk) {
        console.log("\n  Stopping — apply 002_images.sql migration before running this suite.\n");
        process.exit(1);
    }

    // ── Setup ─────────────────────────────────────────────────────────────
    console.log("\n── Setup ───────────────────────────────────────────────────────");
    await deleteTestUser(TEST_EMAIL);
    const jwt = await createTestUser(TEST_EMAIL);
    assert("Test user JWT obtained", !!jwt);

    // ── 1. Upload auth — unauthenticated → 401 ────────────────────────────
    console.log("\n── 1. Upload auth — unauthenticated → 401 ──────────────────────");
    const form = new FormData();
    form.append("file", new Blob([tiny1x1Png()], { type: "image/png" }), "test.png");
    const noAuth = await fetch(`${BASE_URL}/api/stickies/upload`, { method: "POST", body: form });
    assert("POST /api/stickies/upload without token → 401", noAuth.status === 401);

    // ── 2. Upload PNG — valid JWT → 200 + { url, filename, type } ─────────
    console.log("\n── 2. Upload PNG — valid JWT ────────────────────────────────────");
    const up1 = await uploadFile(jwt, "red-dot.png");
    assert("Upload returns 200", up1.status === 200, `status=${up1.status} body=${JSON.stringify(up1.body)}`);
    assert("Response has `url`",      typeof up1.body.url      === "string" && up1.body.url.startsWith("http"), up1.body.url);
    assert("Response has `filename`", up1.body.filename === "red-dot.png");
    assert("Response has `type`",     up1.body.type === "image/png");
    const url1 = up1.body.url as string;

    // ── 3. Upload multi — two files → two distinct public URLs ────────────
    console.log("\n── 3. Upload multi — two files ──────────────────────────────────");
    const up2 = await uploadFile(jwt, "blue-dot.png");
    assert("Second upload returns 200", up2.status === 200);
    assert("Second URL is distinct from first", url1 !== up2.body.url, up2.body.url);
    const url2 = up2.body.url as string;

    // ── 4. Save images — PATCH note with images array ─────────────────────
    console.log("\n── 4. Save images — PATCH note ──────────────────────────────────");

    // First create a note
    const createRes = await apiFetch("/api/stickies?raw=1", jwt, {
        method: "POST",
        body: JSON.stringify({ title: "Image test note", content: "Test", folder_name: "Smoke", is_folder: false }),
    });
    assert("Note created (201)", createRes.status === 201, JSON.stringify(createRes.body));
    const noteId = String(createRes.body.note?.id ?? "");
    assert("Note ID returned", !!noteId, `noteId=${noteId}`);

    const imagePayload = [
        { url: url1, name: "red-dot.png",  type: "image/png" },
        { url: url2, name: "blue-dot.png", type: "image/png" },
    ];
    const patchRes = await apiFetch("/api/stickies", jwt, {
        method: "PATCH",
        body: JSON.stringify({ id: noteId, images: imagePayload }),
    });
    assert("PATCH with images returns 200", patchRes.status === 200, JSON.stringify(patchRes.body));

    // ── 5. Persist load — GET note → images array matches ────────────────
    console.log("\n── 5. Persist load — GET note → images array ───────────────────");
    const getRes = await apiFetch("/api/stickies", jwt);
    assert("GET /api/stickies returns 200", getRes.status === 200);
    const savedNote = (getRes.body.notes ?? []).find((n: any) => String(n.id) === noteId);
    assert("Note is found in GET response", !!savedNote, `noteId=${noteId}`);
    const savedImages: any[] = savedNote?.images ?? [];
    assert("images array has 2 entries",    savedImages.length === 2, `got ${savedImages.length}`);
    assert("First image URL matches",       savedImages[0]?.url === url1, savedImages[0]?.url);
    assert("Second image URL matches",      savedImages[1]?.url === url2, savedImages[1]?.url);
    assert("Image has `name` field",        savedImages[0]?.name === "red-dot.png");
    assert("Image has `type` field",        savedImages[0]?.type === "image/png");

    // ── 6. Remove image — PATCH with one image removed ────────────────────
    console.log("\n── 6. Remove image — PATCH with one removed ─────────────────────");
    const oneImage = [{ url: url2, name: "blue-dot.png", type: "image/png" }];
    const removeRes = await apiFetch("/api/stickies", jwt, {
        method: "PATCH",
        body: JSON.stringify({ id: noteId, images: oneImage }),
    });
    assert("PATCH (remove one) returns 200", removeRes.status === 200);

    const getAfterRemove = await apiFetch("/api/stickies", jwt);
    const noteAfterRemove = (getAfterRemove.body.notes ?? []).find((n: any) => String(n.id) === noteId);
    const imagesAfterRemove: any[] = noteAfterRemove?.images ?? [];
    assert("images array now has 1 entry",    imagesAfterRemove.length === 1, `got ${imagesAfterRemove.length}`);
    assert("Remaining image is the second one", imagesAfterRemove[0]?.url === url2, imagesAfterRemove[0]?.url);

    // ── 7. Clear images — PATCH with empty array ──────────────────────────
    console.log("\n── 7. Clear images — PATCH with [] ──────────────────────────────");
    const clearRes = await apiFetch("/api/stickies", jwt, {
        method: "PATCH",
        body: JSON.stringify({ id: noteId, images: [] }),
    });
    assert("PATCH (clear all) returns 200", clearRes.status === 200);

    const getAfterClear = await apiFetch("/api/stickies", jwt);
    const noteAfterClear = (getAfterClear.body.notes ?? []).find((n: any) => String(n.id) === noteId);
    const imagesAfterClear: any[] = noteAfterClear?.images ?? [];
    assert("images array is empty after clear", imagesAfterClear.length === 0, `got ${imagesAfterClear.length}`);

    // ── 8. API-key auth — owner key can upload ────────────────────────────
    if (OWNER_KEY) {
        console.log("\n── 8. API-key auth — owner key can upload ───────────────────────");
        const upOwner = await uploadFile(OWNER_KEY, "owner-upload.png");
        assert("Owner API key upload returns 200", upOwner.status === 200,
            `status=${upOwner.status} body=${JSON.stringify(upOwner.body)}`);
        assert("Owner upload returns URL", typeof upOwner.body.url === "string" && upOwner.body.url.startsWith("http"));
    } else {
        console.log("\n── 8. (skipped — no STICKIES_API_KEY set) ───────────────────────");
    }

    // ── Cleanup ───────────────────────────────────────────────────────────
    console.log("\n── Cleanup ─────────────────────────────────────────────────────");
    await deleteTestUser(TEST_EMAIL);
    console.log("  🧹  Test user deleted");

    // ── Summary ───────────────────────────────────────────────────────────
    console.log(`\n${"─".repeat(55)}`);
    console.log(`  Passed: ${passed}   Failed: ${failed}`);
    console.log(`${"─".repeat(55)}\n`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error("\n💥  Image smoke test crashed:", err);
    process.exit(1);
});
