import type { NoteRow } from "./types";

// Pure helpers for the note editor UI.
// Keeping these out of app/(app)/page.tsx lets us unit-test the small,
// user-facing behaviors (smart tags, switch colors, header tint, draft
// backup, tag truncation) without spinning up a React renderer.

export type AppTheme = "light" | "dark";
export type NoteFormat = "text" | "rich";

// ─── Smart tags ──────────────────────────────────────────────────────────────
// Auto-tag a note when a configured keyword appears as a standalone token in
// the title or content. Word-boundary matching is intentional — naive `#hash`
// scanning produced too many false positives (hex colors, Slack channel names,
// anchor links). Add more entries here as the vocab grows.
export const SMART_TAGS: { tag: string; pattern: RegExp }[] = [
    { tag: "ai", pattern: /\bAI\b/i },
    { tag: "zeta", pattern: /\bzeta\b/i },
];

export function extractSmartTags(haystack: string): string[] {
    if (!haystack) return [];
    return SMART_TAGS.filter(({ pattern }) => pattern.test(haystack)).map(({ tag }) => tag);
}

export function mergeSmartTags(existing: string[], extracted: string[]): string[] {
    return Array.from(new Set([...(existing ?? []), ...(extracted ?? [])]));
}

// ─── Tag chip truncation ─────────────────────────────────────────────────────
export function truncateTagsForDisplay<T>(tags: T[], cap = 3): { visible: T[]; hiddenCount: number } {
    const list = tags ?? [];
    return {
        visible: list.length > cap ? list.slice(0, cap) : list,
        hiddenCount: Math.max(0, list.length - cap),
    };
}

// ─── Switch (toggle) colors ──────────────────────────────────────────────────
// One source of truth so every switch in the app stays visually identical.
export interface SwitchColors {
    background: string;
    border: string;
}

export function switchTrackColors(isOn: boolean, appTheme: AppTheme): SwitchColors {
    if (isOn) return { background: "#22c55e", border: "none" };
    if (appTheme === "light") return { background: "#d1d1d6", border: "1px solid rgba(0,0,0,0.1)" };
    return { background: "#48484a", border: "none" };
}

// ─── Editor header tint ──────────────────────────────────────────────────────
// 13% note-color tint (matches footer aesthetic). Falls back to a neutral
// chrome color when the note has no color set.
export interface HeaderColors {
    bg: string;
    border: string;
    text: string;
}

export function headerColors(noteColor: string | null | undefined, appTheme: AppTheme): HeaderColors {
    const bg = noteColor
        ? `${noteColor}22`
        : appTheme === "light"
            ? "#f5f5f5"
            : "#1e1e1e";
    const border = noteColor
        ? `${noteColor}55`
        : appTheme === "light"
            ? "rgba(0,0,0,0.06)"
            : "rgba(255,255,255,0.06)";
    const text = appTheme === "light" ? "#1a1a1a" : "#fff";
    return { bg, border, text };
}

// ─── Grid tile foreground rules ──────────────────────────────────────────────
// Bunlong's rules (kept colorful, dark-stroke in light):
//  - Light mode  = DARK icon/initial stroke (#1c1c1e)
//  - Dark mode   = white (#fff)  [folders] / contrast-vs-bg [notes]
//  - CLAUDE      = the ONE fixed-white tile, so its label is dark in BOTH themes
// IMPORTANT: never return "#1a1a1a" — that exact string trips the global
// [data-theme=light] [style*="#1a1a1a"]{background:#f2f2f7} override and silently
// greys the tile, wiping the folder color. Use "#1c1c1e".
export const TILE_DARK_FG = "#1c1c1e";
export const TILE_LIGHT_FG = "#fff";
/** The literal hex strings that, if placed in an inline style, get force-greyed in light mode. */
export const GREY_TRIGGER_HEXES = ["#1a1a1a", "#1e1e1e", "#222222", "#2a2a2a", "#050507"];

