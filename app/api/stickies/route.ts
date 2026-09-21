import { NextResponse } from "next/server";
import Pusher from "pusher";
import crypto from "crypto";
import { query, queryOne, execute } from "@/lib/db-driver";
import { auth as getSession } from "@/auth";
import { normalizeIcon, pickNoteIcon, SUPPORTED_NOTE_ICONS } from "@/lib/note-icons";
import { colorName, stripEmoji } from "@/lib/note-format";
import { palette12 } from "@/lib/colors";
import { isProdLocked, STATIC_KEY_LABEL, lookupApiKey } from "@/app/api/stickies/_auth";
import { isReservedFolderName, remapReservedFolderPath } from "@/lib/reserved-folders";
import { machineForRequestIp } from "@/lib/machine-lookup";
import { hubLanTrusted } from "@/lib/is-local";
import { livePayload } from "@/lib/live-payload";

// Ensure the created_by_key attribution column exists. Runs once per process.
let _createdByKeyEnsured = false;
async function ensureCreatedByKeyColumn() {
    if (_createdByKeyEnsured) return;
    try { await execute(`ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS created_by_key TEXT`); } catch (e) { console.error("[stickies] ensure created_by_key column", e); }
    _createdByKeyEnsured = true;
}

// Ensure the created_by_machine attribution column exists. Runs once per process.
// Records which machine the API call came from (sent via X-Stickies-Machine header).
let _createdByMachineEnsured = false;
async function ensureCreatedByMachineColumn() {
    if (_createdByMachineEnsured) return;
    try { await execute(`ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS created_by_machine TEXT`); } catch (e) { console.error("[stickies] ensure created_by_machine column", e); }
    _createdByMachineEnsured = true;
}

// Read + sanitize the posting machine from the request header. Safe chars only,
// capped at 64 — keeps a hostname like "M4" but rejects junk/oversized values.
async function machineFromRequest(req: Request): Promise<string | null> {
    // Explicit override wins, if a caller chooses to send it.
    const raw = (req.headers.get("x-stickies-machine") ?? "").trim();
    if (raw) {
        const clean = raw.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
        if (clean) return clean;
    }
    // Otherwise derive from the request IP (localhost = the M4 hub); an unknown
    // LAN IP is matched against the peers the hub can resolve by Bonjour name.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("x-real-ip")?.trim()
        ?? req.headers.get("cf-connecting-ip")?.trim()
        ?? "";
    return machineForRequestIp(ip);
}

/** Friendly rejection when an agent sends an icon we don't support. */
function iconRejection(badIcon: unknown) {
    return NextResponse.json({
        ok: false,
        code: "unsupported_icon",
        error: `Icon "${String(badIcon)}" is not supported. Pick one from the supported list and resubmit.`,
        how_to_fix: 'Set "icon" to one of the supported names (with or without the "__hero:" prefix), e.g. icon:"RocketLaunchIcon". Omit "icon" entirely and we will auto-pick one for you.',
        supported_icons: SUPPORTED_NOTE_ICONS,
    }, { status: 422 });
}

// ── Singletons ───────────────────────────────────────────────────────────────
let _pusher: Pusher | null = null;
function getPusher() {
    if (!_pusher) {
        _pusher = new Pusher({
            appId: process.env.PUSHER_APP_ID!,
            key: process.env.PUSHER_KEY!,
            secret: process.env.PUSHER_SECRET!,
            cluster: process.env.PUSHER_CLUSTER!,
            useTLS: true,
        });
    }
    return _pusher;
}

// ── API request broadcast — only for external callers ────────────────────────
function broadcastRequest(req: Request, auth: AuthResult, extra?: Record<string, unknown>) {
    if (auth.type !== "external") return; // frontend (owner/user) calls are silent
    const url = new URL(req.url);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        ?? req.headers.get("cf-connecting-ip")
        ?? "unknown";
    const ua = (req.headers.get("user-agent") ?? "").slice(0, 80);
    const payload = {
        method: req.method,
        path: url.pathname + (url.search || ""),
        ip,
        ua,
        auth: auth.type,
        at: new Date().toISOString(),
        ...extra,
    };
    getPusher().trigger("stickies", "api-request", payload).catch(() => {});
}

