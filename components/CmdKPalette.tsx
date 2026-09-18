import React from "react";
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import ChevronRightIcon from "@heroicons/react/24/outline/ChevronRightIcon";
import BookmarkIcon from "@heroicons/react/24/solid/BookmarkIcon";
import HeartSolidIcon from "@heroicons/react/24/solid/HeartIcon";
import { FolderIconDisplay } from "@/components/FolderIconDisplay";
import { palette12 } from "@/lib/colors";
import { looksLikeUrl, timeAgo } from "@/lib/text";
import type { CmdKResultItem } from "@/lib/editor-ui";
import type { NoteRow } from "@/lib/types";

interface CmdKPaletteProps {
    showCmdK: boolean;
    setShowCmdK: React.Dispatch<React.SetStateAction<boolean>>;
    cmdKQuery: string;
    setCmdKQuery: React.Dispatch<React.SetStateAction<string>>;
    cmdKCursor: number;
    setCmdKCursor: React.Dispatch<React.SetStateAction<number>>;
    cmdKGlobal: boolean;
    setCmdKGlobal: React.Dispatch<React.SetStateAction<boolean>>;
    cmdKInFile: boolean;
    cmdKInputRef: React.RefObject<HTMLInputElement | null>;
    cmdKResults: CmdKResultItem[];
    openNoteFromCmdK: (note: CmdKResultItem) => void;
    openAllFromCmdK: () => void;
    activeFolder: string | null;
    dbData: NoteRow[];
    pinnedIds: Set<string>;
    enterFolder: (frame: { id: string; name: string; color: string }) => void;
    loadFolderNotes: (folderName: string, append?: boolean) => void;
}

