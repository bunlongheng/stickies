import React from "react";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import PencilSquareIcon from "@heroicons/react/24/outline/PencilSquareIcon";
import HeartSolidIcon from "@heroicons/react/24/solid/HeartIcon";
import ArrowRightIcon from "@heroicons/react/24/outline/ArrowRightIcon";
import { FolderTileIcon } from "@/components/FolderTileIcon";
import { NoteTileIcon } from "@/components/NoteTileIcon";
import { looksLikeUrl, timeAgo } from "@/lib/text";
import { isOwnerBrowserNote, isHubMachine, machineIcon, forcedMachineIcon } from "@/lib/machines";
import { appIconForKey, DEFAULT_APP_ICON } from "@/lib/app-icons";

const OWNER_AVATAR = "/avatar.png";

export interface NoteTileListItem {
    id: string | number;
    is_folder?: boolean;
    name?: string | null;
    title?: string | null;
    content?: string | null;
    color?: string | null;
    folder_color?: string | null;
    folder_name?: string | null;
    subfolderCount?: number;
    count?: number;
    trashed_at?: string | null;
    created_by_key?: string | null;
    created_by_machine?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
    latestUpdatedAt?: string | null;
    icon?: string | null;
    locked?: boolean | null;
    is_public?: boolean | null;
}

/**
 * The contents of a LIST-mode row: select checkbox, folder/note icon, title +
 * meta, inline affordances (bookmark edit, pin), source-attribution badges, and
 * the trailing timestamp / folder arrow. Presentational - all opens, folder
 * navigation, and filter toggles are delegated to callbacks.
 */
