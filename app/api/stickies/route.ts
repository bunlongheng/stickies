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

    // Supabase JWT → regular user (reads/writes to `users_stickies` table)
    const { data: { user } } = await getSupabase().auth.getUser(bearer);
    if (user) return { type: "user", userId: user.id };

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
                    const { data, error } = await sb.from(table).insert([{
                        is_folder: false, title, content, folder_name,
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

    let title = "", content = "", folder_name: string | null = null, rawColor = "";

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
        folder_name = qFolder?.trim() || "CLAUDE";
        if (qColor?.trim()) rawColor = qColor.trim().toUpperCase();
    } else {
        let body: Record<string, unknown>;
        try { body = bodyForFolderCheck ?? await req.json(); }
        catch { return NextResponse.json({ error: "Invalid body — send JSON or raw markdown text" }, { status: 400 }); }
        title       = typeof body.title   === "string" ? body.title.trim() : "";
        content     = typeof body.content === "string" ? body.content : "";
        const folderField = (typeof body.folder === "string" ? body.folder : "") || (typeof body.folder_name === "string" ? body.folder_name : "");
        folder_name = folderField.trim() || "CLAUDE";
        rawColor    = typeof body.color   === "string" ? body.color.trim().toUpperCase() : "";
    }

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    if (!content?.trim()) return NextResponse.json({ error: "content required" }, { status: 400 });
    if (folder_name !== null && !folder_name?.trim()) return NextResponse.json({ error: "folder cannot be empty" }, { status: 400 });
    if (!folder_name?.trim()) folder_name = "CLAUDE";

    const sb = getSupabase();
    let folder_color = rawColor;
    if (!/^#[0-9A-F]{6}$/.test(folder_color)) {
        const { data: colorRows } = await sb.from(table).select("folder_color").eq("is_folder", false);
        const counts = new Map<string, number>(palette12.map((c) => [c, 0]));
        (colorRows ?? []).forEach((r: any) => { const c = String(r.folder_color ?? "").toUpperCase(); if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1); });
        folder_color = palette12.reduce((least, c) => (counts.get(c)! < counts.get(least)! ? c : least), palette12[0]);
    }

    const { data: maxRow } = await sb.from(table).select("order").eq("is_folder", false).order("order", { ascending: false }).limit(1).single();
    const nextOrder = typeof maxRow?.order === "number" ? maxRow.order + 1 : 0;
    const now = new Date().toISOString();

    const { data, error } = await sb.from(table).insert([{
        title, content, folder_name, folder_color, is_folder: false,
        order: nextOrder, created_at: now, updated_at: now, ...userField,
    }]).select().single();

    if (error) { console.error("[stickies POST]", error); return NextResponse.json({ error: "Database error" }, { status: 500 }); }

    if (auth.type === "apikey") {
        try { await getPusher().trigger("stickies", "note-created", data); } catch {}

        // Fire Hue + log automation run
        const sb2 = getSupabase();
        const { data: automation } = await sb2
            .from("automations")
            .select("id, name")
            .eq("trigger_type", "note_created")
            .eq("action_type", "hue_flash")
            .eq("active", true)
            .single();

        const hueRes = await fetch(`${process.env.PROD_BASE_URL ?? "https://bheng.vercel.app"}/api/hue/trigger`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ color: folder_color }),
        }).catch(() => null);

        const result = hueRes?.ok ? "success" : "error";

        if (automation) {
            await sb2.from("automation_logs").insert({
                automation_id: automation.id,
                automation_name: automation.name,
                triggered_at: new Date().toISOString(),
                result,
                detail: `Note "${data.title}" posted to ${data.folder_name}`,
                via: "api",
                trigger_payload: { note_id: data.id, title: data.title, folder_name: data.folder_name },
            }).catch(() => {});
        }
    }

    return NextResponse.json({ note: data }, { status: 201 });
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(req: Request) {
    const auth = await authenticate(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
