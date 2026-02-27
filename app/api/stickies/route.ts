import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Pusher from "pusher";
import crypto from "crypto";

const palette12 = [
    "#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00",
    "#D4E157", "#34C759", "#00C7BE", "#32ADE6",
    "#007AFF", "#5856D6", "#AF52DE", "#FF2D55",
    "#B0B0B8", "#555560", "#8B1A2E", "#6B7A1E", "#0D2B6B",
];

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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

function authorize(req: Request): boolean {
    const apiKey = process.env.STICKIES_API_KEY;
    if (!apiKey) return false;
    const auth = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${apiKey}`;
    if (auth.length !== expected.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
    } catch {
        return false;
    }
}

// GET /api/stickies — list notes/folders
//
// ?folders=1           → list only folders
// ?folder=<name>       → list notes inside a specific folder
// ?q=<keyword>         → search notes by title or content (case-insensitive)
// ?route=<path>        → get page sticky for a specific route (folder_name = PAGES)
// (no params)          → list all notes (non-folder)
export async function GET(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const foldersOnly = url.searchParams.get("folders") === "1";
    const folderFilter = url.searchParams.get("folder");
    const q = url.searchParams.get("q")?.trim();
    const route = url.searchParams.get("route")?.trim();

    const supabase = getSupabase();

    // ?route=<path> — get page sticky for a specific route
    // ?folder=BHENG (or 3PI) scopes to the correct project; falls back to "BHENG"
    if (route) {
        const routeFolder = folderFilter ?? "BHENG";
        const { data, error } = await supabase
            .from("notes")
            .select("*")
            .eq("is_folder", false)
            .eq("folder_name", routeFolder)
            .eq("title", route)
            .maybeSingle();
        if (error) {
            console.error("[stickies GET route]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ sticky: data ?? null });
    }

    // ?folders=1 — return folder list only
    if (foldersOnly) {
        const { data, error } = await supabase
            .from("notes")
            .select("id, folder_name, folder_color, parent_folder_name, order, updated_at")
            .eq("is_folder", true)
            .order("order", { ascending: true });
        if (error) {
            console.error("[stickies GET folders]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ folders: data ?? [] });
    }

    // ?folder=<name> — notes inside a specific folder
    if (folderFilter) {
        const { data, error } = await supabase
            .from("notes")
            .select("*")
            .eq("is_folder", false)
            .eq("folder_name", folderFilter)
            .order("order", { ascending: true });
        if (error) {
            console.error("[stickies GET folder filter]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ notes: data ?? [] });
    }

    // ?q=<keyword> — search by title or content
    if (q) {
        const { data, error } = await supabase
            .from("notes")
            .select("*")
            .eq("is_folder", false)
            .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
            .order("updated_at", { ascending: false });
        if (error) {
            console.error("[stickies GET search]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ notes: data ?? [], query: q });
    }

    // default — all notes
    const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("is_folder", false)
        .order("order", { ascending: true });

    if (error) {
        console.error("[stickies GET]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ notes: data ?? [] });
}

// POST /api/stickies/notes — create notes/folders (single or batch)
//
// Option A — JSON body (note):
//   { title, content?, folder_name?, color? }
//
// Option B — raw Markdown body (AI-friendly):
//   Content-Type: text/plain | text/markdown | text/x-markdown
//   Body: raw .md text  |  Query: ?folder=MyFolder&color=%23FF9500
//
// Option C — raw internal insert (?raw=1):
//   Exact payload forwarded as-is
//
// Option D — create a folder:
//   { type: "folder", name: "FolderName", color?: "#FF9500", parent_folder?: "ParentName" }
//
// Option E — BATCH (any mix of folders + notes in one call):
//   {
//     "batch": [
//       { "type": "folder", "name": "My Folder", "color": "#007AFF", "parent_folder": "Parent" },
//       { "type": "note",   "title": "My Note",  "content": "...", "folder_name": "My Folder", "color": "#FF9500" }
//     ]
//   }
//   Processed in order — folders created first are immediately referenceable by notes.
export async function POST(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);

    // ── Folder creation ──
    const isJsonBody = /application\/json/i.test(req.headers.get("content-type") ?? "");
    let bodyForFolderCheck: Record<string, unknown> | null = null;
    let bodyText: string | null = null;

    if (isJsonBody) {
        try {
            bodyText = await req.text();
            bodyForFolderCheck = JSON.parse(bodyText);
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }
    }

    // ── Compact array format → normalize to batch items ──
    // ["folder", name, color?, parent_folder?]
    // ["note", title, content?, folderRef (index or name)?, color?]
    const isCompact = Array.isArray(bodyForFolderCheck);
    if (isCompact) {
        const raw = bodyForFolderCheck as unknown as Array<unknown[]>;
        const normalized: Array<Record<string, unknown>> = raw.map((row, idx) => {
            const [type, ...rest] = row as [string, ...unknown[]];
            if (type === "folder") {
                return { type: "folder", name: rest[0], color: rest[1], parent_folder: rest[2] };
            }
            // note: rest = [title, content, folder, color]
            const folder_name = String(rest[2] ?? "CLAUDE").trim() || "CLAUDE";
            return { type: "note", title: rest[0], content: rest[1] ?? "", folder_name, color: rest[3] };
        });
        // fall through to batch processor with normalized items
        (bodyForFolderCheck as any) = { batch: normalized };
    }

    // ── Batch mode ──
    if (bodyForFolderCheck && Array.isArray((bodyForFolderCheck as any).batch)) {
        const items = (bodyForFolderCheck as any).batch as Array<Record<string, unknown>>;
        const supabase = getSupabase();
        const now = new Date().toISOString();

        // Pre-fetch color usage once for the whole batch
        const { data: colorRows } = await supabase.from("notes").select("folder_color");
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

        // Get max order once, increment as we go
        const { data: maxOrderRow } = await supabase.from("notes").select("order").order("order", { ascending: false }).limit(1).single();
        let nextOrder = typeof maxOrderRow?.order === "number" ? maxOrderRow.order + 1 : 0;

        const results: Array<{ type: string; data: Record<string, unknown> | null; error?: string }> = [];

        for (const item of items) {
            const type = String(item.type ?? "note");
            if (item.__error) { results.push({ type, data: null, error: String(item.__error) }); continue; }
            try {
                if (type === "folder") {
                    const name = String(item.name ?? "").trim();
                    if (!name) { results.push({ type: "folder", data: null, error: "name required" }); continue; }
                    const { data, error } = await supabase.from("notes").insert([{
                        is_folder: true,
                        folder_name: name,
                        title: name,
                        content: "",
                        folder_color: pickColor(item.color as string),
                        parent_folder_name: String(item.parent_folder ?? "").trim() || null,
                        order: nextOrder++,
                        created_at: now,
                        updated_at: now,
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
                    const { data, error } = await supabase.from("notes").insert([{
                        is_folder: false,
                        title,
                        content,
                        folder_name,
                        folder_color: pickColor(item.color as string),
                        order: nextOrder++,
                        created_at: now,
                        updated_at: now,
                    }]).select().single();
                    if (error) { results.push({ type: "note", data: null, error: error.message }); continue; }
                    results.push({ type: "note", data: data as Record<string, unknown> });
                }
            } catch (err: any) {
                results.push({ type, data: null, error: err?.message ?? "unknown error" });
            }
        }

        const failed = results.filter((r) => r.error);
        return NextResponse.json({ results, total: results.length, failed: failed.length }, { status: failed.length === results.length ? 500 : 201 });
    }

    const isFolderCreate =
        url.searchParams.get("type") === "folder" ||
        (bodyForFolderCheck && bodyForFolderCheck.type === "folder");

    if (isFolderCreate) {
        const name = String(
            url.searchParams.get("name") ||
            (bodyForFolderCheck?.name as string) ||
            ""
        ).trim();
        if (!name) return NextResponse.json({ error: "name is required for folder" }, { status: 400 });

        const rawColor = String(
            url.searchParams.get("color") ||
            (bodyForFolderCheck?.color as string) ||
            ""
        ).trim().toUpperCase();

        const parentFolder = String(
            url.searchParams.get("parent") ||
            (bodyForFolderCheck?.parent_folder as string) ||
            ""
        ).trim() || null;

        let folder_color = rawColor;
        if (!/^#[0-9A-F]{6}$/.test(folder_color)) {
            const { data: colorRows } = await getSupabase().from("notes").select("folder_color").eq("is_folder", true);
            const counts = new Map<string, number>(palette12.map((c) => [c, 0]));
            (colorRows ?? []).forEach((r: any) => {
                const c = String(r.folder_color ?? "").toUpperCase();
                if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
            });
            folder_color = palette12.reduce((least, c) => (counts.get(c)! < counts.get(least)! ? c : least), palette12[0]);
        }

        const supabase = getSupabase();
        const { data: maxRow } = await supabase
            .from("notes").select("order").eq("is_folder", true)
            .order("order", { ascending: false }).limit(1).single();
        const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from("notes")
            .insert([{
                is_folder: true,
                folder_name: name,
                title: name,
                content: "",
                folder_color,
                parent_folder_name: parentFolder,
                order: nextOrder,
                created_at: now,
                updated_at: now,
            }])
            .select()
            .single();

        if (error) {
            console.error("[stickies/notes POST folder]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }

        try { await getPusher().trigger("stickies", "note-created", data); } catch {}
        return NextResponse.json({ folder: data }, { status: 201 });
    }

    // Raw internal insert — exact payload, no formatting/defaults applied
    if (url.searchParams.get("raw") === "1") {
        let payload: Record<string, unknown>;
        try {
            payload = bodyForFolderCheck ?? await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const now = new Date().toISOString();
        const { data, error } = await getSupabase()
            .from("notes")
            .insert([{ ...payload, updated_at: now, created_at: payload.created_at ?? now }])
            .select()
            .single();
        if (error) {
            console.error("[stickies/notes POST raw]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        try { await getPusher().trigger("stickies", "note-created", data); } catch {}
        return NextResponse.json({ note: data }, { status: 201 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    const isMarkdown = /text\/(plain|markdown|x-markdown)/i.test(contentType);

    let title = "";
    let content = "";
    let folder_name: string | null = null;
    let rawColor = "";

    if (isMarkdown) {
        // Raw .md body — parse title from first H1, rest is content
        const raw = await req.text();
        const lines = raw.split("\n");
        const h1Index = lines.findIndex((l) => /^#\s+/.test(l));
        if (h1Index !== -1) {
            title = lines[h1Index].replace(/^#\s+/, "").trim();
            content = [...lines.slice(0, h1Index), ...lines.slice(h1Index + 1)].join("\n").trim();
        } else {
            // No H1 — use first non-empty line as title
            const firstLine = lines.find((l) => l.trim()) ?? "";
            title = firstLine.replace(/^#+\s*/, "").trim() || "Untitled";
            content = raw.trim();
        }
        // Folder + color from query params
        const url = new URL(req.url);
        const qFolder = url.searchParams.get("folder");
        const qColor  = url.searchParams.get("color");
        folder_name = qFolder?.trim() || "CLAUDE";
        if (qColor?.trim())  rawColor    = qColor.trim().toUpperCase();
    } else {
        // JSON body (already parsed above if isJsonBody, else parse now)
        let body: Record<string, unknown>;
        try {
            body = bodyForFolderCheck ?? await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid body — send JSON or raw markdown text" }, { status: 400 });
        }
        title       = typeof body.title       === "string" ? body.title.trim()       : "";
        content     = typeof body.content     === "string" ? body.content            : "";
        folder_name = typeof body.folder === "string" && body.folder.trim() ? body.folder.trim() : "CLAUDE";
        rawColor    = typeof body.color       === "string" ? body.color.trim().toUpperCase() : "";
    }

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    // folder omitted → CLAUDE; folder present but blank → error
    if (folder_name !== null && !folder_name?.trim()) {
        return NextResponse.json({ error: "folder cannot be empty" }, { status: 400 });
    }
    if (!folder_name?.trim()) folder_name = "CLAUDE";

    // Validate or pick least-used palette color
    let folder_color = rawColor;
    if (!/^#[0-9A-F]{6}$/.test(folder_color)) {
        const { data: colorRows } = await getSupabase()
            .from("notes")
            .select("folder_color")
            .eq("is_folder", false);
        const counts = new Map<string, number>(palette12.map((c) => [c, 0]));
        (colorRows ?? []).forEach((r: any) => {
            const c = String(r.folder_color ?? "").toUpperCase();
            if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
        });
        folder_color = palette12.reduce((least, c) => (counts.get(c)! < counts.get(least)! ? c : least), palette12[0]);
    }

    const supabase = getSupabase();

    // Get max order to append at the end
    const { data: maxRow } = await supabase
        .from("notes")
        .select("order")
        .eq("is_folder", false)
        .order("order", { ascending: false })
        .limit(1)
        .single();

    const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;
    const now = new Date().toISOString();

    const payload = {
        title,
        content,
        folder_name,
        folder_color,
        is_folder: false,
        order: nextOrder,
        created_at: now,
        updated_at: now,
    };

    const { data, error } = await supabase
        .from("notes")
        .insert([payload])
        .select()
        .single();

    if (error) {
        console.error("[stickies/notes POST]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    try { await getPusher().trigger("stickies", "note-created", data); } catch {}

    // 💡 Hue flash — fire-and-forget when note color matches yellow
    const YELLOW = "#FFCC00";
    if (folder_color === YELLOW && process.env.HUE_LIGHT_ID) {
        fetch(`${process.env.PROD_BASE_URL ?? "https://bheng.vercel.app"}/api/hue/flash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ light_id: process.env.HUE_LIGHT_ID, color: YELLOW }),
        }).catch(() => {});
    }

    return NextResponse.json({ note: data }, { status: 201 });
}