export function folderTileForeground(appTheme: AppTheme, isClaude = false): string {
    if (isClaude) return TILE_DARK_FG; // fixed-white tile -> always dark label
    return appTheme === "light" ? TILE_DARK_FG : TILE_LIGHT_FG;
}

// Same rule as folders — light = dark stroke, dark = white. Applies to note
// initials too ("all letters"). No per-bg contrast: the rule is absolute.
export function noteTileForeground(appTheme: AppTheme): string {
    return appTheme === "light" ? TILE_DARK_FG : TILE_LIGHT_FG;
}

/** CLAUDE is the single folder that renders as a fixed-white tile in both themes. */
export function isFixedWhiteTile(folderName: string | null | undefined): boolean {
    return folderName === "CLAUDE";
}

// ─── Draft backup (localStorage safety net) ──────────────────────────────────
export const DRAFT_BACKUP_KEY = "stickies:draft-backup:v1";

export interface DraftBackup {
    title: string;
    content: string;
    doc: { type?: string; content?: unknown[] } | null;
    color: string | null;
    folder: string | null;
    format: NoteFormat | null;
    type: string | null;
    savedAt: string;
}

export interface DraftBackupInput {
    title?: string;
    content?: string;
    doc?: { type?: string; content?: unknown[] } | null;
    color?: string | null;
    folder?: string | null;
    format?: NoteFormat | null;
    type?: string | null;
}

export function backupHasWork(b: Partial<DraftBackup> | null | undefined): boolean {
    if (!b) return false;
    const hasTitle = typeof b.title === "string" && b.title.trim().length > 0;
    const hasContent = typeof b.content === "string" && b.content.trim().length > 0;
    const hasDoc = !!(b.doc && Array.isArray((b.doc as { content?: unknown[] }).content) && (b.doc as { content?: unknown[] }).content!.length > 0);
    return hasTitle || hasContent || hasDoc;
}

export function serializeDraft(state: DraftBackupInput, now: Date = new Date()): DraftBackup {
    return {
        title: state.title || "",
        content: state.content || "",
        doc: state.doc || null,
        color: state.color || null,
        folder: state.folder || null,
        format: state.format || null,
        type: state.type || null,
        savedAt: now.toISOString(),
    };
}

export function parseDraftBackup(raw: string | null | undefined): DraftBackup | null {
    if (!raw) return null;
    try {
        const b = JSON.parse(raw) as DraftBackup;
        return backupHasWork(b) ? b : null;
    } catch {
        return null;
    }
}

// ─── Unsaved draft detection ─────────────────────────────────────────────────
// Used by the tab bar to inject a synthetic "current draft" tab so the user
// always sees what they're editing, even before the 2s autosave fires.
export function isUnsavedDraft(editorOpen: boolean, editingNoteId: string | number | null | undefined): boolean {
    if (!editorOpen) return false;
    if (editingNoteId == null) return true;
    return String(editingNoteId).length === 0;
}

// ─── Rich-doc sanitization ───────────────────────────────────────────────────
// While an image upload is in-flight the rich editor shows a `placeholder://`
// image node (a dashed spinner). That node must NEVER be persisted: if it
// reaches the DB it reloads as a broken-image spinner with no upload left to
// resolve it — the "image upload is unreliable / stuck" bug. We strip these
// nodes from the doc both before every save and on load (so already-broken
// notes self-heal). The real image node replaces the placeholder once the
// upload lands, firing another save with the correct URL.
export const PLACEHOLDER_IMAGE_PREFIX = "placeholder://";

// A file the rich editor can embed as an image. Checks the MIME type first,
// then falls back to the extension for formats browsers don't always type
// (HEIC/HEIF from iOS, JFIF, etc.). Used by both paste and drag-and-drop.
export function isImageFile(f: File): boolean {
    return f.type.startsWith("image/") ||
        /\.(heic|heif|webp|avif|png|jpg|jpeg|gif|svg|bmp|tiff?|ico|jfif)$/i.test(f.name);
}

