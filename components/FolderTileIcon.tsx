import React from "react";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import { FolderIconDisplay } from "@/components/FolderIconDisplay";
import { palette12 } from "@/lib/colors";

export interface FolderTileIconItem {
    id: string | number;
    name?: string | null;
    color?: string | null;
    folder_color?: string | null;
    icon?: string | null;
}

/**
 * The 54x54 folder icon badge shown in list mode. CLAUDE and TRASH get their
 * fixed glyphs; every other folder renders its chosen hero icon. Presentational:
 * the click (which navigates into the folder, guarded against tap bleed-through)
 * is delegated to onEnter.
 */
export function FolderTileIcon({ item, onEnter }: { item: FolderTileIconItem; onEnter: () => void }) {
    const c = item.color || item.folder_color || palette12[0];
    return (
        <button type="button" data-icon-sq
            onClick={(e) => { e.stopPropagation(); onEnter(); }}
            className={`folder-icon-badge${item.name === "CLAUDE" ? " folder-icon-badge-claude" : ""} flex-shrink-0 w-[48px] h-[48px] sm:w-[46px] sm:h-[46px] m-1 sm:m-0 flex items-center justify-center font-black overflow-hidden`}
            style={{ fontSize: 22, "--fc": c, "--ic": "#fff", boxShadow: `2px 3px 8px ${c}55` } as React.CSSProperties}>
            {item.name === "CLAUDE"
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                : item.name === "TRASH"
                ? <TrashIcon className="w-6 h-6 text-white" />
                : <FolderIconDisplay value={item.icon || ""} folderName={item.name || "F"} className="w-6 h-6" />}
        </button>
    );
}
