import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Pusher from "pusher";
import crypto from "crypto";
import { query, queryOne, execute } from "@/lib/db-driver";

// ── External ideas integration ────────────────────────────────────────────────
const IDEAS_PALETTE = [
    "#FF3B30","#FF6B4E","#FF9500","#FFCC00","#D4E157","#34C759",
    "#00C7BE","#32ADE6","#007AFF","#5856D6","#AF52DE","#FF2D55",
];
function randomIdeaColor(): string {
    return IDEAS_PALETTE[Math.floor(Math.random() * IDEAS_PALETTE.length)];
}

function mindmapNodesToJSON(name: string, nodes: any[]): string {
    if (!Array.isArray(nodes) || nodes.length === 0) return JSON.stringify({ [name]: [] }, null, 2);
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    const childrenMap = new Map<string, any[]>();
    for (const n of nodes) {
        if (n.parentId && nodeIds.has(n.parentId)) {
            if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
            childrenMap.get(n.parentId)!.push(n);
        }
    }
    for (const list of childrenMap.values()) list.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const roots = nodes
        .filter((n: any) => !n.parentId || !nodeIds.has(n.parentId))
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const categories: any[] = [];
    for (const root of roots) {
        for (const cat of childrenMap.get(root.id) ?? []) {
            const leaves = (childrenMap.get(cat.id) ?? []).map((c: any) => (c.title ?? "").trim()).filter(Boolean);
            const obj: any = { [(cat.title ?? "").trim()]: leaves };
            if (cat.emoji) obj.emoji = cat.emoji;
            categories.push(obj);
        }
    }
    return JSON.stringify({ [name]: categories }, null, 2);
}

async function fetchExternalIdeas(req: Request, folderName: string): Promise<Record<string, unknown>[]> {
    const ref   = process.env.BHENG_SUPABASE_PROJECT_REF;
    const token = process.env.BHENG_SUPABASE_MANAGEMENT_TOKEN;
    if (!ref || !token) return [];
    try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query: "SELECT id, name, type, nodes, created_at, updated_at FROM mindmaps ORDER BY updated_at DESC" }),
        });
        if (!res.ok) return [];
        const rows: any[] = await res.json();
        if (!Array.isArray(rows)) return [];
        const host = req.headers.get("host") ?? "";
        const isLocal = host.startsWith("localhost") || host.startsWith("10.") || host.startsWith("192.168.");
        const baseUrl = isLocal ? "http://10.0.0.138:5173" : "https://ideas-bheng.vercel.app";
        return rows.map((idea) => {
            const mapUrl = `${baseUrl}/?map=${idea.id}`;
            return {
                id: `ext_idea_${idea.id}`,
                title: idea.name,
                content: mindmapNodesToJSON(idea.name, idea.nodes),
                folder_name: folderName,
                folder_color: randomIdeaColor(),
                is_folder: false,
                type: "json",
                _external: true,
                _mapUrl: mapUrl,
                created_at: idea.created_at,
                updated_at: idea.updated_at,
            };
        });
    } catch { return []; }
}

async function fetchDiagrams(req: Request): Promise<Record<string, unknown>[]> {
    try {
        const { createClient: createSb } = await import("@supabase/supabase-js");
        const sb = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data, error } = await sb
            .from("diagrams")
            .select("id, title, slug, diagram_type, code, created_at, updated_at")
            .order("updated_at", { ascending: false });
        if (error || !data) return [];
        const host = req.headers.get("host") ?? "";
        const isLocal = host.startsWith("localhost") || host.startsWith("10.") || host.startsWith("192.168.");
        const baseUrl = isLocal ? "http://10.0.0.138:3002" : "https://mermaid-bheng.vercel.app";
        return data.map((d: any, i: number) => {
            const galleryUrl = `${baseUrl}/?id=${d.id}&view=1`;
            return {
                id: `ext_diagram_${d.id}`,
                title: d.title || d.slug || "Untitled Diagram",
                content: d.code ?? "",
                folder_name: "diagrams",
                folder_color: palette12[i % palette12.length],
                is_folder: false,
                type: "mermaid",
                _external: true,
                _mapUrl: galleryUrl,
                created_at: d.created_at,
                updated_at: d.updated_at,
            };
        });
    } catch { return []; }
}