// True when a drag/drop event carries external files (vs. an internal node
// move). Lets the editor show its drop overlay only for real file drags and
// leave ProseMirror's internal drag-to-reorder untouched.
export function dragHasFiles(dt: { types?: readonly string[] | string[] } | null | undefined): boolean {
    return !!dt && Array.from(dt.types ?? []).includes("Files");
}

// Cmd+K relevance tier for a note (lower = better). Match QUALITY picks the
// tier; the caller breaks ties WITHIN a tier by recency (date desc). Prefix and
// substring title matches deliberately share one tier so the LATEST title match
// floats to the top — don't bury a fresh "Email to Vincent…" under an older note
// that merely starts with the query. Returns CMDK_NO_MATCH when nothing matches.
export const CMDK_NO_MATCH = 9;

export function cmdkMatchTier(title: string, content: string, query: string, pinned = false): number {
    const t = (title || "").toLowerCase();
    const c = (content || "").toLowerCase();
    const q = query.toLowerCase();
    if (!q) return CMDK_NO_MATCH;
    if (t === q) return 0;
    if (t.includes(q)) return pinned ? 1 : 2;
    if (pinned && c.includes(q)) return 3;
    if (c.includes(q)) return 4;
    return CMDK_NO_MATCH;
}

// Merge a freshly-fetched batch of recent notes into the existing rows without
// clobbering folders or un-confirmed optimistic notes. Fetched notes win for
// matching ids so creates/edits made elsewhere apply. Backs the realtime
// catch-up that runs on tab refocus / reconnect (covers events missed while the
// Pusher socket was asleep).
export function mergeRecentNotes<T extends { id: string | number; is_folder?: boolean; _optimistic?: boolean }>(
    prev: T[],
    incoming: T[],
): T[] {
    const freshIds = new Set(incoming.map((n) => String(n.id)));
    const kept = prev.filter((r) => r.is_folder || r._optimistic || !freshIds.has(String(r.id)));
    return [...kept, ...incoming];
}

export function stripPlaceholderImages<T>(node: T): T {
    const n = node as unknown as { type?: string; attrs?: { src?: unknown }; content?: unknown[] };
    if (!n || typeof n !== "object" || !Array.isArray(n.content)) return node;
    return {
        ...n,
        content: n.content
            .filter((c) => {
                const child = c as { type?: string; attrs?: { src?: unknown } };
                return !(child?.type === "image" && typeof child?.attrs?.src === "string" && child.attrs.src.startsWith(PLACEHOLDER_IMAGE_PREFIX));
            })
            .map((c) => stripPlaceholderImages(c)),
    } as unknown as T;
}

// ── Cmd-K palette search ───────────────────────────────────────────────
// Pure helpers backing the Cmd-K palette. Kept out of the client component so
// the tiering/merge logic is unit-testable in isolation. See useCmdK for the
// state + debounce/server-fetch effects and CmdKPalette for the render.

export interface CmdKIndexEntry {
    _orig: NoteRow;
    t: string;
    f: string;
    c: string;
    date: string;
}

export type CmdKFolder = { name: string;[key: string]: unknown };

// A palette row is one of three shapes, discriminated by _isFolder / _isLine:
//  - a note (NoteRow, neither flag), an in-file line hit, or a matched folder.
// The index signatures keep it structurally permissive for the presentational
// render while giving callers real discriminants to narrow on.
export interface CmdKLineHit { _isLine: true; id: string; lineNum: number; text: string;[key: string]: unknown }
export interface CmdKFolderHit extends CmdKFolder { _isFolder: true; _score: number }
export type CmdKResultItem = NoteRow | CmdKFolderHit | CmdKLineHit;