export function NoteTileListBody({
    item,
    selected,
    showFileIcons,
    activeFolder,
    isSelectMode,
    pinned,
    createdByFilter,
    noteIcon,
    iconAnim,
    iconSpin,
    onOpen,
    onIconOpen,
    onEnterFolder,
    onSetFilter,
}: {
    item: NoteTileListItem;
    selected: boolean;
    showFileIcons: boolean;
    activeFolder: string | null;
    isSelectMode: boolean;
    pinned: boolean;
    createdByFilter: string | null;
    noteIcon?: string;
    iconAnim: boolean;
    iconSpin: boolean;
    onOpen: () => void;
    onIconOpen: () => void;
    onEnterFolder: () => void;
    onSetFilter: (next: string | null) => void;
}) {
    const title = item.title?.trim() || "Untitled";
    return (
        <>
            {isSelectMode && !item.is_folder && (
                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${selected ? "bg-blue-500 border-blue-500" : "border-zinc-600"}`}>
                    {selected && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
            )}
            {item.is_folder && (showFileIcons || !activeFolder) && (
                <FolderTileIcon item={item} onEnter={onEnterFolder} />
            )}
            {!item.is_folder && showFileIcons && (
                <NoteTileIcon
                    item={item}
                    noteIcon={noteIcon}
                    iconAnim={iconAnim}
                    iconSpin={iconSpin}
                    createdByFilter={createdByFilter}
                    onOpen={onIconOpen}
                    onSetFilter={onSetFilter}
                    hideSubBadge
                />
            )}
            <div className="flex-1 min-w-0 max-w-[80%]">
                <div className={`text-[14px] tracking-tight text-white truncate ${item.is_folder && !showFileIcons ? "font-bold" : "font-normal"}`}>
                    <span className="inline relative">
                        <span className="absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-300 ease-out" style={{ backgroundColor: "var(--row-color, rgba(255,255,255,0.5))" }} />
                        {item.is_folder ? <><span className="uppercase">{item.name}</span>{showFileIcons && activeFolder && <span className="text-white/30 ml-0.5">/</span>}</> : (title.length > 40 ? title.slice(0, 40) + "…" : title)}
                    </span>
                </div>
                {item.is_folder ? (
                    <div className={`text-[10px] ${!showFileIcons || !activeFolder ? "text-white/50" : "text-zinc-500"}`}>
                        {(item.subfolderCount ?? 0) > 0 && <span>{item.subfolderCount} folder{item.subfolderCount !== 1 ? "s" : ""}{(item.count ?? 0) > 0 ? " · " : ""}</span>}
                        {(item.count ?? 0) > 0 && <span>{item.count} note{item.count !== 1 ? "s" : ""}</span>}
                    </div>
                ) : null}
            </div>
            {!item.is_folder && looksLikeUrl(item.content || "") && !isSelectMode && (item.folder_name || activeFolder) !== "TEAM" && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                    className="p-1 opacity-0 group-hover:opacity-100 transition text-zinc-400 hover:text-white flex-shrink-0"
                    title="Edit bookmark"
                >
                    <PencilSquareIcon className="w-4 h-4" />
                </button>
            )}
            {!item.is_folder && pinned && !isSelectMode && (
                <HeartSolidIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />
            )}
            {/* Right-aligned: date + arrow */}
            {!item.is_folder && item.trashed_at && (
                <span className="text-sm text-red-500/70 font-medium whitespace-nowrap flex-shrink-0">
                    {(() => { const days = 7 - Math.floor((Date.now() - new Date(item.trashed_at).getTime()) / 86400000); return days > 0 ? `${days}d left` : "expiring"; })()}
                </span>
            )}
            {!item.is_folder && !showFileIcons && item.created_by_key && item.created_by_key !== item.created_by_machine && !isOwnerBrowserNote(item.created_by_key, item.created_by_machine) && (() => {
                const key = item.created_by_key as string;
                const icon = appIconForKey(key);
                const active = createdByFilter === key;
                const toggle = (e: React.MouseEvent) => { e.stopPropagation(); onSetFilter(active ? null : key); };
                return icon ? (
                    <button type="button" onClick={toggle} title={active ? `Filtering by ${key} - click to clear` : `Show only ${key}`}
                        className="flex-shrink-0 rounded-sm transition-all hover:scale-110"
                        style={active ? { outline: "2px solid #34c759", outlineOffset: 1 } : undefined}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={icon} alt={key} className="w-4 h-4 rounded-sm object-contain" />
                    </button>
                ) : (
                    <button type="button" onClick={toggle} title={active ? `Filtering by ${key} - click to clear` : `Show only ${key}`}
                        className="text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 border transition-all hover:scale-105"
                        style={{ borderColor: active ? "#34c759" : "var(--row-color, rgba(255,255,255,0.25))", color: active ? "#34c759" : "var(--row-color, rgba(255,255,255,0.6))", opacity: 0.85 }}>{key}</button>
                );
            })()}
            {!item.is_folder && !showFileIcons && item.created_by_machine && !isHubMachine(item.created_by_machine) && (() => {
                const machine = item.created_by_machine as string;
                const mIcon = machineIcon(machine);
                if (isOwnerBrowserNote(item.created_by_key, machine))
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={OWNER_AVATAR} alt="me" title="Created by me" className="hidden sm:block w-4 h-4 rounded-full object-cover flex-shrink-0" />;
                return mIcon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mIcon} alt={machine} title={`Posted from ${machine}`} className="hidden sm:block w-4 h-4 object-contain flex-shrink-0 opacity-80" />
                ) : (
                    <span className="hidden sm:inline-block text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 border" style={{ borderColor: "var(--row-color, rgba(255,255,255,0.2))", color: "var(--row-color, rgba(255,255,255,0.5))", opacity: 0.8 }} title={`Posted from ${machine}`}>{machine}</span>
                );
            })()}
            {/* Dedicated submitter icon on the right - who posted this note (posting app
                -> device -> owner -> default). Bigger than the old 9px on-icon sub-badge,
                using the space freed by the shorter title. Only in file-icon list mode. */}
            {!item.is_folder && showFileIcons && !item.trashed_at && (() => {
                const byKey = item.created_by_key ?? undefined;
                const byMachine = item.created_by_machine ?? undefined;
                const ownerBrowser = isOwnerBrowserNote(byKey, byMachine);
                // "Created by me" (browser note or the built-in "stickies" key) shows my
                // avatar. The work-laptop force-badge still wins first.
                const createdByMe = ownerBrowser || byKey === "stickies";
                const submitterIcon = forcedMachineIcon(byMachine) || (createdByMe ? OWNER_AVATAR : (appIconForKey(byKey) || machineIcon(byMachine) || DEFAULT_APP_ICON));
                const subKey = byKey || byMachine || null;
                const active = !!subKey && createdByFilter === subKey;
                return (
                    <button type="button"
                        onClick={(e) => { e.stopPropagation(); if (subKey) onSetFilter(active ? null : subKey); }}
                        title={subKey ? (active ? `Filtering by ${subKey} - click to clear` : `Show only ${subKey}`) : "Created in Stickies"}
                        className="flex-shrink-0 transition-all hover:scale-110"
                        style={active ? { outline: "2px solid #34c759", outlineOffset: 2, borderRadius: 6 } : undefined}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={submitterIcon} alt={subKey || "stickies"} className={`w-8 h-8 object-contain ${createdByMe ? "rounded-full object-cover" : "rounded-md"}`} />
                    </button>
                );
            })()}
            {!item.is_folder && !item.trashed_at && (item.updated_at || item.created_at) && (() => {
                // The All view is ordered by created_at, so show the creation time there
                // (the "X ago" must match the sort). Everywhere else shows last-edit time.
                const ts = (activeFolder === "All" ? (item.created_at || item.updated_at) : (item.updated_at || item.created_at)) as string;
                return (
                    <span className={`text-[10px] whitespace-nowrap flex-shrink-0 inline-block text-right ${activeFolder === "Today" ? "" : "min-w-[96px]"} ${!showFileIcons ? "text-white/40" : "text-zinc-500"}`}>{timeAgo(ts)}{activeFolder === "Today" ? "" : ` · ${new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</span>
                );
            })()}
            {item.is_folder && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(!!activeFolder || !showFileIcons) && <ArrowRightIcon className={`w-4 h-4 ${!showFileIcons ? "text-white/40" : "text-zinc-600"}`} />}
                    {item.latestUpdatedAt && (
                        <span className={`text-[10px] whitespace-nowrap ${!showFileIcons ? "text-white/40" : "text-zinc-500"}`}>{timeAgo(item.latestUpdatedAt)}{activeFolder === "Today" ? "" : ` · ${new Date(item.latestUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</span>
                    )}
                </div>
            )}
        </>
    );
}