// ── Hue trigger — only called for external (AI/script) requests ──────────────
async function triggerHue(color: string) {
    // Local bridge only — skip on Vercel (can't reach home network)
    if (process.env.VERCEL) return;
    // Respect the "Note Created → Hue Flash" automation toggle. Without this the flash
    // fires on every external post regardless of the switch (the /api/hue/trigger route
    // only gates on the INTEGRATION's active/mode, not the automation). Skip when off.
    try {
        const autom = await queryOne<{ active: boolean }>(
            `SELECT active FROM automations WHERE trigger_type = 'note_created' AND action_type = 'hue_flash' ORDER BY created_at LIMIT 1`
        );
        if (autom && autom.active === false) return;
    } catch { /* table missing / query error — fall through and let the trigger route decide */ }
    // The Hue bridge is reachable ONLY from this local server, and the internal
    // /api/hue/trigger call relies on the localhost auth bypass. So it MUST hit
    // localhost:4444 — NOT NEXT_PUBLIC_APP_BASE_URL, which points at the public
    // Vercel origin (that 401s the keyless call and can't reach the home bridge).
    const base = (process.env.HUE_INTERNAL_BASE_URL ?? "http://127.0.0.1:4444").replace(/\/$/, "");
    fetch(`${base}/api/hue/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color, source: "note_created" }),
    })
    .then(async (res) => {
        const result = res.ok ? "ok" : "error";
        const detail = res.ok ? `${color} via ${(await res.json().catch(() => ({}))).via || "unknown"}` : `HTTP ${res.status}`;
        execute(
            `INSERT INTO automation_logs (automation_id, automation_name, triggered_at, result, detail, via, trigger_payload)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ["0f3b671c-95a1-4b4e-b59c-ffd2ed3de7e9", "Note Created \u2192 Hue Flash", new Date().toISOString(), result, detail, "ext-api", JSON.stringify({ color })]
        ).catch(() => {});
    })
    .catch((err) => {
        execute(
            `INSERT INTO automation_logs (automation_id, automation_name, triggered_at, result, detail, via, trigger_payload)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            ["0f3b671c-95a1-4b4e-b59c-ffd2ed3de7e9", "Note Created \u2192 Hue Flash", new Date().toISOString(), "error", err?.message || "fetch failed", "ext-api", JSON.stringify({ color })]
        ).catch(() => {});
    });
}

// ── Auth ────────────────────────────────────────────────────────────────────
// "external" = static API key (AI / scripts / curl) → ONLY via /api/stickies/ext
// "owner"    = browser JWT for the owner account → /api/stickies (browser only)
// "user"     = browser JWT for other users → scoped by user_id in stickies table
// `via`/`label` mirror _auth.ts's Caller shape — captured here (instead of a second
// identifyCaller() call) so POST can attribute the note in one authentication pass.
type AuthResult = { type: "external" | "owner" | "user"; userId: string; via?: "static" | "apikey" | "jwt" | "local"; label?: string };

// Guards the main /api/stickies route against static API key access.
// External callers (AI, scripts, automations) MUST use /api/stickies/ext instead.
// Returns a friendly 403 response if the API key is being used on the wrong route.
function blockExternalKey(req: Request): NextResponse | null {
    const auth = req.headers.get("authorization") ?? "";
    const apiKey = process.env.STICKIES_API_KEY;
    if (!apiKey || !auth) return null;
    const expected = `Bearer ${apiKey}`;
    if (auth.length !== expected.length) return null;
    try {
        if (!crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return null;
    } catch { return null; }
    // It is the API key — only allow it on the /ext route
    const url = new URL(req.url);
    if (url.pathname.includes("/stickies/ext")) return null;
    return NextResponse.json({
        error: "API key access is not permitted on /api/stickies.",
        message: "This endpoint is reserved for browser sessions (JWT auth). External integrations — including AI agents, scripts, and automations — must use /api/stickies/ext instead.",
        correct_endpoint: "/api/stickies/ext",
        hint: "Send your Authorization: Bearer <STICKIES_API_KEY> to /api/stickies/ext — same methods (GET, POST, PATCH, DELETE) work identically there.",
    }, { status: 403 });
}

async function authenticate(req: Request): Promise<AuthResult | null> {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    // Static API key → external caller (AI, scripts, automations) — checked first, even in dev.
    // NOTE: unlike _auth.ts's identifyCaller(), this intentionally does NOT accept
    // STICKIES_PASSWORD — only STICKIES_API_KEY. That is pre-existing behavior of this
    // route (and /ext, which re-exports it), preserved as-is by this refactor.
    const apiKey = process.env.STICKIES_API_KEY;
    if (apiKey) {
        const expected = `Bearer ${apiKey}`;
        if (auth.length === expected.length) {
            try {
                if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
                    // Prod is locked to the claude-routine key only — reject the shared static key there.
                    if (isProdLocked()) return null;
                    return { type: "external", userId: process.env.OWNER_USER_ID?.trim() ?? "", via: "static", label: STATIC_KEY_LABEL };
                }
            } catch (e) { console.error("[stickies] static api key compare", e); }
        }
    }

    // Per-machine API key (api_keys table) → external caller owned by the owner.
    // Shared lookup with _auth.ts's identifyCaller() (see lookupApiKey) instead of a
    // second, independently-drifting copy of this query.
    if (bearer && bearer !== apiKey) {
        const result = await lookupApiKey(bearer);
        if (result.status === "match") {
            return { type: "external", userId: process.env.OWNER_USER_ID?.trim() ?? "", via: "apikey", label: result.label };
        }
        // On prod, only the allow-listed key (claude-routine) may call /ext at all.
        if (result.status === "prod_locked") return null;
    }

    // Dev bypass: in development the owner's own browser drives the app without a
    // login. A bearer-less request can only reach the dev server from that browser
    // (LAN automations and the ext API always send a key, handled above), so the
    // owner gets full read+write locally. The "writes need a ticket" rule is a
    // PROD concern: on Vercel NODE_ENV==="production" so this never fires, and
    // isProdLocked() already restricts keyed callers there.
    if (!bearer && (process.env.NODE_ENV === "development" || hubLanTrusted(req))) {
        return { type: "owner", userId: process.env.OWNER_USER_ID?.trim() ?? "", via: "local" };
    }

    // NextAuth session (cookie-based). No bearer JWT for browser sessions anymore.
    const session = await getSession();
    if (session?.user?.email) {
        const ownerUserId = process.env.OWNER_USER_ID?.trim();
        const ownerEmail  = process.env.OWNER_EMAIL?.trim();
        const isOwner = ownerEmail && session.user.email.toLowerCase() === ownerEmail.toLowerCase();
        if (isOwner) {
            // Surface the legacy OWNER_USER_ID so all 400+ existing notes still resolve.
            return { type: "owner", userId: ownerUserId ?? String((session.user as any).id ?? ""), via: "jwt" };
        }
        // Non-owner authenticated user — scope to their NextAuth id for any future multi-user data.
        return { type: "user", userId: String((session.user as any).id ?? "") };
    }

    return null;
}

// ── User scope helper ────────────────────────────────────────────────────────
// Fix #1: parameterized user isolation — never string-interpolate userId into SQL.
function withUser(sql: string, params: unknown[], userId?: string): { sql: string; params: unknown[] } {
    if (!userId) return { sql, params: [...params] };
    return { sql: `${sql} AND user_id = $${params.length + 1}`, params: [...params, userId] };
}

// ── Allowed columns for raw insert (Fix #2) ──────────────────────────────────
const RAW_INSERT_ALLOWED_COLS = new Set([
    "title", "content", "folder_name", "folder_color", "is_folder", "type",
    "order", "created_at", "updated_at", "parent_folder_name", "folder_id", "list_mode",
    "format", "doc", "created_by_key", "created_by_machine",
]);

// ── Allowed columns for PATCH updates ────────────────────────────────────────
const PATCH_ALLOWED_COLS = new Set([
    "title", "content", "folder_name", "folder_color", "is_folder", "type",
    "order", "updated_at", "parent_folder_name", "folder_id", "list_mode", "tags", "trashed_at", "is_public", "icon",
    // Rich-text support: per-note editor mode + ProseMirror JSON doc
    "format", "doc",
    // Share visibility: passcode-gated Private share (locked) + its hash
    "locked", "lock_password_hash",
    // Note lock — owner write-protect: when true the note can't be modified or deleted
    "frozen",
]);

// Lazy column add — keeps prod DB in sync without a separate migration step
let _lockedColumnEnsured = false;
async function ensureLockedColumn(): Promise<void> {
    if (_lockedColumnEnsured) return;
    _lockedColumnEnsured = true;
    try { await execute(`ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false`); } catch (e) { console.error("[stickies] ensure locked column", e); }
    try { await execute(`ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS lock_password_hash text`); } catch (e) { console.error("[stickies] ensure lock_password_hash column", e); }
    try { await execute(`ALTER TABLE "stickies" ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false`); } catch (e) { console.error("[stickies] ensure frozen column", e); }
}

// ── Color helpers ────────────────────────────────────────────────────────────
async function pickLeastUsedColor(userId: string, rawColor?: string): Promise<string> {
    const c = String(rawColor ?? "").trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(c)) return c;

    const rows = await query<{ folder_color: string; cnt: string }>(`SELECT UPPER(folder_color) AS folder_color, COUNT(*) AS cnt FROM "stickies" WHERE is_folder = false AND user_id = $1 GROUP BY UPPER(folder_color)`, [userId]);
    const counts = new Map<string, number>(palette12.map((p) => [p, 0]));
    rows.forEach((r) => { if (counts.has(r.folder_color)) counts.set(r.folder_color, Number(r.cnt)); });
    return palette12.reduce((a, b) => (counts.get(b)! < counts.get(a)! ? b : a), palette12[0]);
}

async function pickLeastUsedFolderColor(userId: string, rawColor?: string): Promise<string> {
    const c = String(rawColor ?? "").trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(c)) return c;

    const rows = await query<{ folder_color: string; cnt: string }>(`SELECT UPPER(folder_color) AS folder_color, COUNT(*) AS cnt FROM "stickies" WHERE is_folder = true AND user_id = $1 GROUP BY UPPER(folder_color)`, [userId]);
    const counts = new Map<string, number>(palette12.map((p) => [p, 0]));
    rows.forEach((r) => { if (counts.has(r.folder_color)) counts.set(r.folder_color, Number(r.cnt)); });
    return palette12.reduce((a, b) => (counts.get(b)! < counts.get(a)! ? b : a), palette12[0]);
}

async function getNextOrder(userId: string, isFolderOnly = false): Promise<number> {
    const whereClause = isFolderOnly ? "WHERE is_folder = true AND user_id = $1" : "WHERE is_folder = false AND user_id = $1";
    const row = await queryOne<{ order: number }>(`SELECT "order" FROM "stickies" ${whereClause} ORDER BY "order" DESC LIMIT 1`, [userId]);
    return typeof row?.order === "number" ? row.order + 1 : 0;
}

// ── Fuzzy folder name matcher ────────────────────────────────────────────────
function normalize(s: string): string { return s.toLowerCase().replace(/[-_ ]/g, ""); }
function fuzzyMatchFolder<T extends { folder_name: string }>(folders: T[], input: string, parentFilter?: (f: T) => boolean): T | undefined {
    const norm = normalize(input);
    const pool = parentFilter ? folders.filter(parentFilter) : folders;
    // 1. Exact case-insensitive
    let m = pool.find(f => f.folder_name.toLowerCase() === input.toLowerCase());
    if (m) return m;
    // 2. Normalized (strip dashes/underscores/spaces)
    m = pool.find(f => normalize(f.folder_name) === norm);
    if (m) return m;
    // 3. Starts with
    m = pool.find(f => normalize(f.folder_name).startsWith(norm) || norm.startsWith(normalize(f.folder_name)));
    if (m) return m;
    // 4. Contains
    m = pool.find(f => normalize(f.folder_name).includes(norm) || norm.includes(normalize(f.folder_name)));
    return m;
}

// Throttle the TRASH auto-expire sweep to at most once/hour per user (in-memory),
// so it stops running a DELETE on every single list/counts/search GET.
const _trashExpiredAt = new Map<string, number>();
const TRASH_EXPIRE_INTERVAL_MS = 60 * 60 * 1000;

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    const blocked = blockExternalKey(req);
    if (blocked) return blocked;
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = "stickies";
    const userId = auth.userId;

    await ensureLockedColumn();

    // Auto-expire: permanently delete TRASH notes older than 7 days. Throttled to
    // once/hour per user and fire-and-forget, so reads never wait on this write.
    const _now = Date.now();
    if (_now - (_trashExpiredAt.get(userId) ?? 0) > TRASH_EXPIRE_INTERVAL_MS) {
        _trashExpiredAt.set(userId, _now);
        execute(
            `DELETE FROM "${table}" WHERE user_id = $1 AND folder_name = 'TRASH' AND trashed_at IS NOT NULL AND trashed_at < NOW() - INTERVAL '7 days'`,
            [userId]
        ).catch(() => { /* column may not exist yet — migration pending */ });
    }
    const url = new URL(req.url);

    // User preferences (pinned folders)
    if (url.searchParams.get("prefs") === "1") {
        // Auto-create table if missing
        try { await execute(`CREATE TABLE IF NOT EXISTS user_preferences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL UNIQUE, pinned_folders TEXT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`); } catch (e) { console.error("[stickies] ensure user_preferences table", e); }
        const row = await queryOne<{ pinned_folders: string[] }>(`SELECT pinned_folders FROM user_preferences WHERE user_id = $1`, [userId]);
        return NextResponse.json({ pinned_folders: row?.pinned_folders ?? [] });
    }

    // Return API key for import guide — owner-only (browser session). Any keyed or
    // non-owner caller is refused so a leaked scoped key can't read the master key.
    if (url.searchParams.get("apikey") === "1") {
        if (auth.type !== "owner") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
        }
        return NextResponse.json({ key: process.env.STICKIES_API_KEY || "" }, { headers: { "Cache-Control": "no-store" } });
    }

    const foldersOnly = url.searchParams.get("folders") === "1";
    const folderFilter = url.searchParams.get("folder");
    const q = url.searchParams.get("q")?.trim();
    const route = url.searchParams.get("route")?.trim();

    if (route) {
        const routeFolder = folderFilter ?? "BHENG";
        const { sql, params } = withUser(
            `SELECT * FROM "${table}" WHERE is_folder = false AND folder_name = $1 AND title = $2`,
            [routeFolder, route],
            userId
        );
        const data = await queryOne(`${sql} LIMIT 1`, params);
        return NextResponse.json({ sticky: data ?? null });
    }

    if (foldersOnly) {
        const { sql, params } = withUser(
            `SELECT id, folder_name, folder_color, parent_folder_name, "order", updated_at, content FROM "${table}" WHERE is_folder = true`,
            [],
            userId
        );
        const rows = await query(`${sql} ORDER BY "order" ASC LIMIT 2000`, params);
        return NextResponse.json({ folders: rows });
    }

    if (url.searchParams.get("recent") === "today") {
        // "days" widens the Today window in 24h steps for the Load-more button
        // (days=1 → last 24h, days=2 → last 48h, …). Clamped 1..30.
        const days = Math.min(30, Math.max(1, parseInt(url.searchParams.get("days") ?? "1") || 1));
        const hours = days * 24;
        const RECENT_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder, is_public, trashed_at, icon, list_mode, locked, frozen, created_by_key, created_by_machine`;
        const { sql, params } = withUser(
            `SELECT ${RECENT_COLS} FROM "${table}" WHERE is_folder = false AND trashed_at IS NULL AND created_at >= NOW() - INTERVAL '${hours} hours'`,
            [],
            userId
        );
        const rows = await query(`${sql} ORDER BY updated_at DESC LIMIT 500`, params);
        return NextResponse.json({ notes: rows, days });
    }

    if (url.searchParams.get("recent") === "all") {
        // "All" virtual view: every live note, latest first, server-paginated
        // (default 20/page for the root All card; clamped 1..100).
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20") || 20));
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0") || 0);
        const ALL_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder, is_public, trashed_at, icon, list_mode, locked, frozen, created_by_key, created_by_machine`;
        const { sql, params } = withUser(
            `SELECT ${ALL_COLS}, COUNT(*) OVER() AS _total FROM "${table}" WHERE is_folder = false AND trashed_at IS NULL`,
            [],
            userId
        );
        params.push(limit, offset);
        // "All" orders by creation time, not edit time — editing a note must not
        // jump it to the top of All (and it stays stable if updated_at churns).
        const rows = await query<Record<string, unknown>>(
            `${sql} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const total = Number(rows[0]?._total ?? 0);
        return NextResponse.json({ notes: rows.map(({ _total, ...rest }) => rest), total });
    }

    if (url.searchParams.get("counts") === "1") {
        const rows = await query<{ folder_name: string; folder_id: string | null; cnt: string; latest: string }>(
            `SELECT folder_name, folder_id::text AS folder_id, COUNT(*) AS cnt, MAX(updated_at) AS latest FROM "stickies" WHERE is_folder = false AND user_id = $1 AND (trashed_at IS NULL OR folder_name = 'TRASH') GROUP BY folder_name, folder_id`,
            [userId]
        );
        const byName: Record<string, number> = {};
        const byId: Record<string, number> = {};
        const latestByFolderId: Record<string, string> = {};
        let total = 0;
        for (const row of rows) {
            const n = Number(row.cnt ?? 0);
            if (row.folder_name) byName[row.folder_name] = (byName[row.folder_name] || 0) + n;
            if (row.folder_id) {
                byId[String(row.folder_id)] = (byId[String(row.folder_id)] || 0) + n;
                const ts = String(row.latest || "");
                if (!latestByFolderId[String(row.folder_id)] || ts > latestByFolderId[String(row.folder_id)]) {
                    latestByFolderId[String(row.folder_id)] = ts;
                }
            }
            total += n;
        }

        // "Today" virtual view count — notes created < 24h, computed server-side so the
        // card never depends on how many notes happen to be loaded into the client.
        const todayRows = await query<{ n: string }>(
            `SELECT COUNT(*) AS n FROM "stickies" WHERE is_folder = false AND user_id = $1 AND trashed_at IS NULL AND created_at >= NOW() - INTERVAL '24 hours'`,
            [userId]
        );
        const todayCount = Number(todayRows[0]?.n ?? 0);
        return NextResponse.json({ counts: byName, countsByFolderId: byId, latestByFolderId, total, todayCount });
    }

    if (folderFilter) {
        const FOLDER_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder, is_public, trashed_at, icon, list_mode, locked, frozen, created_by_key, created_by_machine, format, CASE WHEN (type = 'checklist' OR list_mode = true) AND content IS NOT NULL AND length(content) > 0 THEN (SELECT COUNT(*)::int FROM regexp_split_to_table(content, E'\\n') AS line WHERE TRIM(line) <> '' AND TRIM(line) !~ '^[-=*#~_.]{2,}$') ELSE 0 END AS task_count, CASE WHEN (type = 'checklist' OR list_mode = true) AND content IS NOT NULL AND length(content) > 0 THEN COALESCE((SELECT SUM(CASE WHEN TRIM(line) ~* '^\\[x\\]' THEN 1.0 WHEN TRIM(line) ~ '^\\[/\\]' THEN 0.5 ELSE 0 END)::float FROM regexp_split_to_table(content, E'\\n') AS line), 0) ELSE 0 END AS task_done_count, CASE WHEN (type = 'checklist' OR list_mode = true) AND content IS NOT NULL AND length(content) > 0 THEN (SELECT COUNT(*)::int FROM regexp_split_to_table(content, E'\\n') AS line WHERE TRIM(line) <> '' AND TRIM(line) !~ '^[-=*#~_.]{2,}$' AND TRIM(line) !~* '^\\[x\\]') ELSE 0 END AS task_remaining_count`;
        const limitParam = parseInt(url.searchParams.get("limit") ?? "0");
        const offsetParam = parseInt(url.searchParams.get("offset") ?? "0");
        const sinceParam = url.searchParams.get("since"); // ISO timestamp — delta sync

        // ── Copy: return title+content only, max 25 ──────────────────────────
        // ── Delta sync: only return notes changed since last sync ─────────────
        if (sinceParam) {
            const sinceDate = new Date(sinceParam);
            if (!isNaN(sinceDate.getTime())) {
                const { sql, params } = withUser(
                    `SELECT ${FOLDER_COLS} FROM "${table}" WHERE is_folder = false AND folder_name = $1 AND updated_at > $2`,
                    [folderFilter, sinceDate.toISOString()],
                    userId
                );
                const changed = await query<Record<string, unknown>>(`${sql} ORDER BY updated_at DESC`, params);
                return NextResponse.json({ notes: changed, delta: true, syncedAt: new Date().toISOString() });
            }
        }

        // ── Full fetch: include COUNT(*) OVER() to avoid a second round-trip ─
        const { sql: whereSql, params: whereParams } = withUser(
            `WHERE is_folder = false AND folder_name = $1`,
            [folderFilter],
            userId
        );
        let paginationSql = "";
        if (limitParam > 0) {
            whereParams.push(limitParam, offsetParam);
            paginationSql = `LIMIT $${whereParams.length - 1} OFFSET $${whereParams.length}`;
        }
        const rows = await query<Record<string, unknown>>(
            `SELECT ${FOLDER_COLS}, COUNT(*) OVER() AS _total FROM "${table}" ${whereSql} ORDER BY updated_at DESC ${paginationSql}`,
            whereParams
        );
        const total = Number(rows[0]?._total ?? 0);
        const cleanRows = rows.map(({ _total, ...rest }) => rest);
        return NextResponse.json({ notes: cleanRows, total, syncedAt: new Date().toISOString() });
    }

    if (q) {
        const SEARCH_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder, is_public, trashed_at, icon, locked, frozen`;
        // Skill-scoped search: with many *-audit skills, a bare "audit" match is noise. If the
        // query IS a known audit skill name - any separator, or none ("pr audit" / "pr-audit" /
        // "praudit") - return ONLY that skill's notes, identified by its tile icon OR its
        // "/<skill>" content chip (the ground truth of which skill generated the note).
        const SKILL_SEARCH: { norm: string; icon: string; chip: string }[] = [
            { norm: "portfolioaudit", icon: "__portfolioaudit", chip: "portfolio-audit" },
            { norm: "githubaudit",    icon: "__githubaudit",    chip: "github-audit" },
            { norm: "repoaudit",      icon: "__repoaudit",      chip: "repo-audit" },
            { norm: "githubstats",    icon: "__githubstats",    chip: "github-stats" },
            { norm: "praudit",        icon: "__praudit",        chip: "(zeta-)?pr-audit" },
            { norm: "reporecon",      icon: "__reporecon",      chip: "repo-recon" },
            { norm: "securityaudit",  icon: "__securityaudit",  chip: "security-audit" },
            { norm: "epicaudit",      icon: "__epicaudit",      chip: "(zeta-)?epic-audit" },
            { norm: "devaudit",       icon: "__devaudit",       chip: "dev-audit" },
            { norm: "projectaudit",   icon: "__projectaudit",   chip: "project-(audit|recon)" },
            { norm: "storageaudit",   icon: "__storageaudit",   chip: "storage-audit" },
            { norm: "resourceaudit",  icon: "__resourceaudit",  chip: "resource-audit" },
        ];
        // Chained filter: consume a LEADING skill name (1-2 words, any separator) and treat the
        // rest as an extra filter. So "repo audit bunlongheng" = repo-audit notes filtered to
        // "bunlongheng" (partial too - "repo audit bunlong" matches). No trailing term = the
        // whole skill.
        const words = q.trim().split(/\s+/);
        let skill: typeof SKILL_SEARCH[number] | null = null;
        let filterText = "";
        for (let take = Math.min(3, words.length); take >= 1; take--) {
            const head = words.slice(0, take).join("").toLowerCase().replace(/[^a-z0-9]/g, "");
            const s = SKILL_SEARCH.find((sk) => sk.norm === head);
            if (s) { skill = s; filterText = words.slice(take).join(" ").trim(); break; }
        }
        if (skill) {
            const chipRe = `class="chip"[^>]*>\\s*/${skill.chip}`;
            const conds = ["(icon = $1 OR content ~* $2)"];
            const params: unknown[] = [skill.icon, chipRe];
            if (filterText) {
                // Filter on the TITLE only (the note's subject - repo/owner/name). Content is
                // too noisy: nearly every audit report mentions "stickies", "github", etc. in
                // its body, so a content filter would match the whole skill.
                const fesc = filterText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[-\\s]+");
                params.push(fesc);
                conds.push(`title ~* $${params.length}`);
            }
            const { sql, params: p } = withUser(
                `SELECT ${SEARCH_COLS} FROM "${table}" WHERE is_folder = false AND trashed_at IS NULL AND (folder_name IS DISTINCT FROM 'TRASH') AND ${conds.join(" AND ")}`,
                params,
                userId
            );
            const rows = await query(`${sql} ORDER BY updated_at DESC LIMIT 50`, p);
            return NextResponse.json({ notes: rows, query: q, skill: skill.icon, filter: filterText || undefined });
        }
        // Otherwise: separator-agnostic general search ("repo recon" == "repo-recon", free text).
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = escaped.replace(/[\s-]+/g, "[-\\s]+");
        const { sql, params } = withUser(
            `SELECT ${SEARCH_COLS} FROM "${table}" WHERE is_folder = false AND trashed_at IS NULL AND (folder_name IS DISTINCT FROM 'TRASH') AND (title ~* $1 OR content ~* $1)`,
            [pattern],
            userId
        );
        const rows = await query(`${sql} ORDER BY updated_at DESC LIMIT 50`, params);
        return NextResponse.json({ notes: rows, query: q });
    }

    const idParam = url.searchParams.get("id")?.trim();
    if (idParam) {
        const { sql, params } = withUser(
            `SELECT * FROM "${table}" WHERE is_folder = false AND id = $1`,
            [idParam],
            userId
        );
        const data = await queryOne(`${sql} LIMIT 1`, params);
        return NextResponse.json({ note: data ?? null });
    }

    const exportAll = url.searchParams.get("export") === "1";
    if (exportAll) {
        const { sql, params } = withUser(
            `SELECT * FROM "${table}" WHERE is_folder = false`,
            [],
            userId
        );
        const rows = await query(`${sql} ORDER BY updated_at DESC LIMIT 500`, params);
        return NextResponse.json({ notes: rows, total: rows.length });
    }

    const LIST_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder, is_public, trashed_at, icon, list_mode, locked, frozen, created_by_key, created_by_machine, format, CASE WHEN (type = 'checklist' OR list_mode = true) AND content IS NOT NULL AND length(content) > 0 THEN (SELECT COUNT(*)::int FROM regexp_split_to_table(content, E'\\n') AS line WHERE TRIM(line) <> '' AND TRIM(line) !~ '^[-=*#~_.]{2,}$') ELSE 0 END AS task_count, CASE WHEN (type = 'checklist' OR list_mode = true) AND content IS NOT NULL AND length(content) > 0 THEN COALESCE((SELECT SUM(CASE WHEN TRIM(line) ~* '^\\[x\\]' THEN 1.0 WHEN TRIM(line) ~ '^\\[/\\]' THEN 0.5 ELSE 0 END)::float FROM regexp_split_to_table(content, E'\\n') AS line), 0) ELSE 0 END AS task_done_count, CASE WHEN (type = 'checklist' OR list_mode = true) AND content IS NOT NULL AND length(content) > 0 THEN (SELECT COUNT(*)::int FROM regexp_split_to_table(content, E'\\n') AS line WHERE TRIM(line) <> '' AND TRIM(line) !~ '^[-=*#~_.]{2,}$' AND TRIM(line) !~* '^\\[x\\]') ELSE 0 END AS task_remaining_count`;
    const { sql, params } = withUser(
        `SELECT ${LIST_COLS} FROM "${table}" WHERE is_folder = false`,
        [],
        userId
    );
    const rows = await query(`${sql} ORDER BY "order" ASC LIMIT 500`, params);
    return NextResponse.json({ notes: rows });
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const blocked = blockExternalKey(req);
    if (blocked) return blocked;
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = "stickies";
    const userId = auth.userId;

    // Attribution: which key created the note. External keys carry their label;
    // owner browser/local creates (jwt/local) are stamped 'stickies' so notes made
    // in the web app itself show the Stickies icon like any other app. Sourced from
    // `auth` (computed once above by authenticate()) instead of a second
    // identifyCaller() call — this used to be 2 DB key lookups per request.
    const createdByMachine = await machineFromRequest(req);
    if (createdByMachine) await ensureCreatedByMachineColumn();

    const createdByKey =
        auth.via === "apikey" ? auth.label ?? null
        // Static bearer is hardcoded label 'legacy'; prefer the calling machine so
        // notes attribute to their origin instead of a generic 'legacy'.
        : auth.via === "static" ? (createdByMachine ?? auth.label ?? null)
        : (auth.via === "jwt" || auth.via === "local") ? "stickies"
        : null;
    if (createdByKey) await ensureCreatedByKeyColumn();

    const url = new URL(req.url);
    const isJsonBody = /application\/json/i.test(req.headers.get("content-type") ?? "");
    let bodyForFolderCheck: Record<string, unknown> | null = null;

    if (isJsonBody) {
        try { bodyForFolderCheck = JSON.parse(await req.text()); }
        catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
    }

    // Broadcast incoming request to all live sessions
    {
        const isBatch = Array.isArray(bodyForFolderCheck) || (bodyForFolderCheck as any)?.batch;
        const summary = isBatch
            ? `batch(${Array.isArray(bodyForFolderCheck) ? bodyForFolderCheck.length : (bodyForFolderCheck as any).batch?.length ?? "?"})`
            : (bodyForFolderCheck as any)?.title ?? (bodyForFolderCheck as any)?.name ?? undefined;
        broadcastRequest(req, auth, summary ? { summary } : {});
    }

    // ── Compact array format ──
    if (Array.isArray(bodyForFolderCheck)) {
        const raw = bodyForFolderCheck as unknown as Array<unknown[]>;
        // Fix #3: batch size limit
        if (raw.length > 500) {
            return NextResponse.json({ error: "Batch limit is 500 items per request" }, { status: 400 });
        }
        const normalized = raw.map((row) => {
            const [type, ...rest] = row as [string, ...unknown[]];
            if (type === "folder") return { type: "folder", name: rest[0], color: rest[1], parent_folder: rest[2] };
            const folder_name = String(rest[2] ?? "CLAUDE").trim() || "CLAUDE";
            return { type: "note", title: rest[0], content: rest[1] ?? "", folder_name, color: rest[3] };
        });
        (bodyForFolderCheck as any) = { batch: normalized };
    }

    // ── Batch mode ──
    if (bodyForFolderCheck && Array.isArray((bodyForFolderCheck as any).batch)) {
        const items = (bodyForFolderCheck as any).batch as Array<Record<string, unknown>>;
        // Fix #3: batch size limit
        if (items.length > 500) {
            return NextResponse.json({ error: "Batch limit is 500 items per request" }, { status: 400 });
        }
        const now = new Date().toISOString();

        // Load existing color counts once
        const colorRows = await query<{ folder_color: string }>(`SELECT folder_color FROM "stickies" WHERE is_folder = false AND user_id = $1`, [userId]);
        const colorCounts = new Map<string, number>(palette12.map((c) => [c, 0]));
        colorRows.forEach((r) => {
            const c = String(r.folder_color ?? "").toUpperCase();
            if (colorCounts.has(c)) colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
        });
        const pickColor = (raw?: string): string => {
            const c = String(raw ?? "").trim().toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(c)) { colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1); return c; }
            const least = palette12.reduce((a, b) => (colorCounts.get(b)! < colorCounts.get(a)! ? b : a), palette12[0]);
            colorCounts.set(least, (colorCounts.get(least) ?? 0) + 1);
            return least;
        };

        const maxOrderRow = await queryOne<{ order: number }>(`SELECT "order" FROM "stickies" WHERE user_id = $1 ORDER BY "order" DESC LIMIT 1`, [userId]);
        let nextOrder = typeof maxOrderRow?.order === "number" ? maxOrderRow.order + 1 : 0;
        const results: Array<{ type: string; data: Record<string, unknown> | null; error?: string }> = [];
        // Notes are buffered and flushed as ONE multi-row INSERT below. The old code ran a
        // statement per item, so a 20-note batch paid 20 sequential round trips to a remote
        // Postgres. Folders stay sequential: each needs its own duplicate check, and a later
        // folder can reference an earlier one by name.
        const pendingNotes: Array<{ slot: number; order: number; values: unknown[] }> = [];

        for (const item of items) {
            const slot = results.length;
            const type = String(item.type ?? "note");
            if (item.__error) { results.push({ type, data: null, error: String(item.__error) }); continue; }
            try {
                if (type === "folder") {
                    const name = String(item.name ?? "").trim();
                    if (!name) { results.push({ type: "folder", data: null, error: "name required" }); continue; }
                    if (isReservedFolderName(name)) { results.push({ type: "folder", data: null, error: "reserved_name: \"Today\"/\"Yesterday\" are virtual views, not folders" }); continue; }
                    const folder_color = pickColor(item.color as string);
                    // External callers may not create root folders — nest under CLAUDE when no parent given.
                    const parent_folder_name = String(item.parent_folder ?? "").trim() || (auth.type === "external" ? "CLAUDE" : null);
                    const folderIcon = String(item.icon ?? "").trim();
                    // Skip if folder already exists at this level
                    const dup = await queryOne(`SELECT id FROM "stickies" WHERE is_folder = true AND folder_name = $1 AND COALESCE(parent_folder_name, '') = $2 AND user_id = $3`, [name, parent_folder_name || "", userId]);
                    if (dup) { results.push({ type: "folder", data: dup, error: "already exists" }); continue; }
                    const row = await queryOne(
                        `INSERT INTO "stickies" (is_folder, folder_name, title, content, folder_color, parent_folder_name, "order", created_at, updated_at, user_id)
                         VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                        [name, name, folderIcon, folder_color, parent_folder_name, nextOrder++, now, now, userId]
                    );
                    results.push({ type: "folder", data: row as Record<string, unknown> });
                } else {
                    const title = stripEmoji(String(item.title ?? "").trim());
                    if (!title) { results.push({ type: "note", data: null, error: "title required" }); continue; }
                    const content = String(item.content ?? "").trim();
                    if (!content) { results.push({ type: "note", data: null, error: "content required" }); continue; }
                    const folder_name = remapReservedFolderPath("folder" in item
                        ? (String(item.folder ?? "").trim() || (() => { throw new Error("folder cannot be empty"); })())
                        : "CLAUDE");
                    const batchType = (typeof item.type === "string" && VALID_TYPES.has(item.type)) ? item.type : detectType(content, title);
                    const folder_color = pickColor(item.color as string);
                    const bKeyClause = createdByKey ? `, created_by_key` : "";
                    const bMachineClause = createdByMachine ? `, created_by_machine` : "";
                    const bExtra = [
                        ...(createdByKey ? [createdByKey] : []),
                        ...(createdByMachine ? [createdByMachine] : []),
                    ];
                    void bKeyClause; void bMachineClause;
                    const thisOrder = nextOrder++;
                    // Buffer; the single INSERT after the loop fills this slot in.
                    pendingNotes.push({ slot, order: thisOrder, values: [title, content, folder_name, batchType, folder_color, thisOrder, now, now, userId, ...bExtra] });
                    results.push({ type: "note", data: null });
                }
            } catch (err: any) {
                results.push({ type, data: null, error: err?.message ?? "unknown error" });
            }
        }

        // ── Flush the buffered notes in ONE statement ────────────────────────────
        if (pendingNotes.length > 0) {
            const bKeyCol = createdByKey ? `, created_by_key` : "";
            const bMachineCol = createdByMachine ? `, created_by_machine` : "";
            const perRow = pendingNotes[0].values.length; // 9 fixed + optional key/machine
            const valuesSql = pendingNotes
                .map((_, r) => `(false, ${Array.from({ length: perRow }, (_, c) => `$${r * perRow + c + 1}`).join(", ")})`)
                .join(", ");
            const flat = pendingNotes.flatMap((n) => n.values);
            try {
                const rows = await query<Record<string, unknown>>(
                    `INSERT INTO "stickies" (is_folder, title, content, folder_name, type, folder_color, "order", created_at, updated_at, user_id${bKeyCol}${bMachineCol})
                     VALUES ${valuesSql} RETURNING *`,
                    flat
                );
                // Postgres returns RETURNING rows in VALUES order, so position is the
                // primary mapping. Fall back to matching on "order" (unique per row in
                // this batch) if the row count ever differs.
                const byOrder = new Map(rows.map((r) => [Number(r.order), r]));
                pendingNotes.forEach((n, i) => {
                    const row = (rows.length === pendingNotes.length ? rows[i] : byOrder.get(n.order)) ?? null;
                    results[n.slot] = row
                        ? { type: "note", data: row }
                        : { type: "note", data: null, error: "insert returned no row" };
                });
            } catch (err: any) {
                // One bad row fails the whole statement, so fall back to per-row inserts and
                // keep the old behaviour: each item succeeds or fails on its own.
                console.error("[stickies] batch insert failed, falling back per row:", err?.message);
                for (const n of pendingNotes) {
                    const ph = Array.from({ length: perRow }, (_, c) => `$${c + 1}`).join(", ");
                    try {
                        const row = await queryOne<Record<string, unknown>>(
                            `INSERT INTO "stickies" (is_folder, title, content, folder_name, type, folder_color, "order", created_at, updated_at, user_id${bKeyCol}${bMachineCol})
                             VALUES (false, ${ph}) RETURNING *`,
                            n.values
                        );
                        results[n.slot] = { type: "note", data: row as Record<string, unknown> };
                    } catch (e: any) {
                        results[n.slot] = { type: "note", data: null, error: e?.message ?? "unknown error" };
                    }
                }
            }
        }

        const failed = results.filter((r) => r.error);
        const pusher = getPusher();
        for (const r of results) {
            if (r.data && !r.error) {
                pusher.trigger("stickies", "note-created", r.data).catch(() => {});
            }
        }

        return NextResponse.json({ results, total: results.length, failed: failed.length }, { status: failed.length === results.length ? 500 : 201 });
    }

    // ── Folder create ──
    const isFolderCreate = url.searchParams.get("type") === "folder" || bodyForFolderCheck?.type === "folder";
    if (isFolderCreate) {
        const name = String(url.searchParams.get("name") || (bodyForFolderCheck?.name as string) || "").trim();
        if (!name) return NextResponse.json({ error: "name is required for folder" }, { status: 400 });
        if (isReservedFolderName(name)) return NextResponse.json({ error: "\"Today\"/\"Yesterday\" are virtual views, not folders" }, { status: 400 });

        const rawColor = String(url.searchParams.get("color") || (bodyForFolderCheck?.color as string) || "").trim();
        // External callers may not create root folders — nest under CLAUDE when no parent given.
        const parentFolder = String(url.searchParams.get("parent") || (bodyForFolderCheck?.parent_folder as string) || "").trim() || (auth.type === "external" ? "CLAUDE" : null);

        // Prevent duplicate folder names at the same level
        const existing = await queryOne(`SELECT id FROM "stickies" WHERE is_folder = true AND folder_name = $1 AND COALESCE(parent_folder_name, '') = $2 AND user_id = $3`, [name, parentFolder || "", userId]);
        if (existing) return NextResponse.json({ error: "Folder already exists", id: existing.id }, { status: 409 });
        const folderIcon = String(url.searchParams.get("icon") || (bodyForFolderCheck?.icon as string) || "").trim();
        const folder_color = await pickLeastUsedFolderColor(userId, rawColor);
        const nextOrder = await getNextOrder(userId, true);
        const now = new Date().toISOString();

        const data = await queryOne(
            `INSERT INTO "stickies" (is_folder, folder_name, title, content, folder_color, parent_folder_name, "order", created_at, updated_at, user_id)
             VALUES (true, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, name, folderIcon, folder_color, parentFolder, nextOrder, now, now, userId]
        );

        if (!data) { return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        try { await getPusher().trigger("stickies", "note-created", livePayload(data)); } catch (e) { console.error("[stickies] broadcast note-created", e); }
        return NextResponse.json({ folder: data }, { status: 201 });
    }

    // ── Raw insert ──
    if (url.searchParams.get("raw") === "1") {
        let payload: Record<string, unknown>;
        try { payload = bodyForFolderCheck ?? await req.json(); }
        catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
        const now = new Date().toISOString();
        const insertPayload: Record<string, unknown> = { ...payload, updated_at: now, created_at: payload.created_at ?? now, user_id: userId };
        if (createdByKey) insertPayload.created_by_key = createdByKey;
        if (createdByMachine) insertPayload.created_by_machine = createdByMachine;
        // Fix #2: whitelist allowed columns — reject arbitrary user-supplied column names
        const filteredPayload = Object.fromEntries(
            Object.entries(insertPayload).filter(([k]) => RAW_INSERT_ALLOWED_COLS.has(k) || k === "user_id")
        );
        if (Object.keys(filteredPayload).length === 0) {
            return NextResponse.json({ error: "No valid columns provided" }, { status: 400 });
        }
        // External callers may not create root folders — nest under CLAUDE when no parent given.
        const rawIsFolder = filteredPayload.is_folder === true || filteredPayload.is_folder === "true";
        if (auth.type === "external" && rawIsFolder && !String(filteredPayload.parent_folder_name ?? "").trim()) {
            filteredPayload.parent_folder_name = "CLAUDE";
        }
        const cols = Object.keys(filteredPayload).map((k) => `"${k}"`).join(", ");
        // Same JSONB stringify treatment as PATCH — see PATCH_ALLOWED_COLS notes above.
        const vals = Object.entries(filteredPayload).map(([k, v]) => (k === "doc" && v !== null && typeof v === "object" ? JSON.stringify(v) : v));
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        const data = await queryOne(
            `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
            vals
        );
        if (!data) { return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        try { await getPusher().trigger("stickies", "note-created", livePayload(data)); } catch (e) { console.error("[stickies] broadcast note-created", e); }
        return NextResponse.json({ note: data }, { status: 201 });
    }

    // ── Single note (JSON body, or a raw-text body posted with a text/* Content-Type) ──
    const isRawTextBody = /text\/(plain|markdown|x-markdown)/i.test(req.headers.get("content-type") ?? "");

    let title = "", content = "", folder_name: string | null = null, rawColor = "", parentFolderHint: string | null = null, explicitType: string | null = null;
    let rawIcon: unknown = undefined;
    // Bump created_at on an ext upsert so a re-posted note ranks as new in the All
    // view (see the upsert branch below). Default ON: an incoming re-post (audits,
    // health checks, anything a skill/person pushes again) should surface at the top,
    // not stay buried behind everything created since its first post - which reads as
    // "incoming stopped working." Owner browser POSTs always INSERT, so this only ever
    // affects external upsert-UPDATES. Send `resurface: false` to opt out (a silent edit).
    let resurface = true;

    if (isRawTextBody) {
        const raw = await req.text();
        const lines = raw.split("\n");
        const h1Index = lines.findIndex((l) => /^#\s+/.test(l));
        if (h1Index !== -1) {
            title = lines[h1Index].replace(/^#\s+/, "").trim();
            content = [...lines.slice(0, h1Index), ...lines.slice(h1Index + 1)].join("\n").trim();
        } else {
            const firstLine = lines.find((l) => l.trim()) ?? "";
            title = firstLine.replace(/^#+\s*/, "").trim() || "Untitled";
            content = raw.trim();
        }
        const qFolder = url.searchParams.get("folder");
        const qColor  = url.searchParams.get("color");
        const qType   = url.searchParams.get("type");
        folder_name = qFolder?.trim() || "CLAUDE";
        if (qColor?.trim()) rawColor = qColor.trim().toUpperCase();
        if (qType && VALID_TYPES.has(qType)) explicitType = qType;
        rawIcon = url.searchParams.get("icon") ?? undefined;
    } else {
        let body: Record<string, unknown>;
        try { body = bodyForFolderCheck ?? await req.json(); }
        catch { return NextResponse.json({ error: "Invalid body — send JSON or raw markdown text" }, { status: 400 }); }
        title       = typeof body.title   === "string" ? body.title.trim() : "";
        content     = typeof body.content === "string" ? body.content : "";
        const folderField = (typeof body.folder === "string" ? body.folder : "") || (typeof body.folder_name === "string" ? body.folder_name : "");
        folder_name = folderField.trim() || "CLAUDE";
        rawColor    = typeof body.color   === "string" ? body.color.trim().toUpperCase() : "";
        parentFolderHint = typeof body.parent_folder === "string" ? body.parent_folder.trim() : null;
        const bodyType = typeof body.type === "string" ? body.type.trim().toLowerCase() : null;
        if (bodyType && VALID_TYPES.has(bodyType)) explicitType = bodyType;
        rawIcon = body.icon;
        resurface = body.resurface !== false;
    }

    // Auto-derive title from content if missing or "Untitled"
    if (!title || title.toLowerCase() === "untitled") {
        const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (fm) { const m = fm[1].match(/^title:\s*(.+)$/m); if (m) title = m[1].trim().slice(0, 80); }
        if (!title || title.toLowerCase() === "untitled") {
            const heading = content.match(/^#{1,6}\s+(.+)$/m);
            if (heading) title = heading[1].trim().slice(0, 80);
        }
        if (!title || title.toLowerCase() === "untitled") {
            const firstLine = content.trim().split("\n").find(l => l.trim() && !l.startsWith("---")) || "";
            title = firstLine.replace(/^#+\s*/, "").slice(0, 80).trim() || "Untitled";
        }
    }
    // Keep API titles clean text — strip emoji so they don't clash with the icon.
    title = stripEmoji(title) || "Untitled";
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    if (folder_name !== null && !folder_name?.trim()) return NextResponse.json({ error: "folder cannot be empty" }, { status: 400 });
    if (!folder_name?.trim()) folder_name = "CLAUDE";
    // "Today"/"Yesterday" are virtual views, never real folders — file under CLAUDE.
    folder_name = remapReservedFolderPath(folder_name!);

    // Icon: if the agent supplied one it MUST be from the supported set — reject
    // early (before any DB work) so they resubmit a valid one. Resolved/auto-
    // picked below at insert time when absent.
    const hasIcon = rawIcon !== undefined && rawIcon !== null && String(rawIcon).trim() !== "";
    let suppliedIcon: string | null = null;
    if (hasIcon) {
        suppliedIcon = normalizeIcon(rawIcon);
        if (!suppliedIcon) return iconRejection(rawIcon);
    }

    // ── Non-browser API calls: enforce CLAUDE as parent for unknown simple folders ──
    const isExternalCall = !/mozilla/i.test(req.headers.get("user-agent") ?? "");
    if (isExternalCall && !folder_name!.includes("/")) {
        const rootFolders = await query<{ folder_name: string }>(
            `SELECT folder_name FROM "stickies" WHERE is_folder = true AND parent_folder_name IS NULL AND user_id = $1`,
            [userId]
        );
        const rootMatch = fuzzyMatchFolder(rootFolders, folder_name!);
        if (!rootMatch) {
            folder_name = `CLAUDE/${folder_name}`;
        } else {
            folder_name = rootMatch.folder_name; // normalize to real DB name
        }
    }

    // Resolve folder via slash-path
    let resolved_folder_id: string | null = null;
    let resolved_folder_name: string = folder_name!;

    const folderPathParts = folder_name!.split("/").map((p) => p.trim()).filter(Boolean);

    if (folderPathParts.length > 1) {
        const allFolders = await query<{ id: string; folder_name: string; parent_folder_name: string | null }>(
            `SELECT id::text, folder_name, parent_folder_name FROM "stickies" WHERE is_folder = true AND user_id = $1`,
            [userId]
        );

        let parentName: string | null = null;
        let parentId: string | null = null;
        const nowTs = new Date().toISOString();

        for (const segment of folderPathParts) {
            const match = fuzzyMatchFolder(allFolders, segment, (f) =>
                parentName === null ? !f.parent_folder_name : f.parent_folder_name?.toLowerCase() === parentName?.toLowerCase()
            );
            if (match) {
                parentName = match.folder_name;
                parentId = String(match.id);
            } else {
                if (parentName === null) {
                    return NextResponse.json({ error: `Root folder "${segment}" does not exist. Create it manually or use an existing folder.` }, { status: 400 });
                }
                // Create missing sub-folder
                const folderOrder = await getNextOrder(userId, true);
                const newFolder = await queryOne(
                    `INSERT INTO "stickies" (is_folder, folder_name, title, content, folder_color, parent_folder_name, "order", created_at, updated_at, user_id)
                     VALUES (true, $1, $2, '', $3, $4, $5, $6, $7, $8) RETURNING *`,
                    [segment, segment, palette12[8], parentName, folderOrder, nowTs, nowTs, userId]
                );
                if (newFolder) {
                    try { await getPusher().trigger("stickies", "note-created", newFolder); } catch (e) { console.error("[stickies] broadcast folder note-created", e); }
                    allFolders.push({ id: String((newFolder as any).id), folder_name: segment, parent_folder_name: parentName });
                    parentName = segment;
                    parentId = String((newFolder as any).id);
                } else {
                    parentName = segment;
                }
            }
        }
        // Use the canonical matched name (parentName), not the raw last segment -
        // fuzzy matches like "Job Search" -> "Jobs" must not store the input name
        // with the matched folder's id, or the client renders a ghost root folder.
        resolved_folder_name = parentName ?? folderPathParts[folderPathParts.length - 1];
        resolved_folder_id = parentId;
    } else {
        // Simple folder — fuzzy look up existing
        const allFolderRows = await query<{ id: string; folder_name: string; parent_folder_name: string | null }>(
            `SELECT id::text, folder_name, parent_folder_name FROM "stickies" WHERE is_folder = true AND user_id = $1`,
            [userId]
        );
        const match = fuzzyMatchFolder(allFolderRows, folder_name!, parentFolderHint
            ? (f) => f.parent_folder_name?.toLowerCase() === parentFolderHint!.toLowerCase()
            : undefined
        );
        if (match) {
            resolved_folder_id = String(match.id);
            resolved_folder_name = match.folder_name; // use the real DB name, not the fuzzy input
        }
    }

    const folder_color = await pickLeastUsedColor(userId, rawColor);
    const now = new Date().toISOString();

    // Upsert-by-title is ONLY for external/automation callers — an agent re-POSTing
    // the same title updates its note in place (idempotent re-posts). Owner/browser
    // callers always INSERT: notes are keyed by id, so the same title (even in the
    // same folder) is allowed and must never silently overwrite an existing note.
    // Fix #1: userId as parameterized $N, not string-interpolated
    let existingNote: { id: string } | null = null;
    if (auth.type === "external") {
        const { sql: upsertSql, params: upsertParams } = withUser(
            `SELECT id::text AS id FROM "${table}" WHERE is_folder = false AND folder_name = $1 AND title = $2`,
            [resolved_folder_name, title],
            userId
        );
        existingNote = await queryOne<{ id: string }>(`${upsertSql} LIMIT 1`, upsertParams);
    }

    const noteType = explicitType ?? detectType(content, title);

    let data: Record<string, unknown> | null;

    if (existingNote?.id) {
        // Upsert update: only touch icon when the agent explicitly sent one
        // (don't clobber a manually-set icon on a plain content re-post).
        //
        // `resurface`: the upsert normally leaves created_at alone, which is right
        // for an edit but wrong for a recurring REPORT (audits, health checks). The
        // All view ranks by created_at, so a regenerated report kept sinking behind
        // every note written since its first post - present in the DB, invisible in
        // the UI. An automation opts in by sending `resurface: true` and the freshly
        // written note rises to the top like the new content it is. Opt-in so normal
        // upserts (a bot editing an existing note) keep their original created_at.
        const bump = resurface ? `, created_at = $${suppliedIcon ? 6 : 5}` : "";
        if (suppliedIcon) {
            data = await queryOne(
                `UPDATE "stickies" SET content = $1, folder_color = $2, type = $3, icon = $4, updated_at = $5${bump} WHERE id = $${resurface ? 7 : 6} RETURNING *`,
                resurface
                    ? [content, folder_color, noteType, suppliedIcon, now, now, existingNote.id]
                    : [content, folder_color, noteType, suppliedIcon, now, existingNote.id]
            );
        } else {
            data = await queryOne(
                `UPDATE "stickies" SET content = $1, folder_color = $2, type = $3, updated_at = $4${bump} WHERE id = $${resurface ? 6 : 5} RETURNING *`,
                resurface
                    ? [content, folder_color, noteType, now, now, existingNote.id]
                    : [content, folder_color, noteType, now, existingNote.id]
            );
        }
    } else {
        const resolvedIcon = suppliedIcon ?? pickNoteIcon(title, content, noteType);
        const nextOrder = await getNextOrder(userId, false);
        const folderIdClause = resolved_folder_id ? `, folder_id` : "";
        const folderIdVal = resolved_folder_id ? `, $11` : "";
        const extraParams: unknown[] = resolved_folder_id ? [resolved_folder_id] : [];

        const baseParams: unknown[] = [title, content, resolved_folder_name, folder_color, noteType, resolvedIcon, nextOrder, now, now, userId, ...extraParams];
        const keyClause = createdByKey ? `, created_by_key` : "";
        const keyVal = createdByKey ? `, $${baseParams.length + 1}` : "";
        if (createdByKey) baseParams.push(createdByKey);
        const machineClause = createdByMachine ? `, created_by_machine` : "";
        const machineVal = createdByMachine ? `, $${baseParams.length + 1}` : "";
        if (createdByMachine) baseParams.push(createdByMachine);
        data = await queryOne(
            `INSERT INTO "stickies" (title, content, folder_name, folder_color, is_folder, type, icon, "order", created_at, updated_at, user_id${folderIdClause}${keyClause}${machineClause})
             VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, $9, $10${folderIdVal}${keyVal}${machineVal}) RETURNING *`,
            baseParams
        );
    }

    if (!data) { return NextResponse.json({ error: "Database error" }, { status: 500 }); }

    // A resurfaced re-post (bumped created_at) is effectively a NEW arrival for the UI:
    // broadcast note-created so live clients that don't have the old row loaded ADD it
    // (and highlight it), instead of a note-updated that no-ops on an absent note.
    const liveEvent = (existingNote?.id && !resurface) ? "note-updated" : "note-created";
    try { await getPusher().trigger("stickies", liveEvent, livePayload(data)); } catch (e) { console.error("[stickies] broadcast note-created/updated", e); }
    if (auth.type === "external") {
        void triggerHue(folder_color).catch(() => {});
    }

    const action = existingNote?.id ? "updated" : "created";
    const savedColor = String((data as any)?.folder_color || folder_color);
    return NextResponse.json({
        ok: true,
        action,
        message: `Successfully ${action}. Your sticky color is ${colorName(savedColor)} (${savedColor}).`,
        color: savedColor,
        color_name: colorName(savedColor),
        note: data,
    }, { status: 201 });
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
    const blocked = blockExternalKey(req);
    if (blocked) return blocked;
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // No API key may delete. Deletion is owner-browser-only (JWT/local), so a
    // leaked key cannot destroy notes — the strongest guard for prod data.
    if (auth.type === "external") {
        return NextResponse.json({
            error: "Deletion is not permitted via API key.",
            message: "Notes can only be deleted from the owner's browser session.",
        }, { status: 403 });
    }

    broadcastRequest(req, auth);

    const table = "stickies";
    const userId = auth.userId;
    const url = new URL(req.url);
    const noteId = url.searchParams.get("id")?.trim();
    const folderName = url.searchParams.get("folder_name")?.trim();

    if (noteId) {
        // A locked (frozen) note can't be deleted — unlock it first. This makes the
        // lock a true write-protect (edit + delete), not just an edit guard.
        await ensureLockedColumn();
        const dfSel = withUser(`SELECT frozen FROM "${table}" WHERE id = $1`, [noteId], userId);
        const dfRow = await queryOne<{ frozen: boolean }>(dfSel.sql, dfSel.params);
        if (dfRow?.frozen) return NextResponse.json({ error: "Note is locked", frozen: true }, { status: 423 });
        const { sql, params } = withUser(`DELETE FROM "${table}" WHERE id = $1`, [noteId], userId);
        await execute(sql, params);
        try { await getPusher().trigger("stickies", "note-deleted", { id: noteId }); } catch (e) { console.error("[stickies] broadcast note-deleted", e); }
        return NextResponse.json({ ok: true, deleted_note: noteId });
    }

    if (!folderName) return NextResponse.json({ error: "id or folder_name is required" }, { status: 400 });

    // Guard: never delete a folder that still holds notes — deleting the folder row
    // by name also wipes every note under it. TRASH is exempt (its whole purpose is
    // to empty the notes inside). Move or delete the notes first, then the folder.
    if (folderName !== "TRASH") {
        const guard = withUser(
            `SELECT COUNT(*)::int AS n FROM "${table}" WHERE folder_name = $1 AND is_folder = false AND trashed_at IS NULL`,
            [folderName],
            userId
        );
        const cnt = (await queryOne<{ n: number }>(guard.sql, guard.params))?.n ?? 0;
        if (cnt > 0) {
            return NextResponse.json({
                error: `Folder "${folderName}" still has ${cnt} note${cnt === 1 ? "" : "s"}. Move or delete them first.`,
                code: "folder_not_empty",
                note_count: cnt,
            }, { status: 409 });
        }
    }

    // For TRASH: only delete notes inside, never the folder row itself
    const deleteQuery = folderName === "TRASH"
        ? withUser(`DELETE FROM "${table}" WHERE folder_name = $1 AND is_folder = false`, [folderName], userId)
        : withUser(`DELETE FROM "${table}" WHERE folder_name = $1`, [folderName], userId);
    await execute(deleteQuery.sql, deleteQuery.params);
    try { await getPusher().trigger("stickies", "note-deleted", { folder_name: folderName }); } catch (e) { console.error("[stickies] broadcast folder note-deleted", e); }
    return NextResponse.json({ ok: true, deleted_folder: folderName });
}

// ── Note type detection ──────────────────────────────────────────────────────
const VALID_TYPES = new Set(["text","html","json","javascript","typescript","python","css","sql","bash","checklist"]);

export function detectType(content: string, title?: string): string {
    const t = content.trim();
    if (!t) return "text";

    if ((t.startsWith("{") || t.startsWith("[")) && (() => { try { JSON.parse(t); return true; } catch { return false; } })()) return "json";
    if (title) {
        const ext = title.split(".").pop()?.toLowerCase() ?? "";
        if (ext === "js")   return "javascript";
        if (ext === "ts")   return "typescript";
        if (ext === "py")   return "python";
        if (ext === "css")  return "css";
        if (ext === "sql")  return "sql";
        if (ext === "sh" || ext === "bash") return "bash";
        if (ext === "html" || ext === "htm")    return "html";
        if (ext === "json") return "json";
    }
    if (/^\s*<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t)) return "html";
    if (/^\s*\[[ xX]?\]/m.test(t)) return "checklist";

    return "text";
}

// ── PATCH ───────────────────────────────────────────────────────────────────
export async function PATCH(req: Request) {
    const blocked = blockExternalKey(req);
    if (blocked) return blocked;
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = "stickies";
    const userId = auth.userId;

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    broadcastRequest(req, auth, { summary: (body as any)?.rename_note?.title ?? (body as any)?.rename_folder?.from ?? (body as any)?.id ?? undefined });

    const now = new Date().toISOString();

    if (body.pinned_folders !== undefined) {
        const folders = Array.isArray(body.pinned_folders) ? body.pinned_folders.map(String) : [];
        try { await execute(`CREATE TABLE IF NOT EXISTS user_preferences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL UNIQUE, pinned_folders TEXT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`); } catch (e) { console.error("[stickies] ensure user_preferences table", e); }
        await execute(
            `INSERT INTO user_preferences (user_id, pinned_folders, updated_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET pinned_folders = $2, updated_at = $3`,
            [userId, folders, now]
        );
        return NextResponse.json({ ok: true, pinned_folders: folders });
    }

    if (body.rename_note) {
        const { id, title } = body.rename_note as { id: string; title: string };
        if (!id?.trim() || !title?.trim()) return NextResponse.json({ error: "rename_note requires id and title" }, { status: 400 });
        await ensureLockedColumn();
        const rnSel = withUser(`SELECT frozen FROM "${table}" WHERE id = $1`, [id.trim()], userId);
        const rnFrozen = await queryOne<{ frozen: boolean }>(rnSel.sql, rnSel.params);
        if (rnFrozen?.frozen) return NextResponse.json({ error: "Note is locked", frozen: true }, { status: 423 });
        const { sql, params } = withUser(
            `UPDATE "${table}" SET title = $1, updated_at = $2 WHERE id = $3`,
            [title.trim(), now, id.trim()],
            userId
        );
        const data = await queryOne(`${sql} RETURNING *`, params);
        return NextResponse.json({ ok: true, note: data });
    }

    if (body.rename_folder) {
        const { from, to } = body.rename_folder as { from: string; to: string };
        if (!from?.trim() || !to?.trim()) return NextResponse.json({ error: "rename_folder requires from and to" }, { status: 400 });
        const toTrimmed = to.trim();
        if (isReservedFolderName(toTrimmed)) return NextResponse.json({ error: "\"Today\"/\"Yesterday\" are reserved virtual views" }, { status: 400 });
        const { sql: sql1, params: params1 } = withUser(
            `UPDATE "${table}" SET folder_name = $1, title = $2, updated_at = $3 WHERE is_folder = true AND folder_name = $4`,
            [toTrimmed, toTrimmed, now, from.trim()],
            userId
        );
        await execute(sql1, params1);
        const { sql: sql2, params: params2 } = withUser(
            `UPDATE "${table}" SET folder_name = $1, updated_at = $2 WHERE is_folder = false AND folder_name = $3`,
            [toTrimmed, now, from.trim()],
            userId
        );
        await execute(sql2, params2);
        return NextResponse.json({ ok: true, renamed: { from, to: toTrimmed } });
    }

    if (body.merge_folder) {
        const { from, to } = body.merge_folder as { from: string; to: string };
        if (!from?.trim() || !to?.trim()) return NextResponse.json({ error: "merge_folder requires from and to" }, { status: 400 });
        if (isReservedFolderName(to.trim())) return NextResponse.json({ error: "\"Today\"/\"Yesterday\" are reserved virtual views" }, { status: 400 });
        const { sql: sql1, params: params1 } = withUser(
            `UPDATE "${table}" SET folder_name = $1, updated_at = $2 WHERE is_folder = false AND folder_name = $3`,
            [to.trim(), now, from.trim()],
            userId
        );
        const movedRows = await query<{ id: string }>(`${sql1} RETURNING id`, params1);
        const { sql: sql2, params: params2 } = withUser(
            `DELETE FROM "${table}" WHERE is_folder = true AND folder_name = $1`,
            [from.trim()],
            userId
        );
        await execute(sql2, params2);
        return NextResponse.json({ ok: true, merged: { from, to: to.trim(), moved: movedRows.length } });
    }

    if (Array.isArray(body.updates)) {
        const updates = body.updates as Array<{ id: string; [key: string]: unknown }>;
        await ensureLockedColumn();
        // Skip any frozen (locked) rows in batch updates — never silently overwrite them.
        const ids = updates.map(u => u.id).filter(Boolean);
        const lockedIds = new Set<string>();
        if (ids.length) {
            const ph = ids.map((_, i) => `$${i + 1}`).join(",");
            const lk = withUser(`SELECT id FROM "${table}" WHERE id IN (${ph}) AND frozen = true`, ids, userId);
            const rows = await query<{ id: string }>(lk.sql, lk.params);
            for (const r of rows) lockedIds.add(String(r.id));
        }
        await Promise.all(updates.filter(u => !lockedIds.has(String(u.id))).map(({ id, ...fields }) => {
            // Whitelist keys exactly like the single-update path (line ~1315): the
            // raw JSON keys are interpolated as SQL identifiers, so an un-filtered
            // key is both a mass-assignment (user_id / created_by_key / lock_*) and
            // a SQL-injection vector via a `"`-bearing key.
            const filteredFields = Object.fromEntries(Object.entries(fields).filter(([k]) => PATCH_ALLOWED_COLS.has(k)));
            const setEntries = Object.entries({ ...filteredFields, updated_at: now });
            const setClauses = setEntries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
            const setVals: unknown[] = setEntries.map(([, v]) => v);
            setVals.push(id);
            const { sql, params } = withUser(
                `UPDATE "${table}" SET ${setClauses} WHERE id = $${setVals.length}`,
                setVals,
                userId
            );
            return execute(sql, params);
        }));
        return NextResponse.json({ ok: true, locked_skipped: [...lockedIds] });
    }

    const { id, ...fields } = body;
    if (!id || typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Sharing / visibility is OWNER-only (browser session). An external API key - even
    // a leaked one - must never expose a private note (flip is_public / release the
    // lock) or rewrite its passcode. Strip those fields from any external-key PATCH.
    if (auth.type === "external") {
        for (const k of ["is_public", "locked", "lock_password", "lock_password_hash"]) delete (fields as Record<string, unknown>)[k];
    }

    await ensureLockedColumn();
    const frozenSel = withUser(`SELECT frozen FROM "${table}" WHERE id = $1`, [id], userId);
    const frozenRow = await queryOne<{ frozen: boolean }>(frozenSel.sql, frozenSel.params);
    // A locked (frozen) note can't be modified — the ONLY change honored is releasing
    // the lock itself (frozen:false). Everything else (title/content/color/folder/
    // sharing) is rejected so an accidental autosave can't bypass the write-protect.
    // NOTE: this is independent of Private share (`locked` + passcode) — a shared
    // Private note stays fully editable unless it is also locked.
    if (frozenRow?.frozen) {
        // Write-protect blocks CONTENT edits, not sharing controls: a frozen note must
        // still be publishable and passcode-gateable. Allow the share-visibility fields
        // (is_public, locked, lock_password) alongside releasing the freeze itself;
        // anything else (title/content/color/folder) stays rejected.
        const FROZEN_ALLOWED = new Set(["frozen", "is_public", "locked", "lock_password"]);
        const fieldKeys = Object.keys(fields);
        if (!fieldKeys.every(k => FROZEN_ALLOWED.has(k))) {
            return NextResponse.json({ error: "Note is locked", frozen: true }, { status: 423 });
        }
    }

    // Translate plaintext `lock_password` into a hash before persisting; the
    // raw column `lock_password_hash` is server-managed and not client-writable.
    // Unlocking (`locked:false`) clears the hash so a subsequent re-lock starts
    // fresh — no stale password lingering after an unlock.
    if (typeof fields.lock_password === "string") {
        const { hashLockPassword } = await import("@/lib/lock-password");
        const plain = (fields.lock_password as string).trim();
        (fields as any).lock_password_hash = plain ? await hashLockPassword(plain) : null;
        delete (fields as any).lock_password;
    }
    if (fields.locked === false) {
        (fields as any).lock_password_hash = null;
    }

    const filteredFields = Object.fromEntries(Object.entries(fields).filter(([k]) => PATCH_ALLOWED_COLS.has(k)));
    const setEntries = Object.entries({ ...filteredFields, updated_at: now });
    if (setEntries.length === 0) return NextResponse.json({ note: { id } });

    const setClauses = setEntries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
    // JSONB columns (`doc`) must be stringified before binding so node-pg serializes them
    // correctly; objects passed raw stringify to "[object Object]" and break the JSONB cast.
    const vals: unknown[] = setEntries.map(([k, v]) => (k === "doc" && v !== null && typeof v === "object" ? JSON.stringify(v) : v));
    vals.push(id);
    const { sql, params } = withUser(
        `UPDATE "${table}" SET ${setClauses} WHERE id = $${vals.length}`,
        vals,
        userId
    );

    let data: Record<string, unknown> | null;
    try {
        data = await queryOne(`${sql} RETURNING *`, params);
    } catch (err: any) {
        console.error("[PATCH] DB error:", err.message, "| SQL:", sql, "| vals:", vals);
        return NextResponse.json({ error: err.message ?? "db error" }, { status: 500 });
    }

    // data can be null when the Management API returns empty rows even though
    // the UPDATE executed successfully — treat as success so the client doesn't
    // show a false "Save Failed" toast.
    try { await getPusher().trigger("stickies", "note-updated", livePayload(data ?? { id })); } catch (e) { console.error("[stickies] broadcast note-updated", e); }
    return NextResponse.json({ note: data ?? { id } });
}