// PATCH /api/stickies — update notes/folders or organize
//
// Single note update:    { id: string, ...fields }
// Bulk update:           { updates: Array<{ id: string, ...fields }> }
// Rename note title:     { rename_note: { id: string, title: string } }
// Rename folder:         { rename_folder: { from: string, to: string } }  — also migrates folder_name on all notes inside
// Merge/move folder:     { merge_folder: { from: string, to: string } }
export async function PATCH(req: Request) {
    if (!authorize(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Rename note title
    if (body.rename_note) {
        const { id, title } = body.rename_note as { id: string; title: string };
        if (!id?.trim() || !title?.trim()) {
            return NextResponse.json({ error: "rename_note requires id and title" }, { status: 400 });
        }
        const { data, error } = await supabase
            .from("notes")
            .update({ title: title.trim(), updated_at: now })
            .eq("id", id.trim())
            .select()
            .single();
        if (error) {
            console.error("[stickies PATCH rename_note]", error);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ ok: true, note: data });
    }

    // Rename folder — updates folder row + all notes inside it
    if (body.rename_folder) {
        const { from, to } = body.rename_folder as { from: string; to: string };
        if (!from?.trim() || !to?.trim()) {
            return NextResponse.json({ error: "rename_folder requires from and to" }, { status: 400 });
        }
        const toTrimmed = to.trim();
        // Update folder row
        const { error: folderErr } = await supabase
            .from("notes")
            .update({ folder_name: toTrimmed, title: toTrimmed, updated_at: now })
            .eq("is_folder", true)
            .eq("folder_name", from.trim());
        if (folderErr) {
            console.error("[stickies PATCH rename_folder]", folderErr);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        // Cascade update all notes in that folder
        const { error: notesErr } = await supabase
            .from("notes")
            .update({ folder_name: toTrimmed, updated_at: now })
            .eq("is_folder", false)
            .eq("folder_name", from.trim());
        if (notesErr) {
            console.error("[stickies PATCH rename_folder notes]", notesErr);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ ok: true, renamed: { from, to: toTrimmed } });
    }

    // Merge/move folder — move all notes from `from` into `to`, delete `from` folder row
    if (body.merge_folder) {
        const { from, to } = body.merge_folder as { from: string; to: string };
        if (!from?.trim() || !to?.trim()) {
            return NextResponse.json({ error: "merge_folder requires from and to" }, { status: 400 });
        }
        // Move all notes
        const { data: movedRows, error: moveErr } = await supabase
            .from("notes")
            .update({ folder_name: to.trim(), updated_at: now })
            .eq("is_folder", false)
            .eq("folder_name", from.trim())
            .select("id");
        if (moveErr) {
            console.error("[stickies PATCH merge_folder move]", moveErr);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        // Delete the source folder row
        const { error: delErr } = await supabase
            .from("notes")
            .delete()
            .eq("is_folder", true)
            .eq("folder_name", from.trim());
        if (delErr) {
            console.error("[stickies PATCH merge_folder delete]", delErr);
            return NextResponse.json({ error: "Database error" }, { status: 500 });
        }
        return NextResponse.json({ ok: true, merged: { from, to: to.trim(), moved: movedRows?.length ?? 0 } });
    }

    // Bulk update
    if (Array.isArray(body.updates)) {
        const updates = body.updates as Array<{ id: string; [key: string]: unknown }>;
        const results = await Promise.all(
            updates.map(({ id, ...fields }) =>
                supabase.from("notes").update({ ...fields, updated_at: now }).eq("id", id),
            ),
        );
        const failed = results.filter((r) => r.error);
        if (failed.length > 0) {
            console.error("[stickies PATCH bulk]", failed[0].error);
            return NextResponse.json({ error: "Partial failure" }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
    }

    // Single update
    const { id, ...fields } = body;
    if (!id || typeof id !== "string") {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("notes")
        .update({ ...fields, updated_at: now })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("[stickies PATCH]", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    try { await getPusher().trigger("stickies", "note-updated", data); } catch {}
    return NextResponse.json({ note: data });
}