const palette12 = [
    "#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00",
    "#D4E157", "#34C759", "#00C7BE", "#32ADE6",
    "#007AFF", "#5856D6", "#AF52DE", "#FF2D55",
];

// ── Singletons ───────────────────────────────────────────────────────────────
let _supabaseAuth: ReturnType<typeof createClient> | null = null;
function getSupabaseAuth() {
    if (!_supabaseAuth) {
        _supabaseAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return _supabaseAuth;
}

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
function triggerHue(color: string) {
    // VERCEL_PROJECT_PRODUCTION_URL is auto-set by Vercel to the stable prod domain
    // Fall back to NEXT_PUBLIC_APP_BASE_URL for local dev
    const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : (process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:4444").replace(/\/$/, "");
    fetch(`${base}/api/hue/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
    }).catch(() => {});
}

// ── Auth ────────────────────────────────────────────────────────────────────
// "external" = static API key (AI / scripts / curl) → ONLY via /api/stickies/ext
// "owner"    = browser JWT for the owner account → /api/stickies (browser only)
// "user"     = browser JWT for other users → scoped by user_id in stickies table
type AuthResult = { type: "external" | "owner" | "user"; userId: string };

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
    // Dev bypass: in development, always authenticate as owner — no login needed locally
    if (process.env.NODE_ENV === "development") {
        return { type: "owner", userId: process.env.OWNER_USER_ID?.trim() ?? "" };
    }

    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return null;

    // Static API key → external caller (AI, scripts, automations)
    const apiKey = process.env.STICKIES_API_KEY;
    if (apiKey) {
        const expected = `Bearer ${apiKey}`;
        if (auth.length === expected.length) {
            try {
                if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
                    return { type: "external", userId: process.env.OWNER_USER_ID?.trim() ?? "" };
                }
            } catch {}
        }
    }

    // Supabase JWT → verify via auth service (not database)
    const { data: { user } } = await getSupabaseAuth().auth.getUser(bearer);
    if (user) {
        const ownerUserId = process.env.OWNER_USER_ID?.trim();
        const ownerEmail  = process.env.OWNER_EMAIL?.trim();
        const isOwner =
            (ownerUserId && user.id === ownerUserId) ||
            (ownerEmail  && user.email?.toLowerCase() === ownerEmail.toLowerCase());
        if (isOwner) return { type: "owner", userId: user.id };
        return { type: "user", userId: user.id };
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
]);

// ── Allowed columns for PATCH updates ────────────────────────────────────────
const PATCH_ALLOWED_COLS = new Set([
    "title", "content", "folder_name", "folder_color", "is_folder", "type",
    "order", "updated_at", "parent_folder_name", "folder_id", "list_mode", "tags",
]);

// ── Color helpers ────────────────────────────────────────────────────────────
async function pickLeastUsedColor(userId: string, rawColor?: string): Promise<string> {
    const c = String(rawColor ?? "").trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(c)) return c;

    const rows = await query<{ folder_color: string }>(`SELECT folder_color FROM "stickies" WHERE is_folder = false AND user_id = $1 LIMIT 500`, [userId]);
    const counts = new Map<string, number>(palette12.map((p) => [p, 0]));
    rows.forEach((r) => {
        const col = String(r.folder_color ?? "").toUpperCase();
        if (counts.has(col)) counts.set(col, (counts.get(col) ?? 0) + 1);
    });
    return palette12.reduce((a, b) => (counts.get(b)! < counts.get(a)! ? b : a), palette12[0]);
}

async function pickLeastUsedFolderColor(userId: string, rawColor?: string): Promise<string> {
    const c = String(rawColor ?? "").trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(c)) return c;

    const rows = await query<{ folder_color: string }>(`SELECT folder_color FROM "stickies" WHERE is_folder = true AND user_id = $1 LIMIT 500`, [userId]);
    const counts = new Map<string, number>(palette12.map((p) => [p, 0]));
    rows.forEach((r) => {
        const col = String(r.folder_color ?? "").toUpperCase();
        if (counts.has(col)) counts.set(col, (counts.get(col) ?? 0) + 1);
    });
    return palette12.reduce((a, b) => (counts.get(b)! < counts.get(a)! ? b : a), palette12[0]);
}

async function getNextOrder(userId: string, isFolderOnly = false): Promise<number> {
    const whereClause = isFolderOnly ? "WHERE is_folder = true AND user_id = $1" : "WHERE is_folder = false AND user_id = $1";
    const row = await queryOne<{ order: number }>(`SELECT "order" FROM "stickies" ${whereClause} ORDER BY "order" DESC LIMIT 1`, [userId]);
    return typeof row?.order === "number" ? row.order + 1 : 0;
}

// ── Folder path resolver ─────────────────────────────────────────────────────
async function resolveFolderPath(raw: string, userId: string): Promise<{ folder_name: string; folder_id: string | null }> {
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { folder_name: raw.trim() || "CLAUDE", folder_id: null };

    const folders = await query<{ id: string; folder_name: string; parent_folder_name: string | null }>(
        `SELECT id::text, folder_name, parent_folder_name FROM "stickies" WHERE is_folder = true AND user_id = $1`,
        [userId]
    );

    let parentName: string | null = null;
    let resolved: { id: string; folder_name: string } | null = null;

    for (const segment of parts) {
        const match = folders.find((f) =>
            f.folder_name.toLowerCase() === segment.toLowerCase() &&
            (parentName === null
                ? !f.parent_folder_name
                : f.parent_folder_name?.toLowerCase() === parentName.toLowerCase())
        );
        if (!match) return { folder_name: parts[parts.length - 1], folder_id: null };
        resolved = { id: String(match.id), folder_name: match.folder_name };
        parentName = match.folder_name;
    }

    return resolved
        ? { folder_name: resolved.folder_name, folder_id: resolved.id }
        : { folder_name: parts[parts.length - 1], folder_id: null };
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    const blocked = blockExternalKey(req);
    if (blocked) return blocked;
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = "stickies";
    const userId = auth.userId;
    const url = new URL(req.url);
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
            `SELECT id, folder_name, folder_color, parent_folder_name, "order", updated_at FROM "${table}" WHERE is_folder = true`,
            [],
            userId
        );
        const rows = await query(`${sql} ORDER BY "order" ASC LIMIT 2000`, params);
        return NextResponse.json({ folders: rows });
    }

    if (url.searchParams.get("counts") === "1") {
        const rows = await query<{ folder_name: string; folder_id: string | null; cnt: string }>(
            `SELECT folder_name, folder_id::text AS folder_id, COUNT(*) AS cnt FROM "stickies" WHERE is_folder = false AND user_id = $1 GROUP BY folder_name, folder_id`,
            [userId]
        );
        const byName: Record<string, number> = {};
        const byId: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
            const n = Number(row.cnt ?? 0);
            if (row.folder_name) byName[row.folder_name] = (byName[row.folder_name] || 0) + n;
            if (row.folder_id) byId[String(row.folder_id)] = (byId[String(row.folder_id)] || 0) + n;
            total += n;
        }

        // Add external source counts so folder tiles show the right number
        try {
            const [ideasRows, diagramsCount] = await Promise.all([
                // mindmaps: use same fetch path as folder load (reuses proven Management API call)
                fetchExternalIdeas(req, "mindmaps"),
                // diagrams: count rows in stickies diagrams table
                (async () => {
                    const { createClient: createSb } = await import("@supabase/supabase-js");
                    const sb = createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
                    const { count } = await sb.from("diagrams").select("*", { count: "exact", head: true });
                    return count ?? 0;
                })(),
            ]);
            const ideasCount = ideasRows.length;
            if (ideasCount > 0) { byName["mindmaps"] = (byName["mindmaps"] || 0) + ideasCount; total += ideasCount; }
            if (diagramsCount > 0) { byName["diagrams"] = (byName["diagrams"] || 0) + diagramsCount; total += diagramsCount; }
        } catch { /* non-fatal — counts just won't include externals */ }

        return NextResponse.json({ counts: byName, countsByFolderId: byId, total });
    }

    if (folderFilter) {
        const FOLDER_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder`;
        const limitParam = parseInt(url.searchParams.get("limit") ?? "0");
        const offsetParam = parseInt(url.searchParams.get("offset") ?? "0");
        const sinceParam = url.searchParams.get("since"); // ISO timestamp — delta sync

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
        let allNotes: unknown[] = cleanRows;
        if (folderFilter.toLowerCase() === "mindmaps" && offsetParam === 0) {
            const external = await fetchExternalIdeas(req, folderFilter);
            allNotes = [...cleanRows, ...external];
        }
        if (folderFilter.toLowerCase() === "diagrams" && offsetParam === 0) {
            const diagrams = await fetchDiagrams(req);
            allNotes = [...cleanRows, ...diagrams];
        }
        return NextResponse.json({ notes: allNotes, total: total + (allNotes.length - cleanRows.length), syncedAt: new Date().toISOString() });
    }

    if (q) {
        const SEARCH_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder`;
        const { sql, params } = withUser(
            `SELECT ${SEARCH_COLS} FROM "${table}" WHERE is_folder = false AND (title ILIKE $1 OR content ILIKE $1)`,
            [`%${q}%`],
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
        const rows = await query(`${sql} ORDER BY updated_at DESC LIMIT 10000`, params);
        return NextResponse.json({ notes: rows, total: rows.length });
    }

    const LIST_COLS = `id, title, folder_name, folder_color, folder_id, parent_folder_name, "order", updated_at, created_at, type, is_folder`;
    const { sql, params } = withUser(
        `SELECT ${LIST_COLS} FROM "${table}" WHERE is_folder = false`,
        [],
        userId
    );
    const rows = await query(`${sql} ORDER BY "order" ASC LIMIT 10000`, params);
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

        for (const item of items) {
            const type = String(item.type ?? "note");
            if (item.__error) { results.push({ type, data: null, error: String(item.__error) }); continue; }
            try {
                if (type === "folder") {
                    const name = String(item.name ?? "").trim();
                    if (!name) { results.push({ type: "folder", data: null, error: "name required" }); continue; }
                    const folder_color = pickColor(item.color as string);
                    const parent_folder_name = String(item.parent_folder ?? "").trim() || null;
                    const row = await queryOne(
                        `INSERT INTO "stickies" (is_folder, folder_name, title, content, folder_color, parent_folder_name, "order", created_at, updated_at, user_id)
                         VALUES (true, $1, $2, '', $3, $4, $5, $6, $7, $8) RETURNING *`,
                        [name, name, folder_color, parent_folder_name, nextOrder++, now, now, userId]
                    );
                    results.push({ type: "folder", data: row as Record<string, unknown> });
                } else {
                    const title = String(item.title ?? "").trim();
                    if (!title) { results.push({ type: "note", data: null, error: "title required" }); continue; }
                    const content = String(item.content ?? "").trim();
                    if (!content) { results.push({ type: "note", data: null, error: "content required" }); continue; }
                    const folder_name = "folder" in item
                        ? (String(item.folder ?? "").trim() || (() => { throw new Error("folder cannot be empty"); })())
                        : "CLAUDE";
                    const batchType = (typeof item.type === "string" && VALID_TYPES.has(item.type)) ? item.type : detectType(content, title);
                    const folder_color = pickColor(item.color as string);
                    const row = await queryOne(
                        `INSERT INTO "stickies" (is_folder, title, content, folder_name, type, folder_color, "order", created_at, updated_at, user_id)
                         VALUES (false, $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                        [title, content, folder_name, batchType, folder_color, nextOrder++, now, now, userId]
                    );
                    results.push({ type: "note", data: row as Record<string, unknown> });
                }
            } catch (err: any) {
                results.push({ type, data: null, error: err?.message ?? "unknown error" });
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

        const rawColor = String(url.searchParams.get("color") || (bodyForFolderCheck?.color as string) || "").trim();
        const parentFolder = String(url.searchParams.get("parent") || (bodyForFolderCheck?.parent_folder as string) || "").trim() || null;
        const folder_color = await pickLeastUsedFolderColor(userId, rawColor);
        const nextOrder = await getNextOrder(userId, true);
        const now = new Date().toISOString();

        const data = await queryOne(
            `INSERT INTO "stickies" (is_folder, folder_name, title, content, folder_color, parent_folder_name, "order", created_at, updated_at, user_id)
             VALUES (true, $1, $2, '', $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, name, folder_color, parentFolder, nextOrder, now, now, userId]
        );

        if (!data) { return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        try { await getPusher().trigger("stickies", "note-created", data); } catch {}
        return NextResponse.json({ folder: data }, { status: 201 });
    }

    // ── Raw insert ──
    if (url.searchParams.get("raw") === "1") {
        let payload: Record<string, unknown>;
        try { payload = bodyForFolderCheck ?? await req.json(); }
        catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
        const now = new Date().toISOString();
        const insertPayload = { ...payload, updated_at: now, created_at: payload.created_at ?? now, user_id: userId };
        // Fix #2: whitelist allowed columns — reject arbitrary user-supplied column names
        const filteredPayload = Object.fromEntries(
            Object.entries(insertPayload).filter(([k]) => RAW_INSERT_ALLOWED_COLS.has(k) || k === "user_id")
        );
        if (Object.keys(filteredPayload).length === 0) {
            return NextResponse.json({ error: "No valid columns provided" }, { status: 400 });
        }
        const cols = Object.keys(filteredPayload).map((k) => `"${k}"`).join(", ");
        const vals = Object.values(filteredPayload);
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        const data = await queryOne(
            `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
            vals
        );
        if (!data) { return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        try { await getPusher().trigger("stickies", "note-created", data); } catch {}
        return NextResponse.json({ note: data }, { status: 201 });
    }

    // ── Single note (JSON or Markdown) ──
    const contentType = req.headers.get("content-type") ?? "";
    const isMarkdown = /text\/(plain|markdown|x-markdown)/i.test(contentType);

    let title = "", content = "", folder_name: string | null = null, rawColor = "", parentFolderHint: string | null = null, explicitType: string | null = null;

    if (isMarkdown) {
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
    }

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    if (folder_name !== null && !folder_name?.trim()) return NextResponse.json({ error: "folder cannot be empty" }, { status: 400 });
    if (!folder_name?.trim()) folder_name = "CLAUDE";

    // ── Non-browser API calls: enforce CLAUDE as parent for unknown simple folders ──
    const isExternalCall = !/mozilla/i.test(req.headers.get("user-agent") ?? "");
    if (isExternalCall && !folder_name!.includes("/")) {
        const rootFolders = await query<{ folder_name: string }>(
            `SELECT folder_name FROM "stickies" WHERE is_folder = true AND parent_folder_name IS NULL AND user_id = $1`,
            [userId]
        );
        const rootNames = rootFolders.map((f) => f.folder_name.toLowerCase());
        if (!rootNames.includes(folder_name!.toLowerCase())) {
            folder_name = `CLAUDE/${folder_name}`;
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
            const match = allFolders.find((f) =>
                f.folder_name.toLowerCase() === segment.toLowerCase() &&
                (parentName === null ? !f.parent_folder_name : f.parent_folder_name?.toLowerCase() === parentName.toLowerCase())
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
                    try { await getPusher().trigger("stickies", "note-created", newFolder); } catch {}
                    allFolders.push({ id: String((newFolder as any).id), folder_name: segment, parent_folder_name: parentName });
                    parentName = segment;
                    parentId = String((newFolder as any).id);
                } else {
                    parentName = segment;
                }
            }
        }
        resolved_folder_name = folderPathParts[folderPathParts.length - 1];
        resolved_folder_id = parentId;
    } else {
        // Simple folder — look up existing
        const folderRows = await query<{ id: string; folder_name: string; parent_folder_name: string | null }>(
            `SELECT id::text, folder_name, parent_folder_name FROM "stickies" WHERE is_folder = true AND folder_name = $1 AND user_id = $2`,
            [folder_name!, userId]
        );
        if (folderRows.length > 0) {
            const match = parentFolderHint
                ? folderRows.find((r) => r.parent_folder_name?.toLowerCase() === parentFolderHint!.toLowerCase())
                : folderRows[0];
            if (match) resolved_folder_id = String(match.id);
        }
        resolved_folder_name = folder_name!;
    }

    const folder_color = await pickLeastUsedColor(userId, rawColor);
    const now = new Date().toISOString();

    // Upsert: check if note with same title exists in this folder
    // Fix #1: userId as parameterized $N, not string-interpolated
    const { sql: upsertSql, params: upsertParams } = withUser(
        `SELECT id::text AS id FROM "${table}" WHERE is_folder = false AND folder_name = $1 AND title = $2`,
        [resolved_folder_name, title],
        userId
    );
    const existingNote = await queryOne<{ id: string }>(`${upsertSql} LIMIT 1`, upsertParams);

    const noteType = explicitType ?? detectType(content, title);
    let data: Record<string, unknown> | null;

    if (existingNote?.id) {
        data = await queryOne(
            `UPDATE "stickies" SET content = $1, folder_color = $2, type = $3, updated_at = $4 WHERE id = $5 RETURNING *`,
            [content, folder_color, noteType, now, existingNote.id]
        );
    } else {
        const nextOrder = await getNextOrder(userId, false);
        const folderIdClause = resolved_folder_id ? `, folder_id` : "";
        const folderIdVal = resolved_folder_id ? `, $10` : "";
        const extraParams: unknown[] = resolved_folder_id ? [resolved_folder_id] : [];

        data = await queryOne(
            `INSERT INTO "stickies" (title, content, folder_name, folder_color, is_folder, type, "order", created_at, updated_at, user_id${folderIdClause})
             VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8, $9${folderIdVal}) RETURNING *`,
            [title, content, resolved_folder_name, folder_color, noteType, nextOrder, now, now, userId, ...extraParams]
        );
    }

    if (!data) { return NextResponse.json({ error: "Database error" }, { status: 500 }); }

    try { await getPusher().trigger("stickies", existingNote?.id ? "note-updated" : "note-created", data); } catch {}
    if (auth.type === "external") {
        triggerHue(folder_color);
    }

    return NextResponse.json({ note: data, action: existingNote?.id ? "updated" : "created" }, { status: 201 });
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
    const blocked = blockExternalKey(req);
    if (blocked) return blocked;
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    broadcastRequest(req, auth);

    const table = "stickies";
    const userId = auth.userId;
    const url = new URL(req.url);
    const noteId = url.searchParams.get("id")?.trim();
    const folderName = url.searchParams.get("folder_name")?.trim();

    if (noteId) {
        const { sql, params } = withUser(`DELETE FROM "${table}" WHERE id = $1`, [noteId], userId);
        await execute(sql, params);
        try { await getPusher().trigger("stickies", "note-deleted", { id: noteId }); } catch {}
        return NextResponse.json({ ok: true, deleted_note: noteId });
    }

    if (!folderName) return NextResponse.json({ error: "id or folder_name is required" }, { status: 400 });

    const { sql, params } = withUser(`DELETE FROM "${table}" WHERE folder_name = $1`, [folderName], userId);
    await execute(sql, params);
    try { await getPusher().trigger("stickies", "note-deleted", { folder_name: folderName }); } catch {}
    return NextResponse.json({ ok: true, deleted_folder: folderName });
}

// ── Note type detection ──────────────────────────────────────────────────────
const VALID_TYPES = new Set(["text","markdown","html","json","mermaid","javascript","typescript","python","css","sql","bash","voice","checklist","rich"]);

export function detectType(content: string, title?: string): string {
    const t = content.trim();
    if (!t) return "text";

    if (t.startsWith('{"_type":"voice"')) {
        try { if (JSON.parse(t)?._type === "voice") return "voice"; } catch {}
    }
    if (/^```(?:mermaid)?\s*\n[\s\S]*?```\s*$/im.test(t)) return "mermaid";
    if (/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im.test(t)) return "mermaid";
    if ((t.startsWith("{") || t.startsWith("[")) && (() => { try { JSON.parse(t); return true; } catch { return false; } })()) return "json";
    if (title) {
        const ext = title.split(".").pop()?.toLowerCase() ?? "";
        if (ext === "js")   return "javascript";
        if (ext === "ts")   return "typescript";
        if (ext === "py")   return "python";
        if (ext === "css")  return "css";
        if (ext === "sql")  return "sql";
        if (ext === "sh" || ext === "bash") return "bash";
        if (ext === "md" || ext === "markdown") return "markdown";
        if (ext === "html" || ext === "htm")    return "html";
        if (ext === "json") return "json";
        if (ext === "mermaid" || ext === "mmd") return "mermaid";
    }
    if (/^\s*<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t)) return "html";
    if (/^\s*\[[ xX]?\]/m.test(t)) return "checklist";
    if (/^#{1,6}\s|^[-*]\s|\*\*|^>\s|^```/m.test(t)) return "markdown";

    return "text";
}

function htmlToPlainLines(html: string): string {
    if (!/<[a-z][^>]*>/i.test(html)) return html;
    return html
        .replace(/<br\s*\/?>/gi, "\n").replace(/<\/li>/gi, "\n").replace(/<li[^>]*>/gi, "")
        .replace(/<\/?(p|div|tr|dt|dd|h[1-6])[^>]*>/gi, "\n").replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n").trim();
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

    if (body.rename_note) {
        const { id, title } = body.rename_note as { id: string; title: string };
        if (!id?.trim() || !title?.trim()) return NextResponse.json({ error: "rename_note requires id and title" }, { status: 400 });
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

    if (body.fix_html_content) {
        const { sql, params } = withUser(
            `SELECT id::text AS id, content FROM "${table}" WHERE is_folder = false AND folder_name = 'TEAM'`,
            [],
            userId
        );
        const allNotes = await query<{ id: string; content: string }>(sql, params);
        const toFix = allNotes.filter((n) => /<[a-z][^>]*>/i.test(n.content || "") && !/<!DOCTYPE\s+html/i.test(n.content || ""));
        if (toFix.length === 0) return NextResponse.json({ ok: true, fixed: 0 });
        await Promise.all(toFix.map((n) =>
            execute(`UPDATE "${table}" SET content = $1, updated_at = $2 WHERE id = $3`, [htmlToPlainLines(n.content), now, n.id])
        ));
        return NextResponse.json({ ok: true, fixed: toFix.length });
    }

    if (body.fix_team_checklist) {
        const { sql, params } = withUser(
            `SELECT id::text AS id, content, list_mode FROM "${table}" WHERE is_folder = false AND folder_name = 'TEAM'`,
            [],
            userId
        );
        const teamNotes = await query<{ id: string; content: string; list_mode: boolean }>(sql, params);
        const toFix = teamNotes.filter((n) => !n.list_mode);
        if (toFix.length === 0) return NextResponse.json({ ok: true, fixed: 0 });
        await Promise.all(toFix.map((n) => {
            const cleanContent = /<[a-z][^>]*>/i.test(n.content || "") ? htmlToPlainLines(n.content) : n.content;
            return execute(`UPDATE "${table}" SET list_mode = true, content = $1, updated_at = $2 WHERE id = $3`, [cleanContent, now, n.id]);
        }));
        return NextResponse.json({ ok: true, fixed: toFix.length });
    }

    if (Array.isArray(body.updates)) {
        const updates = body.updates as Array<{ id: string; [key: string]: unknown }>;
        await Promise.all(updates.map(({ id, ...fields }) => {
            const setEntries = Object.entries({ ...fields, updated_at: now });
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
        return NextResponse.json({ ok: true });
    }

    const { id, ...fields } = body;
    if (!id || typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

    const filteredFields = Object.fromEntries(Object.entries(fields).filter(([k]) => PATCH_ALLOWED_COLS.has(k)));
    const setEntries = Object.entries({ ...filteredFields, updated_at: now });
    if (setEntries.length === 0) return NextResponse.json({ note: { id } });

    const setClauses = setEntries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
    const vals: unknown[] = setEntries.map(([, v]) => v);
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
    try { await getPusher().trigger("stickies", "note-updated", data ?? { id }); } catch {}
    return NextResponse.json({ note: data ?? { id } });
}
