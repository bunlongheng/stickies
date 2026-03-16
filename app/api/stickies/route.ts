import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Pusher from "pusher";
import crypto from "crypto";

const palette12 = [
    "#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00",
    "#D4E157", "#34C759", "#00C7BE", "#32ADE6",
    "#007AFF", "#5856D6", "#AF52DE", "#FF2D55",
    "#B0B0B8", "#555560", "#8B1A2E", "#6B7A1E", "#0D2B6B", "#FFFFFF",
];

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// ── Folder path resolver ─────────────────────────────────────────────────────
// "work/team" → finds "team" whose parent is "work", returns { folder_name, folder_id }
// Plain "CLAUDE" → returns { folder_name: "CLAUDE", folder_id: null }
async function resolveFolderPath(raw: string, table: string): Promise<{ folder_name: string; folder_id: string | null }> {
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return { folder_name: raw.trim() || "CLAUDE", folder_id: null };

    const sb = getSupabase();
    const { data: folders } = await sb.from(table).select("id, folder_name, parent_folder_name").eq("is_folder", true);
    const all = folders ?? [];

    let parentName: string | null = null;
    let resolved: { id: string; folder_name: string } | null = null;

    for (const segment of parts) {
        const match = all.find((f) =>
            f.folder_name.toLowerCase() === segment.toLowerCase() &&
            (parentName === null
                ? !f.parent_folder_name
                : f.parent_folder_name?.toLowerCase() === parentName.toLowerCase())
        );
        if (!match) {
            // Folder segment not found — fall back to last segment as folder_name
            return { folder_name: parts[parts.length - 1], folder_id: null };
        }
        resolved = { id: String(match.id), folder_name: match.folder_name };
        parentName = match.folder_name;
    }

    return resolved
        ? { folder_name: resolved.folder_name, folder_id: resolved.id }
        : { folder_name: parts[parts.length - 1], folder_id: null };
}

function getPusher() {
    return new Pusher({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.PUSHER_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: process.env.PUSHER_CLUSTER!,
        useTLS: true,
    });
}