export function CmdKPalette({
    showCmdK, setShowCmdK, cmdKQuery, setCmdKQuery, cmdKCursor, setCmdKCursor,
    cmdKGlobal, setCmdKGlobal, cmdKInFile, cmdKInputRef, cmdKResults,
    openNoteFromCmdK, openAllFromCmdK, activeFolder, dbData, pinnedIds, enterFolder, loadFolderNotes,
}: CmdKPaletteProps) {
    if (!showCmdK) return null;
    const hasQuery = cmdKQuery.trim().length > 0;
    // Only surface note matches (and the open-all affordance) once the user has typed —
    // an empty query should suggest nothing.
    const noteMatchCount = (cmdKInFile || !hasQuery) ? 0 : cmdKResults.filter((r: any) => !r._isFolder && !r._isLine).length;
    return (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCmdK(false)}>
            <div className="w-full max-w-lg bg-zinc-900 border border-white/15 shadow-2xl overflow-hidden rounded-2xl"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                    if (e.key === "Escape") { setShowCmdK(false); return; }
                    if (e.key === "ArrowDown") { e.preventDefault(); setCmdKCursor(v => Math.min(v + 1, cmdKResults.length - 1)); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setCmdKCursor(v => Math.max(v - 1, 0)); }
                    if (e.key === "Enter" && (e.metaKey || e.altKey) && noteMatchCount > 1) { e.preventDefault(); openAllFromCmdK(); return; }
                    if (e.key === "Enter" && cmdKResults[cmdKCursor]) openNoteFromCmdK(cmdKResults[cmdKCursor]);
                }}>
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                    <MagnifyingGlassIcon className="w-6 h-6 text-white/35 flex-shrink-0" />
                    <input
                        ref={cmdKInputRef}
                        autoFocus
                        value={cmdKQuery}
                        onChange={(e) => { setCmdKQuery(e.target.value); setCmdKCursor(0); }}
                        placeholder={cmdKInFile ? "SEARCH IN FILE…" : "SEARCH…"}
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/30 font-black tracking-tight"
                    />
                    {cmdKInFile ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wide flex-shrink-0"
                            style={{ background: "rgba(234,179,8,0.15)", color: "#ca8a04", border: "1px solid rgba(234,179,8,0.3)" }}>
                            IN FILE
                        </span>
                    ) : activeFolder ? (
                        <button
                            type="button"
                            onClick={() => setCmdKGlobal(v => !v)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black tracking-wide transition-colors flex-shrink-0"
                            style={cmdKGlobal
                                ? { background: "rgba(255,255,255,0.08)", color: "#71717a" }
                                : { background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                            {cmdKGlobal ? "GLOBAL" : activeFolder}
                        </button>
                    ) : null}
                    <kbd className="text-[10px] text-zinc-600 border border-zinc-700 px-1.5 py-0.5 font-mono">esc</kbd>
                </div>
                {/* Results */}
                <div className="max-h-[520px] overflow-y-auto">
                    {(() => {
                        // In-file search results
                        if (cmdKInFile) {
                            if (!cmdKQuery.trim()) return <div className="px-4 py-8 text-center text-xs text-zinc-600">Type to search in current note</div>;
                            if (cmdKResults.length === 0) return <div className="px-4 py-8 text-center text-xs text-zinc-600">No matches in file</div>;
                            return (
                                <>
                                    <div className="px-4 pt-3 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase">{cmdKResults.length} line{cmdKResults.length !== 1 ? "s" : ""} matched</div>
                                    {cmdKResults.map((item: any, i: number) => (
                                        <button key={item.id} type="button"
                                            onMouseEnter={() => setCmdKCursor(i)}
                                            onClick={() => setShowCmdK(false)}
                                            className={`w-full flex items-start gap-3 px-4 py-2 text-left transition ${i === cmdKCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                            <span className="text-[10px] text-zinc-600 w-8 text-right flex-shrink-0 mt-0.5 font-mono">{item.lineNum}</span>
                                            <span className="text-xs text-zinc-300 font-mono truncate">{item.text || <span className="text-zinc-700">(empty)</span>}</span>
                                        </button>
                                    ))}
                                </>
                            );
                        }
                        const folderItems = cmdKResults.filter((r: any) => r._isFolder);
                        const noteItems = cmdKResults.filter((r: any) => !r._isFolder);
                        return (
                            <>
                                {noteItems.length > 0 && (
                                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                                        <span className="text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase">{hasQuery ? "Notes" : "Recent"}</span>
                                        {hasQuery && noteItems.length > 1 && (
                                            <button type="button"
                                                onClick={openAllFromCmdK}
                                                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black tracking-wide transition-colors"
                                                style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                                                OPEN ALL {noteItems.length} IN TABS
                                                <kbd className="text-[9px] font-mono opacity-70">⌘↵</kbd>
                                            </button>
                                        )}
                                    </div>
                                )}
                                {noteItems.map((note: any, ni: number) => {
                                    const i = ni;
                                    const isPinned = pinnedIds.has(String(note.id));
                                    return (
                                        <button key={note.id} type="button"
                                            onClick={(e) => openNoteFromCmdK(note)}
                                            onMouseEnter={() => setCmdKCursor(i)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === cmdKCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                            <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black text-white overflow-hidden"
                                                style={{ backgroundColor: note.color || note.folder_color || "#3f3f46", borderRadius: "24%" }}>
                                                {note.icon
                                                    ? <FolderIconDisplay value={note.icon} folderName={note.title || "N"} className="w-4 h-4" />
                                                    : [...(note.title || "N")][0]?.toUpperCase()}
                                                {looksLikeUrl(note.content || "") && (
                                                    <BookmarkIcon className="absolute -top-1 -right-1 w-3 h-3 text-white drop-shadow-sm" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))" }} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-normal text-white truncate">{note.title || "Untitled"}</div>
                                            </div>
                                            {isPinned && <HeartSolidIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />}
                                            {looksLikeUrl(note.content || "") && i === cmdKCursor && <span className="text-[9px] text-zinc-500 flex-shrink-0">⌘ open</span>}
                                            <span className="text-[10px] text-zinc-600 flex-shrink-0">{timeAgo(note.updated_at)}</span>
                                            {i === cmdKCursor && <kbd className="text-[9px] text-zinc-600 border border-zinc-700 px-1 py-0.5 font-mono flex-shrink-0">↵</kbd>}
                                        </button>
                                    );
                                })}
                                {folderItems.length > 0 && (
                                    <>
                                        <div className="px-4 pt-3 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase">Notebooks</div>
                                        {folderItems.map((folder: any, fi: number) => {
                                            const i = noteItems.length + fi;
                                            const dbRow = dbData.find((r: any) => r.is_folder && String(r.id) === String(folder.id));
                                            const parentName = dbRow?.parent_folder_name || null;
                                            return (
                                            <button key={`f-${folder.id}`} type="button"
                                                onMouseEnter={() => setCmdKCursor(i)}
                                                onClick={() => {
                                                    setShowCmdK(false); setCmdKQuery("");
                                                    const fr = dbData.find((r: any) => r.is_folder && (r.folder_name === folder.name || r.name === folder.name));
                                                    enterFolder({ id: fr ? String(fr.id) : `virtual-${folder.name}`, name: folder.name, color: folder.color || palette12[0] });
                                                    void loadFolderNotes(folder.name, false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === cmdKCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                                <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black overflow-hidden rounded-lg"
                                                    style={{ backgroundColor: folder.color || "#3f3f46", color: "#fff" }}>
                                                    {folder.name === "CLAUDE"
                                                        ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                        : <FolderIconDisplay value={folder.icon || ""} folderName={folder.name || "F"} className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    {parentName && (
                                                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wide truncate">
                                                            <span>{parentName}</span>
                                                            <span className="text-zinc-700">/</span>
                                                        </div>
                                                    )}
                                                    <div className="text-sm font-semibold text-white truncate uppercase">{folder.name}</div>
                                                    <div className="text-[10px] text-zinc-500">{folder.count ?? 0} note{(folder.count ?? 0) !== 1 ? "s" : ""}</div>
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                            </button>
                                            );
                                        })}
                                    </>
                                )}
                                {cmdKResults.length === 0 && (
                                    <div className="px-4 py-10 text-center text-zinc-600 text-sm">No results found</div>
                                )}
                            </>
                        );
                    })()}
                </div>
                {/* Footer */}
                <div className="border-t border-white/10 px-4 py-2 flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">↑↓</kbd> navigate</span>
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">↵</kbd> open</span>
                    {noteMatchCount > 1 && (
                        <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">⌘↵</kbd> open all</span>
                    )}
                    <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
}