// Search index — pre-sorted by date descending so the empty-query case is an
// O(1) slice. Rebuilt only when dbData changes, never on keystroke.
export function buildCmdKIndex(dbData: NoteRow[]): CmdKIndexEntry[] {
    return dbData
        .filter((n) => !n.is_folder)
        .map((n) => ({
            _orig: n,
            t: (n.title || "").toLowerCase(),
            f: (n.folder_name || "").toLowerCase(),
            // Only index first 400 chars of content — enough for a match signal
            c: (n.content || "").slice(0, 400).toLowerCase(),
            date: String(n.updated_at || ""),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
}

// Pre-built folder name → db row map — avoids O(n×m) dbData.find() in results.
export function buildFolderLookup(dbData: NoteRow[]): Map<string, NoteRow> {
    const map = new Map<string, NoteRow>();
    dbData.forEach((r) => { if (r.is_folder) map.set(r.folder_name || (r.name as string), r); });
    return map;
}

export interface CmdKResultsArgs {
    cmdKIndex: CmdKIndexEntry[];
    folderLookup: Map<string, NoteRow>;
    folders: CmdKFolder[];
    pinnedIds: Set<string>;
    deferredContent: string;
    cmdKInFile: boolean;
    deferredCmdKQuery: string;
    cmdKServerResults: NoteRow[];
}

export function computeCmdKResults(args: CmdKResultsArgs): CmdKResultItem[] {
    const { cmdKIndex, folderLookup, folders, pinnedIds, deferredContent, cmdKInFile, deferredCmdKQuery, cmdKServerResults } = args;
    // In-file mode: search lines of the current note
    if (cmdKInFile) {
        if (!deferredCmdKQuery.trim()) return [];
        const q = deferredCmdKQuery.toLowerCase();
        return (deferredContent || "").split("\n")
            .map((line, i) => ({ _isLine: true as const, id: `line_${i}`, lineNum: i + 1, text: line }))
            .filter(item => item.text.toLowerCase().includes(q))
            .slice(0, 100);
    }
    if (!deferredCmdKQuery.trim()) {
        // Before typing: suggest the 5 most-recently-CREATED notes (newest first).
        return [...cmdKIndex]
            .sort((a, b) => String(b._orig.created_at || "").localeCompare(String(a._orig.created_at || "")))
            .slice(0, 5)
            .map(x => x._orig);
    }
    const q = deferredCmdKQuery.toLowerCase();
    const matchingFolders = folders
        .filter(f => {
            if (f.name.toUpperCase() === "BOOKMARKS") return false;
            const dbRow = folderLookup.get(f.name);
            if (dbRow?.parent_folder_name?.toUpperCase() === "BOOKMARKS") return false;
            return f.name.toLowerCase().includes(q);
        })
        .map(f => {
            const fn = f.name.toLowerCase();
            const score = fn === q ? 0 : fn.startsWith(q) ? 1 : 2;
            return { ...f, _isFolder: true as const, _score: score };
        })
        .sort((a, b) => a._score - b._score)
        .slice(0, 5);
    // Match QUALITY decides the tier; recency (date desc, below) decides order
    // WITHIN a tier so the LATEST matching note floats to the top.
    const scoreEntry = (e: CmdKIndexEntry): number =>
        cmdkMatchTier(e.t, e.c, q, pinnedIds.has(String(e._orig.id)));
    const scored = cmdKIndex
        .map(e => ({ row: e._orig, s: scoreEntry(e), date: e.date }))
        .filter(x => x.s < CMDK_NO_MATCH);
    // Merge server hits not already in the local index. The search endpoint omits
    // content, so a row whose title doesn't contain q must have matched on body → tier 4.
    const localIds = new Set(scored.map(x => String(x.row.id)));
    const serverScored = cmdKServerResults
        .filter((n) => !n.is_folder && !n.trashed_at && !localIds.has(String(n.id)))
        .map((n) => {
            const s = (n.title || "").toLowerCase().includes(q)
                ? cmdkMatchTier(n.title || "", "", q, pinnedIds.has(String(n.id)))
                : CMDK_NO_MATCH - 1;
            return { row: n, s, date: String(n.updated_at || "") };
        });
    // Newest match on top: order purely by recency (updated_at DESC, then
    // created_at DESC as the tie-break) - the match tier only gates what qualifies
    // (filtered above), it no longer decides row order.
    const merged = [...scored, ...serverScored]
        .sort((a, b) => {
            const au = String(a.row.updated_at || ""), bu = String(b.row.updated_at || "");
            if (au !== bu) return bu.localeCompare(au);
            return String(b.row.created_at || "").localeCompare(String(a.row.created_at || ""));
        })
        .slice(0, 30);
    // Notes first, folder (notebook) matches pinned to the BOTTOM of the list.
    return [...merged.map(x => x.row), ...matchingFolders];
}

// ── Note ordering (extracted from app/(app)/page.tsx to shrink the God component
// and make the ordering rules unit-testable) ───────────────────────────────────
type OrderableNote = {
    _pinnedToTop?: boolean;
    updated_at?: string | null;
    created_at?: string | null;
    title?: string | null;
    name?: string | null;
};

/** Order notes by last-EDIT time (updated_at) - the source of truth for the list
 *  body AND the tab strip so they always agree. Optimistic new notes pin to top;
 *  ties broken by title so same-timestamp notes stay stable. */
export function noteOrderByUpdated(a: OrderableNote, b: OrderableNote): number {
    if (a._pinnedToTop && !b._pinnedToTop) return -1;
    if (b._pinnedToTop && !a._pinnedToTop) return 1;
    return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")) ||
        String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
}

/** Order notes by CREATION time (created_at) - used by the "All" view so an edit
 *  never jumps a note to the top. Newest-created first; ties broken by title. */
export function noteOrderByCreated(a: OrderableNote, b: OrderableNote): number {
    if (a._pinnedToTop && !b._pinnedToTop) return -1;
    if (b._pinnedToTop && !a._pinnedToTop) return 1;
    return String(b.created_at || b.updated_at || "").localeCompare(String(a.created_at || a.updated_at || "")) ||
        String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
}

// ── Display-items selection (extracted verbatim from app/(app)/page.tsx to shrink
// the God component + make the All/Today/folder/search selection unit-testable) ──
type DisplayNote = {
    id?: string | number;
    is_folder?: boolean;
    trashed_at?: string | null;
    folder_name?: string | null;
    folder_id?: string | null;
    title?: string | null;
    content?: string | null;
    name?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    color?: string | null;
    [k: string]: unknown;
};

export interface DisplayItemsArgs {
    dbData: DisplayNote[];
    activeFolder: string | null;
    folderStack: { id: string }[];
    search: string;
    currentLevelFolders: DisplayNote[];
    pinnedIds: Set<string>;
    todayNotes: DisplayNote[];
    todayDays: number;
    allNotes: DisplayNote[];
    showFileIcons: boolean;
    // Server-side search matches (title OR content ILIKE, case-insensitive). The loaded
    // list rows carry no `content`, so a content-only match (e.g. searching "repo-recon"
    // to hit the "/repo-recon" skill chip in a note titled "Repo Recon") is invisible
    // client-side; these fill that gap.
    searchResults?: DisplayNote[];
}

/** The ordered items shown in the main view: search results, or the Today / All
 *  virtual views, or the notes+folders of the active folder, or the root folder grid.
 *  Pure - identical behaviour to the old inline useMemo, now testable in isolation. */
export function computeDisplayItems(a: DisplayItemsArgs): DisplayNote[] {
    const { dbData, activeFolder, folderStack, search, currentLevelFolders, pinnedIds, todayNotes, todayDays, allNotes, showFileIcons, searchResults } = a;
    const byUpdated = noteOrderByUpdated;
    const byCreated = noteOrderByCreated;
    // Prune soft-deleted (TRASH) ids so a just-deleted note vanishes from All/Today
    // immediately instead of lingering until a hard refresh reloads the virtual states.
    const trashedIds = new Set(
        dbData.filter((n) => !n.is_folder && (n.trashed_at || n.folder_name === "TRASH")).map((n) => String(n.id))
    );
    if (search.trim()) {
        const q = search.toLowerCase();
        const score = (n: DisplayNote): number => {
            const t = (n.title || "").toLowerCase();
            const f = (n.folder_name || "").toLowerCase();
            const c = (n.content || "").toLowerCase();
            const pinned = pinnedIds.has(String(n.id));
            if (f === q)           return 0;
            if (f.startsWith(q))   return 1;
            if (f.includes(q))     return 2;
            if (t === q)           return 3;
            if (t.startsWith(q))   return 4;
            if (t.includes(q))     return pinned ? 5 : 6;
            if (pinned && c.includes(q)) return 7;
            if (c.includes(q))     return 8;
            return 9;
        };
        const local = dbData
            .filter((n) => !n.is_folder && !n.trashed_at && score(n) < 9)
            .sort((x, y) => { const sd = score(x) - score(y); return sd !== 0 ? sd : byUpdated(x, y); });
        // Append server-side matches (title OR content ILIKE) the client can't see because
        // list rows have no content. These are the content/skill-chip matches (case-insensitive).
        if (!searchResults || !searchResults.length) return local;
        const seen = new Set(local.map((n) => String(n.id)));
        const extra = searchResults.filter((n) => !n.is_folder && !n.trashed_at && n.folder_name !== "TRASH" && !seen.has(String(n.id)));
        return [...local, ...extra];
    }
    if (activeFolder) {
        if (activeFolder === "Today") {
            const windowStart = new Date(Date.now() - todayDays * 24 * 60 * 60 * 1000);
            const seen = new Set<string>();
            const notes = [
                ...todayNotes.filter((n) => !trashedIds.has(String(n.id))),
                ...dbData.filter((n) => !n.is_folder && !n.trashed_at && new Date((n.created_at as string) || 0) >= windowStart),
            ]
                .filter((n) => !n.is_folder && !n.trashed_at && new Date((n.created_at as string) || 0) >= windowStart)
                .filter((n) => { const id = String(n.id); if (seen.has(id)) return false; seen.add(id); return true; })
                .sort(byUpdated);
            return showFileIcons ? [...currentLevelFolders, ...notes] : [...notes, ...currentLevelFolders];
        }
        if (activeFolder === "All") {
            const liveNote = (n: DisplayNote) => !n.is_folder && !n.trashed_at && n.folder_name !== "TRASH";
            if (!allNotes.length) {
                const cached = dbData.filter(liveNote).sort(byCreated).slice(0, 20);
                return showFileIcons ? [...currentLevelFolders, ...cached] : [...cached, ...currentLevelFolders];
            }
            const seen = new Set<string>();
            const windowStart = String(allNotes.at(-1)?.created_at ?? "");
            const notes = [
                ...allNotes.filter((n) => !trashedIds.has(String(n.id))),
                ...dbData.filter((n) => liveNote(n) && String(n.created_at || "") >= windowStart),
            ]
                .filter(liveNote)
                .filter((n) => { const id = String(n.id); if (seen.has(id)) return false; seen.add(id); return true; })
                .sort(byCreated);
            return showFileIcons ? [...currentLevelFolders, ...notes] : [...notes, ...currentLevelFolders];
        }
        const activeFolderId = folderStack.at(-1)?.id ?? null;
        const useUuid = activeFolderId && !activeFolderId.startsWith("virtual-");
        const notes = dbData.filter((n) => {
            if (n.is_folder) return false;
            if (activeFolder === "TRASH") return n.folder_name === "TRASH";
            const inFolder = n.folder_id
                ? (useUuid && String(n.folder_id) === activeFolderId)
                : n.folder_name === activeFolder;
            return inFolder && n.folder_name !== "TRASH" && !n.trashed_at;
        }).sort(byUpdated);
        return showFileIcons ? [...currentLevelFolders, ...notes] : [...notes, ...currentLevelFolders];
    }
    return currentLevelFolders;
}