// ── API request broadcast ─────────────────────────────────────────────────────
function broadcastRequest(req: Request, auth: AuthResult, extra?: Record<string, unknown>) {
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

// ── Hue trigger ──────────────────────────────────────────────────────────────
// Fires on any non-browser API write (curl / AI / external).
// Browser requests have a Mozilla User-Agent — skip those.
function triggerHue(req: Request, color: string) {
    const ua = req.headers.get("user-agent") ?? "";
    if (/mozilla/i.test(ua)) return; // browser — skip
    const base = (process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://localhost:4444").replace(/\/$/, "");
    fetch(`${base}/api/hue/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
    }).catch(() => {});
}

// ── Auth ────────────────────────────────────────────────────────────────────
type AuthResult = { type: "apikey" } | { type: "user"; userId: string };

async function authenticate(req: Request): Promise<AuthResult | null> {
    const auth = req.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!bearer) return null;

    // Static API key → owner (reads/writes to `notes` table, unchanged)
    const apiKey = process.env.STICKIES_API_KEY;
    if (apiKey) {
        const expected = `Bearer ${apiKey}`;
        if (auth.length === expected.length) {
            try {
                if (crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
                    return { type: "apikey" };
                }
            } catch {}
        }
    }

    // Supabase JWT → check if owner email, else regular user
    const { data: { user } } = await getSupabase().auth.getUser(bearer);
    if (user) {
        const ownerUserId = process.env.OWNER_USER_ID?.trim();
        if (ownerUserId && user.id === ownerUserId) return { type: "apikey" };
        return { type: "user", userId: user.id };
    }

    return null;
}

// Owner → "notes" (existing table, untouched)
// Users → "users_stickies" (new per-user table)
function getTable(auth: AuthResult): string {
    return auth.type === "user" ? "users_stickies" : "notes";
}

// ── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = getTable(auth);
    const userId = auth.type === "user" ? auth.userId : undefined;
    const url = new URL(req.url);
    const foldersOnly = url.searchParams.get("folders") === "1";
    const folderFilter = url.searchParams.get("folder");
    const q = url.searchParams.get("q")?.trim();
    const route = url.searchParams.get("route")?.trim();
    const sb = getSupabase();

    const scope = (query: any): any => userId ? query.eq("user_id", userId) : query;

    if (route) {
        const routeFolder = folderFilter ?? "BHENG";
        const { data, error } = await scope(
            sb.from(table).select("*").eq("is_folder", false).eq("folder_name", routeFolder).eq("title", route)
        ).maybeSingle();
        if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
        return NextResponse.json({ sticky: data ?? null });
    }

    if (foldersOnly) {
        const { data, error } = await scope(
            sb.from(table).select("id, folder_name, folder_color, parent_folder_name, order, updated_at").eq("is_folder", true).order("order", { ascending: true })
        );
        if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
        return NextResponse.json({ folders: data ?? [] });
    }

    if (folderFilter) {
        const { data, error } = await scope(
            sb.from(table).select("*").eq("is_folder", false).eq("folder_name", folderFilter).order("order", { ascending: true })
        );
        if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
        return NextResponse.json({ notes: data ?? [] });
    }

    if (q) {
        const { data, error } = await scope(
            sb.from(table).select("*").eq("is_folder", false).or(`title.ilike.%${q}%,content.ilike.%${q}%`).order("updated_at", { ascending: false })
        );
        if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
        return NextResponse.json({ notes: data ?? [], query: q });
    }

    const { data, error } = await scope(
        sb.from(table).select("*").eq("is_folder", false).order("order", { ascending: true })
    );
    if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
    return NextResponse.json({ notes: data ?? [] });
}

// ── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = getTable(auth);
    const userId = auth.type === "user" ? auth.userId : undefined;
    const userField = userId ? { user_id: userId } : {};

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
        const sb = getSupabase();
        const now = new Date().toISOString();

        const { data: colorRows } = await sb.from(table).select("folder_color").eq("is_folder", false);
        const colorCounts = new Map<string, number>(palette12.map((c) => [c, 0]));
        (colorRows ?? []).forEach((r: any) => {
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

        const { data: maxOrderRow } = await sb.from(table).select("order").order("order", { ascending: false }).limit(1).single();
        let nextOrder = typeof maxOrderRow?.order === "number" ? maxOrderRow.order + 1 : 0;
        const results: Array<{ type: string; data: Record<string, unknown> | null; error?: string }> = [];

        for (const item of items) {
            const type = String(item.type ?? "note");
            if (item.__error) { results.push({ type, data: null, error: String(item.__error) }); continue; }
            try {
                if (type === "folder") {
                    const name = String(item.name ?? "").trim();
                    if (!name) { results.push({ type: "folder", data: null, error: "name required" }); continue; }
                    const { data, error } = await sb.from(table).insert([{
                        is_folder: true, folder_name: name, title: name, content: "",
                        folder_color: pickColor(item.color as string),
                        parent_folder_name: String(item.parent_folder ?? "").trim() || null,
                        order: nextOrder++, created_at: now, updated_at: now, ...userField,
                    }]).select().single();
                    if (error) { results.push({ type: "folder", data: null, error: error.message }); continue; }
                    results.push({ type: "folder", data: data as Record<string, unknown> });
                } else {
                    const title = String(item.title ?? "").trim();
                    if (!title) { results.push({ type: "note", data: null, error: "title required" }); continue; }
                    const content = String(item.content ?? "").trim();
                    if (!content) { results.push({ type: "note", data: null, error: "content required" }); continue; }
                    const folder_name = "folder" in item
                        ? (String(item.folder ?? "").trim() || (() => { throw new Error("folder cannot be empty"); })())
                        : "CLAUDE";
                    const batchType = (typeof item.type === "string" && VALID_TYPES.has(item.type)) ? item.type : detectType(content, title);
                    const { data, error } = await sb.from(table).insert([{
                        is_folder: false, title, content, folder_name, type: batchType,
                        folder_color: pickColor(item.color as string),
                        order: nextOrder++, created_at: now, updated_at: now, ...userField,
                    }]).select().single();
                    if (error) { results.push({ type: "note", data: null, error: error.message }); continue; }
                    results.push({ type: "note", data: data as Record<string, unknown> });
                }
            } catch (err: any) {
                results.push({ type, data: null, error: err?.message ?? "unknown error" });
            }
        }

        const failed = results.filter((r) => r.error);

        // Broadcast each successfully created item to all live sessions
        const pusher = getPusher();
        for (const r of results) {
            if (r.data && !r.error) {
                const event = r.type === "folder" ? "note-created" : "note-created";
                pusher.trigger("stickies", event, r.data).catch(() => {});
            }
        }

        return NextResponse.json({ results, total: results.length, failed: failed.length }, { status: failed.length === results.length ? 500 : 201 });
    }

    // ── Folder create ──
    const isFolderCreate = url.searchParams.get("type") === "folder" || bodyForFolderCheck?.type === "folder";
    if (isFolderCreate) {
        const name = String(url.searchParams.get("name") || (bodyForFolderCheck?.name as string) || "").trim();
        if (!name) return NextResponse.json({ error: "name is required for folder" }, { status: 400 });

        const rawColor = String(url.searchParams.get("color") || (bodyForFolderCheck?.color as string) || "").trim().toUpperCase();
        const parentFolder = String(url.searchParams.get("parent") || (bodyForFolderCheck?.parent_folder as string) || "").trim() || null;
        const sb = getSupabase();

        let folder_color = rawColor;
        if (!/^#[0-9A-F]{6}$/.test(folder_color)) {
            const { data: colorRows } = await sb.from(table).select("folder_color").eq("is_folder", true);
            const counts = new Map<string, number>(palette12.map((c) => [c, 0]));
            (colorRows ?? []).forEach((r: any) => { const c = String(r.folder_color ?? "").toUpperCase(); if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1); });
            folder_color = palette12.reduce((least, c) => (counts.get(c)! < counts.get(least)! ? c : least), palette12[0]);
        }

        const { data: maxRow } = await sb.from(table).select("order").eq("is_folder", true).order("order", { ascending: false }).limit(1).single();
        const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;
        const now = new Date().toISOString();

        const { data, error } = await sb.from(table).insert([{
            is_folder: true, folder_name: name, title: name, content: "",
            folder_color, parent_folder_name: parentFolder, order: nextOrder, created_at: now, updated_at: now, ...userField,
        }]).select().single();

        if (error) { console.error("[stickies POST folder]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        try { await getPusher().trigger("stickies", "note-created", data); } catch {}
        return NextResponse.json({ folder: data }, { status: 201 });
    }

    // ── Raw insert ──
    if (url.searchParams.get("raw") === "1") {
        let payload: Record<string, unknown>;
        try { payload = bodyForFolderCheck ?? await req.json(); }
        catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
        const now = new Date().toISOString();
        const { data, error } = await getSupabase().from(table).insert([{
            ...payload, updated_at: now, created_at: payload.created_at ?? now, ...userField,
        }]).select().single();
        if (error) { console.error("[stickies POST raw]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
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

    const sb = getSupabase();

    // ── Non-browser API calls: enforce CLAUDE as parent for unknown simple folders ──
    const isExternalCall = !/mozilla/i.test(req.headers.get("user-agent") ?? "");
    if (isExternalCall && !folder_name!.includes("/")) {
        // Check if this is a known root-level folder
        const { data: rootFolders } = await sb.from(table).select("folder_name").eq("is_folder", true).is("parent_folder_name", null);
        const rootNames = (rootFolders ?? []).map((f: any) => f.folder_name.toLowerCase());
        if (!rootNames.includes(folder_name!.toLowerCase())) {
            // Not a root folder — nest under CLAUDE
            folder_name = `CLAUDE/${folder_name}`;
        }
    }

    // Resolve folder via slash-path (e.g. "claude/skills") or simple name
    let resolved_folder_id: string | null = null;
    let resolved_folder_name: string = folder_name!;

    const folderPathParts = folder_name!.split("/").map((p) => p.trim()).filter(Boolean);

    if (folderPathParts.length > 1) {
        // Walk path, find or create each segment
        const { data: allFolderRows } = await sb.from(table).select("id, folder_name, parent_folder_name").eq("is_folder", true);
        const allFolders: Array<{ id: string; folder_name: string; parent_folder_name: string | null }> = (allFolderRows ?? []) as any;

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
                // Never auto-create root-level folders — require a parent
                if (parentName === null) {
                    return NextResponse.json({ error: `Root folder "${segment}" does not exist. Create it manually or use an existing folder.` }, { status: 400 });
                }
                // Create missing sub-folder in chain
                const { data: maxFolderRow } = await sb.from(table).select("order").eq("is_folder", true).order("order", { ascending: false }).limit(1).single();
                const folderOrder = typeof maxFolderRow?.order === "number" ? maxFolderRow.order + 1 : 0;
                const { data: newFolder } = await sb.from(table).insert([{
                    is_folder: true, folder_name: segment, title: segment, content: "",
                    folder_color: palette12[8], // #007AFF default
                    parent_folder_name: parentName,
                    order: folderOrder, created_at: nowTs, updated_at: nowTs, ...userField,
                }]).select().single();
                if (newFolder) {
                    try { await getPusher().trigger("stickies", "note-created", newFolder); } catch {}
                    allFolders.push({ id: String(newFolder.id), folder_name: segment, parent_folder_name: parentName });
                    parentName = segment;
                    parentId = String(newFolder.id);
                } else {
                    parentName = segment;
                }
            }
        }
        resolved_folder_name = folderPathParts[folderPathParts.length - 1];
        resolved_folder_id = parentId;
    } else {
        // Simple folder name — look up existing folder row
        const { data: folderRows } = await sb.from(table).select("id, folder_name, parent_folder_name").eq("is_folder", true).eq("folder_name", folder_name!);
        if (folderRows && folderRows.length > 0) {
            const match = parentFolderHint
                ? folderRows.find((r: any) => r.parent_folder_name?.toLowerCase() === parentFolderHint!.toLowerCase())
                : folderRows[0];
            if (match) resolved_folder_id = String(match.id);
        }
        resolved_folder_name = folder_name!;
    }

    let folder_color = rawColor;
    if (!/^#[0-9A-F]{6}$/.test(folder_color)) {
        const { data: colorRows } = await sb.from(table).select("folder_color").eq("is_folder", false);
        const counts = new Map<string, number>(palette12.map((c) => [c, 0]));
        (colorRows ?? []).forEach((r: any) => { const c = String(r.folder_color ?? "").toUpperCase(); if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1); });
        folder_color = palette12.reduce((least, c) => (counts.get(c)! < counts.get(least)! ? c : least), palette12[0]);
    }

    const now = new Date().toISOString();

    // Upsert: check if note with same title already exists in this folder
    const existingQuery = resolved_folder_id
        ? sb.from(table).select("id").eq("is_folder", false).eq("folder_name", resolved_folder_name).eq("title", title).limit(1)
        : sb.from(table).select("id").eq("is_folder", false).eq("folder_name", resolved_folder_name).eq("title", title).limit(1);
    const { data: existingRows } = await existingQuery;
    const existingNote = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    let data: any, error: any;

    const noteType = explicitType ?? detectType(content, title);

    if (existingNote?.id) {
        // Update existing note
        ({ data, error } = await sb.from(table)
            .update({ content, folder_color, type: noteType, updated_at: now })
            .eq("id", existingNote.id)
            .select().single());
    } else {
        // Insert new note
        const { data: maxRow } = await sb.from(table).select("order").eq("is_folder", false).order("order", { ascending: false }).limit(1).single();
        const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;
        ({ data, error } = await sb.from(table).insert([{
            title, content, folder_name: resolved_folder_name, folder_color, is_folder: false, type: noteType,
            ...(resolved_folder_id ? { folder_id: resolved_folder_id } : {}),
            order: nextOrder, created_at: now, updated_at: now, ...userField,
        }]).select().single());
    }

    if (error) { console.error("[stickies POST]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }

    if (auth.type === "apikey") {
        try { await getPusher().trigger("stickies", existingNote?.id ? "note-updated" : "note-created", data); } catch {}
        triggerHue(req, folder_color);
    }

    return NextResponse.json({ note: data, action: existingNote?.id ? "updated" : "created" }, { status: 201 });
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    broadcastRequest(req, auth);

    const table = getTable(auth);
    const userId = auth.type === "user" ? auth.userId : undefined;
    const url = new URL(req.url);
    const noteId = url.searchParams.get("id")?.trim();
    const folderName = url.searchParams.get("folder_name")?.trim();
    const sb = getSupabase();

    const scope = (q: any) => userId ? q.eq("user_id", userId) : q;

    if (noteId) {
        const { error } = await scope(sb.from(table).delete().eq("id", noteId));
        if (error) { console.error("[stickies DELETE note]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        try { await getPusher().trigger("stickies", "note-deleted", { id: noteId }); } catch {}
        return NextResponse.json({ ok: true, deleted_note: noteId });
    }

    if (!folderName) return NextResponse.json({ error: "id or folder_name is required" }, { status: 400 });

    const { error } = await scope(sb.from(table).delete().eq("folder_name", folderName));
    if (error) { console.error("[stickies DELETE folder]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
    try { await getPusher().trigger("stickies", "note-deleted", { folder_name: folderName }); } catch {}
    return NextResponse.json({ ok: true, deleted_folder: folderName });
}

// ── Note type detection ──────────────────────────────────────────────────────
const VALID_TYPES = new Set(["text","markdown","html","json","mermaid","javascript","typescript","python","css","sql","bash","voice","checklist","rich"]);

export function detectType(content: string, title?: string): string {
    const t = content.trim();
    if (!t) return "text";

    // Voice note (JSON blob)
    if (t.startsWith('{"_type":"voice"')) {
        try { if (JSON.parse(t)?._type === "voice") return "voice"; } catch {}
    }
    // Fenced mermaid block
    if (/^```(?:mermaid)?\s*\n[\s\S]*?```\s*$/im.test(t)) return "mermaid";
    // Bare mermaid keyword
    if (/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im.test(t)) return "mermaid";
    // JSON
    if ((t.startsWith("{") || t.startsWith("[")) && (() => { try { JSON.parse(t); return true; } catch { return false; } })()) return "json";
    // Code by title extension
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
    // HTML document
    if (/^\s*<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t)) return "html";
    // Checklist: any line with [ ], [x], [X], or [] pattern
    if (/^\s*\[[ xX]?\]/m.test(t)) return "checklist";
    // Markdown heuristic
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
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const table = getTable(auth);
    const userId = auth.type === "user" ? auth.userId : undefined;
    const scope = (q: any) => userId ? q.eq("user_id", userId) : q;

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

    broadcastRequest(req, auth, { summary: (body as any)?.rename_note?.title ?? (body as any)?.rename_folder?.from ?? (body as any)?.id ?? undefined });

    const sb = getSupabase();
    const now = new Date().toISOString();

    if (body.rename_note) {
        const { id, title } = body.rename_note as { id: string; title: string };
        if (!id?.trim() || !title?.trim()) return NextResponse.json({ error: "rename_note requires id and title" }, { status: 400 });
        const { data, error } = await scope(sb.from(table).update({ title: title.trim(), updated_at: now }).eq("id", id.trim())).select().single();
        if (error) { console.error("[stickies PATCH rename_note]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        return NextResponse.json({ ok: true, note: data });
    }

    if (body.rename_folder) {
        const { from, to } = body.rename_folder as { from: string; to: string };
        if (!from?.trim() || !to?.trim()) return NextResponse.json({ error: "rename_folder requires from and to" }, { status: 400 });
        const toTrimmed = to.trim();
        const { error: folderErr } = await scope(sb.from(table).update({ folder_name: toTrimmed, title: toTrimmed, updated_at: now }).eq("is_folder", true).eq("folder_name", from.trim()));
        if (folderErr) { console.error("[stickies PATCH rename_folder]", folderErr); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        const { error: notesErr } = await scope(sb.from(table).update({ folder_name: toTrimmed, updated_at: now }).eq("is_folder", false).eq("folder_name", from.trim()));
        if (notesErr) { console.error("[stickies PATCH rename_folder notes]", notesErr); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        return NextResponse.json({ ok: true, renamed: { from, to: toTrimmed } });
    }

    if (body.merge_folder) {
        const { from, to } = body.merge_folder as { from: string; to: string };
        if (!from?.trim() || !to?.trim()) return NextResponse.json({ error: "merge_folder requires from and to" }, { status: 400 });
        const { data: movedRows, error: moveErr } = await scope(sb.from(table).update({ folder_name: to.trim(), updated_at: now }).eq("is_folder", false).eq("folder_name", from.trim())).select("id");
        if (moveErr) { console.error("[stickies PATCH merge_folder]", moveErr); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        const { error: delErr } = await scope(sb.from(table).delete().eq("is_folder", true).eq("folder_name", from.trim()));
        if (delErr) { console.error("[stickies PATCH merge_folder delete]", delErr); return NextResponse.json({ error: "Database error" }, { status: 500 }); }
        return NextResponse.json({ ok: true, merged: { from, to: to.trim(), moved: movedRows?.length ?? 0 } });
    }

    if (body.fix_html_content) {
        const { data: allNotes, error: fetchErr } = await scope(
            sb.from(table).select("id, content").eq("is_folder", false).eq("folder_name", "TEAM")
        );
        if (fetchErr) return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
        // Only strip HTML from TEAM notes — never touch intentional HTML notes in other folders
        const toFix = (allNotes ?? []).filter((n: any) => /<[a-z][^>]*>/i.test(n.content || "") && !/<!DOCTYPE\s+html/i.test(n.content || ""));
        if (toFix.length === 0) return NextResponse.json({ ok: true, fixed: 0 });
        const results = await Promise.all(toFix.map((n: any) =>
            scope(sb.from(table).update({ content: htmlToPlainLines(n.content), updated_at: now }).eq("id", n.id))
        ));
        const failed = results.filter((r: any) => r.error);
        if (failed.length > 0) return NextResponse.json({ error: "Partial failure", fixed: toFix.length - failed.length }, { status: 500 });
        return NextResponse.json({ ok: true, fixed: toFix.length });
    }

    if (body.fix_team_checklist) {
        // One-time fix: set list_mode=true on all TEAM notes, strip HTML content
        const { data: teamNotes, error: fetchErr } = await scope(
            sb.from(table).select("id, content, list_mode").eq("is_folder", false).eq("folder_name", "TEAM")
        );
        if (fetchErr) return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
        const toFix = (teamNotes ?? []).filter((n: any) => !n.list_mode);
        if (toFix.length === 0) return NextResponse.json({ ok: true, fixed: 0 });
        const results = await Promise.all(toFix.map((n: any) => {
            const cleanContent = /<[a-z][^>]*>/i.test(n.content || "") ? htmlToPlainLines(n.content) : n.content;
            return scope(sb.from(table).update({ list_mode: true, content: cleanContent, updated_at: now }).eq("id", n.id));
        }));
        const failed = results.filter((r: any) => r.error);
        if (failed.length > 0) return NextResponse.json({ error: "Partial failure", fixed: toFix.length - failed.length }, { status: 500 });
        return NextResponse.json({ ok: true, fixed: toFix.length });
    }

    if (Array.isArray(body.updates)) {
        const updates = body.updates as Array<{ id: string; [key: string]: unknown }>;
        const results = await Promise.all(
            updates.map(({ id, ...fields }) => scope(sb.from(table).update({ ...fields, updated_at: now }).eq("id", id)))
        );
        const failed = results.filter((r) => r.error);
        if (failed.length > 0) { console.error("[stickies PATCH bulk]", failed[0].error); return NextResponse.json({ error: "Partial failure" }, { status: 500 }); }
        return NextResponse.json({ ok: true });
    }

    const { id, ...fields } = body;
    if (!id || typeof id !== "string") return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data, error } = await scope(sb.from(table).update({ ...fields, updated_at: now }).eq("id", id)).select().single();
    if (error) { console.error("[stickies PATCH]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }

    try { await getPusher().trigger("stickies", "note-updated", data); } catch {}
    return NextResponse.json({ note: data });
}
