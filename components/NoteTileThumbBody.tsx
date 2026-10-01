import React from "react";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import HeartSolidIcon from "@heroicons/react/24/solid/HeartIcon";
import { FolderTileIcon } from "@/components/FolderTileIcon";
import { timeAgo } from "@/lib/text";
import { type NoteTileListItem } from "@/components/NoteTileListBody";

/**
 * The contents of a THUMBNAIL card. A card is read in a grid at arm's length,
 * so it carries only what survives that distance: the name, one line of what is
 * inside, and the count. Everything else (attribution badges, bookmark edit,
 * the trailing arrow) belongs to the list row, which has the width for it.
 */
export function NoteTileThumbBody({
    item,
    selected,
    isSelectMode,
    pinned,
    onEnterFolder,
}: {
    item: NoteTileListItem;
    selected: boolean;
    isSelectMode: boolean;
    pinned: boolean;
    onEnterFolder: () => void;
}) {
    const title = item.is_folder ? (item.name || "Untitled") : (item.title?.trim() || "Untitled");
    const ts = item.is_folder ? item.latestUpdatedAt : (item.updated_at || item.created_at);
    const preview = (item.content || "").replace(/\s+/g, " ").trim();

    return (
        <>
            <div className="flex items-center gap-2 w-full min-w-0">
                {isSelectMode && !item.is_folder && (
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${selected ? "bg-blue-500 border-blue-500" : "border-zinc-600"}`}>
                        {selected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                    </div>
                )}
                {item.is_folder && <FolderTileIcon item={item} onEnter={onEnterFolder} />}
                {pinned && !item.is_folder && <HeartSolidIcon className="w-3 h-3 text-white flex-shrink-0" />}
            </div>
            <div className={`text-[13px] leading-tight tracking-tight text-white w-full line-clamp-2 ${item.is_folder ? "font-bold uppercase" : "font-normal"}`}>
                {title}
            </div>
            {!item.is_folder && preview && (
                <div className="text-[11px] leading-snug text-white/45 w-full line-clamp-2">{preview}</div>
            )}
            <div className="mt-auto flex items-center gap-1.5 text-[10px] text-white/40 w-full">
                {item.is_folder ? (
                    <span>
                        {(item.subfolderCount ?? 0) > 0 && `${item.subfolderCount} folder${item.subfolderCount !== 1 ? "s" : ""}`}
                        {(item.subfolderCount ?? 0) > 0 && (item.count ?? 0) > 0 && " · "}
                        {(item.count ?? 0) > 0 && `${item.count} note${item.count !== 1 ? "s" : ""}`}
                    </span>
                ) : null}
                {ts && <span className="ml-auto whitespace-nowrap">{timeAgo(ts)}</span>}
            </div>
        </>
    );
}
