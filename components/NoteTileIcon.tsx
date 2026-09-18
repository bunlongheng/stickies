import React from "react";
import { FolderIconDisplay, AUDIT_GLASS_ICONS } from "@/components/FolderIconDisplay";
import { meaningfulInitial } from "@/lib/text";
import { isLightColor } from "@/lib/colors";
import { isHubMachine, machineIcon, hubMachineIcon, isOwnerBrowserNote, forcedMachineIcon } from "@/lib/machines";
import { appIconForKey, DEFAULT_APP_ICON } from "@/lib/app-icons";
import { LockClosedIcon, GlobeAltIcon, KeyIcon } from "@heroicons/react/24/outline";

const OWNER_AVATAR = "/avatar.png";

// The combined audit-family marks are detailed (glass + inner icon), so they render
// ~20% larger than a plain hero icon for breathing room - and ALL at the same size so
// the search glass is identical across every audit skill. Sourced from FolderIconDisplay
// (single source of truth) so a new audit mark can never render smaller than the rest.
const AUDIT_MARKS = AUDIT_GLASS_ICONS;

export interface NoteTileIconItem {
    id: string | number;
    title?: string | null;
    color?: string | null;
    folder_color?: string | null;
    created_by_key?: string | null;
    created_by_machine?: string | null;
    locked?: boolean | null;
    frozen?: boolean | null;
    is_public?: boolean | null;
}

/**
 * The 54x54 note icon (custom icon or first-letter initial) with its source
 * sub-badge (posting app -> device -> owner avatar -> default). Presentational:
 * all state is passed in, and the two clicks are delegated to onOpen / onSetFilter.
 */
export function NoteTileIcon({
    item,
    noteIcon,
    iconAnim,
    iconSpin,
    createdByFilter,
    onOpen,
    onSetFilter,
    hideSubBadge,
}: {
    item: NoteTileIconItem;
    noteIcon?: string;
    iconAnim: boolean;
    iconSpin: boolean;
    createdByFilter: string | null;
    onOpen: () => void;
    onSetFilter: (next: string | null) => void;
    hideSubBadge?: boolean;
}) {
    const nc = item.color || item.folder_color || "#71717a";
    // App-logo main icons (icon:"__app:<key>") get a fixed WHITE tile with the logo
    // filling it - a brand "app icon" look - instead of the note-colored tile.
    const isAppIcon = typeof noteIcon === "string" && noteIcon.startsWith("__app:");
    // A white or very light tile disappears against the light list background, so
    // give it a thin silver border to keep the edge visible.
    // Border ONLY on the white-background file/app icons (so their edge is visible against
    // the white list). Colored tiles - even light ones like lime/yellow - get no border.
    const needsBorder = isAppIcon;
    const initial = meaningfulInitial(item.title || "", "N");
    const noteTextColor = isLightColor(nc) ? "#1c1c1e" : "#fff";
    const byKey = item.created_by_key ?? undefined;
    const byMachine = item.created_by_machine ?? undefined;
    // Genuine hub system reports (M4 deep audits / health checks, no app key)
    // honestly show the M4 mac-mini icon; every other M4 post keeps its hidden badge.
    const isHubReport = isHubMachine(byMachine) && !appIconForKey(byKey) && /deep audit|health check|health report|mac health/i.test(item.title || "");
    // Every note ALWAYS shows a source sub-icon: posting app, else the device it
    // came from, else a default. Never render a bare note.
    const ownerBrowser = isOwnerBrowserNote(byKey, byMachine);
    // "Created by me" = a note I made myself: a browser note OR the built-in owner key
    // ("stickies"). Show my avatar, never the generic stickies app icon.
    const createdByMe = ownerBrowser || byKey === "stickies";
    // A force-badged machine (the M2 work laptop) always wins - so you instantly know
    // a note was pushed from work, regardless of which app/key submitted it.
    const keyIcon = forcedMachineIcon(byMachine) || (createdByMe ? OWNER_AVATAR : (appIconForKey(byKey) || (isHubReport ? hubMachineIcon() : null) || machineIcon(byMachine) || DEFAULT_APP_ICON));
    const subKey = byKey || byMachine || null;
    const keyActive = !!subKey && createdByFilter === subKey;
    return (
        <div className="relative flex-shrink-0 m-1 sm:m-0">
            <button type="button" data-icon-sq
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                className="w-[48px] h-[48px] sm:w-[46px] sm:h-[46px] flex items-center justify-center font-black overflow-hidden relative"
                style={{
                    fontSize: 22,
                    backgroundColor: isAppIcon ? "#fff" : nc,
                    color: noteTextColor,
                    borderRadius: "24%",
                    border: needsBorder ? "1px solid #d1d1d6" : undefined,
                    boxShadow: `2px 3px 8px ${nc}55`,
                }}>
                {noteIcon ? <FolderIconDisplay value={noteIcon} folderName={item.title || "N"} className={`${isAppIcon ? "w-full h-full" : AUDIT_MARKS.has(noteIcon) ? "w-[23px] h-[23px]" : "w-[19px] h-[19px]"}${iconAnim ? " animate-[iconBlink3_1.2s_ease-in-out]" : ""}`} /> : <span className={iconSpin ? "animate-[iconSpin_0.25s_linear_infinite] inline-block" : ""}>{initial}</span>}
                {iconSpin && <>
                    <span className="absolute inset-0 rounded-[24%] animate-[iconWindSwirl_0.5s_linear_infinite] pointer-events-none" style={{ background: "conic-gradient(from 0deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)" }} />
                    <span className="absolute inset-0 rounded-[24%] animate-[iconWindSwirl_0.8s_linear_infinite] pointer-events-none" style={{ background: "conic-gradient(from 180deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)" }} />
                </>}
            </button>
            {!hideSubBadge && (
            <button type="button"
                onClick={(e) => { e.stopPropagation(); if (subKey) onSetFilter(keyActive ? null : subKey); }}
                title={subKey ? (keyActive ? `Filtering by ${subKey} - click to clear` : `Show only ${subKey}`) : "Created in Stickies"}
                className="absolute -bottom-[2px] -right-[2px] w-[9px] h-[9px] flex items-center justify-center transition-all hover:scale-110"
                style={keyActive ? { outline: "2px solid #34c759", outlineOffset: 1, borderRadius: 4 } : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={keyIcon} alt={subKey || "stickies"} className={`w-[9px] h-[9px] object-contain ${createdByMe ? "rounded-full object-cover" : "rounded-sm"}`} />
            </button>
            )}
            {/* Status badge, distinct icons so they never read the same:
                  frozen (write-lock)   -> LOCK   (can't edit/delete)
                  locked (passcode share) -> KEY   (Private, needs a passcode)
                  is_public             -> GLOBE  (anyone with the link)
                Priority frozen > private > public. Bottom-right in list mode
                (sub-badge hidden), top-right in grid mode. */}
            {(item.frozen || item.locked || item.is_public) && (
                <span
                    title={item.frozen ? "Locked - no edits" : item.locked ? "Private - passcode" : "Public"}
                    className={`absolute ${hideSubBadge ? "-bottom-[2px]" : "-top-[2px]"} -right-[2px] w-[10px] h-[10px] rounded-full flex items-center justify-center pointer-events-none`}
                    style={{ background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                    {item.frozen
                        ? <LockClosedIcon className="w-[7px] h-[7px] text-zinc-800" />
                        : item.locked
                            ? <KeyIcon className="w-[7px] h-[7px] text-zinc-800" />
                            : <GlobeAltIcon className="w-[7px] h-[7px] text-zinc-800" />}
                </span>
            )}
        </div>
    );
}
