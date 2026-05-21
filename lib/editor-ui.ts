// Pure helpers for the note editor UI.
// Keeping these out of app/(app)/page.tsx lets us unit-test the small,
// user-facing behaviors (smart tags, switch colors, header tint, draft
// backup, tag truncation) without spinning up a React renderer.

export type AppTheme = "light" | "dark";
export type NoteFormat = "text" | "markdown" | "rich";

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

export function noteTileForeground(appTheme: AppTheme, bg: string, isLightFn: (hex: string) => boolean): string {
    if (appTheme === "light") return TILE_DARK_FG;
    return isLightFn(bg) ? TILE_DARK_FG : TILE_LIGHT_FG;
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
