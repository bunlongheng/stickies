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
}

/**
 * Inline style for a tile: every row shaded with a gradual parent-color gradient,
 * or a flat tint when file icons are shown.
 */
export function noteTileStyle(item: TileStyleItem, o: TileStyleOpts): Record<string, string> {
    const c = item.color || item.folder_color || "#888888";
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
}

/** Class list for a tile. */
export function noteTileClassName(item: TileStyleItem, o: TileClassOpts): string {
    return `group list-row-hover flex items-center gap-3 pl-3 pr-3 min-h-[56px] sm:min-h-[54px] cursor-pointer select-none transition-colors active:bg-white/10 overflow-hidden ${!item.is_folder && o.incoming ? "note-incoming" : ""} ${!item.is_folder && o.removing ? "note-removing" : ""} ${o.isDragging ? "opacity-30" : o.dropMode === "into" ? "bg-cyan-950/60 ring-1 ring-inset ring-cyan-400" : ""} ${o.isSelectMode && !item.is_folder && o.selected ? "bg-blue-950/50" : ""} border-r-[3px] border-r-transparent`;
}
