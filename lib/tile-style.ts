// Pure style + className builders for a note/folder tile. No React, no app state -
// every input is passed in, so the outputs are fully unit-testable. Returned style
// objects include CSS custom properties (--fc etc.), so callers cast to CSSProperties.
import { shadedRowBg } from "./colors";
import { type AppTheme } from "./editor-ui";

export interface TileStyleItem {
    color?: string | null;
    folder_color?: string | null;
    is_folder?: boolean;
    name?: string | null;
}

export interface TileStyleOpts {
    showFileIcons: boolean;
    activeFolder: boolean;   // is a folder open (breadcrumb non-empty)
    parentColor: string;     // pre-resolved parent/row color (folderStack -> folders -> own)
    appTheme: AppTheme;
    idx: number;
    total: number;
    thumb?: boolean;         // thumbnail grid instead of a full-width row
}

/**
 * Inline style for a tile: every row shaded with a gradual parent-color gradient,
 * or a flat tint when file icons are shown.
 */
export function noteTileStyle(item: TileStyleItem, o: TileStyleOpts): Record<string, string> {
    const c = item.color || item.folder_color || "#888888";
    // A thumbnail is read at a glance across a grid, so the colour has to carry
    // the whole identity: a flat card of its own hue, no row gradient, no rule.
    if (o.thumb) {
        const tc = item.is_folder ? (item.color || item.folder_color || c) : (o.activeFolder ? o.parentColor : c);
        return {
            position: "relative", isolation: "isolate",
            "--row-color": tc, "--fc": tc,
            background: `${tc}${o.appTheme === "light" ? "26" : "1f"}`,
            border: `1px solid ${tc}59`,
        };
    }
    {
        if (!o.showFileIcons) {
            const isRootFolder = !o.activeFolder && !!item.is_folder;
            const isLight = o.appTheme === "light";
            return {
                position: "relative", isolation: "isolate",
                "--row-color": o.parentColor, "--fc": o.parentColor,
                borderBottom: `1px solid ${o.parentColor}30`,
                background: isRootFolder ? `${o.parentColor}${isLight ? "18" : "12"}` : shadedRowBg(o.parentColor, o.idx, o.total, false, isLight),
            };
        }
        const rowColor = item.is_folder ? (item.color || item.folder_color || c) : c;
        return {
            position: "relative", isolation: "isolate",
            "--row-color": rowColor, "--fc": rowColor,
            borderBottom: `1px solid ${rowColor}30`,
            ...(item.is_folder ? { background: `${rowColor}18` } : {}),
        };
    }
}

export interface TileClassOpts {
    isDragging: boolean;
    dropMode: "before" | "after" | "into" | null;
    incoming: boolean;
    removing: boolean;
    isSelectMode: boolean;
    selected: boolean;
    thumb?: boolean;
}

/** Class list for a tile. */
export function noteTileClassName(item: TileStyleItem, o: TileClassOpts): string {
    const shared = `${!item.is_folder && o.incoming ? "note-incoming" : ""} ${!item.is_folder && o.removing ? "note-removing" : ""} ${o.isDragging ? "opacity-30" : o.dropMode === "into" ? "ring-1 ring-inset ring-cyan-400" : ""} ${o.isSelectMode && !item.is_folder && o.selected ? "ring-1 ring-inset ring-blue-400" : ""}`;
    if (o.thumb) {
        return `group list-row-hover flex flex-col items-start gap-1 p-3 h-[104px] rounded-xl cursor-pointer select-none transition-colors overflow-hidden ${shared}`;
    }
    return `group list-row-hover flex items-center gap-3 pl-3 pr-3 min-h-[56px] sm:min-h-[54px] cursor-pointer select-none transition-colors active:bg-white/10 overflow-hidden ${!item.is_folder && o.incoming ? "note-incoming" : ""} ${!item.is_folder && o.removing ? "note-removing" : ""} ${o.isDragging ? "opacity-30" : o.dropMode === "into" ? "bg-cyan-950/60 ring-1 ring-inset ring-cyan-400" : ""} ${o.isSelectMode && !item.is_folder && o.selected ? "bg-blue-950/50" : ""} border-r-[3px] border-r-transparent`;
}
