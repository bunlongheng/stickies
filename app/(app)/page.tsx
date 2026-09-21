"use client";

import { isLocalHostname } from "@/lib/is-local";
import { fetchRetry } from "@/lib/fetch-retry";
import React, { useState, useEffect, useRef, useMemo, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
// Supabase removed — auth now via NextAuth (see auth.ts at project root).
import { usePageMeta } from "@/lib/usePageMeta";
import { extractSmartTags, mergeSmartTags, DRAFT_BACKUP_KEY, serializeDraft, parseDraftBackup, backupHasWork, folderTileForeground, mergeRecentNotes, buildCmdKIndex, buildFolderLookup, computeCmdKResults, noteOrderByUpdated, noteOrderByCreated, computeDisplayItems } from "@/lib/editor-ui";
import { useCmdK } from "@/lib/useCmdK";
import { useRealtimeSync } from "@/lib/hooks/useRealtimeSync";
import { CmdKPalette } from "@/components/CmdKPalette";
import { appIconForKey, DEFAULT_APP_ICON } from "@/lib/app-icons";
import { playSound } from "@/lib/sound";
import { notesApi } from "@/lib/notes-api";
import { secureCopy } from "@/lib/clipboard";
import { colorPickerPalette, TYPE_BADGE, EMPTY_QUOTES } from "@/lib/ui-constants";
import { SHOW_FILE_ICONS_KEY, PINNED_KEY, PINNED_FOLDERS_KEY, VIEW_STATE_KEY, ACTIVE_DRAFT_KEY, FOLDER_COLOR_KEY, FOLDER_ICON_KEY, NOTE_ICON_KEY, MAIN_LIST_MODE_KEY, APP_THEME_KEY, LIST_MODE_KEY, HTML_MODE_KEY, DEFAULT_FOLDER_KEY, LAST_FOLDER_KEY, DB_CACHE_KEY, COUNTS_CACHE_KEY, DEV_MODE_KEY } from "@/lib/storage-keys";
import { machineIcon, isHubMachine, hubMachineIcon, isOwnerBrowserNote } from "@/lib/machines";
import { matchNoteIcon } from "@/lib/note-icons";
import { isReservedFolderName } from "@/lib/reserved-folders";
import { htmlToPlainLines } from "@/lib/note-format";
import { RobotIcon, FolderIconDisplay, FOLDER_HERO_ICONS } from "@/components/FolderIconDisplay";
import { HeaderIconBtn } from "@/components/HeaderIconBtn";
import { noteTileStyle, noteTileClassName } from "@/lib/tile-style";
import { NoteTileListBody } from "@/components/NoteTileListBody";
import { isLightColor, palette12, taskColor } from "@/lib/colors";
import { listStatsSummary } from "@/lib/list-stats";
import { meaningfulInitial, timeAgo, toUrlToken } from "@/lib/text";
import { insertById } from "@/lib/array";
import { wrapHtmlWithTheme } from "@/lib/html";
import { detectJson, detectNoteType } from "@/lib/note-format";
import dynamic from "next/dynamic";
const CodeViewer = dynamic(() => import("@/components/CodeViewer").then(m => m.CodeViewer), { ssr: false });
const RichEditor = dynamic(() => import("@/components/RichEditor"), { ssr: false, loading: () => <div className="flex-1 px-6 py-4 text-zinc-500 text-xs">Loading rich editor…</div> });

// Icons
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import Bars3Icon from "@heroicons/react/24/outline/Bars3Icon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import ArrowRightIcon from "@heroicons/react/24/outline/ArrowRightIcon";
import FolderIcon from "@heroicons/react/24/solid/FolderIcon";
import SwatchIcon from "@heroicons/react/24/outline/SwatchIcon";
import DocumentDuplicateIcon from "@heroicons/react/24/outline/DocumentDuplicateIcon";
import CommandLineIcon from "@heroicons/react/24/outline/CommandLineIcon";
import PaperAirplaneIcon from "@heroicons/react/24/outline/PaperAirplaneIcon";
import CheckCircleIcon from "@heroicons/react/24/solid/CheckCircleIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import QrCodeIcon from "@heroicons/react/24/outline/QrCodeIcon";
import ArrowRightOnRectangleIcon from "@heroicons/react/24/outline/ArrowRightOnRectangleIcon";
import Cog6ToothIcon from "@heroicons/react/24/outline/Cog6ToothIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import ChevronUpIcon from "@heroicons/react/24/outline/ChevronUpIcon";
import EyeIcon from "@heroicons/react/24/outline/EyeIcon";
import CodeBracketIcon from "@heroicons/react/24/outline/CodeBracketIcon";
import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import PuzzlePieceIcon from "@heroicons/react/24/outline/PuzzlePieceIcon";
import ChevronRightIcon from "@heroicons/react/24/outline/ChevronRightIcon";
import ChevronLeftIcon from "@heroicons/react/24/outline/ChevronLeftIcon";
import BoltIcon from "@heroicons/react/24/outline/BoltIcon";
import RectangleStackIcon from "@heroicons/react/24/outline/RectangleStackIcon";

import HeartIcon from "@heroicons/react/24/outline/HeartIcon";
import HeartSolidIcon from "@heroicons/react/24/solid/HeartIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import PencilSquareIcon from "@heroicons/react/24/outline/PencilSquareIcon";
import GlobeAltIcon from "@heroicons/react/24/outline/GlobeAltIcon";
import LockClosedIcon from "@heroicons/react/24/outline/LockClosedIcon";
import LockOpenIcon from "@heroicons/react/24/outline/LockOpenIcon";
import { QrModal } from "@/components/QrModal";




// Notes typed by the owner in their own browser carry the "stickies" key (or no
// key on legacy rows) plus a raw LAN IP as created_by_machine (not the hub, no
// known device icon). Those used to surface as a raw-IP text chip; show the
// owner's avatar instead.
const OWNER_AVATAR = "/avatar.png";

// Generate a gradual shade per row for Mode 2 row backgrounds
// Opacity ramps linearly from min → max across the full list (no looping)

/** True on phones (no physical keyboard expected) — skip attaching keydown shortcuts */
const IS_PHONE = typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && typeof screen !== "undefined" && Math.min(screen.width, screen.height) < 768;

/** True on iPad-class touch tablets (touch + big enough not to be a phone). Used to
    show large edge prev/next floats — touch devices have no arrow keys, and the
    small header pager is a stretch for thumbs at the screen edges. */
const IS_TABLET = typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && typeof screen !== "undefined" && Math.min(screen.width, screen.height) >= 768;

// Note-ordering comparators now live in lib/editor-ui.ts (unit-tested); aliased
// here so the many .sort(byUpdatedOrder/byCreatedOrder) call sites stay unchanged.
const byUpdatedOrder = noteOrderByUpdated;
const byCreatedOrder = noteOrderByCreated;




/** Convert image to WebP for smaller size, preserve quality */


/** Auto-detect full HTML documents — only DOCTYPE or <html> tag */




/** Derive a title from content — checks YAML frontmatter, markdown headings, then first line */

/** Client-side fallback type detection — used only when DB type is null (legacy notes) */


/** Detect plain URL content — single line, no whitespace, http(s) scheme */
/** Strip base64 images and HTML tags for safe single-line preview text */



function renderFindHighlights(text: string, matches: { start: number; end: number }[], currentIdx: number): React.ReactNode {
    if (matches.length === 0) return null;
    const parts: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((m, i) => {
        if (m.start > last) parts.push(<span key={`t${i}`} style={{ color: "transparent" }}>{text.slice(last, m.start)}</span>);
        parts.push(
            <mark key={`m${i}`} data-find-idx={i} style={{
                background: i === currentIdx ? "rgba(255,214,0,1)" : "rgba(255,214,0,0.35)",
                color: "transparent", borderRadius: 3,
                padding: "0 5px", margin: "0 -5px",
            }}>{text.slice(m.start, m.end)}</mark>
        );
        last = m.end;
    });
    if (last < text.length) parts.push(<span key="tail" style={{ color: "transparent" }}>{text.slice(last)}</span>);
    return parts;
}
// Note cache removed — API is fast enough, cache caused stale data bugs




const _CODE_TYPES = new Set(["javascript","typescript","python","css","sql","bash","html","json"]);

export default function NotesMaster() {
    const [mounted, setMounted] = useState(false);
    const [isUrlChecking, setIsUrlChecking] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dbData, setDbData] = useState<any[]>([]);
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
    const [folderCountsById, setFolderCountsById] = useState<Record<string, number>>({});
    const [todayNotes, setTodayNotes] = useState<any[]>([]); // notes for the Today view, from recent=today — decoupled from the 500-capped dbData
    const [todayDays, setTodayDays] = useState(1); // Today window in 24h steps; "Load more" widens it (1=24h, 2=48h, …)
    const [todayLoadingMore, setTodayLoadingMore] = useState(false);
    const [allNotes, setAllNotes] = useState<any[]>([]); // notes for the All view, from recent=all - server-paginated 20/page
    const [allTotal, setAllTotal] = useState(0); // server total for the All view (drives Load more visibility)
    const [allLoadingMore, setAllLoadingMore] = useState(false);
    const [createdByFilter, setCreatedByFilter] = useState<string | null>(null); // filter list to one posting app (created_by_key)
    const [folderLatestById, setFolderLatestById] = useState<Record<string, string>>({});
    const [folderNotesLoading, setFolderNotesLoading] = useState(false);
    const folderNotesLoadingRef = useRef(false);
    const syncHadTokenRef = useRef(false); // true after first sync() that got a valid auth token
    const folderPaginationRef = useRef<Map<string, { offset: number; total: number }>>(new Map());
    const notesEndRef = useRef<HTMLDivElement>(null);
    const [folderStack, setFolderStack] = useState<{ id: string; name: string; color: string }[]>([]);
    const activeFolder = folderStack.at(-1)?.name ?? null;
    // True once the user has navigated by hand (entered a folder or gone back). The
    // Always-ALL landing is applied from inside sync().then(), which resolves a second
    // or so after mount - long enough for the user to have already moved. Without this
    // guard that late callback yanks them back into ALL mid-browse.
    const userNavigatedRef = useRef(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Compat shim — keeps all existing setActiveFolder() call sites working unchanged
    const setActiveFolder = useCallback((name: string | null) => {
        setFolderStack(name ? [{ id: `virtual-${name}`, name, color: palette12[0] }] : []);
    }, []);
    // A virtual view ("All"/"Today") is identified by frame id, but the id is built from
    // the folder NAME at one call site (`virtual-${name}` -> "virtual-All") and hardcoded
    // lowercase at the other (the All card, "virtual-all"). Compare case-insensitively so
    // both spellings are recognised - otherwise goBack() re-pushes All on top of itself and
    // the root folder grid becomes unreachable from the landing view.
    const isVirtualView = (id: string | undefined | null) => {
        const v = (id ?? "").toLowerCase();
        return v === "virtual-all" || v === "virtual-today";
    };
    const enterFolder = useCallback((frame: { id: string; name: string; color: string }) => {
        userNavigatedRef.current = true;
        // Virtual "Today" (notes created < 24h) and "All" (every note, paginated) views
        // are never real folders - keep them single-level and never resolve them
        // against DB rows or nest them under a parent.
        if (isVirtualView(frame.id)) { setFolderStack([frame]); return; }
        setFolderStack((prev) => {
            // Build path from a known row id — avoids name collisions across parent folders
            const buildPathFromId = (id: string): { id: string; name: string; color: string }[] | null => {
                if (!id || id.startsWith("virtual-")) return null;
                const row = dbData.find((r: any) => r.is_folder && String(r.id) === id);
                if (!row) return null;
                const f = { id: String(row.id), name: row.folder_name, color: row.folder_color || palette12[0] };
                if (!row.parent_folder_name) return [f];
                const parentRow = dbData.find((r: any) => r.is_folder && r.folder_name === row.parent_folder_name);
                if (!parentRow) return [f];
                const parentPath = buildPathFromId(String(parentRow.id));
                return parentPath ? [...parentPath, f] : [f];
            };
            // Fallback: name-based path for virtual folders
            const buildPathByName = (name: string): { id: string; name: string; color: string }[] => {
                const row = dbData.find((r: any) => r.is_folder && r.folder_name === name);
                const parent = row?.parent_folder_name;
                const color = row?.folder_color || palette12[0];
                const f = { id: row?.id || `virtual-${name}`, name, color };
                if (!parent) return [f];
                return [...buildPathByName(parent), f];
            };
            const fullPath = buildPathFromId(frame.id) ?? buildPathByName(frame.name);
            const alreadyCorrect = prev.length > 0 && fullPath.slice(0, -1).map(f => f.name).join("/") === prev.map(f => f.name).join("/");
            return alreadyCorrect ? [...prev, frame] : fullPath;
        });
    }, [dbData]);
    const goBack = useCallback(() => {
        userNavigatedRef.current = true;
        setFolderStack((prev) => {
            const top = prev.at(-1);
            const next = prev.slice(0, -1);
            // Backing out of the last real folder returns to the ALL view (home),
            // not the bare folder grid. Popping a virtual view still empties the stack.
            if (next.length === 0 && top && !isVirtualView(top.id)) {
                return [{ id: "virtual-all", name: "All", color: palette12[0] }];
            }
            return next;
        });
        setIsSelectMode(false);
        setSelectedIds(new Set());
        setTypeFilter(null);
    }, []);
    const goToIndex = useCallback((i: number) => {
        setFolderStack((prev) => prev.slice(0, i + 1));
    }, []);
    // Sync activeFolder to URL so refresh stays on current folder
    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (activeFolder) {
            url.searchParams.set("folder", activeFolder);
        } else {
            url.searchParams.delete("folder");
        }
        const next = `${url.pathname}${url.search}`;
        if (next !== `${window.location.pathname}${window.location.search}`) {
            window.history.replaceState({}, "", next);
        }
    }, [activeFolder]);
    const [search, setSearch] = useState("");
    // Server-side search hits (title OR content ILIKE, case-insensitive) so searching by
    // content / skill name (e.g. "repo-recon") finds notes whose content matches even when
    // the title does not. The loaded list rows carry no content, so this fills the gap.
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [toast, setToast] = useState("");
    const [toastColor, setToastColor] = useState("#34C759");
    const [toastConfetti, setToastConfetti] = useState(false);
    const [toastIsError, setToastIsError] = useState(false);
    const [toastRainbow, setToastRainbow] = useState(false);
    const [toastKey, setToastKey] = useState(0);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [undoDeleteTask, setUndoDeleteTask] = useState<{ text: string; lineIdx: number } | null>(null);
    const taskContentHistory = useRef<string[]>([]);
    const pendingDeleteRef = useRef<{ note: any; title: string; content: string; noteColor: string; targetFolder: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
    // Multi-level undo stack for destructive ops (deletes that committed past the 8s window). In-memory, max 5.
    const actionUndoStackRef = useRef<Array<{ type: "delete"; note: any; prevFolder: string | null }>>([]);
    useEffect(() => { if (!undoDeleteTask) return; const t = setTimeout(() => setUndoDeleteTask(null), 5000); return () => clearTimeout(t); }, [undoDeleteTask]);
    const [flashColor, setFlashColor] = useState("#ffffff");
    const [flashNote, setFlashNote] = useState<any | null>(null);
    const [incomingNoteIds, setIncomingNoteIds] = useState<Set<string>>(new Set());
    const [removingNoteIds, setRemovingNoteIds] = useState<Set<string>>(new Set());

    const [, startContentTransition] = useTransition();
    const [editorOpen, setEditorOpen] = useState(false);
    // Sync folder path to URL params — enables shareable/bookmarkable folder links
    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (folderStack.length > 0 && !editorOpen) {
            url.searchParams.set("folder", folderStack.map(f => toUrlToken(f.name)).join("/"));
        } else if (!editorOpen) {
            url.searchParams.delete("folder");
        }
        if (url.toString() !== window.location.href) {
            window.history.replaceState({}, "", url.toString());
        }
    }, [folderStack, editorOpen]);
    const [noteContentLoading, setNoteContentLoading] = useState(false);
    const [editingNote, setEditingNote] = useState<any | null>(null);
    const [title, setTitle] = useState("");
    // Sync uncontrolled title inputs when title state changes (note load / external setTitle)
     
    useEffect(() => {
        titleRaw.current = title;
        if (titleInputRef.current) titleInputRef.current.value = title;
        if (titleInputMobileRef.current) titleInputMobileRef.current.value = title;
    }, [title]);
    const [content, setContent] = useState("");
    // Rich-text (TipTap) state — only used when current note's format === 'rich'.
    // Doc is the canonical ProseMirror JSON; content (above) is a derived plain-text mirror for search/CLI.
    const [richDoc, setRichDoc] = useState<import("@tiptap/react").JSONContent | null>(null);
    const latestRichDocRef = useRef<import("@tiptap/react").JSONContent | null>(null);
    const undoStackRef = useRef<string[]>([]);
    const redoStackRef = useRef<string[]>([]);
    const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Always-current content ref — used in saveNote on blur where React state may lag debounce
    const latestContentRef = useRef("");
    // Shared onChange for all editor textareas — handles undo snapshots correctly
    const handleEditorChange = useCallback((val: string) => {
        // Triple-space shortcut: replace "   " with a ruler line
        const ta = editorTextRef.current;
        if (ta) {
            const pos = ta.selectionStart;
            if (pos >= 3 && val.slice(pos - 3, pos) === "   ") {
                const ruler = "====================";
                const replaced = val.slice(0, pos - 3) + ruler + val.slice(pos);
                latestContentRef.current = replaced;
                setContent(replaced);
                requestAnimationFrame(() => { const np = pos - 3 + ruler.length; ta.setSelectionRange(np, np); });
                return;
            }
        }
        // Snapshot previous content for undo using ref (never stale)
        const prev = latestContentRef.current;
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => {
            if (prev !== val) { undoStackRef.current.push(prev); if (undoStackRef.current.length > 100) undoStackRef.current.shift(); redoStackRef.current = []; }
        }, 500);
        latestContentRef.current = val;
        setContent(val);
    }, []);
    const [pendingRestoreNoteId, setPendingRestoreNoteId] = useState<string | null>(null);
    const [pendingFolderQuery, setPendingFolderQuery] = useState<string | null>(null);
    const [pendingNoteQuery, setPendingNoteQuery] = useState<string | null>(null);
    const [pendingNoteIdQuery, setPendingNoteIdQuery] = useState<string | null>(null);
    const [hydratedViewState, setHydratedViewState] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [showFooterFolderPicker, setShowFooterFolderPicker] = useState(false);
    const [folderSearchQuery, setFolderSearchQuery] = useState("");
    const folderSearchCursorRef = useRef(0);
    const folderSearchListRef = useRef<HTMLDivElement | null>(null);
    const folderSearchRef = useRef<HTMLInputElement | null>(null);
    const [targetFolder, setTargetFolder] = useState("General");
    const [noteColor, setNoteColor] = useState(palette12[0]);
    const [folderColors, setFolderColors] = useState<Record<string, string>>({});
    const [folderIcons, setFolderIcons] = useState<Record<string, string>>({});
    const [noteIcons, setNoteIcons] = useState<Record<string, string>>({});
    const [iconPickerFolder, setIconPickerFolder] = useState<string | null>(null);
    const [pendingShare, setPendingShare] = useState<{ content: string } | null>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState("");
    const [qrType, setQrType] = useState<"link" | "data">("link");
    const [qrLinkCopied, setQrLinkCopied] = useState(false);
    const [sharePickerOpen, setSharePickerOpen] = useState(false);
    const [publicLinkCopied, setPublicLinkCopied] = useState(false);
    const [showIntegrationsPanel, setShowIntegrationsPanel] = useState(false);
    const [integrationsSnapshot, setIntegrationsSnapshot] = useState<Array<{ id?: string; name?: string; trigger: string; condition: Record<string, string>; type: string; config: Record<string, string> }>>([]);
    const [configuringIntegration, setConfiguringIntegration] = useState<{ id?: string; name?: string; trigger: string; condition: Record<string, string>; type: string; config: Record<string, string> } | null>(null);
    const [hueGroups, setHueGroups] = useState<{ id: string; name: string; type: string }[]>([]);
    const [hueGroupsLoading, setHueGroupsLoading] = useState(false);
    const [showAutomationsPanel, setShowAutomationsPanel] = useState(false);
    const [automationsList, setAutomationsList] = useState<Array<{ id: string; name: string; trigger_type: string; condition: Record<string, string>; action_type: string; action_config: Record<string, string>; active: boolean; last_fired: string | null }>>([]);
    const [selectedAutomation, setSelectedAutomation] = useState<{ id: string; name: string } | null>(null);
    const [automationLogs, setAutomationLogs] = useState<Array<{ id: string; triggered_at: string; result: string; detail: string | null; via: string | null }>>([]);
    const [automationLogsLoading, setAutomationLogsLoading] = useState(false);
    useEffect(() => { if (!sharePickerOpen) (document.activeElement as HTMLElement)?.blur(); }, [sharePickerOpen]);
    const [showNoteActions, setShowNoteActions] = useState(false);
    // Id of the note currently playing the Cmd+Delete firefly vanish, or null.
    const [fireflyNoteId, setFireflyNoteId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ type: "note"; noteId: string | null; noteName: string; noteColor?: string } | { type: "folder"; folderName: string } | null>(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [showFabMenu, setShowFabMenu] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newFolderIcon, setNewFolderIcon] = useState("");
    const newFolderInputRef = useRef<HTMLInputElement | null>(null);
    const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
    const draggingTileIdRef = useRef<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string; mode: "before" | "after" | "into" } | null>(null);
    const [pendingFolderOrder, setPendingFolderOrder] = useState<string[] | null>(null);
    const [pendingNoteOrder, setPendingNoteOrder] = useState<string[] | null>(null);
    const [listModeNotes, setListModeNotes] = useState<Set<string>>(new Set());
    const [htmlModeNotes, setHtmlModeNotes] = useState<Set<string>>(new Set());
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTaskText, setNewTaskText] = useState("");
    const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
    const [showImportGuide, setShowImportGuide] = useState(false);
    const [importApiKey, setImportApiKey] = useState("");
    const [showTabs, setShowTabs] = useState(() => { try { if (typeof window === "undefined") return true; return localStorage.getItem("stickies:show-tabs:v1") !== "false"; } catch { return true; } });
    const [dismissedTabs, setDismissedTabs] = useState<Set<string>>(() => { try { if (typeof window === "undefined") return new Set(); const raw = localStorage.getItem("stickies:dismissed-tabs:v1"); return raw ? new Set(JSON.parse(raw)) : new Set(); } catch { return new Set(); } });
    // When non-null, the ALL-view tab strip is restricted to exactly these note ids —
    // set by Cmd-K "Open all" so the tabs span just the matched notes. Cleared when the
    // editor closes (effect below) so a later open shows the full strip again.
    const [cmdkTabIds, setCmdkTabIds] = useState<Set<string> | null>(null);
    const tabLimit = 200;
    const [activeTaskIdx, setActiveTaskIdx] = useState<number | null>(null);
    const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);
    const [swipedTaskIdx, setSwipedTaskIdx] = useState<number | null>(null);
    const [draggingTaskIdx, setDraggingTaskIdx] = useState<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const [reorderDragOrigIdx, setReorderDragOrigIdx] = useState<number | null>(null);
    const [reorderOverOrigIdx, setReorderOverOrigIdx] = useState<number | null>(null);
    const taskRowSwipeStart = useRef<{ x: number; y: number } | null>(null);
    const listPullStartY = useRef<number>(0);
    const listPullTriggered = useRef<boolean>(false);
    const mainSwipeStart = useRef<{ x: number; y: number; time: number } | null>(null);
    const [swipeLeftGlow, setSwipeLeftGlow] = useState(false);
    // Swipe-left-to-delete on a note row (mobile). DOM-only transform via the row
    // element while dragging (no re-render); a decisive full swipe past half the row
    // width moves the note to TRASH (undoable).
    const rowSwipeStart = useRef<{ id: string; x: number; y: number } | null>(null);
    const [editingTaskText, setEditingTaskText] = useState("");
    const editTaskInputRef = useRef<HTMLInputElement | null>(null);
    const addTaskInputRef = useRef<HTMLInputElement | null>(null);
    const noteEverDirtyRef = useRef(false);

    const [showFolderActions, setShowFolderActions] = useState(false);
    const [isGlobalSettings, setIsGlobalSettings] = useState(false);
    const [devMode, setDevMode] = useState(true);
    const [showFileIcons, setShowFileIcons] = useState(true);
    const [gdriveConnected, setGdriveConnected] = useState(false);
    const [aiConfirmPending, setAiConfirmPending] = useState<"magic" | "grammar" | null>(null);
    const [isEditingFolderTitle, setIsEditingFolderTitle] = useState(false);
    const [editingFolderTitleValue, setEditingFolderTitleValue] = useState("");
    const [showFolderColorPicker, setShowFolderColorPicker] = useState(false);
    const [showFolderIconPicker, setShowFolderIconPicker] = useState(false);
    const [iconPickerSearch, setIconPickerSearch] = useState("");
    const [showFolderMovePicker, setShowFolderMovePicker] = useState(false);
    const [folderMoveQuery, setFolderMoveQuery] = useState("");
    const folderMoveCursorRef = useRef(0);
    const folderMoveListRef = useRef<HTMLDivElement | null>(null);
    const folderMoveSearchRef = useRef<HTMLInputElement | null>(null);

    const [quoteIndex, setQuoteIndex] = useState(0);
    const [pusherFlash, setPusherFlash] = useState(false);
    const [mainListMode, setMainListMode] = useState<"list" | "tabs">("list");
    const mainListModeRef = useRef(mainListMode);
    mainListModeRef.current = mainListMode;
    const [defaultFolder, setDefaultFolder] = useState<string>("CLAUDE");
    const [showDefaultFolderPicker, setShowDefaultFolderPicker] = useState(false);
    const [appThemeMode, setAppThemeMode] = useState<"dark" | "light" | "auto">("auto");
    const appTheme = appThemeMode === "auto"
        ? ((() => { const h = new Date().getHours(); return h >= 6 && h < 18 ? "light" : "dark"; })())
        : appThemeMode;
    const [codeEditMode, setCodeEditMode] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [pendingNoteType, setPendingNoteType] = useState<string | null>(null);
    // For brand-new unsaved notes (editingNote=null), this drives the editor mode.
    // openNewNote() seeds it to 'rich' so Cmd+N / + buttons default to Evernote-style.
    // Ext API / CLI / AI agents are unaffected — they hit /api/stickies/ext with their own format.
    const [pendingFormat, setPendingFormat] = useState<"text" | "rich" | null>(null);
    const [showNoteTypePicker, setShowNoteTypePicker] = useState(false);
    const [aiPromptOpen, setAiPromptOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const aiPromptRef = useRef<HTMLTextAreaElement | null>(null);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const [pinnedFolders, setPinnedFolders] = useState<Set<string>>(() => { try { if (typeof window === "undefined") return new Set(); const raw = localStorage.getItem(PINNED_FOLDERS_KEY); return raw ? new Set(JSON.parse(raw)) : new Set(); } catch { return new Set(); } });
    const savePinnedToDb = useCallback(async (folders: Set<string>) => {
        try {
            await fetch("/api/stickies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned_folders: [...folders] }) });
        } catch {}
    }, []);
    const togglePinFolder = useCallback((name: string) => {
        setPinnedFolders(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name); else next.add(name);
            try { localStorage.setItem(PINNED_FOLDERS_KEY, JSON.stringify([...next])); } catch {}
            void savePinnedToDb(next);
            return next;
        });
    }, [savePinnedToDb]);
    // glowCard converted to DOM-only (no React state) to avoid re-renders on every mousemove
    const [now, setNow] = useState(() => new Date());
    // Cmd-K palette state + its self-contained debounce/server-fetch effects (see lib/useCmdK).
    const {
        showCmdK, setShowCmdK, cmdKQuery, setCmdKQuery, cmdKCursor, setCmdKCursor,
        cmdKGlobal, setCmdKGlobal, cmdKInFile, setCmdKInFile,
        cmdKInputRef, deferredCmdKQuery, cmdKServerResults,
    } = useCmdK();
    const [showFindBar, setShowFindBar] = useState(false);
    const [findQuery, setFindQuery] = useState("");
    const [findCursor, setFindCursor] = useState(0);
    const findInputRef = useRef<HTMLInputElement | null>(null);
    const showFindBarRef = useRef(false);
    const findQueryRef = useRef("");
    const findMatchCountRef = useRef(0);
    const [images, setImages] = useState<Array<{ url: string; name: string; type: string }>>([]);
    const [noteTags, setNoteTags] = useState<string[]>([]);
    const [tagsExpanded, setTagsExpanded] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [uploadingImages, setUploadingImages] = useState(false);

    const isSavingRef = useRef(false);
    const saveNoteRef = useRef<((opts?: { silent?: boolean; deriveTitle?: boolean }) => Promise<boolean>) | null>(null);
    const localWriteRef = useRef<Map<string, number>>(new Map()); // noteId → timestamp, self-echo guard
    const flashQueueRef = useRef<Array<{ note: any; color: string }>>([]);
    const integrationsRef = useRef<Array<{ trigger: string; condition: Record<string, string>; type: string; config: Record<string, string> }>>([]);
    const isFlashingRef = useRef(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressOpenRef = useRef(false);
    const navTimestampRef = useRef(0); // guards against click bleed-through on folder navigation
    const openingNoteIdRef = useRef<string | null>(null); // tracks most-recent openNote call; stale fetches are discarded
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mainScrollRef = useRef<HTMLElement | null>(null);
    const editorTextRef = useRef<HTMLTextAreaElement | null>(null);
    // Current tab strip (ordered notes + active id) for Left/Right arrow nav.
    const tabNavRef = useRef<{ notes: any[]; activeId: string }>({ notes: [], activeId: "" });
    const tabScrollRef = useRef<HTMLDivElement | null>(null); // horizontally-scrolling tab strip container
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const titleInputMobileRef = useRef<HTMLInputElement | null>(null);
    const titleRaw = useRef(""); // tracks title input value without triggering re-renders
    const editorToolsRef = useRef<HTMLDivElement | null>(null);
    const shouldFocusTitleOnOpenRef = useRef(false);

    const origin = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
    // Most recently updated note — drives the live favicon
    usePageMeta({
        title: "Stickies",
        description: "Personal sticky notes",
        url: `${origin}/`,
        basePath: "/icons/stickies",
        themeColor: "#000000",
    });

    // --- LOAD ALL NOTES (for "All Notes" view) ---
    const loadAllNotes = async () => {
        if (folderNotesLoadingRef.current) return;
        folderNotesLoadingRef.current = true;
        setFolderNotesLoading(true);
        try {
            const res = await fetchRetry(`/api/stickies`, { headers: {  } });
            if (!res.ok) return;
            const { notes = [] } = await res.json();
            setDbData((prev) => {
                const folders = prev.filter((r: any) => r.is_folder);
                // Only keep optimistic notes not yet confirmed by server
                const optimistic = prev.filter((r: any) => !r.is_folder && r._optimistic);
                // Dedup fetched notes by id
                const seen = new Set<string>();
                const deduped = notes.filter((n: any) => { const id = String(n.id); if (seen.has(id)) return false; seen.add(id); return true; });
                return [...folders, ...optimistic, ...deduped];
            });
        } finally {
            folderNotesLoadingRef.current = false;
            setFolderNotesLoading(false);
        }
    };

    // Load the Today virtual view: notes created < 24h, straight from the server, merged
    // in non-destructively. Independent of the 500-row full-list cap so it never under-fills.
    const loadTodayNotes = async (days = 1) => {
        try {
            const res = await fetchRetry(`/api/stickies?recent=today&days=${days}`, { headers: {  } });
            if (!res.ok) return;
            const { notes = [] } = await res.json();
            // Dedicated state is the view's source of truth, so a later loadAllNotes (which
            // replaces dbData with the 500-capped list) can't wipe these back out.
            setTodayNotes(notes);
            setDbData((prev) => mergeRecentNotes(prev, notes));
        } catch { /* offline / transient — refocus catch-up retries */ }
    };

    // Load the "All" virtual view: every live note, latest first, 20 per page straight
    // from the server (recent=all). Dedicated state is the view's source of truth so
    // the 500-row dbData cap never under-fills it. offset 0 replaces, else appends.
    const loadAllRecent = async (offset = 0) => {
        try {
            const res = await fetchRetry(`/api/stickies?recent=all&limit=20&offset=${offset}`, { headers: {  } });
            if (!res.ok) return;
            const { notes = [], total = 0 } = await res.json();
            setAllTotal(total);
            setAllNotes((prev) => offset === 0 ? notes : Array.from(new Map([...prev, ...notes].map((n: any) => [String(n.id), n])).values()));
            setDbData((prev) => mergeRecentNotes(prev, notes));
        } catch { /* offline / transient - refocus catch-up retries */ }
    };

    // --- LOAD ALL FOLDER NOTES (no pagination) ---
    const loadFolderNotes = async (folderName: string, _append = false) => {
        if (folderNotesLoadingRef.current) return;
        folderNotesLoadingRef.current = true;
        setFolderNotesLoading(true);
        try {
            const res = await fetchRetry(
                `/api/stickies?folder=${encodeURIComponent(folderName)}`,
                { headers: {  } }
            );
            if (!res.ok) return;
            const { notes = [], total = 0 } = await res.json();
            folderPaginationRef.current.set(folderName, { offset: notes.length, total });

            setDbData((prev) => {
                const freshIds = new Set(notes.map((n: any) => String(n.id)));
                const without = prev.filter((r: any) => r.is_folder || r._optimistic || (r.folder_name !== folderName && !freshIds.has(String(r.id))));
                return [...without, ...notes];
            });
        } finally {
            folderNotesLoadingRef.current = false;
            setFolderNotesLoading(false);
        }
    };

    // --- CORE SYNC ---
    const sync = async () => {
        // Seed from cache immediately so tiles appear before network response
        try {
            const cached = localStorage.getItem(DB_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Merge cache (folders) with any already-loaded notes — don't wipe notes
                    setDbData((prev) => {
                        const existingNotes = prev.filter((r: any) => !r.is_folder);
                        const cachefolders = parsed.filter((r: any) => r.is_folder);
                        return [...cachefolders, ...existingNotes];
                    });
                    setIsDataLoaded(true);
                }
            }
            const cachedCounts = localStorage.getItem(COUNTS_CACHE_KEY);
            if (cachedCounts) {
                const { counts, countsByFolderId } = JSON.parse(cachedCounts);
                if (counts) setFolderCounts(counts);
                if (countsByFolderId) setFolderCountsById(countsByFolderId);
            }
        } catch { /* ignore */ }

        try {
            // NextAuth session is cookie-based and sent automatically. Verify via /api/auth/session
            // so we know whether we have an active sign-in before issuing the heavier fetches.
            let sessionEmail: string | null = null;
            try {
                const r = await fetch("/api/auth/session", { cache: "no-store" });
                if (r.ok) { const j = await r.json(); sessionEmail = j?.user?.email ?? null; }
            } catch { /* network ok */ }
            // OAuth redirect race: retry once after a short pause.
            if (!sessionEmail && process.env.NODE_ENV === "production") {
                await new Promise(r => setTimeout(r, 800));
                try {
                    const r = await fetch("/api/auth/session", { cache: "no-store" });
                    if (r.ok) { const j = await r.json(); sessionEmail = j?.user?.email ?? null; }
                } catch {}
            }
            syncHadTokenRef.current = !!sessionEmail;
            if (!sessionEmail && process.env.NODE_ENV === "production" && !isLocalHostname(window.location.hostname)) {
                // No session - clear stale cache and redirect to login (LAN hosts stay keyless)
                try { localStorage.removeItem(DB_CACHE_KEY); localStorage.removeItem(COUNTS_CACHE_KEY); } catch {}
                window.location.href = "/sign-in";
                return;
            }
            // NextAuth session cookie is sent automatically — no bearer header needed.
            const [foldersRes, integrationsResult, countsResult, prefsResult] = await Promise.all([
                fetchRetry("/api/stickies?folders=1").then((r) => {
                    if (r.status === 401) { try { localStorage.removeItem(DB_CACHE_KEY); } catch {} }
                    return r.ok ? r.json() : { folders: [] };
                }).catch(() => ({ folders: [] })),
                fetchRetry("/api/stickies/integrations").then((r) => r.ok ? r.json() : []).catch(() => []),
                fetchRetry("/api/stickies?counts=1").then((r) => r.ok ? r.json() : { counts: {} }).catch(() => ({ counts: {} })),
                fetchRetry("/api/stickies?prefs=1").then((r) => r.ok ? r.json() : { pinned_folders: [] }).catch(() => ({ pinned_folders: [] })),
            ]);
            const folderItems = (foldersRes.folders ?? []).map((f: any) => ({ ...f, is_folder: true }));
            // Preserve any already-loaded notes in dbData (from prior folder navigations)
            setDbData((prev) => {
                const existingNotes = prev.filter((r: any) => !r.is_folder);
                return [...folderItems, ...existingNotes];
            });
            const freshCounts = countsResult.counts ?? {};
            const freshCountsById = countsResult.countsByFolderId ?? {};
            setFolderCounts(freshCounts);
            setFolderCountsById(freshCountsById);
            if (countsResult.latestByFolderId) setFolderLatestById(countsResult.latestByFolderId);
            // Sync pinned folders from DB
            const dbPinned = prefsResult.pinned_folders ?? [];
            if (dbPinned.length > 0) {
                const pinSet = new Set<string>(dbPinned);
                setPinnedFolders(pinSet);
                try { localStorage.setItem(PINNED_FOLDERS_KEY, JSON.stringify(dbPinned)); } catch {}
            }
            // Persist folders + counts cache for instant next load
            try {
                localStorage.setItem(DB_CACHE_KEY, JSON.stringify(folderItems));
                localStorage.setItem(COUNTS_CACHE_KEY, JSON.stringify({ counts: freshCounts, countsByFolderId: freshCountsById }));
            } catch { /* quota exceeded — skip */ }
            // Extract folder icons from folder rows (content field stores icon value)
            const folderIconsFromDb: Record<string, string> = {};
            folderItems.forEach((f: any) => {
                if (f.folder_name && f.content && f.content.trim()) {
                    folderIconsFromDb[String(f.folder_name)] = f.content.trim();
                }
            });
            if (Object.keys(folderIconsFromDb).length > 0) {
                setFolderIcons((prev) => ({ ...prev, ...folderIconsFromDb }));
            }
            if (Array.isArray(integrationsResult)) {
                integrationsRef.current = integrationsResult;
                const gdriveInt = integrationsResult.find((ig: any) => ig.type === "gdrive");
                setGdriveConnected(!!(gdriveInt?.refresh_token && gdriveInt?.active));
            }
        } finally {
            setIsDataLoaded(true);
        }
    };

    // Load first 15 notes when entering a folder; clear on exit.
    // "Today" and "All" are virtual views with their own loaders (recent=today /
    // recent=all) - skip the folder fetch here so the two loads don't race and flicker.
    useEffect(() => {
        if (activeFolder && activeFolder !== "Today" && activeFolder !== "All") {
            folderPaginationRef.current.delete(activeFolder);
            void loadFolderNotes(activeFolder, false);
        }
         
    }, [activeFolder]);

    // All notes load at once — no infinite scroll needed


    // NextAuth session: pull email from /api/auth/session.
    // Replaces the old Supabase onAuthStateChange listener — NextAuth signs in via a full-page
    // redirect so the page mounts with the session already present (no need to listen for it).
    useEffect(() => {
        void fetch("/api/auth/session").then(r => r.ok ? r.json() : null).then(data => {
            const email = data?.user?.email ?? null;
            // Treat a fresh page-load with a valid email as a successful sign-in for the
            // welcome banner — equivalent to the old SIGNED_IN signal.
            if (email && !syncHadTokenRef.current) {
                sessionStorage.removeItem("stickies:session-started");
                setShowWelcomeBack(true);
            }
        }).catch(() => {});
     
    }, []);



    useEffect(() => {
        setMounted(true);
        try { sessionStorage.removeItem("stickies:chunk-reload"); } catch { /* private mode */ }
        void sync().then(() => {
            void loadAllNotes();
            // Always-ALL landing: open on the full ALL notes list, never a saved/default
            // folder. A bare ?folder= in the URL is stripped by the URL block below, so its
            // absence here means "land in ALL".
            const urlFolder = new URLSearchParams(window.location.search).get("folder");
            if (!urlFolder && !userNavigatedRef.current) {
                setActiveFolder("All");
            }
            // Note: openNote is intentionally NOT called here — the auto-open effect handles it
            // once dbData is populated, avoiding a race between two concurrent openNote calls.
        });

        let restoredFromUrl = false;
        let shouldWaitForInitialTarget = false;
        try {
            const params = new URLSearchParams(window.location.search);
            const sharedDataParam = params.get("data");
            const codeParam = params.get("code");
            const folderParam = params.get("folder");
            const noteParam = params.get("note");
            const noteIdParam = params.get("noteId");
            if (codeParam) {
                restoredFromUrl = true;
                try {
                    const decoded = atob(codeParam);
                    setEditingNote(null);
                    setTitle("Diagram");
                    setContent(decoded);
                    setTargetFolder(activeFolder || "General");
                    setNoteColor(palette12[Math.floor(Math.random() * palette12.length)]);
                    setShowColorPicker(false);
                    setShowSwitcher(false);
                    shouldFocusTitleOnOpenRef.current = true;
                    setEditorOpen(true);
                    window.history.replaceState({}, "", window.location.pathname);
                } catch (decodeErr) {
                    console.error("Failed to decode code param:", decodeErr);
                }
            } else if (sharedDataParam) {
                restoredFromUrl = true;
                setIsUrlChecking(true);
                try {
                    const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedDataParam))));
                    const sharedFolder = typeof decoded?.folder_name === "string" && decoded.folder_name.trim() ? decoded.folder_name.trim() : "General";
                    const sharedTitle = typeof decoded?.title === "string" && decoded.title.trim() ? decoded.title : "Shared Note";
                    const sharedContent = typeof decoded?.content === "string" ? decoded.content : "";
                    const sharedColor = typeof decoded?.color === "string" && decoded.color ? decoded.color : palette12[0];
                    setActiveFolder(sharedFolder);
                    setEditingNote(null);
                    setTitle(sharedTitle);
                    setContent(sharedContent);
                    setTargetFolder(sharedFolder);
                    setNoteColor(sharedColor);
                    setPendingShare(sharedContent ? { content: sharedContent } : null);
                    setShowColorPicker(false);
                    setShowSwitcher(false);
                    shouldFocusTitleOnOpenRef.current = true;
                    setEditorOpen(true);
                    window.history.replaceState({}, "", window.location.pathname);
                } catch (decodeErr) {
                    console.error("Failed to decode shared note data:", decodeErr);
                } finally {
                    setIsUrlChecking(false);
                }
            } else if (noteParam || noteIdParam) {
                restoredFromUrl = true;
                shouldWaitForInitialTarget = true;
                setIsUrlChecking(true);
                // Folder param (if present) only supplies the note's context — the ALL
                // landing still applies once the note is closed.
                if (folderParam) setPendingFolderQuery(folderParam);
                if (noteParam) setPendingNoteQuery(noteParam);
                if (noteIdParam) setPendingNoteIdQuery(noteIdParam);
                // Strip note params once captured
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete("note");
                cleanUrl.searchParams.delete("noteId");
                cleanUrl.searchParams.delete("view");
                window.history.replaceState({}, "", cleanUrl.toString());
            } else if (folderParam) {
                // Always-ALL: a bare ?folder= is just auto-persisted browsing state (e.g. the
                // sticky ?folder=claude) — never drop into that folder. Strip it and fall
                // through to the ALL default below.
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete("folder");
                window.history.replaceState({}, "", cleanUrl.toString());
            }
        } catch (err) {
            console.error("Failed to restore URL state:", err);
        }

        if (!restoredFromUrl) {
            // Load default folder
            const savedDefaultFolder = localStorage.getItem(DEFAULT_FOLDER_KEY) || "CLAUDE";
            setDefaultFolder(savedDefaultFolder);

            // On first load of a new session, open All Notes view
            const isNewSession = !sessionStorage.getItem("stickies:session-started");
            if (isNewSession) {
                sessionStorage.setItem("stickies:session-started", "1");
                setActiveFolder("All"); // Always-ALL landing
                setMainListMode("list"); // list as default
                localStorage.setItem(LAST_FOLDER_KEY, "All"); // persist so sync() honors it
            } else {
                try {
                    const raw = localStorage.getItem(VIEW_STATE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        // Always-ALL: don't restore a saved folder on refresh — land in ALL.
                        setActiveFolder("All");
                        if ((parsed?.editorOpen || parsed?.noteModalOpen) && parsed?.editingNoteId) {
                            shouldWaitForInitialTarget = true;
                            setPendingRestoreNoteId(String(parsed.editingNoteId));
                        } else {
                            // No note to restore — ensure editor is closed
                            setEditorOpen(false);
                        }
                    }
                } catch (err) {
                    console.error("Failed to restore local view state:", err);
                }
                // Always ensure a valid view mode and editor closed if no note pending
                if (!shouldWaitForInitialTarget) {
                    setEditorOpen(false);
                }
            }
        }
        try {
            const rawColors = localStorage.getItem(FOLDER_COLOR_KEY);
            if (rawColors) {
                const parsedColors = JSON.parse(rawColors);
                if (parsedColors && typeof parsedColors === "object") {
                    setFolderColors(parsedColors);
                }
            }
        } catch (err) {
            console.error("Failed to restore folder colors:", err);
        }
        try {
            const rawIcons = localStorage.getItem(FOLDER_ICON_KEY);
            if (rawIcons) {
                const parsedIcons = JSON.parse(rawIcons);
                if (parsedIcons && typeof parsedIcons === "object") setFolderIcons(parsedIcons);
            }
            const rawNoteIcons = localStorage.getItem(NOTE_ICON_KEY);
            if (rawNoteIcons) {
                const parsed = JSON.parse(rawNoteIcons);
                if (parsed && typeof parsed === "object") setNoteIcons(parsed);
            }
        } catch { /* ignore */ }
        try {
            const rawList = localStorage.getItem(LIST_MODE_KEY);
            if (rawList) {
                const arr = JSON.parse(rawList);
                if (Array.isArray(arr)) setListModeNotes(new Set(arr));
            }
        } catch { /* ignore */ }
        try {
        } catch { /* ignore */ }
        try {
        } catch { /* ignore */ }
        try {
            const rawMainList = localStorage.getItem(MAIN_LIST_MODE_KEY);
            if (rawMainList) {
                // Legacy values ("true"/"false"/"thumb") all collapse to list - the
                // thumbnail grid is gone, list and tabs are the only two layouts.
                setMainListMode(rawMainList === "tabs" ? "tabs" : "list");
            }
        } catch { /* ignore */ }
        try {
        } catch { /* ignore */ }
        try {
            const rawTheme = localStorage.getItem(APP_THEME_KEY);
            if (rawTheme === "light" || rawTheme === "dark" || rawTheme === "auto") setAppThemeMode(rawTheme);
            const rawIcons = localStorage.getItem(SHOW_FILE_ICONS_KEY);
            if (rawIcons === "false") setShowFileIcons(false);
        } catch { /* ignore */ }
        try {
            const rawDev = localStorage.getItem(DEV_MODE_KEY);
            if (rawDev === "true") setDevMode(true);
        } catch { /* ignore */ }

        // URL params override localStorage (read last so they win)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const themeParam = urlParams.get("theme");
            if (themeParam === "light" || themeParam === "dark" || themeParam === "auto") setAppThemeMode(themeParam);
            const viewParam = urlParams.get("view") || urlParams.get("mode");
            if (viewParam === "list") setMainListMode("list");
            else if (viewParam === "tabs") setMainListMode("tabs");
            const keyParam = urlParams.get("key");
            if (keyParam) setCreatedByFilter(keyParam);
            const gdriveParam = urlParams.get("gdrive");
            if (gdriveParam === "connected") {
                setTimeout(() => { showToast("Google Drive connected", "#34d399"); setGdriveConnected(true); }, 500);
                window.history.replaceState({}, "", window.location.pathname);
            } else if (gdriveParam === "error") {
                setTimeout(() => showError("Google Drive connection failed"), 500);
                window.history.replaceState({}, "", window.location.pathname);
            }
        } catch { /* ignore */ }

        if (!shouldWaitForInitialTarget) setIsUrlChecking(false);
        setHydratedViewState(true);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(FOLDER_COLOR_KEY, JSON.stringify(folderColors));
        } catch (err) {
            console.error("Failed to persist folder colors:", err);
        }
    }, [folderColors]);

    useEffect(() => {
        try { localStorage.setItem(FOLDER_ICON_KEY, JSON.stringify(folderIcons)); } catch { /* ignore */ }
    }, [folderIcons]);
    useEffect(() => {
        try { localStorage.setItem(NOTE_ICON_KEY, JSON.stringify(noteIcons)); } catch { /* ignore */ }
    }, [noteIcons]);

    // Folder icons loaded from ?folders=1 response in sync() — no separate effect needed

    // Sync note icons from DB (icon column) — DB wins over localStorage
    useEffect(() => {
        if (!dbData || dbData.length === 0) return;
        const fromDb: Record<string, string> = {};
        dbData.forEach((row: any) => {
            if (!row.is_folder && row.icon && row.icon.trim()) {
                fromDb[String(row.id)] = row.icon.trim();
            }
        });
        if (Object.keys(fromDb).length > 0) {
            setNoteIcons((prev) => ({ ...prev, ...fromDb }));
        }
    }, [dbData]);

    // Sync folder colors from DB — folder rows (is_folder=true) are authoritative
    useEffect(() => {
        if (!dbData || dbData.length === 0) return;
        const fromDb: Record<string, string> = {};
        // Use folder row's color as authoritative source
        dbData.forEach((row: any) => {
            if (row.is_folder && row.folder_name && row.folder_color) {
                fromDb[String(row.folder_name)] = row.folder_color;
            }
        });
        // Fallback: for virtual folders (no is_folder row), use first note's color
        dbData.forEach((row: any) => {
            if (!row.is_folder && row.folder_name && row.folder_color && !fromDb[row.folder_name]) {
                fromDb[row.folder_name] = row.folder_color;
            }
        });
        if (Object.keys(fromDb).length > 0) {
            setFolderColors((prev) => ({ ...prev, ...fromDb })); // DB wins — folder row is authoritative
        }
    }, [dbData]);

    useEffect(() => {
        try {
            localStorage.setItem(LIST_MODE_KEY, JSON.stringify([...listModeNotes]));
        } catch { /* ignore */ }
    }, [listModeNotes]);

    // Sync listModeNotes from DB on initial data load
    useEffect(() => {
        if (!isDataLoaded) return;
        const checklistIds = dbData
            .filter((r: any) => !r.is_folder && (r.list_mode || r.type === "checklist"))
            .map((r: any) => String(r.id));
        if (checklistIds.length > 0) {
            setListModeNotes((prev) => {
                const next = new Set(prev);
                checklistIds.forEach((id: string) => next.add(id));
                return next;
            });
        }
    }, [isDataLoaded]);



    useEffect(() => {
        try {
            localStorage.setItem(HTML_MODE_KEY, JSON.stringify([...htmlModeNotes]));
        } catch { /* ignore */ }
    }, [htmlModeNotes]);


    useEffect(() => {
        try { localStorage.setItem(MAIN_LIST_MODE_KEY, String(mainListMode)); } catch { /* ignore */ }
        // Auto-open latest note when entering tabs mode
        if (mainListMode === "tabs") {
            const allNotes = dbData.filter(n => !n.is_folder && !n.trashed_at)
                .sort(byUpdatedOrder);
            if (allNotes.length > 0 && String(editingNote?.id) !== String(allNotes[0].id)) {
                void openNote(allNotes[0]);
            }
        }
    }, [mainListMode]);

    // Sync view mode to URL params so refresh preserves the mode
    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        const modeVal = mainListMode;
        if (modeVal === "tabs") {
            url.searchParams.set("mode", modeVal);
        } else {
            url.searchParams.delete("mode");
        }
        if (url.toString() !== window.location.href) {
            window.history.replaceState({}, "", url.toString());
        }
    }, [mainListMode]);

    // Sync the "Posted by" (created_by_key) filter to URL param `key` so refresh/share preserves it
    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (createdByFilter) {
            url.searchParams.set("key", createdByFilter);
        } else {
            url.searchParams.delete("key");
        }
        if (url.toString() !== window.location.href) {
            window.history.replaceState({}, "", url.toString());
        }
    }, [createdByFilter]);

    // Auto-load today's notes and open latest when entering tabs mode (desktop only)
    const tabsAutoOpenedRef = useRef(false);
    useEffect(() => {
        if (mainListMode === "tabs" && !tabsAutoOpenedRef.current) {
            tabsAutoOpenedRef.current = true;
            (async () => {
                try {
                    const res = await fetch("/api/stickies?recent=today", { headers: {  } });
                    if (!res.ok) return;
                    const { notes = [] } = await res.json();
                    if (notes.length > 0) {
                        setDbData(prev => {
                            const freshIds = new Set(notes.map((n: any) => String(n.id)));
                            const without = prev.filter((r: any) => r.is_folder || !freshIds.has(String(r.id)));
                            return [...without, ...notes];
                        });
                        void openNote(notes[0]);
                    }
                } catch { /* ignore */ }
            })();
        }
        if (mainListMode !== "tabs") tabsAutoOpenedRef.current = false;
    }, [mainListMode]);

    useEffect(() => {
        try { localStorage.setItem(APP_THEME_KEY, appThemeMode); } catch { /* ignore */ }
        document.documentElement.setAttribute("data-theme", appTheme);
    }, [appTheme, appThemeMode]);
    // Auto-theme: re-check every minute when in auto mode
    useEffect(() => {
        if (appThemeMode !== "auto") return;
        const id = setInterval(() => {
            // Skip the forced re-render while the tab is backgrounded - no point
            // re-rendering the whole grid for time-ago labels nobody is looking at.
            if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
            setAppThemeMode(m => m);
        }, 60000);
        return () => clearInterval(id);
    }, [appThemeMode]);

    useEffect(() => {
        try { localStorage.setItem(DEV_MODE_KEY, String(devMode)); } catch { /* ignore */ }
    }, [devMode]);

    useEffect(() => {
        try { localStorage.setItem(LAST_FOLDER_KEY, activeFolder ?? "__all__"); } catch { /* ignore */ }
    }, [activeFolder]);


    // Reset code edit mode on note switch
    useEffect(() => {
        setCodeEditMode(false);
    }, [editorOpen, editingNote?.id]);

    // Hide find bar on note open
    useEffect(() => {
        if (editorOpen) setShowFindBar(false);
    }, [editorOpen, editingNote?.id]);

    // Load pinned note IDs from localStorage
    useEffect(() => {
        try {
            const s = localStorage.getItem(PINNED_KEY);
            if (s) setPinnedIds(new Set(JSON.parse(s)));
        } catch { /* ignore */ }
    }, []);

    // Global keydown — Cmd+K/F/D/B, Escape fullscreen, Cmd+Z undo-delete (all [] deps, ref-based)
    useEffect(() => {
        if (IS_PHONE) return;
        const handler = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            // Cmd+Z → undo note deletion (only when textarea isn't focused, so native text undo still works)
            if (mod && e.key === "z" && !e.shiftKey) {
                const active = document.activeElement as HTMLElement | null;
                const inTextarea = !!active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable);
                // 1) Cancel pre-commit delete (8s window) — original behavior
                if (pendingDeleteRef.current) {
                    e.preventDefault();
                    const pd = pendingDeleteRef.current;
                    clearTimeout(pd.timeoutId);
                    pendingDeleteRef.current = null;
                    setDbData((prev) => [pd.note, ...prev.filter((r) => String(r.id) !== String(pd.note.id))]);
                    setEditingNote(pd.note);
                    setTitle(pd.title);
                    setContent(pd.content);
                    setNoteColor(pd.noteColor);
                    setTargetFolder(pd.targetFolder);
                    setEditorOpen(true);
                    showToast("Restored", pd.noteColor || "#34C759");
                    return;
                }
                // 2) Pop from multi-level action stack — only when not editing text
                if (!inTextarea && actionUndoStackRef.current.length > 0) {
                    e.preventDefault();
                    const action = actionUndoStackRef.current.pop()!;
                    if (action.type === "delete") {
                        const restored = { ...action.note, folder_name: action.prevFolder, trashed_at: null };
                        setDbData((prev) => {
                            const exists = prev.some((r) => String(r.id) === String(restored.id));
                            return exists
                                ? prev.map((r) => String(r.id) === String(restored.id) ? { ...r, folder_name: action.prevFolder, trashed_at: null } : r)
                                : [restored, ...prev];
                        });
                        void notesApi.update(String(restored.id), { folder_name: action.prevFolder, trashed_at: null });
                        const t = String(restored.title || "Untitled").slice(0, 16);
                        showToast(`Restored: ${t}`, restored.folder_color || "#34C759");
                    }
                    return;
                }
            }
            if (!mod) return;
            if (e.key === "k") {
                e.preventDefault();
                setCmdKGlobal(true); setCmdKInFile(false);
                setShowCmdK(v => { if (!v) { setCmdKQuery(""); setCmdKCursor(0); } return !v; });
            } else if (e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setCmdKGlobal(true); setCmdKInFile(false);
                setShowCmdK(v => { if (!v) { setCmdKQuery(""); setCmdKCursor(0); } return true; });
            } else if (!e.shiftKey && e.key.toLowerCase() === "d") {
                const sel = window.getSelection()?.toString().trim() ||
                    (() => { const ta = editorTextRef.current; return ta ? ta.value.substring(ta.selectionStart, ta.selectionEnd).trim() : ""; })();
                if (showFindBarRef.current && findMatchCountRef.current > 0 && (!sel || sel.toLowerCase() === findQueryRef.current.toLowerCase())) {
                    e.preventDefault();
                    setFindCursor(v => (v + 1) % findMatchCountRef.current);
                    return;
                }
                if (!sel) return;
                e.preventDefault();
                setShowFindBar(true);
                setFindQuery(sel);
                const cursorPos = editorTextRef.current?.selectionStart ?? 0;
                const txt = (latestContentRef.current || content).toLowerCase();
                const q = sel.toLowerCase();
                const allStarts: number[] = [];
                let idx = txt.indexOf(q);
                while (idx !== -1) { allStarts.push(idx); idx = txt.indexOf(q, idx + 1); }
                const nearest = allStarts.findIndex(s => s >= cursorPos);
                setFindCursor(nearest >= 0 ? nearest : 0);
                setTimeout(() => findInputRef.current?.focus(), 30);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);


    // Live clock — tick every minute
    useEffect(() => {
        const tick = () => setNow(new Date());
        const ms = 60000 - (Date.now() % 60000);
        let interval: ReturnType<typeof setInterval> | undefined;
        const t = setTimeout(() => { tick(); interval = setInterval(tick, 60000); }, ms);
        return () => { clearTimeout(t); if (interval) clearInterval(interval); };
    }, []);

    // Pusher realtime sync (channel bindings, reconnect catch-up, focus/online +
    // 15s poll backstop) lives in useRealtimeSync — invoked below, after every
    // dependency it closes over (showToast, openNoteRef, …) has been declared.

    useEffect(() => {
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
        const prevBodyOverflow = document.body.style.overflow;
        const prevBodyOverscroll = document.body.style.overscrollBehavior;

        document.documentElement.style.overflow = "hidden";
        document.documentElement.style.overscrollBehavior = "none";
        document.body.style.overflow = "hidden";
        document.body.style.overscrollBehavior = "none";

        return () => {
            document.documentElement.style.overflow = prevHtmlOverflow;
            document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
            document.body.style.overflow = prevBodyOverflow;
            document.body.style.overscrollBehavior = prevBodyOverscroll;
        };
    }, []);

    // Auto-checklist for TEAM folder notes — convert HTML content to plain lines
    useEffect(() => {
        if (!editingNote?.id) return;
        const folder = (editingNote.folder_name || "").toUpperCase();
        if (folder === "TEAM") {
            const raw = editingNote.content || "";
            if (/<[a-z][^>]*>/i.test(raw)) {
                setContent(htmlToPlainLines(raw));
            }
            setListModeNotes((prev) => new Set([...prev, String(editingNote.id)]));
        }
    }, [editingNote?.id]);



    useEffect(() => {
        if (!pendingFolderQuery && !pendingNoteQuery && !pendingNoteIdQuery) return;
        if (!isDataLoaded) return;

        const rawFolderParam = pendingFolderQuery || "";
        const noteToken = pendingNoteQuery ? toUrlToken(pendingNoteQuery) : "";
        const noteIdToken = pendingNoteIdQuery ? String(pendingNoteIdQuery).trim() : "";

        const allFolders = Array.from(new Set(dbData.map((item) => item.folder_name).filter(Boolean)));
        const allNotes = dbData.filter((item) => !item.is_folder);

        // Support nested paths like "claude/infra"
        const folderSegments = rawFolderParam ? rawFolderParam.split("/").filter(Boolean) : [];
        const lastSegmentToken = folderSegments.length > 0 ? folderSegments[folderSegments.length - 1] : "";
        const folderToken = lastSegmentToken;
        const matchedFolder = folderToken ? allFolders.find((name) => toUrlToken(name) === folderToken) || null : null;

        // Restore full folder stack — build parent chain even for single-segment URLs
        if (folderSegments.length >= 1) {
            const buildChain = (name: string): { id: string; name: string; color: string }[] => {
                const row = dbData.find((r) => r.is_folder && r.folder_name === name);
                const frame = { id: row?.id || `virtual-${name}`, name, color: row?.folder_color || palette12[0] };
                if (row?.parent_folder_name) {
                    return [...buildChain(row.parent_folder_name), frame];
                }
                return [frame];
            };
            // Use last segment as target, build its full parent chain
            const targetName = allFolders.find((n) => toUrlToken(n) === folderSegments[folderSegments.length - 1]);
            if (targetName) {
                setFolderStack(buildChain(targetName));
                void loadFolderNotes(targetName, false);
            }
        }

        let matchedNote: any = null;
        let matchedDraft: any = null;
        if (noteIdToken) {
            matchedNote = allNotes.find((item) => String(item.id) === noteIdToken && (!matchedFolder || item.folder_name === matchedFolder)) || allNotes.find((item) => String(item.id) === noteIdToken) || null;
            // Note not in dbData yet (lazy-loaded) — fetch directly from API
            if (!matchedNote) {
                void (async () => {
                    try {
                        const res = await fetch(`/api/stickies?id=${noteIdToken}`, { headers: {  } });
                        if (!res.ok) return;
                        const { note } = await res.json();
                        if (!note) return;
                        setActiveFolder(note.folder_name || null);
                        if (note.folder_name) {
                            const row = dbData.find((r: any) => r.is_folder && r.folder_name === note.folder_name);
                            setFolderStack([{ id: row?.id || `virtual-${note.folder_name}`, name: note.folder_name, color: row?.folder_color || note.folder_color || palette12[0] }]);
                        }
                        setEditingNote(note);
                        setTitle(note.title || "");
                        setContent(note.content || "");
                        // Load the rich doc too — without this a format='rich' note opened
                        // via a ?noteId= deep-link (note not yet in dbData) mounts an EMPTY
                        // editor (content + title set, but the TipTap doc never loaded).
                        setRichDoc((note as any).doc ?? null);
                        latestRichDocRef.current = (note as any).doc ?? null;
                        setTargetFolder(note.folder_name || "General");
                        setNoteColor(note.folder_color || palette12[0]);
                        setEditorOpen(true);
                    } catch {}
                })();
                setPendingFolderQuery(null); setPendingNoteQuery(null); setPendingNoteIdQuery(null); setIsUrlChecking(false);
                return;
            }
        }

        if (!matchedNote && noteToken) {
            matchedNote = allNotes.find((item) => toUrlToken(item.title || "") === noteToken && (!matchedFolder || item.folder_name === matchedFolder)) || allNotes.find((item) => toUrlToken(item.title || "") === noteToken) || null;

            if (!matchedNote) {
                try {
                    const rawDraft = localStorage.getItem(ACTIVE_DRAFT_KEY);
                    if (rawDraft) {
                        const parsedDraft = JSON.parse(rawDraft);
                        const draftTitleToken = toUrlToken(parsedDraft?.title || "");
                        const draftFolderToken = toUrlToken(parsedDraft?.folder_name || "");
                        const draftMatches = draftTitleToken === noteToken && (!folderToken || draftFolderToken === folderToken);
                        const draftNoteId = parsedDraft?.noteId ? String(parsedDraft.noteId) : "";

                        if (draftMatches && draftNoteId) {
                            matchedNote = allNotes.find((item) => String(item.id) === draftNoteId) || null;
                        } else if (draftMatches) {
                            matchedDraft = parsedDraft;
                        }
                    }
                } catch (err) {
                    console.error("Failed to restore draft from URL:", err);
                }
            }
        }

        if (matchedNote) {
            setActiveFolder(matchedNote.folder_name || matchedFolder || null);
            // Open through openNote, never by hand. The list query has no `content`
            // column, so setting the body straight off the matched row opened an
            // html note as an EMPTY iframe — a white screen with a correct title,
            // folder and footer. openNote fetches the body (with retries) and owns
            // the loading overlay. The sibling branch above, for a note not yet in
            // dbData, already fetched; this one — the common case — never did.
            void openNoteRef.current?.(matchedNote);
        } else if (matchedDraft) {
            const draftFolder = matchedDraft.folder_name || matchedFolder || "General";
            setActiveFolder(draftFolder || null);
            setEditingNote(null);
            setTitle(matchedDraft.title || "");
            setContent(matchedDraft.content || "");
            setTargetFolder(draftFolder);
            setNoteColor(matchedDraft.folder_color || palette12[0]);
            setEditorOpen(true);
        } else if (matchedFolder) {
            // Full stack already built by buildChain above — also trigger note load
            void loadFolderNotes(matchedFolder, false);
        }

        setPendingFolderQuery(null);
        setPendingNoteQuery(null);
        setPendingNoteIdQuery(null);
        setIsUrlChecking(false);
    }, [pendingFolderQuery, pendingNoteQuery, pendingNoteIdQuery, dbData, isDataLoaded]);

    useEffect(() => {
        if (!hydratedViewState) return;
        try {
            localStorage.setItem(
                VIEW_STATE_KEY,
                JSON.stringify({
                    activeFolder,
                    folderStack,
                    editorOpen,
                    editingNoteId: editingNote?.id ?? null,
                }),
            );
        } catch (err) {
            console.error("Failed to persist view state:", err);
        }
    }, [hydratedViewState, activeFolder, folderStack, editorOpen, editingNote?.id]);


    useEffect(() => {
        if (!hydratedViewState || isUrlChecking) return;
        try {
            const next = new URL(window.location.href);
            // Keep URL clean — strip note-level params (use copy link for sharing)
            next.searchParams.delete("note");
            next.searchParams.delete("noteId");
            next.searchParams.delete("view");
            // Folder param is managed by the folderStack useEffect — don't touch it here

            const currentPath = `${window.location.pathname}${window.location.search}`;
            const nextPath = `${next.pathname}${next.search}`;
            if (currentPath !== nextPath) {
                window.history.replaceState({}, "", nextPath);
            }
        } catch (err) {
            console.error("Failed to sync URL state:", err);
        }
    }, [hydratedViewState, isUrlChecking, activeFolder, editorOpen, targetFolder, title, editingNote?.id, editingNote?.folder_name]);

    useEffect(() => {
        if (!editorOpen) return;
        try {
            const raw = localStorage.getItem(ACTIVE_DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw);
            const currentId = editingNote?.id ? String(editingNote.id) : null;
            const currentFolder = activeFolder || editingNote?.folder_name || "General";
            const sameNote = currentId ? String(draft?.noteId || "") === currentId : !draft?.noteId && draft?.folder_name === currentFolder;
            if (!sameNote) return;
            if (typeof draft?.title === "string") setTitle(draft.title);
            if (typeof draft?.content === "string") setContent(draft.content);
            if (typeof draft?.folder_name === "string" && draft.folder_name) setTargetFolder(draft.folder_name);
            if (typeof draft?.folder_color === "string" && draft.folder_color) setNoteColor(draft.folder_color);
        } catch (err) {
            console.error("Failed to restore active draft:", err);
        }
    // Restore the in-progress draft when a note OPENS (editorOpen / note id), not when
    // editingNote.folder_name mutates — a folder move changes folder_name on the same note,
    // and re-running here would clobber the just-set targetFolder with the stale draft folder.
    }, [editorOpen, editingNote?.id, activeFolder]);

    useEffect(() => {
        if (!editorOpen) return;
        const timer = window.setTimeout(() => {
            try {
                localStorage.setItem(
                    ACTIVE_DRAFT_KEY,
                    JSON.stringify({
                        noteId: editingNote?.id ? String(editingNote.id) : null,
                        folder_name: targetFolder || activeFolder || editingNote?.folder_name || "General",
                        folder_color: noteColor,
                        title,
                        content,
                        updated_at: new Date().toISOString(),
                    }),
                );
            } catch (err) {
                console.error("Failed to persist active draft:", err);
            }
        }, 180);
        return () => window.clearTimeout(timer);
    }, [editorOpen, editingNote?.id, editingNote?.folder_name, activeFolder, targetFolder, noteColor, title, content]);

    // --- DERIVED STATE ---
    const folders = useMemo(() => {
        const noteCountByFolder = new Map<string, number>();
        const firstNoteColorByFolder = new Map<string, string>();
        const subfolderCountByFolder = new Map<string, number>();

        dbData.forEach((item) => {
            const folderName = String(item.folder_name || "General");
            if (item.is_folder) {
                if (item.parent_folder_name) {
                    const parent = String(item.parent_folder_name);
                    subfolderCountByFolder.set(parent, (subfolderCountByFolder.get(parent) || 0) + 1);
                }
                return;
            }
            if (item.trashed_at && folderName !== "TRASH") return;
            noteCountByFolder.set(folderName, (noteCountByFolder.get(folderName) || 0) + 1);
            if (!firstNoteColorByFolder.has(folderName) && item.folder_color) firstNoteColorByFolder.set(folderName, item.folder_color);
        });

        // UUID-keyed — allows same folder_name in different parent directories
        const folderRowsById = new Map<string, any>();
        dbData
            .filter((item) => item.is_folder)
            .forEach((row) => {
                folderRowsById.set(String(row.id), row);
            });

        // Note count per folder_id (UUID-based for accuracy)
        // Notes without folder_id fall back to name-match, but only counted once
        // (avoid double-counting when two folders share the same name)
        const noteCountByFolderId = new Map<string, number>();
        const notesWithoutFolderId = dbData.filter((item) => !item.is_folder && !item.trashed_at && !item.folder_id);
        dbData.filter((item) => !item.is_folder && !item.trashed_at && item.folder_id).forEach((item) => {
            const fid = String(item.folder_id);
            noteCountByFolderId.set(fid, (noteCountByFolderId.get(fid) || 0) + 1);
        });
        // For notes without folder_id: find the single best-matching folder by name
        // and assign to it (prefer folder with matching parent context)
        notesWithoutFolderId.forEach((item) => {
            const name = String(item.folder_name || "");
            const matchingFolders = Array.from(folderRowsById.values()).filter(
                (f) => String(f.folder_name) === name
            );
            if (matchingFolders.length === 1) {
                const fid = String(matchingFolders[0].id);
                noteCountByFolderId.set(fid, (noteCountByFolderId.get(fid) || 0) + 1);
            } else if (matchingFolders.length === 0) {
                // No folder row — handled by noteCountByFolder fallback
            } else {
                // Multiple folders with same name — assign to first one only (no double-count)
                const fid = String(matchingFolders[0].id);
                noteCountByFolderId.set(fid, (noteCountByFolderId.get(fid) || 0) + 1);
            }
        });

        // Compute latest note updated_at per folder (by folder_id)
        const latestUpdatedByFolderId = new Map<string, string>();
        dbData.filter((item) => !item.is_folder).forEach((item) => {
            const fid = String(item.folder_id || "");
            if (!fid) return;
            const t = String(item.updated_at || "");
            if (!latestUpdatedByFolderId.has(fid) || t > latestUpdatedByFolderId.get(fid)!) {
                latestUpdatedByFolderId.set(fid, t);
            }
        });

        const foldersFromRowsRaw = Array.from(folderRowsById.values())
            .map((row) => {
                const folderName = String(row.folder_name || "General");
                const rowId = String(row.id);
                return {
                    id: rowId,
                    order: typeof row.order === "number" ? row.order : Number.MAX_SAFE_INTEGER,
                    latestUpdatedAt: folderLatestById[rowId] || latestUpdatedByFolderId.get(rowId) || String(row.updated_at || ""),
                    name: folderName,
                    color: row.folder_color || folderColors[folderName] || palette12[0],
                    count: (() => {
                        // If this is the only folder with this name, name-based count is authoritative
                        // (captures notes with wrong/missing folder_id)
                        const nameCount = folderCounts[folderName] ?? noteCountByFolder.get(folderName) ?? 0;
                        const idCount = folderCountsById[rowId] ?? noteCountByFolderId.get(rowId) ?? 0;
                        const foldersWithSameName = Array.from(folderRowsById.values()).filter(f => String(f.folder_name) === folderName).length;
                        return foldersWithSameName === 1 ? Math.max(nameCount, idCount) : idCount;
                    })(),
                    subfolderCount: subfolderCountByFolder.get(folderName) || 0,
                    icon: folderIcons[folderName] || "",
                    parent_folder_name: row.parent_folder_name || null,
                };
            })
            .sort((a, b) => a.order - b.order);
        // Deduplicate by name+parent — same name is allowed under different parent folders
        const seenFolderKeys = new Set<string>();
        const foldersFromRows = foldersFromRowsRaw.filter((f) => {
            const key = `${f.name}||${f.parent_folder_name ?? ""}`;
            if (seenFolderKeys.has(key)) return false;
            seenFolderKeys.add(key);
            return true;
        });

        const knownFolderNames = new Set(foldersFromRows.map((f) => f.name));
        const missingFolders = Array.from(noteCountByFolder.keys())
            .filter((folderName) => !knownFolderNames.has(folderName) && (noteCountByFolder.get(folderName) ?? 0) > 0)
            .sort((a, b) => a.localeCompare(b))
            .map((folderName) => ({
                id: `virtual-${folderName}`,
                order: Number.MAX_SAFE_INTEGER,
                latestUpdatedAt: "",
                name: folderName,
                color: folderName === "TRASH" ? "#3a3a3a" : (folderColors[folderName] || firstNoteColorByFolder.get(folderName) || palette12[0]),
                count: noteCountByFolder.get(folderName) || 0,
                subfolderCount: subfolderCountByFolder.get(folderName) || 0,
                icon: folderIcons[folderName] || "",
                parent_folder_name: null as string | null,
            }));

        const all = [...foldersFromRows, ...missingFolders];
        // Sort by DB order column, then assign palette color by position
        const sorted = all.sort((a, b) => a.order - b.order);
        const fullPalette = [...palette12, "#8E8E93", "#FFFFFF"];
        // Root folders get color from position index (not array index). Index 0 is
        // reserved for the virtual Today card (red), so real folders start at 1 and
        // push by one — Today=red, first folder=next palette color, and so on.
        let rootIdx = 1;
        sorted.forEach((f) => {
            if (f.parent_folder_name) return; // subfolders keep parent color
            f.color = fullPalette[rootIdx % fullPalette.length];
            rootIdx++;
        });
        return sorted;
    }, [dbData, folderColors, folderIcons, pendingFolderOrder, folderCounts, folderLatestById]);

    // Folders visible at the current navigation level (root or sub-folder)
    const currentLevelFolders = useMemo(() => {
        const filtered = folders
            .filter((f) => {
                const parentName = f.parent_folder_name ?? null;
                if (folderStack.length === 0) return parentName === null && f.name !== "TRASH";
                return parentName === activeFolder;
            })
            .map((f) => ({ ...f, is_folder: true as const }));
        // Pinned folders float to the top only inside sub-folders; the root grid
        // keeps the user's manual order (pins at root are quick-access markers only).
        const sorted = folderStack.length === 0 ? filtered : [
            ...filtered.filter((f) => pinnedFolders.has(f.name)),
            ...filtered.filter((f) => !pinnedFolders.has(f.name)),
        ];
        // At root, prepend the virtual "All" card — every live note, latest first,
        // 20/page via recent=all. It's purely computed (no DB row) and takes the top
        // slot in red; real folders follow. (The old "Today" <24h card was retired —
        // All supersedes it.) Count prefers the server-authoritative sources over the
        // 500-capped client list so the card never shows a stale low number.
        if (folderStack.length === 0) {
            const allCountByFolder = Object.entries(folderCounts).reduce((s, [name, n]) => name === "TRASH" ? s : s + (Number(n) || 0), 0);
            const allCountLocal = dbData.filter((n) => !n.is_folder && !n.trashed_at && n.folder_name !== "TRASH").length;
            const allCard = {
                id: "virtual-all",
                name: "All",
                color: palette12[0], // red — the top card, formerly Today's color
                count: Math.max(allTotal, allCountByFolder, allCountLocal),
                subfolderCount: 0,
                order: -2,
                latestUpdatedAt: "",
                icon: "__hero:Squares2X2Icon",
                parent_folder_name: null as string | null,
                is_folder: true as const,
                _virtualAll: true,
            };
            return [allCard, ...sorted];
        }
        return sorted;
    }, [folders, folderStack, activeFolder, pinnedFolders, dbData, folderCounts, allTotal]);

    // Debounced server-side search: the DB does `title ILIKE OR content ILIKE` (case-insensitive),
    // so content/skill matches surface even when the title doesn't contain the query.
    useEffect(() => {
        const q = search.trim();
        if (q.length < 2) { setSearchResults([]); return; }
        let cancelled = false;
        const t = window.setTimeout(async () => {
            try {
                const res = await fetch(`/api/stickies?q=${encodeURIComponent(q)}`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setSearchResults(Array.isArray(data?.notes) ? data.notes : []);
            } catch { /* keep prior results on transient error */ }
        }, 220);
        return () => { cancelled = true; window.clearTimeout(t); };
    }, [search]);

    const displayItems = useMemo(
        () => computeDisplayItems({ dbData, activeFolder, folderStack, search, currentLevelFolders, pinnedIds, todayNotes, todayDays, allNotes, showFileIcons, searchResults }) as any[],
        [dbData, activeFolder, folderStack, search, currentLevelFolders, pendingNoteOrder, pinnedIds, todayNotes, todayDays, allNotes, showFileIcons, searchResults],
    );

    // Available type chips for the filter row (only types present in current view, notes only)
    // Debounced content — heavy computations (JSON parse, tree walk, line split) only run 400ms after typing stops
    const [deferredContent, setDeferredContent] = useState(content);
    useEffect(() => {
        const t = setTimeout(() => setDeferredContent(content), 400);
        return () => clearTimeout(t);
    }, [content]);

    // Filtered display items (type filter applied)
    const filteredDisplayItems = useMemo(() => {
        let items = displayItems;
        if (createdByFilter) items = items.filter((item: any) => item.is_folder || item._header || item.created_by_key === createdByFilter);
        if (typeFilter) items = items.filter((item: any) => item.is_folder || item._header || item.type === typeFilter);
        return items;
    }, [displayItems, typeFilter, createdByFilter]);



    // Cmd-K search index + folder lookup — rebuilt only when dbData changes, never on
    // keystroke. Results tiering/merge lives in computeCmdKResults (lib/editor-ui).
    const cmdKIndex = useMemo(() => buildCmdKIndex(dbData), [dbData]);
    const folderLookup = useMemo(() => buildFolderLookup(dbData), [dbData]);
    const cmdKResults = useMemo(
        () => computeCmdKResults({ cmdKIndex, folderLookup, folders, pinnedIds, deferredContent, cmdKInFile, deferredCmdKQuery, cmdKServerResults }),
        [cmdKIndex, folderLookup, folders, pinnedIds, deferredContent, cmdKInFile, deferredCmdKQuery, cmdKServerResults],
    );

    const [deferredFindQuery, setDeferredFindQuery] = useState(findQuery);
    useEffect(() => {
        const t = setTimeout(() => setDeferredFindQuery(findQuery), 120);
        return () => clearTimeout(t);
    }, [findQuery]);

    const findMatches = useMemo(() => {
        if (!showFindBar || !deferredFindQuery.trim()) return [] as { start: number; end: number }[];
        const q = deferredFindQuery.toLowerCase();
        const text = (deferredContent || "").toLowerCase(); // pre-lowercase once
        const results: { start: number; end: number }[] = [];
        let i = 0;
        while (i <= text.length - q.length) {
            const pos = text.indexOf(q, i);
            if (pos === -1) break;
            results.push({ start: pos, end: pos + q.length });
            i = pos + 1;
        }
        return results;
    }, [showFindBar, deferredFindQuery, deferredContent]);

    // Keep refs in sync for use inside stale [] keydown handlers
    useEffect(() => { showFindBarRef.current = showFindBar; }, [showFindBar]);
    useEffect(() => { findQueryRef.current = findQuery; }, [findQuery]);
    useEffect(() => { findMatchCountRef.current = findMatches.length; }, [findMatches.length]);

    useEffect(() => {
        if (!showFindBar || findMatches.length === 0) return;
        const match = findMatches[findCursor];
        if (!match) return;

        // Plain-text textarea: scroll parent container to the matched line
        const textarea = editorTextRef.current;
        if (textarea) {
            const lineHeight = 19;
            const paddingTop = 8;
            const lineNumber = content.substring(0, match.start).split("\n").length - 1;
            const matchTop = paddingTop + lineNumber * lineHeight;
            const scrollable = textarea.parentElement;
            if (scrollable) {
                const center = matchTop - scrollable.clientHeight / 2 + lineHeight;
                scrollable.scrollTo({ top: Math.max(0, center), behavior: "smooth" });
            }
            // Select the match text so the user sees exactly what's highlighted
            textarea.focus();
            textarea.setSelectionRange(match.start, match.end);
            // Return focus to find bar after a tick so user can keep typing
            setTimeout(() => findInputRef.current?.focus(), 50);
        }
    }, [findCursor, findMatches, showFindBar]);




    const activeFolderNoteCount = useMemo(() => {
        if (!activeFolder) return 0;
        const folderMeta = folders.find((folder) => folder.name === activeFolder);
        if (folderMeta && folderMeta.count > 0) return Number(folderMeta.count);
        // Fall back to server counts before all notes are loaded
        if (folderMeta && folderMeta.count > 0) return Number(folderMeta.count);
        return folderCounts[activeFolder] ?? dbData.filter((row) => !row.is_folder && String(row.folder_name || "") === activeFolder).length;
    }, [activeFolder, folders, dbData, folderCounts, folderCountsById]);
    // A folder can only be deleted once it is empty — deleting a folder with notes
    // would wipe those notes. TRASH is exempt (delete = empty it). Matches the API guard.
    const canDeleteActiveFolder = Boolean(activeFolder) && (activeFolder === "TRASH" || activeFolderNoteCount === 0);
    const isEmptyView = isDataLoaded && !editorOpen && !search.trim() && !folderNotesLoading && displayItems.length === 0 && dbData.some(r => r.is_folder) && activeFolder !== "TRASH";
    const folderNames = useMemo(() => {
        const names = new Set<string>();
        // Only include folders that actually exist as is_folder rows — no ghost names
        dbData.filter((n) => n.is_folder && n.folder_name && n.folder_name.toUpperCase() !== "BOOKMARKS")
              .forEach((n) => names.add(String(n.folder_name)));
        if (activeFolder && activeFolder.toUpperCase() !== "BOOKMARKS") names.add(activeFolder);
        if (targetFolder && targetFolder.toUpperCase() !== "BOOKMARKS") names.add(targetFolder);
        if (names.size === 0) names.add("General");
        return Array.from(names).sort((a, b) => a.localeCompare(b));
    }, [dbData, activeFolder, targetFolder]);

    // --- ACTIONS ---
    const isDraftDirty = useMemo(() => {
        if (!editorOpen) return false;
        const nextTitle = title.trim() || "Untitled";
        const nextFolder = targetFolder || activeFolder || editingNote?.folder_name || "General";
        const nextColor = noteColor || editingNote?.folder_color || palette12[0];
        if (editingNote?.id) {
            const prevTitle = editingNote.title || "Untitled";
            const prevContent = editingNote.content || "";
            const prevFolder = editingNote.folder_name || "General";
            // Mirror openNote's color fallback chain so merely opening a note whose
            // row has no folder_color never reads as a change (which would latch
            // noteEverDirtyRef and fire a false "updated" toast on close).
            const prevColor = editingNote.folder_color || folders.find((f: any) => f.name === editingNote.folder_name)?.color || "#888";
            return nextTitle !== prevTitle || content !== prevContent || nextFolder !== prevFolder || nextColor !== prevColor;
        }
        return Boolean(title.trim() || content.trim() || nextFolder !== "General");
    }, [editorOpen, title, content, targetFolder, activeFolder, noteColor, editingNote, folders]);

    // Keep a ref so timers can check isDraftDirty without stale closures
    const isDraftDirtyRef = useRef(isDraftDirty);
    // Mirrored onto window so BuildWatch never reloads over an unsaved draft (#63).
    useEffect(() => {
        isDraftDirtyRef.current = isDraftDirty;
        (window as unknown as { __stickiesDirty?: boolean }).__stickiesDirty = isDraftDirty;
    }, [isDraftDirty]);

    // Track if the current note was ever dirty (survives auto-save clearing isDraftDirty)
    useEffect(() => { if (isDraftDirty) noteEverDirtyRef.current = true; }, [isDraftDirty]);
    // Reset dirty tracker whenever we switch to a different note (or open a new one)
    useEffect(() => { noteEverDirtyRef.current = false; }, [editingNote?.id]);


    // Auto-save disabled — save only on Cmd+S
     

    // Debounced autosave for rich-text edits (TipTap doesn't naturally fire blur on typing
    // the way <textarea> does, so we drive a 2s debounce off onChange instead).
    const richSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleAutoSave = useCallback(() => {
        if (richSaveTimerRef.current) clearTimeout(richSaveTimerRef.current);
        richSaveTimerRef.current = setTimeout(() => {
            void saveNoteRef.current?.({ silent: true });
        }, 2000);
    }, []);

    const saveNote = useCallback(
        async ({ silent = false, deriveTitle = false }: { silent?: boolean; deriveTitle?: boolean } = {}) => {
            // Never save a brand-new note with no meaningful content
            const isNewNoteDraft = !(editingNote?.id);
            const rawContent = latestContentRef.current || content;
            const hasNoTitle = !titleRaw.current.trim();
            const isContentEmpty = !rawContent.trim();
            if (isNewNoteDraft && hasNoTitle && isContentEmpty) return true;
            if (!rawContent.trim()) return true;
            if (!isDraftDirty && !deriveTitle) return true;
            if (isDraftDirty === false && deriveTitle) {
                // Force through for title-only derive — check if title actually needs update
                const hasRealTitle = titleRaw.current.trim() && titleRaw.current.trim().toLowerCase() !== "untitled";
                if (hasRealTitle) return true; // already has real title, nothing to do
            }
            if (isSavingRef.current) return true;
            if ((editingNote as any)?._external) return true; // read-only external note
            isSavingRef.current = true;
            // Use latestContentRef so blur-triggered saves get the current editor content
            // even when the 300ms debounce hasn't flushed to React state yet
            const saveContent = latestContentRef.current || content;
            const hasRealTitle = titleRaw.current.trim() && titleRaw.current.trim().toLowerCase() !== "untitled";
            // For new notes with no title, always derive from content — never save as bare "Untitled"
            const shouldDerive = deriveTitle || (isNewNoteDraft && !hasRealTitle);
            const resolvedTitle = (shouldDerive && !hasRealTitle) ? (() => {
                const firstLine = saveContent.trim().split("\n").find(l => l.trim()) || "";
                return firstLine.replace(/^#+\s*/, "").slice(0, 60).trim() || "Untitled";
            })() : (titleRaw.current.trim() || "Untitled");
            if (shouldDerive && !hasRealTitle) setTitle(resolvedTitle);

            let folderName = targetFolder || activeFolder || editingNote?.folder_name || "General";
            // "Today"/"All" are virtual views, never a real home — filing a note into them
            // creates a phantom folder named Today/All in the root grid. Redirect to the default.
            if (folderName === "Today" || folderName === "All") folderName = defaultFolder || "CLAUDE";
            // Resolve folderId from folderName — don't blindly use folderStack (tab+ may target a different folder)
            const matchedFolderRow = dbData.find(r => r.is_folder && r.folder_name === folderName);
            const folderId = matchedFolderRow && !String(matchedFolderRow.id).startsWith("virtual-") ? String(matchedFolderRow.id) : null;
            // Smart tags: keyword-driven auto-tagging (see lib/editor-ui.ts for the table).
            // Replaces the old #hashtag scan that produced too many false positives
            // (hex colors, anchor links, code samples, Slack channel mentions).
            const haystack = `${titleRaw.current ?? ""}\n${saveContent}`;
            const extractedTags = extractSmartTags(haystack);
            const newSmartTags = extractedTags.filter(t => !noteTags.includes(t));
            if (newSmartTags.length > 0) {
                setNoteTags(prev => mergeSmartTags(prev, newSmartTags));
            }
            const currentFormat = ((editingNote as any)?.format ?? pendingFormat ?? "text") as "text" | "rich";
            const payload: any = {
                title: resolvedTitle,
                content: saveContent,
                format: currentFormat,
                // For rich notes, persist the ProseMirror JSON alongside the plain-text mirror.
                // For text notes, doc stays null.
                ...(currentFormat === "rich" ? { doc: latestRichDocRef.current ?? richDoc } : {}),
                folder_name: folderName,
                folder_color: noteColor || folders.find((f) => f.name === folderName)?.color || editingNote?.folder_color || palette12[0],
                is_folder: false,
                type: (() => {
                    if (pendingNoteType) return pendingNoteType;
                    const saved = (editingNote as any)?.type ?? null;
                    // Don't auto-upgrade plain text notes — user must explicitly switch modes
                    if (saved === "text") return "text";
                    // Never overwrite a code type with a weaker detection
                    if (saved && CODE_TYPES.has(saved)) return saved;
                    // Auto-detect for new notes or notes without a saved type
                    return detectNoteType(saveContent) || saved || "text";
                })(),
                ...(() => { const merged = mergeSmartTags(noteTags, extractedTags); return merged.length > 0 ? { tags: merged } : {}; })(),
                updated_at: new Date().toISOString(),
                ...(folderId ? { folder_id: folderId } : {}),
            };
            // Recompute checklist counts client-side so the file-list circle stays in sync
            const isChecklistSave = payload.type === "checklist" || (editingNote as any)?.list_mode === true;
            if (isChecklistSave) {
                const isSep = (s: string) => /^[-–—=*#~_.]{2,}$/.test(s);
                const lines = saveContent.split("\n").map(l => l.trim()).filter(l => l && !isSep(l));
                payload.task_count = lines.length;
                payload.task_remaining_count = lines.filter(l => !/^\[x\]/i.test(l)).length;
                payload.task_done_count = lines.reduce((sum, l) => sum + (/^\[x\]/i.test(l) ? 1.0 : /^\[\/\]/.test(l) ? 0.5 : 0), 0);
            }
            const existingNoteId = editingNote?.id ?? null;
            const existingNoteIdStr = existingNoteId !== null ? String(existingNoteId) : null;
            const optimisticId = existingNoteIdStr || `local-${Date.now()}`;
            const existingSnapshot = existingNoteIdStr ? dbData.find((n) => String(n.id) === existingNoteIdStr) || null : null;

            const isNewNote = !existingNoteIdStr;
            const optimisticNote = {
                ...(editingNote || {}),
                id: optimisticId,
                ...payload,
                created_at: editingNote?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...(isNewNote ? { _pinnedToTop: true, _optimistic: true } : {}),
            };

            setDbData((prev) => {
                if (existingNoteIdStr) {
                    return prev.map((n) => (String(n.id) === existingNoteIdStr ? { ...n, ...payload } : n));
                }
                return [...prev, optimisticNote];
            });
            // The Today tab bar reads from todayNotes ∪ dbData (todayNotes is the
            // uncapped, decoupled fetch). A Today note can live in todayNotes without
            // being in the 500-capped dbData, so patch it here too or the tab keeps
            // showing the stale title until a refetch.
            if (existingNoteIdStr) {
                setTodayNotes((prev) => prev.map((n) => (String(n.id) === existingNoteIdStr ? { ...n, ...payload } : n)));
            }
            // Write-through cache immediately on optimistic update

            try {
                if (existingNoteId !== null) {
                    localWriteRef.current.set(String(existingNoteId), Date.now());
                    await notesApi.update(String(existingNoteId), payload);
                    // Only patch editingNote if still on the same note (user may have switched mid-save)
                    setEditingNote((prev: any) => (prev && String(prev.id) === String(existingNoteId)) ? { ...prev, ...payload } : prev);
                } else {
                    // Same title is allowed, even in the same folder — notes are keyed
                    // by id, never by title. Always INSERT a new row; no dedup-by-title
                    // overwrite (that silent-overwrite guard is gone by design).
                    const { note: data } = await notesApi.insert(payload);
                    if (data) {
                        // Mark as own-insert so Realtime INSERT handler skips it
                        localWriteRef.current.set(String(data.id), Date.now());
                        setPendingNoteType(null);
                        setPendingFormat(null); // format is now sourced from editingNote.format

                        // Only take editingNote if user hasn't already switched to a different note
                        setEditingNote((prev: any) => (prev === null || String(prev.id) === optimisticId) ? data : prev);
                        setDbData((prev) => { const seen = new Set<string>(); return prev.map((n) => String(n.id) === optimisticId ? data : n).filter((n) => { const id = String(n.id); if (seen.has(id)) return false; seen.add(id); return true; }); });
                        // Replace optimistic entry in cache with confirmed server data
                    }
                }
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                // Cancel any pending auto-save timer — prevents stale closure from firing a second INSERT
                if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
                if (!silent) { const t = (payload.title || "Untitled").slice(0, 10) + ((payload.title || "").length > 10 ? "…" : ""); const isFirst = !existingNoteIdStr && dbData.filter(n => !n.is_folder && !n._optimistic).length <= 1; showToast(existingNoteIdStr ? `"${t}" updated` : `+ "${t}"`, payload.folder_color || "#34C759", isFirst); }
                return true;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error("Save Error:", msg);
                if (existingNoteIdStr && existingSnapshot) {
                    setDbData((prev) => prev.map((n) => (String(n.id) === existingNoteIdStr ? existingSnapshot : n)));
                } else if (!existingNoteIdStr) {
                    setDbData((prev) => prev.filter((n) => String(n.id) !== optimisticId));
                }
                showError(`Save Failed: ${msg.slice(0, 40)}`);
                return false;
            } finally {
                isSavingRef.current = false;
            }
        },
        [isDraftDirty, targetFolder, noteColor, activeFolder, folderStack, editingNote, content, folders, dbData, pendingNoteType, richDoc, defaultFolder],
    );
    // Always-current ref so other callbacks can call saveNote without stale closures
    useEffect(() => { saveNoteRef.current = saveNote; }, [saveNote]);

    const closeEditorTools = useCallback(() => {
        setShowColorPicker(false);
        setShowSwitcher(false);
    }, []);

    const moveToFolder = useCallback(
        async (name: string) => {
            const destColor = folders.find((f) => f.name === name)?.color || palette12[0];
            setTargetFolder(name);
            setShowSwitcher(false);
            setFolderSearchQuery("");
            playSound("move");
            showToast(`→ "${name}"`, destColor);
            if (editingNote?.id) {
                // Optimistic update — keep note's own color, only change folder
                const noteId = String(editingNote.id);
                const folderRow = folders.find((f) => f.name === name);
                const folderId = folderRow?.id ?? `virtual-${name}`;
                const newFolderId = folderId.startsWith("virtual-") ? null : folderId;
                setDbData((prev) =>
                    prev.map((r) =>
                        String(r.id) === noteId ? { ...r, folder_name: name, folder_id: newFolderId, folder_color: destColor } : r,
                    ),
                );
                setEditingNote((prev: any) => (prev ? { ...prev, folder_name: name, folder_id: newFolderId, folder_color: destColor } : prev));
                setShowNoteActions(false);
                // In tab view, stay open and move to next tab
                const isTabView = (showTabs || mainListMode === "tabs") && typeof window !== "undefined" && window.innerWidth >= 640;
                if (mainListMode === "tabs") {
                    // Tabs mode: stay on current note after move
                } else if (isTabView) {
                    // Find next tab to switch to
                    const remaining = dbData.filter(n => !n.is_folder && !n.trashed_at && String(n.id) !== noteId && !dismissedTabs.has(String(n.id)) && (activeFolder ? n.folder_name === activeFolder : true))
                        .sort(byUpdatedOrder).slice(0, tabLimit);
                    if (remaining.length > 0) void openNote(remaining[0]);
                } else {
                    setEditorOpen(false);
                }
                // Remove from old folder cache, add to new
                if (editingNote.folder_name && editingNote.folder_name !== name) {
                }
                try {
                    await notesApi.update(noteId, { folder_name: name, folder_color: destColor, ...(newFolderId ? { folder_id: newFolderId } : {}) });
                    // Refresh target folder notes — but NOT in tabs mode (would wipe other folders' notes)
                    if (mainListMode !== "tabs") void loadFolderNotes(name, false);
                } catch (err) {
                    console.error("Move failed:", err);
                    showToast("Move Failed");
                }
            }
        },
        [folders, editingNote, loadFolderNotes],
    );


    const closeNoteModal = useCallback(() => {
        const wasChanged = noteEverDirtyRef.current;
        noteEverDirtyRef.current = false;
        void saveNote({ silent: true });
        const rawT = titleRaw.current || title;
        if (wasChanged && rawT.trim()) {
            const t = rawT.slice(0, 10) + (rawT.length > 10 ? "…" : "");
            const isNew = !editingNote?.id;
            showToast(isNew ? `+ "${t}"` : `"${t}" updated`, noteColor || "#34C759", isNew);
        }
        closeEditorTools();
        setEditorOpen(false);
        setImages([]);
    }, [saveNote, closeEditorTools, editingNote?.id, noteColor]);

    const backToRootFromEditor = useCallback(async () => {
        const wasChanged = noteEverDirtyRef.current;
        const isNew = !editingNote?.id;
        noteEverDirtyRef.current = false;
        // Await save so folder reload only fires after the note is in the DB
        await saveNote({ silent: true });
        const rawT = titleRaw.current || title;
        if (wasChanged && rawT.trim()) {
            const t = rawT.slice(0, 10) + (rawT.length > 10 ? "…" : "");
            showToast(isNew ? `+ "${t}"` : `"${t}" updated`, noteColor || "#34C759", isNew);
        }
        closeEditorTools();
        setEditorOpen(false);
        setImages([]);
        // Stay on current folder — don't navigate away (preserves Today view, etc.)
        setSearch("");
    }, [saveNote, closeEditorTools, editingNote?.id, targetFolder, activeFolder, noteColor]);

    // Pick a random palette color, avoiding the last-used one if possible
    // Cmd+S → save + toast
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (editorOpen) {
                    void saveNote({ silent: true, deriveTitle: true }).then(() => {
                        const t = (title || "Untitled").slice(0, 10) + ((title || "").length > 10 ? "…" : "");
                        showToast(`"${t}" saved`, noteColor || "#34C759");
                    });
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [saveNote, editorOpen, title, noteColor]);

    // Cmd+Z undo / Cmd+Shift+Z redo
    const editorOpenRef2 = useRef(editorOpen);
    editorOpenRef2.current = editorOpen;
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!editorOpenRef2.current) return;
            if (!(e.metaKey || e.ctrlKey) || e.key !== "z") return;
            e.preventDefault();
            const current = latestContentRef.current;
            if (e.shiftKey) {
                const val = redoStackRef.current.pop();
                if (val !== undefined) { undoStackRef.current.push(current); latestContentRef.current = val; setContent(val); }
            } else {
                const val = undoStackRef.current.pop();
                if (val !== undefined) { redoStackRef.current.push(current); latestContentRef.current = val; setContent(val); }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);


    // Cmd+R → refresh notes (prevents browser reload)
    useEffect(() => {
        if (IS_PHONE) return;
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "r") {
                e.preventDefault();
                void sync();
                if (activeFolder) void loadFolderNotes(activeFolder, false);
                showToast("Refreshed", "#3b82f6");
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [activeFolder, loadFolderNotes]);




    const openNewNote = useCallback((type?: string, folder?: string) => {
        noteEverDirtyRef.current = false;
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
        latestContentRef.current = "";
        // "Today"/"All" are virtual views (not real homes). Filing a new note into them
        // orphans it under a phantom literal "Today"/"All" folder in the root grid, so
        // redirect to the default notebook instead.
        let target = folder || activeFolder || "CLAUDE";
        if (target === "Today" || target === "All") target = defaultFolder || "CLAUDE";
        const isStandup = target.toLowerCase() === "standup";
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;
        setEditingNote(null);
        setTitle(isStandup ? dateStr : "");
        setContent("");
        setRichDoc(null);
        latestRichDocRef.current = null;
        setImages([]);
        setNoteTags([]);
        setPendingNoteType(type ?? "text");
        // New web-created notes default to rich (Evernote-style). Explicit `type` (markdown,
        // code, etc.) overrides — those modes assume the textarea path.
        setPendingFormat(type ? "text" : "rich");
        setTargetFolder(target);
        setNoteColor(palette12[Math.floor(Math.random() * palette12.length)]);
        shouldFocusTitleOnOpenRef.current = !isStandup;
        closeEditorTools();
        setEditorOpen(true);
        playSound("create");
    }, [activeFolder, closeEditorTools, folders, defaultFolder]);

    // AI magic — stream Claude response into note content
    const runAiPrompt = useCallback(async () => {
        if (!aiPrompt.trim() || aiLoading) return;
        // Warn if note already has content
        if (content.trim()) { setAiConfirmPending("magic"); return; }
        void executeAiPrompt();
    }, [aiPrompt, aiLoading, content]);

    const executeAiPrompt = useCallback(async () => {
        const savedTitle = title;
        setAiLoading(true);
        try {
            const res = await fetch("/api/stickies/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: aiPrompt.trim(), content, title }),
            });
            if (!res.ok) { showToast("AI error: " + (await res.text()), "#EF4444"); return; }
            const reader = res.body?.getReader();
            if (!reader) return;
            const decoder = new TextDecoder();
            let result = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                result += decoder.decode(value, { stream: true });
                latestContentRef.current = result;
                startContentTransition(() => setContent(result));
            }
            // Restore title or derive from the prompt if empty
            if (savedTitle.trim()) {
                setTitle(savedTitle); titleRaw.current = savedTitle;
            } else {
                const promptTitle = aiPrompt.trim().slice(0, 60).replace(/[?!.]+$/, "");
                if (promptTitle) { setTitle(promptTitle); titleRaw.current = promptTitle; }
            }
            setAiPrompt("");
            setAiPromptOpen(false);
            noteEverDirtyRef.current = true;
        } catch (e: any) {
            showToast("AI error: " + (e.message || "unknown"), "#EF4444");
        } finally {
            setAiLoading(false);
        }
    }, [aiPrompt, aiLoading, content, title]);

    const runAiGrammarFix = useCallback(async () => {
        if (aiLoading || !content.trim()) return;
        const savedTitle = title;
        setAiLoading(true);
        try {
            const res = await fetch("/api/stickies/ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: "Please clean up my grammar only! Make it precisely clear. Keep the same tone and meaning. Do not add or remove content.", content, title }),
            });
            if (!res.ok) { showToast("AI error: " + (await res.text()), "#EF4444"); return; }
            const reader = res.body?.getReader();
            if (!reader) return;
            const decoder = new TextDecoder();
            let result = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                result += decoder.decode(value, { stream: true });
                latestContentRef.current = result;
                startContentTransition(() => setContent(result));
            }
            if (savedTitle.trim()) { setTitle(savedTitle); titleRaw.current = savedTitle; }
            noteEverDirtyRef.current = true;
            showToast("Grammar cleaned up!", "#34d399");
        } catch (e: any) {
            showToast("AI error: " + (e.message || "unknown"), "#EF4444");
        } finally {
            setAiLoading(false);
        }
    }, [aiLoading, content, title]);

    // Cmd+N — open new note (always global, but can't override OS-level browser new-tab)
    useEffect(() => {
        if (IS_PHONE) return;
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "n") {
                e.preventDefault();
                e.stopPropagation();
                openNewNote();
            }
        };
        window.addEventListener("keydown", handler, true);
        return () => window.removeEventListener("keydown", handler, true);
    }, [openNewNote]);

    // Global paste handler — paste markdown in list view creates a new note
    const editorOpenRef = useRef(editorOpen);
    editorOpenRef.current = editorOpen;
    const activeFolderRef = useRef(activeFolder);
    activeFolderRef.current = activeFolder;
    useEffect(() => {
        const handler = (e: ClipboardEvent) => {
            // Skip if editor is open or user is typing in an input
            if (editorOpenRef.current) return;
            const el = document.activeElement;
            if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || (el as HTMLElement).isContentEditable)) return;
            const text = e.clipboardData?.getData("text/plain")?.trim();
            if (!text || text.length < 10) return;
            e.preventDefault();
            setEditingNote(null);
            setTitle("");
            setContent(text);
            setTargetFolder(activeFolderRef.current || "General");
            const fc = folders.find(f => f.name === (activeFolderRef.current || "General"))?.color || palette12[0];
            setNoteColor(fc);
            setPendingNoteType(detectNoteType(text));
            setEditorOpen(true);
            shouldFocusTitleOnOpenRef.current = true;
            playSound("create");
            showToast("Pasted — name your note", "#34C759");
        };
        window.addEventListener("paste", handler);
        return () => window.removeEventListener("paste", handler);
    }, [folders]);

    const showToast = (msg: string, color = "#34C759", confetti = true) => {
        setToastKey(k => k + 1);
        setToastColor(color);
        setToast(msg);
        setToastConfetti(confetti);
        setToastIsError(false);
        setToastRainbow(false);
        setTimeout(() => { setToast(""); setToastConfetti(false); setToastIsError(false); setToastRainbow(false); }, 3000);
        playSound("toast");
    };
    const showError = (msg: string) => {
        setToastKey(k => k + 1);
        setToastColor("#FF3B30");
        setToast(msg);
        setToastConfetti(false);
        setToastIsError(true);
        setTimeout(() => { setToast(""); setToastIsError(false); }, 3000);
        playSound("toast-error");
    };

    useEffect(() => {
        if (!showWelcomeBack) return;
        setShowWelcomeBack(false);
        const greetings = [
            "Let's build something cool.",
            "Welcome back, boss.",
            "Let's do it. One diagram at a time.",
            "Good to see you.",
            "Ready when you are.",
            "Let's make it count.",
            "Diagrams standing by.",
            "Ready, set, go.",
            "All systems initiated.",
            "Let's make something great.",
        ];
        showToast(greetings[Math.floor(Math.random() * greetings.length)], "#34C759");
     
    }, [showWelcomeBack]);

    useEffect(() => {
        const handler = (e: Event) => {
            const { msg, color, confetti } = (e as CustomEvent).detail ?? {};
            showToast(msg ?? "Done", color ?? "#34C759", confetti ?? false);
        };
        window.addEventListener("stickies-toast", handler);
        return () => window.removeEventListener("stickies-toast", handler);
    }, []);

    // Surface RichEditor image-upload failures via the existing error toast.
    // RichEditor dispatches `stickies:upload-error` because it doesn't have direct access to showError.
    useEffect(() => {
        const handler = (e: Event) => {
            const { name, error } = (e as CustomEvent).detail ?? {};
            showError(`Upload failed: ${name ?? "image"}${error ? ` (${String(error).slice(0, 60)})` : ""}`);
        };
        window.addEventListener("stickies:upload-error", handler);
        return () => window.removeEventListener("stickies:upload-error", handler);
    }, []);

    async function uploadImage(file: File): Promise<{ url: string; name: string; type: string; extractedText?: string }> {
        // Downscale very large photos before upload to save bandwidth + Google Drive storage,
        // but stay above any visible-quality threshold (longest side >= 2000px, quality 0.95).
        // PNG stays PNG (lossless), JPEG stays JPEG at 95%. Anything the browser can't decode
        // in a canvas (HEIC/AVIF often, SVG, GIF) passes through as-is.
        const optimized = await shrinkIfHuge(file);
        const fd = new FormData();
        fd.append("file", optimized);
        fd.append("folder", targetFolder || activeFolder || "unsorted");
        const res = await fetch("/api/stickies/gdrive", {
            method: "POST",
            headers: {  },
            body: fd,
        });
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
    }

    /** Downscale to a max dimension if the source is huge; preserve format + quality. */
    async function shrinkIfHuge(file: File, maxDim = 2000): Promise<File> {
        // Skip unsupported types — canvas can't reliably decode these
        if (!file.type.startsWith("image/")) return file;
        if (/svg|gif/i.test(file.type)) return file;
        // Heic/avif: browser support is inconsistent; pass through
        if (/heic|heif|avif/i.test(file.type)) return file;
        try {
            const bitmap = await createImageBitmap(file);
            const { width, height } = bitmap;
            const longest = Math.max(width, height);
            if (longest <= maxDim) { bitmap.close?.(); return file; }
            const scale = maxDim / longest;
            const w = Math.round(width * scale);
            const h = Math.round(height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
            bitmap.close?.();
            // Preserve format. PNG -> lossless. JPEG -> 95%. Anything else -> JPEG 95%.
            const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
            const quality = outType === "image/jpeg" ? 0.95 : undefined;
            const blob: Blob = await new Promise((res, rej) =>
                canvas.toBlob(b => b ? res(b) : rej(new Error("canvas.toBlob failed")), outType, quality),
            );
            return new File([blob], file.name, { type: outType });
        } catch (err) {
            console.warn("[shrinkIfHuge] falling back to original:", err);
            return file;
        }
    }

    async function addImages(files: FileList | File[]) {
        setUploadingImages(true);
        // PDFs upload as-is; the server (pdf-parse in the gdrive route) still extracts
        // their text below. Client-side PDF->PNG rasterizing was dropped with pdfjs-dist
        // (it carried a high-severity arbitrary-code-execution CVE).
        const expanded: File[] = Array.from(files);
        showToast(`Uploading ${expanded.length} file${expanded.length !== 1 ? "s" : ""}...`, "#a78bfa");
        try {
            const uploads = await Promise.all(expanded.map(uploadImage));
            // If any PDF had extracted text and the note body is empty, populate it
            const pdfText = uploads.filter(u => u.extractedText).map(u => u.extractedText!).join("\n\n");
            if (pdfText && !content.trim()) {
                setContent(pdfText);
            }
            setImages((prev) => {
                const updated = [...prev, ...uploads.map(({ extractedText: _, ...rest }) => rest)];
                const noteId = editingNote?.id;
                if (noteId) notesApi.update(String(noteId), { images: updated }).catch(console.error);
                return updated;
            });
            showToast(`${uploads.length} file${uploads.length !== 1 ? "s" : ""} uploaded`, "#34C759");
        } catch {
            showError("Upload failed");
        } finally {
            setUploadingImages(false);
        }
    }

    function removeImage(index: number) {
        setImages((prev) => {
            const updated = prev.filter((_, i) => i !== index);
            const noteId = editingNote?.id;
            if (noteId) notesApi.update(String(noteId), { images: updated }).catch(console.error);
            return updated;
        });
    }

    async function handleEditorPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter((i) => i.type.startsWith("image/"));

        const nid = editingNote?.id ? String(editingNote.id) : null;

        // Excel / Sheets paste → tab-separated rows → convert to an HTML table
        if (imageItems.length === 0) {
            let plain = e.clipboardData.getData("text/plain");
            plain = plain.replace(/^[⏺\s]+(?=[┌│├└])/m, "");
            const rows = plain.split(/\r?\n/).filter(r => r.length > 0);
            const looksLikeTsv = rows.length >= 2 && rows.every(r => r.includes("\t")) && rows[0].split("\t").length >= 2;
            if (looksLikeTsv) {
                e.preventDefault();
                const cellRows = rows.map(r => r.split("\t"));
                const colCount = Math.max(...cellRows.map(r => r.length));
                const esc = (c: string) => c.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                const padded = cellRows.map(r => {
                    const cells = r.map(esc);
                    while (cells.length < colCount) cells.push("");
                    return cells;
                });
                const header = padded[0];
                const body = padded.slice(1);
                const html = [
                    `<table>`,
                    `<thead><tr>${header.map(c => `<th>${c}</th>`).join("")}</tr></thead>`,
                    `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`,
                    `</table>`,
                ].join("\n");
                const textarea = e.currentTarget;
                const start = textarea.selectionStart ?? content.length;
                const end = textarea.selectionEnd ?? content.length;
                const needsBreaks = start > 0 && content[start - 1] !== "\n";
                const insert = (needsBreaks ? "\n\n" : "") + html + "\n";
                setContent(content.slice(0, start) + insert + content.slice(end));
                setPendingNoteType("html");
                showToast(`Table pasted (${cellRows.length}×${colCount}) ✓`, "#34C759");
                return;
            }
        }

        // Direct image file paste → upload to Google Drive (fallback: Supabase), embed as short URL
        if (imageItems.length > 0) {
            e.preventDefault();
            const files = imageItems.map((i) => i.getAsFile()).filter(Boolean) as File[];
            showToast("Uploading image…", "#32ADE6");
            try {
                const textarea = e.currentTarget;
                const start = textarea.selectionStart ?? content.length;
                const end = textarea.selectionEnd ?? content.length;
                const urls = await Promise.all(files.map(async (file, i) => {
                    const fd = new FormData();
                    fd.append("file", file, `image-${i + 1}.${file.type.split("/")[1] ?? "png"}`);
                    if (nid) fd.append("noteId", nid);
                    // Try Google Drive first
                    const gdriveRes = await fetch("/api/stickies/gdrive", {
                        method: "POST",
                        headers: {  },
                        body: fd,
                    });
                    if (gdriveRes.ok) {
                        const gdata = await gdriveRes.json();
                        if (gdata.url) return gdata.url as string;
                    }
                    // Fallback: Supabase
                    const res = await fetch("/api/stickies/upload", {
                        method: "POST",
                        headers: {  },
                        body: fd,
                    });
                    if (!res.ok) throw new Error("Upload failed");
                    const data = await res.json();
                    return data.url as string;
                }));
                const md = urls.map((src, i) => `![image-${i + 1}](${src})`).join("\n");
                const newContent = content.slice(0, start) + md + content.slice(end);
                setContent(newContent);
                showToast("Image pasted ✓", "#34C759");
            } catch {
                showError("Image paste failed");
            }
            return;
        }

        // Auto-trim leading/trailing spaces on each line (common from email/web paste)
        const plain = e.clipboardData.getData("text/plain");
        if (plain) {
            // Auto-format JSON
            try {
                const parsed = JSON.parse(plain);
                e.preventDefault();
                const formatted = JSON.stringify(parsed, null, 2);
                setContent(formatted);
                setPendingNoteType("json");
                showToast("JSON formatted", "#34C759", true);
                return;
            } catch {}

            const trimmed = plain
                .replace(/^[•·*][ \t]*/gm, "") // strip leading bullets that misalign tables
                .replace(/^[ \t\u00a0\u200b]+/gm, ""); // strip leading whitespace
            const spacesRemoved = plain.length - trimmed.length;
            if (spacesRemoved > 0) {
                e.preventDefault();
                const textarea = e.currentTarget;
                const start = textarea.selectionStart ?? content.length;
                const end = textarea.selectionEnd ?? content.length;
                // Blink red on textarea to show spaces being removed
                const orig = textarea.style.backgroundColor;
                textarea.style.backgroundColor = "rgba(255,59,48,0.25)";
                setTimeout(() => { textarea.style.backgroundColor = orig; }, 150);
                setTimeout(() => { textarea.style.backgroundColor = "rgba(255,59,48,0.25)"; }, 300);
                setTimeout(() => { textarea.style.backgroundColor = orig; }, 450);
                setContent(content.slice(0, start) + trimmed + content.slice(end));
                showToast(`${spacesRemoved} spaces removed`, noteColor || "#FF9500");
                return;
            }
            // Auto-detect and tag language
            const detected = detectNoteType(plain);
            if (detected && detected !== "text") {
                setPendingNoteType(detected);
            }
        }
    }

    // handleCursorUpdate removed — activeLine/editorLineHeight/editorPaddingTop were never read
    // getComputedStyle + 3 setState calls per keystroke was the main typing lag cause



    const openNoteLinkQr = useCallback(() => {
        const base = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://stickies-bheng.vercel.app";
        const noteId = editingNote?.id ? String(editingNote.id) : "";
        const url = noteId ? `${base}/share?noteId=${noteId}&theme=${appTheme === "dark" ? "dark" : "light"}` : base;
        setQrData(url);
        setQrType("link");
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, targetFolder, activeFolder]);

    const openNoteDataQr = useCallback(() => {
        const noteTitle = title.trim() || editingNote?.title || "";
        const noteContent = content || editingNote?.content || "";
        const text = [noteTitle, noteContent].filter(Boolean).join("\n\n").slice(0, 1500);
        const base64 = btoa(unescape(encodeURIComponent(text)));
        const base = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://stickies-bheng.vercel.app";
        setQrData(`${base}/clip?clip=${base64}`);
        setQrType("data");
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, content]);

    const deleteCurrentNote = useCallback(
        async (noteId: string | null, noteName: string, permanent = false) => {
            const resolvedNoteName = noteName.trim() || "Untitled";
            const label = resolvedNoteName.length > 10 ? resolvedNoteName.slice(0, 10) + "…" : resolvedNoteName;
            const resolvedColor = (noteId ? dbData.find((r) => String(r.id) === noteId)?.folder_color : null) || noteColor || "#FF3B30";
            if (!noteId) {
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                setEditingNote(null);
                setTitle("");
                setContent("");
                setEditorOpen(false);
                showToast(`"${label}" deleted`, resolvedColor);
                return;
            }
            const existingNote = dbData.find((r) => String(r.id) === noteId);
            // A locked (frozen) note can't be deleted or trashed. Stop here so the row
            // isn't optimistically removed only to reappear when the server 423s.
            if (existingNote?.frozen) {
                showToast("Locked — unlock to delete", "#f59e0b");
                return;
            }
            const alreadyInTrash = existingNote?.folder_name === "TRASH";
            try {
                const trashedAt = new Date().toISOString();
                const isPermanent = permanent || alreadyInTrash;
                // The list mutation + DB write, with rollback on failure. Deferred
                // when we fall back to the list so the row can blink + slide first.
                const commitRemoval = () => {
                    // Prune the dedicated virtual-view states too — they don't share dbData's
                    // mutation, so a permanent delete would otherwise linger in All/Today.
                    setAllNotes((prev) => prev.filter((n) => String(n.id) !== noteId));
                    setTodayNotes((prev) => prev.filter((n) => String(n.id) !== noteId));
                    if (isPermanent) {
                        setDbData((prev) => prev.filter((row) => String(row.id) !== noteId));
                        notesApi.delete(noteId).catch((err) => {
                            console.error("Delete failed:", err);
                            if (existingNote) setDbData((prev) => prev.some((r) => String(r.id) === noteId) ? prev : [existingNote, ...prev]);
                            showError("Delete didn't save");
                        });
                    } else {
                        setDbData((prev) => prev.map((r) => String(r.id) === noteId ? { ...r, folder_name: "TRASH", trashed_at: trashedAt } : r));
                        notesApi.update(noteId, { folder_name: "TRASH", trashed_at: trashedAt }).catch((err) => {
                            console.error("Trash failed:", err);
                            if (existingNote) setDbData((prev) => prev.map((r) => String(r.id) === noteId ? existingNote : r));
                            showError("Move to Trash didn't save");
                        });
                        if (existingNote) {
                            actionUndoStackRef.current.push({ type: "delete", note: existingNote, prevFolder: existingNote.folder_name || null });
                            if (actionUndoStackRef.current.length > 5) actionUndoStackRef.current.shift();
                        }
                    }
                };
                showToast(isPermanent ? `"${label}" deleted` : `"${label}" → Trash`, isPermanent ? "#FF3B30" : resolvedColor);
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                playSound("delete");
                // Pick the adjacent tab from the live tab strip (same as the tab ✕ button).
                const tabNotes = tabNavRef.current.notes || [];
                const tabIdx = tabNotes.findIndex((t: any) => String(t.id) === noteId);
                const remaining = tabNotes.filter((t: any) => String(t.id) !== noteId);
                const nextTab = tabIdx !== -1 && remaining.length > 0 ? remaining[Math.min(tabIdx, remaining.length - 1)] : null;
                if ((showTabs || mainListMode === "tabs") && nextTab && String(nextTab.id) !== "__draft__") {
                    // Stay in the tab view: drop the row now and activate the adjacent tab.
                    commitRemoval();
                    void openNote(nextTab);
                    return;
                }
                // Falling back to the list: blink the row red twice then slide it out.
                setEditingNote(null);
                setTitle("");
                setContent("");
                setEditorOpen(false);
                setRemovingNoteIds((prev) => new Set([...prev, noteId]));
                setTimeout(() => {
                    commitRemoval();
                    setRemovingNoteIds((prev) => { const s = new Set(prev); s.delete(noteId); return s; });
                }, 700);
            } catch (err) {
                console.error("Delete note failed:", err);
                showError("Delete Failed");
            }
        },
        [closeEditorTools, dbData, noteColor, showTabs, mainListMode],
    );

    // Cmd+Delete → send the open note to TRASH, skipping the confirm dialog. Same
    // contract as Noto ("Move to TRASH (Cmd+Delete skips this)"). The note dissolves
    // first, then the normal delete path runs, so the toast, sound, undo entry and
    // TRASH semantics are all unchanged - this only adds the shortcut and the vanish.
    const FIREFLY_MS = 600;
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || (e.key !== "Backspace" && e.key !== "Delete")) return;
            if (!editorOpen || !editingNote?.id || fireflyNoteId) return;
            e.preventDefault();
            const id = String(editingNote.id);
            // Mirror deleteCurrentNote's guard up front: a locked note must not appear
            // to dissolve and then quietly come back when the delete is refused.
            if (dbData.find((r) => String(r.id) === id)?.frozen) {
                showToast("Locked — unlock to delete", "#f59e0b");
                return;
            }
            const name = title;
            setFireflyNoteId(id);
            window.setTimeout(() => {
                setFireflyNoteId(null);
                void deleteCurrentNote(id, name);
            }, FIREFLY_MS);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [editorOpen, editingNote?.id, title, dbData, deleteCurrentNote, fireflyNoteId]);

    // Fast delete from toolbar — soft deletes to TRASH (recoverable), permanent if already in TRASH


    const deleteFolderByName = useCallback(
        async (folderName: string) => {
            if (!folderName) return;
            const isTrash = folderName === "TRASH";
            try {
                const folderColor = folderColors[folderName] || palette12[0];
                await notesApi.deleteByFolder(folderName);
                setDbData((prev) => prev.filter((row) =>
                    // For TRASH: only remove notes inside, keep the TRASH folder row itself
                    isTrash
                        ? !(String(row.folder_name || "") === folderName && !row.is_folder)
                        : String(row.folder_name || "") !== folderName
                ));
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                setEditingNote(null);
                setTitle("");
                setContent("");
                setEditorOpen(false);
                if (!isTrash) {
                    setFolderColors((prev) => { const next = { ...prev }; delete next[folderName]; return next; });
                    goBack();
                }
                setSearch("");
                playSound("delete");
                showToast(isTrash ? "Trash emptied" : `folder "${folderName}", deleted!`, folderColor);
            } catch (err) {
                console.error("Delete folder failed:", err);
                // Surface the real reason (e.g. "Folder X still has N notes...") so the
                // user knows to empty it first, rather than a generic failure.
                showError(err instanceof Error && err.message ? err.message : "Delete Failed");
            }
        },
        [closeEditorTools, goBack],
    );


    const bulkDeleteSelected = useCallback(
        async () => {
            // Locked (frozen) notes can't be deleted — drop them from the batch so the
            // UI doesn't optimistically trash them only for the server to 423.
            const ids = [...selectedIds].filter((id) => !dbData.find((r) => String(r.id) === String(id))?.frozen);
            const lockedSkipped = selectedIds.size - ids.length;
            if (lockedSkipped > 0) showToast(`${lockedSkipped} locked note${lockedSkipped === 1 ? "" : "s"} skipped`, "#f59e0b");
            if (ids.length === 0) return;
            try {
                const toDelete = dbData.filter((n) => ids.includes(String(n.id)));
                const inTrash = activeFolder === "TRASH";
                const trashedAt = new Date().toISOString();
                // Keep the virtual-view states in sync (they don't share dbData's mutation).
                setAllNotes((prev) => prev.filter((n) => !ids.includes(String(n.id))));
                setTodayNotes((prev) => prev.filter((n) => !ids.includes(String(n.id))));
                if (inTrash) {
                    setDbData((prev) => prev.filter((n) => !ids.includes(String(n.id))));
                    await Promise.all(ids.map((id) => notesApi.delete(id)));
                } else {
                    setDbData((prev) => prev.map((n) => ids.includes(String(n.id)) ? { ...n, folder_name: "TRASH", trashed_at: trashedAt } : n));
                    await Promise.all(ids.map((id) => notesApi.update(id, { folder_name: "TRASH", trashed_at: trashedAt })));
                    // Push each soft-deleted note onto the multi-level undo stack
                    toDelete.forEach((n: any) => {
                        actionUndoStackRef.current.push({ type: "delete", note: n, prevFolder: n.folder_name || null });
                    });
                    while (actionUndoStackRef.current.length > 5) actionUndoStackRef.current.shift();
                }
                setIsSelectMode(false);
                setSelectedIds(new Set());
                showToast(inTrash ? `Deleted ${ids.length} note${ids.length !== 1 ? "s" : ""}` : `${ids.length} note${ids.length !== 1 ? "s" : ""} → Trash`);
            } catch (err) {
                console.error("Bulk delete failed:", err);
                showError("Delete Failed");
            }
        },
        [selectedIds, activeFolder, dbData],
    );

    // Soft-delete ONE note to TRASH (swipe-to-delete). Optimistic with rollback on
    // error (matches bulkDeleteSelected); in the TRASH folder it deletes permanently.
    const swipeDeleteNote = useCallback(async (item: any) => {
        const id = String(item.id);
        const inTrash = activeFolder === "TRASH" || item.folder_name === "TRASH";
        const trashedAt = new Date().toISOString();
        setAllNotes((prev) => prev.filter((n) => String(n.id) !== id));
        setTodayNotes((prev) => prev.filter((n) => String(n.id) !== id));
        try {
            if (inTrash) {
                setDbData((prev) => prev.filter((n) => String(n.id) !== id));
                await notesApi.delete(id);
                showToast("Deleted");
            } else {
                setDbData((prev) => prev.map((n) => String(n.id) === id ? { ...n, folder_name: "TRASH", trashed_at: trashedAt } : n));
                await notesApi.update(id, { folder_name: "TRASH", trashed_at: trashedAt });
                actionUndoStackRef.current.push({ type: "delete", note: item, prevFolder: item.folder_name || null });
                while (actionUndoStackRef.current.length > 5) actionUndoStackRef.current.shift();
                showToast("Note → Trash");
            }
        } catch (err) {
            console.error("Swipe delete failed:", err);
            // Rollback the optimistic move so the note doesn't silently vanish.
            setDbData((prev) => prev.map((n) => String(n.id) === id ? { ...n, folder_name: item.folder_name, trashed_at: item.trashed_at ?? null } : n));
            showError("Delete Failed");
        }
    }, [activeFolder]);

    const togglePin = useCallback((id: string) => {
        setPinnedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(PINNED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
    }, []);

    // Lazily fetch full note content if it wasn't loaded in the list sync
    const openNote = useCallback(async (note: any) => {
        // Save any unsaved new note before switching — prevents duplicate INSERT from stale auto-save timer
        if (isDraftDirtyRef.current && !isSavingRef.current) {
            void saveNoteRef.current?.({ silent: true });
        }
        // Cancel pending auto-save timer so the stale closure can't fire a second INSERT
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }

        // Stamp this open so concurrent stale fetches don't overwrite the latest result
        const noteId = String(note.id);
        openingNoteIdRef.current = noteId;

        // Open immediately with available metadata so the editor switches at once
        setPendingNoteType(null); // reset so noteType comes from note.type, not prior mode
        setPendingFormat(null);   // ditto — format comes from note.format
        setEditingNote(note);
        setTitle(note.title || "");
        setContent(note.content ?? "");
        // Rich-text doc: only present for format='rich' notes; null otherwise
        const initialDoc = (note as any).doc ?? null;
        setRichDoc(initialDoc);
        latestRichDocRef.current = initialDoc;
        setImages((note as any).images ?? []);
        setNoteTags((note as any).tags ?? []);
        undoStackRef.current = [];
        redoStackRef.current = [];
        setTargetFolder(note.folder_name || activeFolder || "General");
        setNoteColor(note.folder_color || folders.find((f: any) => f.name === (note.folder_name || activeFolder))?.color || "#888");
        setShowColorPicker(false);
        setShowSwitcher(false);
        setEditorOpen(true);

        // Always fetch full content — list API omits the content column.
        // Also force-fetch when the note is `format='rich'` but no `doc` field arrived
        // from the list (the list query doesn't include the heavy `doc` JSONB column).
        const needsRichDocFetch = (note as any).format === "rich" && (note as any).doc == null;
        if (note.content == null || needsRichDocFetch) {
            setNoteContentLoading(true);
            // Retry transient blips (network hiccup, !res.ok, expired token) so the
            // body never lands on a silent blank — a single failed fetch used to leave
            // the editor empty until the note was reopened.
            let fetched: any = null;
            for (let attempt = 0; attempt < 4 && !fetched; attempt++) {
                // Bail if the user switched notes mid-retry
                // A newer openNote superseded this one — bail WITHOUT touching the
                // global loading flag. The newer call owns it; clearing it here would
                // dismiss the overlay for the note that IS still loading -> blank white.
                if (openingNoteIdRef.current !== noteId) return;
                if (attempt > 0) await new Promise((r) => setTimeout(r, 350 * attempt));
                try {
                    const res = await fetch(`/api/stickies?id=${encodeURIComponent(note.id)}`, {
                        headers: {  },
                    });
                    if (res.ok) {
                        const data = await res.json().catch(() => null);
                        if (data?.note) fetched = data.note;
                    }
                } catch { /* retry */ }
            }
            // Discard if user switched to a different note while this fetch was in flight
            if (openingNoteIdRef.current !== noteId) { setNoteContentLoading(false); return; }
            if (fetched) {
                setDbData((prev: any[]) => prev.map((r) => String(r.id) === noteId ? { ...r, ...fetched } : r));
                setEditingNote(fetched);
                const body = fetched.content || "";
                setContent(body);
                const fetchedDoc = (fetched as any).doc ?? null;
                setRichDoc(fetchedDoc);
                latestRichDocRef.current = fetchedDoc;
                // Always use the DB title — no auto-derive
                if (fetched.title) setTitle(fetched.title);
                if (fetched.id && (fetched.list_mode || fetched.type === "checklist")) setListModeNotes((p: Set<string>) => new Set([...p, String(fetched.id)]));
            }
            setNoteContentLoading(false);
        } else {
            if (note.id && (note.list_mode || note.type === "checklist")) setListModeNotes((p: Set<string>) => new Set([...p, String(note.id)]));
        }
    }, [activeFolder, folders]);
    const openNoteRef = useRef(openNote);
    openNoteRef.current = openNote;

    // Realtime sync — Pusher channel + reconnect catch-up + focus/online/poll backstop.
    // Called here (not up with the other effects) so every value it closes over is
    // already declared; behavior is a verbatim 1:1 move of the former inline effects.
    useRealtimeSync({
        mounted,
        setDbData,
        setFolderCounts,
        setFolderCountsById,
        setFlashColor,
        setFlashNote,
        setPusherFlash,
        setIncomingNoteIds,
        setRemovingNoteIds,
        setEditingNote,
        setContent,
        setTitle,
        setRichDoc,
        setListModeNotes,
        showToast,
        localWriteRef,
        integrationsRef,
        isFlashingRef,
        flashQueueRef,
        mainListModeRef,
        openNoteRef,
        latestRichDocRef,
        pendingDeleteRef,
    });

    // Tab navigation model - the ordered tab list + where we are in it. Computed
    // here (not inside the tab strip's JSX) so the HEADER stepper and the strip
    // read the same source: the strip renders after the header, so a ref written
    // during its render would leave the header a frame stale.
    const tabNav = useMemo(() => {
        // Bail before doing any work unless a note is actually open. The tab strip
        // lives inside the `editorOpen` section and the header stepper only exists
        // there, so outside the editor this dedupe+sort would be pure waste on every
        // render of the root grid (the pre-extraction code ran inside the strip's
        // JSX, so it inherited this guard implicitly - keep it explicit here).
        if (!editorOpen) {
            return { notes: [] as any[], activeId: "", inFolder: false, isUnsavedDraft: false, dayLabel: "All", index: -1 };
        }
        const isAllView = activeFolder === "All";
        const inFolder = !!activeFolder && activeFolder !== "Today" && !isAllView;
        const dedupeById = (arr: any[]) => Array.from(new Map(arr.map(n => [String(n.id), n])).values());
        const list = (inFolder
            ? dbData.filter(n => !n.is_folder && !n.trashed_at && !dismissedTabs.has(String(n.id)) && n.folder_name === activeFolder)
            : dedupeById([...todayNotes, ...allNotes, ...dbData])
                .filter(n => !n.is_folder && !n.trashed_at && n.folder_name !== "TRASH" && !dismissedTabs.has(String(n.id)))
        ).filter(n => !createdByFilter || n.created_by_key === createdByFilter)
         // Cmd-K "Open all" tab scope: in the ALL view, show only the matched notes.
         .filter(n => inFolder || !cmdkTabIds || cmdkTabIds.has(String(n.id)))
         .sort(inFolder ? byUpdatedOrder : byCreatedOrder);
        const isUnsavedDraft = editorOpen && !editingNote?.id;
        if (isUnsavedDraft && !inFolder) {
            list.unshift({
                id: "__draft__", title: title.trim() || "New note",
                folder_name: targetFolder || "Today", folder_color: noteColor || palette12[0],
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(), _draft: true,
            } as any);
        }
        const notes = list.slice(0, tabLimit);
        const activeId = String(editingNote?.id ?? (isUnsavedDraft ? "__draft__" : ""));
        return {
            notes, activeId, inFolder, isUnsavedDraft,
            dayLabel: inFolder ? activeFolder : "All",
            index: notes.findIndex((n: any) => String(n.id) === activeId),
        };
    }, [activeFolder, dbData, todayNotes, allNotes, dismissedTabs, createdByFilter,
        editorOpen, editingNote?.id, title, targetFolder, noteColor, tabLimit, cmdkTabIds]);

    // Step to the previous/next tab. Single implementation shared by the keyboard
    // arrows and the header stepper buttons (touch devices have no arrow keys).
    const stepTab = useCallback((dir: -1 | 1) => {
        const { notes, index } = tabNav;
        if (index === -1 || notes.length < 2) return false;
        const target = notes[index + dir];
        if (!target || String(target.id) === "__draft__") return false;
        void openNote(target);
        return true;
    }, [tabNav, openNote]);

    const canStepPrev = tabNav.index > 0 && String(tabNav.notes[tabNav.index - 1]?.id ?? "") !== "__draft__";
    const canStepNext = tabNav.index > -1 && tabNav.index < tabNav.notes.length - 1;

    // ← / → arrows flip through open tabs (Gmail-style). They keep working across
    // plain- AND rich-text notes because switching to a note no longer auto-focuses
    // its body (rich autofocus is now new-notes-only). Arrows only fall through to
    // caret movement once the user CLICKS into the body — a focused textarea /
    // contentEditable / input is exempt so editing feels normal. Click out (or the
    // body isn't focused) and Left/Right go back to switching tabs.
    useEffect(() => {
        if (IS_PHONE) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
            const el = document.activeElement as HTMLElement | null;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
            if (!editorOpen) return;
            if (stepTab(e.key === "ArrowRight" ? 1 : -1)) e.preventDefault();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [editorOpen, stepTab]);

    useEffect(() => {
        if (!pendingRestoreNoteId || !isDataLoaded) return;
        const note = dbData.find((n: any) => !n.is_folder && String(n.id) === String(pendingRestoreNoteId));
        if (note) {
            setActiveFolder(note.folder_name || null);
            void openNote(note);
            setPendingRestoreNoteId(null);
            setIsUrlChecking(false);
        } else if (!folderNotesLoading) {
            // Notes done loading and note still not found — give up
            setPendingRestoreNoteId(null);
            setIsUrlChecking(false);
        }
        // If folderNotesLoading, wait — effect re-fires when dbData changes
    }, [pendingRestoreNoteId, dbData, isDataLoaded, folderNotesLoading, openNote]);

    const openNoteFromCmdK = useCallback((note: any) => {
        setShowCmdK(false);
        setCmdKQuery("");
        setCmdkTabIds(null); // single open — no tab-scope filter
        // Folder selected — navigate into it (don't open as a note)
        if (note._isFolder) {
            const fr = dbData.find((r: any) => r.is_folder && (r.folder_name === note.name || String(r.id) === String(note.id)));
            enterFolder({ id: fr ? String(fr.id) : `virtual-${note.name}`, name: note.name, color: note.color || palette12[0] });
            void loadFolderNotes(note.name, false);
            return;
        }
        // Don't hijack the breadcrumb when browsing a virtual view (All/Today) — opening a
        // note from there should leave you in All/Today on back, not drop you into the note's
        // own folder (e.g. CLAUDE). Only relocate when there's no meaningful view to preserve.
        const inVirtualView = activeFolder === "All" || activeFolder === "Today";
        if (note.folder_name && !inVirtualView && note.folder_name !== activeFolder) {
            const fr = dbData.find((r: any) => r.is_folder && r.folder_name === note.folder_name);
            if (fr) enterFolder({ id: String(fr.id), name: note.folder_name, color: fr.color || fr.folder_color || palette12[0] });
        }
        void openNote(note);
    }, [dbData, enterFolder, openNote, loadFolderNotes, activeFolder]);

    // Cmd-K "Open all" — open every matched note at once as tabs. Forces the ALL view
    // so the tab strip spans the matches and BACK lands on ALL, restricts the strip to
    // just those notes, then opens the first. The rest ride the tab strip.
    const openAllFromCmdK = useCallback(() => {
        // Open EVERY match as a tab (not a subset). tabNav caps the strip at tabLimit.
        const notes = (cmdKResults as any[]).filter((r) => !r._isFolder && !r._isLine && r.id != null);
        if (notes.length === 0) return;
        setShowCmdK(false);
        setCmdKQuery("");
        // Merge matched notes into dbData so the tab strip + openNote can resolve them —
        // server hits can live outside the loaded window.
        setDbData((prev: any[]) => {
            const byId = new Map(prev.map((r) => [String(r.id), r]));
            notes.forEach((n) => { const id = String(n.id); byId.set(id, { ...(byId.get(id) || {}), ...n }); });
            return Array.from(byId.values());
        });
        setActiveFolder("All");
        setCmdkTabIds(new Set(notes.map((n) => String(n.id))));
        void openNote(notes[0]);
    }, [cmdKResults, openNote, setActiveFolder]);

    // Drop the Cmd-K tab-scope once the editor closes so a later open shows the full strip.
    useEffect(() => { if (!editorOpen) setCmdkTabIds(null); }, [editorOpen]);


    const currentNoteId = editingNote?.id ? String(editingNote.id) : null;
    const listMode = currentNoteId ? listModeNotes.has(currentNoteId) : false;
    // Per-note `format` ('text' | 'rich') — DB-backed for saved notes,
    // pendingFormat for brand-new unsaved ones. Defaults to 'text'.
    const noteFormat: "text" | "rich" =
        ((editingNote as any)?.format ?? pendingFormat ?? "text") as "text" | "rich";
    const isRichMode = noteFormat === "rich";

    // ── Type resolution: DB `type` is source of truth; fall back to client detection ──
    const dbType: string | null = (editingNote as any)?.type ?? null;
    const detectedType = useMemo(() => detectNoteType(content), [content]);
    // If DB type is null but content is clearly a code type, trust the detection
    // so the toggle never shows and the correct renderer is used. Never downgrade a code type.
    const CODE_TYPES = _CODE_TYPES;
    const effectiveDbType = dbType ?? (CODE_TYPES.has(detectedType) ? detectedType : null);
    const noteType: string = pendingNoteType ?? effectiveDbType ?? detectedType;


    // Download the ENTIRE note (full scroll height, browser-screencapture style)
    // as a 2x PNG. html notes re-render in an offscreen same-origin iframe; other
    // formats capture the live preview or a styled text replica (lib/note-capture).
    const downloadNotePng = useCallback(async () => {
        setSharePickerOpen(false);
        showToast("Capturing note…", "#8b5cf6");
        try {
            const { captureNotePng } = await import("@/lib/note-capture");
            await captureNotePng({
                title: title.trim() || editingNote?.title || "note",
                noteType,
                isDark: appTheme === "dark",
                html: noteType === "html" ? wrapHtmlWithTheme(content || editingNote?.content || "", appTheme === "dark") : null,
                text: content || editingNote?.content || "",
                onNotice: (msg) => showToast(msg, "#f59e0b"),
            });
            showToast("PNG downloaded ✓", "#34C759");
        } catch (e) {
            console.error("[capture] note png failed", e);
            showError("Capture failed");
        }
    }, [title, editingNote, noteType, content, appTheme]);


    // Derived booleans — clean, no detection chains
    const baseMode = !listMode;
    const htmlMode     = baseMode && (noteType === "html" || (!!currentNoteId && htmlModeNotes.has(currentNoteId)));
    const jsonMode     = baseMode && noteType === "json";
    const codeMode     = baseMode && ["javascript","typescript","python","css","sql","bash"].includes(noteType);
    // jsonDetect kept for JSON syntax highlight fallback
    const jsonDetect = useMemo(() => jsonMode ? detectJson(content) : { ok: false, parsed: null }, [jsonMode, content]);

    // Checklist toggle: plain-text only, bullet/numbered list ≤12 lines, no blank lines between items
    const canToggleChecklist = useMemo(() => {
        if (noteType !== "text" || listMode) return false;
        const rawLines = content.split("\n");
        const lines = rawLines.filter(l => l.trim());
        if (lines.length < 4 || lines.length > 12) return false;
        if (lines.some(l => l.length > 200)) return false;
        const hasBlankBetween = rawLines.some((l, i) => i > 0 && i < rawLines.length - 1 && !l.trim() && rawLines[i - 1].trim());
        return !hasBlankBetween;
    }, [noteType, listMode, content]);

    // Unified active mode label
    const noteViewMode = listMode ? "Checklist" : isRichMode ? "Rich" : codeMode ? noteType : htmlMode ? "HTML" : "Text";

    // Folder stats for bottom status bar (active folder view, no note open)

    // Note stats for bottom status bar
     
    // Uses deferredContent (400ms debounce) — avoids JSON tree-walk on every keystroke

    const saveFolderIconToDb = useCallback(async (folderName: string, icon: string) => {
        try {
            const res = await fetch("/api/stickies/folder-icon", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ folderName, icon }),
            });
            if (!res.ok) console.error("[saveFolderIconToDb] HTTP", res.status, await res.text());
        } catch (err) {
            console.error("[saveFolderIconToDb] fetch error", err);
        }
    }, []);

    const toggleListMode = useCallback(() => {
        if (!currentNoteId) return;
        setShowAddTask(false);
        setListModeNotes((prev) => {
            const next = new Set(prev);
            const newVal = !next.has(currentNoteId);
            if (newVal) {
                next.add(currentNoteId);
            } else {
                next.delete(currentNoteId);
            }
            localWriteRef.current.set(currentNoteId, Date.now());
            void notesApi.update(currentNoteId, { list_mode: newVal, type: newVal ? "checklist" : null });
            // Update dbData + editingNote locally so type reflects change immediately everywhere
            setDbData((prev: any[]) => prev.map((r: any) =>
                String(r.id) === currentNoteId ? { ...r, list_mode: newVal, type: newVal ? "checklist" : null } : r
            ));
            setEditingNote((prev: any) => prev ? { ...prev, list_mode: newVal, type: newVal ? "checklist" : null } : prev);
            showToast(newVal ? "Checklist on" : "Checklist off", newVal ? "#34C759" : "#8e8e93");
            return next;
        });
    }, [currentNoteId]);

    const toggleHtmlMode = useCallback(() => {
        if (!currentNoteId) return;
        setHtmlModeNotes((prev) => {
            const next = new Set(prev);
            const enabling = !next.has(currentNoteId);
            if (enabling) next.add(currentNoteId);
            else next.delete(currentNoteId);
            void notesApi.update(currentNoteId, { type: enabling ? "html" : null });
            return next;
        });
    }, [currentNoteId]);


    // Switch a note's `format` between text and rich.
    // Lazy-imports rich-format helpers so the conversion cost is only paid on actual switch.
    // Optimistically updates local state, reverts on API failure so the UI never lies about
    // what's actually persisted.
    const switchNoteFormat = useCallback(async (next: "text" | "rich") => {
        if (!currentNoteId) { showError("Save the note first"); return; }
        const current = ((editingNote as any)?.format ?? "text") as "text" | "rich";
        if (current === next) return;
        const { textToDoc, docToText } = await import("@/lib/rich-format");

        const currentText = latestContentRef.current || content;
        const currentDoc  = latestRichDocRef.current ?? richDoc;

        // Snapshot rollback state before we touch anything
        const prevContent = currentText;
        const prevDoc     = currentDoc;
        const prevFormat  = current;

        const payload: Record<string, unknown> = { format: next };

        if (next === "rich") {
            const doc = textToDoc(currentText);
            latestRichDocRef.current = doc;
            setRichDoc(doc);
            payload.doc = doc;
            payload.content = docToText(doc);
            showToast("Rich mode — Evernote-style editing", "#a78bfa");
        } else {
            // rich → text: flatten the doc back to plain text.
            const text = docToText(currentDoc);
            payload.doc = null;
            payload.content = text;
            latestRichDocRef.current = null;
            setRichDoc(null);
            setContent(text);
            latestContentRef.current = text;
            showToast(`Switched to ${next}`, "#22d3ee");
        }

        // Optimistic local state update
        setEditingNote((prev: any) => prev ? { ...prev, format: next, ...(payload.doc !== undefined ? { doc: payload.doc } : {}) } : prev);
        setDbData((prev: any[]) => prev.map(r => String(r.id) === currentNoteId ? { ...r, format: next, ...(payload.doc !== undefined ? { doc: payload.doc } : {}) } : r));

        localWriteRef.current.set(currentNoteId, Date.now());
        try {
            await notesApi.update(currentNoteId, payload);
        } catch (e) {
            console.error("[switchNoteFormat] persistence failed, rolling back:", e);
            // Roll back local state so UI matches DB
            latestRichDocRef.current = prevDoc;
            setRichDoc(prevDoc);
            setContent(prevContent);
            latestContentRef.current = prevContent;
            setEditingNote((p: any) => p ? { ...p, format: prevFormat, doc: prevDoc } : p);
            setDbData((p: any[]) => p.map(r => String(r.id) === currentNoteId ? { ...r, format: prevFormat, doc: prevDoc } : r));
            showError("Format switch failed — reverted");
        }
    }, [currentNoteId, editingNote, content, richDoc]);

    // Cycle through note modes: Text -> Rich -> Checklist -> Text


    const contentLineCount = useMemo(() => deferredContent.split("\n").filter((l) => l.trim().length > 0).length, [deferredContent]);

    const parsedTasks = useMemo(() => {
        if (!listMode) return [];
        const isSeparator = (s: string) => /^[-–—=*#~_.]{2,}$/.test(s) || /^[-–—]{2,}.*[-–—]{2,}$/.test(s);
        const result: { done: boolean; inProgress: boolean; text: string; lineIdx: number }[] = [];
        // Use immediate `content` (not deferred) so checklist updates as soon as content arrives
        content.split("\n").forEach((line, lineIdx) => {
            const trimmed = line.trim();
            if (trimmed.length === 0 || isSeparator(trimmed)) return;
            const noBullet = trimmed.replace(/^\s*[-*•+_]\s*/, "").replace(/^\s*\d+\.\s*/, "").trim();
            const done = /^\[x\]/i.test(noBullet) || /^\[x\]/i.test(trimmed);
            const inProgress = !done && (/^\[\/\]/.test(noBullet) || /^\[\/\]/.test(trimmed));
            const text = noBullet.replace(/^\[x\]\s*/i, "").replace(/^\[\/\]\s*/, "").replace(/^\[\s*\]\s*/, "").trim();
            if (text.length === 0) return;
            result.push({ done, inProgress, text, lineIdx });
        });
        return result;
    }, [content, listMode]);

    const pushTaskHistory = useCallback((c: string) => {
        taskContentHistory.current = [...taskContentHistory.current.slice(-30), c];
    }, []);

    const toggleTask = useCallback((lineIdx: number) => {
        const lines = content.split("\n");
        const line = lines[lineIdx];
        if (line === undefined) return;
        const trimmed = line.trim();
        const noBullet = trimmed.replace(/^\s*[-*•+_]\s*/, "").replace(/^\s*\d+\.\s*/, "").trim();
        const wasDone = /^\[x\]/i.test(noBullet) || /^\[x\]/i.test(trimmed);
        const wasInProgress = !wasDone && (/^\[\/\]/.test(noBullet) || /^\[\/\]/.test(trimmed));
        // Cycle: empty → in-progress → done → empty
        let nextLine: string;
        let nextState: "empty" | "in-progress" | "done";
        const stripped = line.replace(/^\s*\[[ x\/]\]\s*/i, "");
        if (wasDone) { nextLine = stripped; nextState = "empty"; }
        else if (wasInProgress) { nextLine = `[x] ${stripped}`; nextState = "done"; }
        else { nextLine = `[/] ${stripped}`; nextState = "in-progress"; }
        pushTaskHistory(content);
        lines[lineIdx] = nextLine;
        playSound(nextState === "done" ? "check" : nextState === "empty" ? "uncheck" : "click");
        setContent(lines.join("\n"));
        setEditingTaskIdx(null);
        if (nextState === "done") {
            const label = noBullet.replace(/^\[.\]\s*/i, "").trim();
            showToast(`✓ ${label.length > 18 ? label.slice(0, 18) + "…" : label}`, "#34C759");
        } else if (nextState === "in-progress") {
            const label = noBullet.replace(/^\[.\]\s*/i, "").trim();
            showToast(`◐ ${label.length > 18 ? label.slice(0, 18) + "…" : label}`, "#FF9500");
        }
    }, [content, pushTaskHistory]);

    const reorderTask = useCallback((fromLineIdx: number, toLineIdx: number) => {
        if (fromLineIdx === toLineIdx) return;
        pushTaskHistory(content);
        const lines = content.split("\n");
        const [moved] = lines.splice(fromLineIdx, 1);
        lines.splice(toLineIdx > fromLineIdx ? toLineIdx - 1 : toLineIdx, 0, moved);
        setContent(lines.join("\n"));
    }, [content, pushTaskHistory]);

    const deleteTask = useCallback((lineIdx: number, label?: string, color?: string) => {
        pushTaskHistory(content);
        const lines = content.split("\n");
        const deletedText = lines[lineIdx];
        lines.splice(lineIdx, 1);
        setContent(lines.join("\n"));
        playSound("delete");
        if (deletedText !== undefined) setUndoDeleteTask({ text: deletedText, lineIdx });
        if (label) showToast(`"${label.length > 10 ? label.slice(0, 10) + "…" : label}" deleted`, color || "#71717a");
    }, [content, pushTaskHistory]);

    const renameTask = useCallback((lineIdx: number, newText: string) => {
        const trimmed = newText.trim();
        if (!trimmed) return;
        pushTaskHistory(content);
        const lines = content.split("\n");
        if (lines[lineIdx] === undefined) return;
        const isDone = /^\s*\[x\]\s*/i.test(lines[lineIdx]);
        lines[lineIdx] = isDone ? `[x] ${trimmed}` : trimmed;
        setContent(lines.join("\n"));
        setEditingTaskIdx(null);
        showToast("Updated", "#32ADE6");
    }, [content, pushTaskHistory]);

    const openAddTask = useCallback(() => {
        setNewTaskText("");
        setShowAddTask(true);
        setTimeout(() => addTaskInputRef.current?.focus(), 50);
    }, []);

    useEffect(() => {
        if (IS_PHONE || !showAddTask) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAddTask(false); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [showAddTask]);

    const confirmAddTask = useCallback(() => {
        const text = newTaskText.trim();
        if (!text) { setShowAddTask(false); return; }
        pushTaskHistory(content);
        setContent((prev) => (prev.trim() ? prev.trimEnd() + "\n" + text : text));
        setNewTaskText("");
        playSound("add");
        showToast(`Added`, "#34C759");
        setTimeout(() => addTaskInputRef.current?.focus(), 50);
    }, [newTaskText, content, pushTaskHistory]);



    const pickRandomPaletteColor = useCallback(() => palette12[Math.floor(Math.random() * palette12.length)], []);

    const applySingleFolderColor = useCallback(
        (color: string) => {
            if (!activeFolder) return;
            setFolderColors((prev) => ({ ...prev, [activeFolder]: color }));
            setFolderStack((prev) => prev.map((f) => f.name === activeFolder ? { ...f, color } : f));
            // Persist to DB — update folder row only
            const folderRow = dbData.find((r) => r.is_folder && r.folder_name === activeFolder);
            setDbData((prev) => prev.map((r) => {
                if (r.is_folder && r.folder_name === activeFolder) return { ...r, folder_color: color };
                return r;
            }));
            if (folderRow) void notesApi.update(String(folderRow.id), { folder_color: color });
            showToast(`${activeFolder} updated`, color);
        },
        [activeFolder, dbData],
    );

    const randomizeFolderColors = useCallback(async () => {
        if (!activeFolder) return;
        const folderNotes = dbData.filter(r => !r.is_folder && r.folder_name === activeFolder);
        const subfolders = dbData.filter(r => r.is_folder && r.parent_folder_name === activeFolder);
        const allItems = [...subfolders, ...folderNotes];
        if (allItems.length === 0) return;
        const picks: Record<string, string> = {};
        if (allItems.length <= 12) {
            const shuffled = [...palette12].sort(() => Math.random() - 0.5);
            allItems.forEach((n, i) => { picks[String(n.id)] = shuffled[i]; });
        } else {
            allItems.forEach(n => { picks[String(n.id)] = palette12[Math.floor(Math.random() * palette12.length)]; });
        }
        // DOM-only color update — zero React re-renders
        for (const [id, color] of Object.entries(picks)) {
            const el = document.querySelector(`[data-note-id="${id}"] [data-icon-sq]`) as HTMLElement;
            if (!el) continue;
            el.style.backgroundColor = color;
            el.style.boxShadow = `2px 3px 8px ${color}55`;
            el.style.setProperty("--fc", color);
        }
        showToast(`🎲 ${allItems.length} colors randomized`, "#AF52DE");
        // Persist then sync dbData silently
        await Promise.all(allItems.map(n =>
            notesApi.update(String(n.id), { folder_color: picks[String(n.id)] })
        ));
        setDbData(prev => prev.map(r => picks[String(r.id)] ? { ...r, folder_color: picks[String(r.id)] } : r));
    }, [activeFolder, dbData]);

    const renameFolderTo = useCallback(async (newName: string) => {
        if (!activeFolder || !newName.trim() || newName.trim() === activeFolder) return;
        const trimmed = newName.trim();
        if (isReservedFolderName(trimmed)) { showToast(`"${trimmed}" is a virtual view, not a folder`); return; }
        // Optimistic update
        setDbData((data) => data.map((r) => {
            if (r.folder_name === activeFolder) return { ...r, folder_name: trimmed };
            if (r.parent_folder_name === activeFolder) return { ...r, parent_folder_name: trimmed };
            return r;
        }));
        setFolderColors((prev) => {
            const next = { ...prev };
            if (next[activeFolder]) { next[trimmed] = next[activeFolder]; delete next[activeFolder]; }
            return next;
        });
        setFolderIcons((prev) => {
            const next = { ...prev };
            if (next[activeFolder]) { next[trimmed] = next[activeFolder]; delete next[activeFolder]; }
            return next;
        });
        setFolderStack((prev) => prev.map((f) => f.name === activeFolder ? { ...f, name: trimmed } : f));
        try {
            await notesApi.renameFolder(activeFolder, trimmed);
            showToast(`"${activeFolder}" → "${trimmed}"`, folderColors[trimmed] || folderColors[activeFolder] || palette12[0]);
        } catch (err) {
            console.error("Rename folder failed:", err);
            showToast("Rename Failed");
            void sync();
        }
    }, [activeFolder, setFolderStack, sync]);

    const moveFolderToParent = useCallback(async (parentName: string | null) => {
        if (!activeFolder) return;
        const folderRow = dbData.find((r) => r.is_folder && r.folder_name === activeFolder);
        if (!folderRow?.id || String(folderRow.id).startsWith("virtual-")) {
            showToast("Can't move virtual folder");
            return;
        }
        const color = folders.find((f) => f.name === (parentName ?? activeFolder))?.color;
        try {
            await notesApi.update(String(folderRow.id), { parent_folder_name: parentName });
            setDbData((prev) => prev.map((r) => String(r.id) === String(folderRow.id) ? { ...r, parent_folder_name: parentName } : r));
            setShowFolderMovePicker(false);
            setFolderMoveQuery("");
            { const fc = folderColors[activeFolder] || color || palette12[0]; showToast(parentName ? `"${activeFolder}" → "${parentName}"` : `"${activeFolder}" → Root`, fc); }
            if (!parentName) { setActiveFolder(null); setShowFolderActions(false); }
        } catch (err) {
            console.error("Move folder failed:", err);
            showToast("Move Failed");
        }
    }, [activeFolder, dbData, folders]);

    const openCreateFolder = useCallback(() => {
        setNewFolderName("");
        setNewFolderIcon("");
        setShowCreateFolder(true);
        setTimeout(() => newFolderInputRef.current?.focus(), 100);
    }, []);

    const confirmCreateFolder = useCallback(async () => {
        const folderName = newFolderName.trim();
        if (!folderName) return;
        if (isReservedFolderName(folderName)) { showToast(`"${folderName}" is a virtual view, not a folder`); return; }
        setShowCreateFolder(false);
        setShowFolderIconPicker(false);
        setNewFolderName("");
        const iconToSave = newFolderIcon || matchNoteIcon(folderName, "") || "";
        if (iconToSave) {
            setFolderIcons((prev) => ({ ...prev, [folderName]: iconToSave }));
            // Persist icon to DB after folder is created
            setTimeout(() => void saveFolderIconToDb(folderName, iconToSave), 500);
        }
        setNewFolderIcon("");

        const exists = folderNames.some((name) => name.toLowerCase() === folderName.toLowerCase());
        if (exists) {
            showToast("Folder Exists");
            return;
        }

        const color = activeFolder ? (folderStack.at(-1)?.color || pickRandomPaletteColor()) : pickRandomPaletteColor();
        const optimisticId = `folder-${Date.now()}`;
        const payload = {
            title: `ROOT_${folderName}`,
            content: "",
            folder_name: folderName,
            folder_color: color,
            is_folder: true,
            parent_folder_name: activeFolder || null,
            updated_at: new Date().toISOString(),
        };

        setDbData((prev) => [...prev, { id: optimisticId, ...payload, created_at: new Date().toISOString() }]);
        enterFolder({ id: optimisticId, name: folderName, color });
        const isFirstFolder = dbData.filter(n => n.is_folder).length <= 1;
        showToast(`+ "${folderName}"`, color, isFirstFolder);
        try {
            const { note: data } = await notesApi.insert(payload);
            if (data) {
                setDbData((prev) => { const seen = new Set<string>(); return prev.map((row) => String(row.id) === optimisticId ? data : row).filter((row) => { const id = String(row.id); if (seen.has(id)) return false; seen.add(id); return true; }); });
                setFolderStack((prev) => prev.map((f) => f.id === optimisticId ? { ...f, id: String(data.id) } : f));
            }
            playSound("create");
        } catch (err) {
            console.error("Create folder failed:", err);
            setDbData((prev) => prev.filter((row) => String(row.id) !== optimisticId));
            goBack();
            showToast("Create Failed");
        }
    }, [newFolderName, folderNames, pickRandomPaletteColor, enterFolder, goBack]);

    const isFolderGridView = !search.trim() && !activeFolder;
    const viewModeIcon = mainListMode === "list" ? Bars3Icon : RectangleStackIcon;
    const viewModeLabel = mainListMode === "list" ? "List" : "Tabs";
    const viewPanelRef = useRef<HTMLDivElement>(null);
    const cycleViewMode = useCallback(() => {
        // Trigger flip animation via DOM - no remount
        const el = viewPanelRef.current;
        if (el) {
            el.classList.remove("view-flip-in");
            void el.offsetWidth; // force reflow
            el.classList.add("view-flip-in");
        }
        setMainListMode(v => (v === "list" ? "tabs" : "list"));
    }, []);

    // Today is a virtual <24h view. Load it from the authoritative recent=today endpoint
    // (created_at filter, no row cap) and merge in — NOT loadAllNotes, whose ORDER BY
    // "order" ASC LIMIT 500 drops the newest notes (exactly the Today ones) once the
    // library passes 500 notes.
    useEffect(() => {
        if (activeFolder === "Today") { setTodayDays(1); void loadTodayNotes(1); return; }
        if (activeFolder === "All") { setAllNotes([]); setAllTotal(0); void loadAllRecent(0); return; }
        setTodayDays(1); // reset the Load-more window when leaving Today
    }, [mainListMode, activeFolder]);
    // Clear the "Posted by" filter only when the FOLDER changes (real navigation) —
    // NOT when switching list/tabs mode or opening a note, so a filtered view keeps
    // its filter (and its tab strip) after clicking into one of the filtered files.
    useEffect(() => { setCreatedByFilter(null); }, [activeFolder]);

    // "Load more" on the Today view — widen the window by one more 24h step and refetch.
    const loadMoreToday = async () => {
        if (todayLoadingMore) return;
        setTodayLoadingMore(true);
        const next = todayDays + 1;
        try {
            await loadTodayNotes(next);
            setTodayDays(next);
        } finally {
            setTodayLoadingMore(false);
        }
    };

    // "Load more" on the All view - fetch the next 20-note page from the server.
    const loadMoreAll = async () => {
        if (allLoadingMore) return;
        setAllLoadingMore(true);
        try {
            await loadAllRecent(allNotes.length);
        } finally {
            setAllLoadingMore(false);
        }
    };

    // When a "Posted by" filter is active in the All view, auto-pull every remaining
    // page so all matching notes appear at once — no clicking "Load more" 10 times.
    useEffect(() => {
        if (!createdByFilter || activeFolder !== "All") return;
        if (allLoadingMore || allNotes.length >= allTotal) return;
        void loadMoreAll();
    }, [createdByFilter, activeFolder, allNotes.length, allTotal, allLoadingMore]);

    const isNoteGridView = Boolean(activeFolder) && !search.trim();

    const persistFolderOrder = useCallback(
        async (orderedFolders: any[]) => {
            if (orderedFolders.length <= 1) return;
            const now = new Date().toISOString();

            // Materialize any virtual folders (create real DB rows) so they can be ordered
            const resolvedFolders = await Promise.all(
                orderedFolders.map(async (folder) => {
                    if (!String(folder.id || "").startsWith("virtual-")) return folder;
                    const folderName = folder.name || folder.folder_name;
                    let data: Record<string, unknown> | null = null;
                    try {
                        const res = await notesApi.insert({
                            is_folder: true,
                            folder_name: folderName,
                            folder_color: folder.color || palette12[0],
                            title: folderName,
                            content: folderIcons[folderName] || "",
                            order: 0,
                        });
                        data = res.note;
                    } catch { return folder; }
                    if (!data) return folder;
                    setDbData((prev) => [...prev, data as any]);
                    return data;
                })
            );

            const realFolders = resolvedFolders.filter((f) => !String(f.id || "").startsWith("virtual-"));
            const updates = realFolders.map((folder, index) => ({ id: folder.id, order: index + 1 }));
            const updateMap = new Map(updates.map((u) => [String(u.id), u.order]));
            const prev = dbData;

            setDbData((data) => data.map((row) => updateMap.has(String(row.id)) ? { ...row, order: updateMap.get(String(row.id)), updated_at: now } : row));

            try {
                await notesApi.bulkUpdate(updates.map((u) => ({ id: String(u.id), order: u.order })));
                // Cascade position-based palette colors to all children (notes + subfolders)
                const fullPalette = [...palette12, "#8E8E93", "#FFFFFF"];
                const rootFolders = realFolders.filter(f => !f.parent_folder_name);
                const colorUpdates: { id: string; folder_color: string }[] = [];
                rootFolders.forEach((folder, idx) => {
                    const newColor = fullPalette[idx % fullPalette.length];
                    const folderName = folder.folder_name || folder.name;
                    // Update the folder row itself
                    colorUpdates.push({ id: String(folder.id), folder_color: newColor });
                    // Find all notes and subfolders inside this folder
                    dbData.forEach(r => {
                        if (String(r.id) === String(folder.id)) return; // skip self
                        if (r.folder_name === folderName || r.parent_folder_name === folderName) {
                            colorUpdates.push({ id: String(r.id), folder_color: newColor });
                        }
                    });
                });
                // Optimistic local update
                const colorMap = new Map(colorUpdates.map(u => [u.id, u.folder_color]));
                setDbData(d => d.map(r => colorMap.has(String(r.id)) ? { ...r, folder_color: colorMap.get(String(r.id)) } : r));
                // Persist to DB
                void notesApi.bulkUpdate(colorUpdates);
            } catch (err) {
                console.error("Folder reorder failed:", err);
                setDbData(prev);
                throw err;
            }
        },
        [dbData, folderIcons],
    );

    const persistNoteOrder = useCallback(
        async (orderedNotes: any[]) => {
            if (orderedNotes.length <= 1) return;

            const now = new Date().toISOString();
            const updates = orderedNotes.map((note, index) => ({
                id: note.id,
                order: index + 1,
            }));
            const updateMap = new Map(updates.map((u) => [String(u.id), u.order]));
            const prev = dbData;

            setDbData((data) => data.map((row) => (updateMap.has(String(row.id)) ? { ...row, order: updateMap.get(String(row.id)), updated_at: now } : row)));

            try {
                await notesApi.bulkUpdate(updates.map((u) => ({ id: String(u.id), order: u.order })));
            } catch (err) {
                console.error("Note reorder failed:", err);
                setDbData(prev);
                throw err;
            }
        },
        [dbData],
    );


    const dragDidMoveRef = useRef(false);
    // Whether the tile currently being dragged is a folder. Notes may only be
    // dropped INTO a folder — a note dropped onto another note is ignored entirely.
    const draggingIsFolderRef = useRef(false);
    const handleTileDragStart = useCallback(
        (event: React.DragEvent<HTMLDivElement>, item: any) => {
            const id = String(item?.id || "");
            if (!id) return;
            if (!isFolderGridView && !isNoteGridView) return;
            dragDidMoveRef.current = false;
            draggingTileIdRef.current = id;
            draggingIsFolderRef.current = !!item?.is_folder;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", id);
        },
        [isFolderGridView, isNoteGridView],
    );

    const handleTileDragOver = useCallback(
        (event: React.DragEvent<HTMLDivElement>, item: any) => {
            const dragging = draggingTileIdRef.current;
            const targetId = String(item?.id || "");
            if (!dragging || !targetId || dragging === targetId) return;
            if (!dragDidMoveRef.current) {
                dragDidMoveRef.current = true;
                suppressOpenRef.current = true;
                setDraggingTileId(dragging);
            }
            // A note may only be dropped INTO a folder. Ignore note→note entirely:
            // no drop (skip preventDefault so the browser shows "no-drop") and no
            // before/after indicator. Folder→folder and →folder targets still work.
            if (!draggingIsFolderRef.current && !item?.is_folder) { setDropTarget(null); return; }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
            let mode: "before" | "after" | "into" = "after";
            const relY = (event.clientY - rect.top) / rect.height;
            if (item?.is_folder && relY > 0.25 && relY < 0.75) mode = "into";
            else mode = relY < 0.5 ? "before" : "after";
            setDropTarget({ id: targetId, mode });
        },
        [],
    );

    const handleTileDragLeave = useCallback(() => {
        setDropTarget(null);
    }, []);

    const handleTileDragEnd = useCallback(() => {
        draggingTileIdRef.current = null;
        setDraggingTileId(null);
        setDropTarget(null);
        if (dragDidMoveRef.current) {
            window.setTimeout(() => { suppressOpenRef.current = false; }, 0);
        }
        dragDidMoveRef.current = false;
    }, []);

    const handleTileDrop = useCallback(
        async (event: React.DragEvent<HTMLDivElement>, item: any) => {
            event.preventDefault();
            const targetId = String(item?.id || "");
            const sourceId = draggingTileIdRef.current;
            const mode = dropTarget?.id === targetId ? dropTarget.mode : "after";
            draggingTileIdRef.current = null;
            setDraggingTileId(null);
            setDropTarget(null);
            if (!sourceId || !targetId || sourceId === targetId) return;

            const sourceItem = dbData.find((x) => String(x.id) === sourceId)
                ?? currentLevelFolders.find((x) => String(x.id) === sourceId);
            const targetItem = (displayItems as any[]).find((x) => String(x.id) === targetId)
                ?? currentLevelFolders.find((x) => String(x.id) === targetId);

            try {
                // Drop onto center of folder → move into it
                if (mode === "into" && targetItem?.is_folder) {
                    const destFolder = targetItem.name || targetItem.folder_name;
                    if (!destFolder) return;
                    const destColor = targetItem.color || "#34C759";
                    if (sourceItem?.is_folder) {
                        // Folder into folder → nest
                        const srcFolder = sourceItem.name || sourceItem.folder_name;
                        if (destFolder === srcFolder) return;
                        const isVirtual = sourceId.startsWith("virtual-");
                        if (isVirtual) {
                            // No is_folder row exists — create one with parent set
                            await notesApi.insert({
                                is_folder: true,
                                folder_name: srcFolder,
                                parent_folder_name: destFolder,
                                title: srcFolder,
                                content: sourceItem.icon || "",
                                folder_color: sourceItem.color || palette12[0],
                                order: 0,
                            });
                            await sync();
                        } else {
                            await notesApi.update(sourceId, { parent_folder_name: destFolder });
                            setDbData((prev) => prev.map((r) => String(r.id) === sourceId ? { ...r, parent_folder_name: destFolder } : r));
                        }
                        showToast(`${srcFolder} → ${destFolder}`, destColor);
                        enterFolder({ id: String(targetItem.id), name: destFolder, color: destColor });
                    } else if (!sourceItem?.is_folder) {
                        // Note into folder → move (keep note's own color)
                        const destFolderId = String(targetItem.id).startsWith("virtual-") ? null : String(targetItem.id);
                        await notesApi.update(sourceId, { folder_name: destFolder, ...(destFolderId ? { folder_id: destFolderId } : {}) });
                        setDbData((prev) => prev.map((r) => String(r.id) === sourceId ? { ...r, folder_name: destFolder, folder_id: destFolderId } : r));
                        showToast(`→ ${destFolder}`, destColor);
                    }
                    return;
                }
                // Drop on edge → reorder (insert before/after) — optimistic instant update
                if (sourceItem?.is_folder && targetItem?.is_folder) {
                    const side = mode === "before" ? "before" : "after";
                    const next = insertById(currentLevelFolders, sourceId, targetId, side);
                    setPendingFolderOrder(next.map((f: any) => f.name));
                    showToast("Reordered");
                    persistFolderOrder(next)
                        .then(() => setPendingFolderOrder(null))
                        .catch(() => { setPendingFolderOrder(null); showToast("Save failed"); });
                    return;
                }
                // Note → note never reaches here: handleTileDragOver skips
                // preventDefault for a note dropped onto another note, so this drop
                // event does not fire. A note only moves when dropped INTO a folder.
                if (!sourceItem?.is_folder && !targetItem?.is_folder) {
                    const onlyNotes = displayItems.filter((n: any) => !n.is_folder);
                    const side = mode === "before" ? "before" : "after";
                    const next = insertById(onlyNotes, sourceId, targetId, side);
                    setPendingNoteOrder(next.map((n: any) => String(n.id)));
                    showToast("Reordered");
                    persistNoteOrder(next)
                        .then(() => setPendingNoteOrder(null))
                        .catch(() => { setPendingNoteOrder(null); showToast("Save failed"); });
                }
            } catch {
                showToast("Reorder Failed");
            } finally {
                window.setTimeout(() => { suppressOpenRef.current = false; }, 0);
            }
        },
        [dropTarget, displayItems, currentLevelFolders, dbData, persistFolderOrder, persistNoteOrder],
    );

    useEffect(() => {
        if (!isEmptyView) return;
        const timer = window.setInterval(() => {
            setQuoteIndex((prev) => (prev + 1) % EMPTY_QUOTES.length);
        }, 10000);
        return () => window.clearInterval(timer);
    }, [isEmptyView]);

    // Block pinch zoom on the entire stickies page
    useEffect(() => {
        const block = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
        document.addEventListener("touchmove", block, { passive: false });
        document.addEventListener("touchstart", block, { passive: false });
        return () => { document.removeEventListener("touchmove", block); document.removeEventListener("touchstart", block); };
    }, []);

    useEffect(() => {
        if (!editorOpen) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (!showColorPicker && !showSwitcher) return;
            const target = event.target as Node | null;
            if (!target) return;
            if (editorToolsRef.current?.contains(target)) return;
            closeEditorTools();
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                closeEditorTools();
                setShowNoteActions(false);
                setShowFolderActions(false);
                if (!editorOpen) goBack();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "z" && taskContentHistory.current.length > 0) {
                const prev = taskContentHistory.current.pop();
                if (prev !== undefined) { setContent(prev); showToast("Undone", "#32ADE6"); event.preventDefault(); }
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown, { passive: true });
        if (!IS_PHONE) document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
            if (!IS_PHONE) document.removeEventListener("keydown", onKeyDown);
        };
    }, [editorOpen, showColorPicker, showSwitcher, closeEditorTools, goBack]);


    useEffect(() => {
        if (!editorOpen) return;

        const handleVisibility = () => {
            if (document.visibilityState === "hidden") {
                void saveNote({ silent: true });
            }
        };

        const handlePageHide = () => {
            void saveNote({ silent: true });
        };

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("beforeunload", handlePageHide);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("beforeunload", handlePageHide);
        };
    }, [editorOpen, saveNote]);

    // Draft safety net — back unsaved new-note drafts up to localStorage on every
    // change. The browser can unload before our beforeunload save fetch completes
    // (no keepalive on our notesApi), and a refresh within the 2s autosave debounce
    // also drops the work. The backup is cleared once the note gets a real id.
    useEffect(() => {
        if (!editorOpen) return;
        if (editingNote?.id) return; // already persisted with an id
        const backup = serializeDraft({
            title, content, doc: richDoc, color: noteColor, folder: targetFolder,
            format: pendingFormat, type: pendingNoteType,
        });
        try {
            if (backupHasWork(backup)) {
                localStorage.setItem(DRAFT_BACKUP_KEY, JSON.stringify(backup));
            } else {
                localStorage.removeItem(DRAFT_BACKUP_KEY);
            }
        } catch {}
    }, [editorOpen, editingNote?.id, title, content, richDoc, noteColor, targetFolder, pendingFormat, pendingNoteType]);

    // Clear backup as soon as the draft transitions to a real saved note (id appears)
    useEffect(() => {
        if (editingNote?.id) {
            try { localStorage.removeItem(DRAFT_BACKUP_KEY); } catch {}
        }
    }, [editingNote?.id]);

    // Restore unsaved draft on mount if one exists. One-shot.
    const draftRestoredRef = useRef(false);
    useEffect(() => {
        if (draftRestoredRef.current) return;
        draftRestoredRef.current = true;
        const b = parseDraftBackup(typeof window !== "undefined" ? localStorage.getItem(DRAFT_BACKUP_KEY) : null);
        if (!b) {
            try { localStorage.removeItem(DRAFT_BACKUP_KEY); } catch {}
            return;
        }
        // Restore after the initial render so openNewNote's resets don't clobber us
        setTimeout(() => {
            openNewNote(b.type || undefined, b.folder || undefined);
            setTimeout(() => {
                setTitle(b.title || "");
                setContent(b.content || "");
                latestContentRef.current = b.content || "";
                if (b.doc) { setRichDoc(b.doc as any); latestRichDocRef.current = b.doc as any; }
                if (b.color) setNoteColor(b.color);
                if (b.format) setPendingFormat(b.format);
                showToast("Restored unsaved draft", "#22c55e");
            }, 120);
        }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!editorOpen || !shouldFocusTitleOnOpenRef.current) return;
        const frame = requestAnimationFrame(() => {
            const input = titleInputRef.current;
            if (!input) return;
            input.focus();
            const caretAt = input.value.length;
            input.setSelectionRange(caretAt, caretAt);
            shouldFocusTitleOnOpenRef.current = false;
        });
        return () => cancelAnimationFrame(frame);
    }, [editorOpen]);


    if (!mounted || isUrlChecking) return (
        <div className="h-screen bg-black flex flex-col items-center justify-center gap-8 overflow-hidden">
            <style>{`
                @keyframes stickyFloat0 { 0%,100%{transform:rotate(-18deg) translateY(0px) scale(1)}  50%{transform:rotate(-20deg) translateY(-14px) scale(1.04)} }
                @keyframes stickyFloat1 { 0%,100%{transform:rotate(-8deg)  translateY(0px) scale(1)}  50%{transform:rotate(-6deg)  translateY(-18px) scale(1.06)} }
                @keyframes stickyFloat2 { 0%,100%{transform:rotate(2deg)   translateY(0px) scale(1)}  50%{transform:rotate(4deg)   translateY(-12px) scale(1.05)} }
                @keyframes stickyFloat3 { 0%,100%{transform:rotate(12deg)  translateY(0px) scale(1)}  50%{transform:rotate(14deg)  translateY(-16px) scale(1.06)} }
                @keyframes stickyFloat4 { 0%,100%{transform:rotate(22deg)  translateY(0px) scale(1)}  50%{transform:rotate(20deg)  translateY(-10px) scale(1.04)} }
                @keyframes stickyPulse  { 0%,100%{opacity:.7} 50%{opacity:1} }
                @keyframes loadDots     { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
                .sticky-load { position:absolute; border-radius:3px 3px 3px 18px; box-shadow:0 8px 28px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.4); }
                .sticky-load::after { content:''; position:absolute; bottom:0; right:0; width:0; height:0; border-style:solid; border-width:0 0 14px 14px; border-color:transparent transparent rgba(0,0,0,.18) transparent; }
            `}</style>

            {/* Fanned sticky stack */}
            <div style={{ position: "relative", width: 110, height: 110 }}>
                {[
                    { color: "#FF3B30", anim: "stickyFloat0", delay: "0s",    z: 1 },
                    { color: "#FF9500", anim: "stickyFloat1", delay: "0.15s", z: 2 },
                    { color: "#FFCC00", anim: "stickyFloat2", delay: "0.3s",  z: 3 },
                    { color: "#34C759", anim: "stickyFloat3", delay: "0.15s", z: 2 },
                    { color: "#007AFF", anim: "stickyFloat4", delay: "0s",    z: 1 },
                ].map((s, i) => (
                    <div key={i} className="sticky-load" style={{
                        width: 72, height: 72,
                        background: s.color,
                        left: "50%", top: "50%",
                        marginLeft: -36, marginTop: -36,
                        zIndex: s.z,
                        animation: `${s.anim} ${1.8 + i * 0.1}s ease-in-out ${s.delay} infinite, stickyPulse ${2.4}s ease-in-out ${s.delay} infinite`,
                    }} />
                ))}
            </div>

            {/* Brand label + dots */}
            <div className="flex flex-col items-center gap-3">
                <span className="text-white/80 text-[11px] font-black tracking-[0.35em] uppercase">Stickies</span>
                <div className="flex gap-1.5">
                    {["#FF9500","#FFCC00","#34C759"].map((c, i) => (
                        <div key={i} style={{
                            width: 6, height: 6, borderRadius: "50%", background: c,
                            animation: `loadDots 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                    ))}
                </div>
            </div>
        </div>
    );
    const activeAccentColor = noteColor || editingNote?.folder_color || folders.find((f) => f.name === activeFolder)?.color || "#22d3ee";
    const activeFolderColor = (activeFolder
        ? (folderColors[activeFolder]
            || folderStack.at(-1)?.color
            || dbData.find((r) => r.is_folder && r.folder_name === activeFolder)?.folder_color)
        : null) || "#22d3ee";

    return (
        <div className="safe-shell box-border h-[100dvh] bg-black text-white font-sans select-none overflow-hidden overscroll-none flex flex-col">

            {/* Full-screen border flash overlay + centered note card */}
            {pusherFlash && (
                <>
                    <div style={{
                        position: "fixed", inset: 0, zIndex: 100001,
                        pointerEvents: "none",
                        border: `3px solid ${flashColor}`,
                        animation: "borderFlash 2s ease-in-out forwards",
                    }} />
                    {flashNote && (
                        <div style={{
                            position: "fixed", inset: 0, zIndex: 100000,
                            pointerEvents: "none",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <div style={{
                                width: 500, height: 500,
                                backgroundColor: flashColor,
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                animation: "noteCardFlash 2s ease-in-out forwards",
                                padding: "2rem",
                                textAlign: "center",
                                gap: "1rem",
                            }}>
                                <div style={{ fontSize: "10rem", fontWeight: 900, color: "#000", lineHeight: 1 }}>
                                    {[...(flashNote.title || "N")][0].toUpperCase()}
                                </div>
                                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#000", lineHeight: 1.2 }}>
                                    {flashNote.title}
                                </div>
                                {flashNote.folder_name && (
                                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(0,0,0,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                        {flashNote.folder_name}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            <style>{`
                @keyframes borderFlash {
                    0%   { opacity: 0; }
                    10%  { opacity: 1; }
                    20%  { opacity: 0; }
                    35%  { opacity: 1; }
                    50%  { opacity: 0; }
                    60%  { opacity: 1; }
                    70%  { opacity: 0; }
                    82%  { opacity: 1; }
                    90%  { opacity: 0; }
                    96%  { opacity: 1; }
                    100% { opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.2; }
                }
                @keyframes noteLaunchBreath {
                    0%   { transform: scale(0.9) rotate(-3deg); opacity: 0.85; }
                    50%  { transform: scale(1.05) rotate(2deg); opacity: 1; }
                    100% { transform: scale(0.9) rotate(-3deg); opacity: 0.85; }
                }
                .note-launch-tile { animation: noteLaunchBreath 1s ease-in-out infinite; }
                @keyframes noteCardFlash {
                    0%   { opacity: 0; transform: scale(0.85); }
                    12%  { opacity: 1; transform: scale(1); }
                    80%  { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(1.04); }
                }
                html, body { background-color: #000 !important; }
                @keyframes fabFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .fab-float {
                    animation: fabFloat 2.2s ease-in-out infinite;
                }
                [data-theme="dark"] .task-card-pattern {
                    background:
                        linear-gradient(to right, rgba(2,1,18,0.82) 0%, rgba(6,3,28,0.42) 35%, rgba(255,255,255,0.07) 65%, rgba(255,255,255,0.14) 100%),
                        repeating-linear-gradient(
                            -52deg,
                            transparent 0px,
                            transparent 7px,
                            rgba(255,255,255,0.055) 7px,
                            rgba(255,255,255,0.055) 8px
                        );
                }
                [data-theme="light"] .task-card-pattern {
                    background: none;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes noteActionsIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
                }
                @keyframes noteActionsSlideIn {
                    from { transform: translateX(100%); }
                    to   { transform: translateX(0);    }
                }
                .note-actions-panel { animation: noteActionsIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }
                @media (min-width: 1024px) {
                    .note-actions-panel { animation: noteActionsSlideIn 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
                }
                @keyframes bubbleFloat {
                    0%, 100% { transform: translate(0, 0); }
                    33% { transform: translate(2px, -3px); }
                    66% { transform: translate(-2px, 2px); }
                }
                .bubble-idle {
                    animation: bubbleFloat 4s ease-in-out infinite;
                }
                @keyframes taskRowEnter {
                    from { opacity: 0; transform: translateX(-20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .task-row-enter {
                    animation: taskRowEnter 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .bubble-text-clamp {
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    word-break: break-word;
                }
                .list-row-hover {
                    transition: background-color 0.15s ease;
                }
                .list-row-hover:hover {
                    background-color: color-mix(in srgb, var(--row-color) 12%, transparent) !important;
                }
                @keyframes fabIn {
                    0%   { opacity: 0; transform: scale(0.4) rotate(-120deg); }
                    60%  { opacity: 1; transform: scale(1.18) rotate(8deg); }
                    80%  { transform: scale(0.94) rotate(-3deg); }
                    100% { opacity: 1; transform: scale(1) rotate(0deg); }
                }
                @keyframes fabBreath {
                    0%   { transform: scale(1)    rotate(0deg); }
                    30%  { transform: scale(1.07) rotate(2deg); }
                    60%  { transform: scale(0.96) rotate(-1.5deg); }
                    80%  { transform: scale(1.03) rotate(1deg); }
                    100% { transform: scale(1)    rotate(0deg); }
                }
                .fab-alive {
                    animation: fabIn 0.55s cubic-bezier(0.16,1,0.3,1) both,
                               fabBreath 3.8s cubic-bezier(0.4,0,0.6,1) 0.6s infinite;
                }
                .fab-alive:hover {
                    animation: none !important;
                    transform: scale(1.12) rotate(-4deg) !important;
                    transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1) !important;
                }
                .fab-alive:active {
                    animation: none !important;
                    transform: scale(0.88) rotate(6deg) !important;
                }
                @keyframes fabMenuIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
                }
                @keyframes islandToastInOut {
                    0% {
                        opacity: 0;
                        transform: translateY(-8px) scale(0.72);
                    }
                    14% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                    82% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-6px) scale(0.78);
                    }
                }
                @keyframes confettiShoot {
                    0%   { transform: translate(0, 0) scale(0); opacity: 1; }
                    60%  { transform: translate(var(--cx), var(--cy)) scale(1); opacity: 1; }
                    100% { transform: translate(var(--cx), var(--cy)) scale(0); opacity: 0; }
                }
                @keyframes toastSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes emptyQuotePulse {
                    0% {
                        opacity: 0;
                        transform: translateY(8px) scale(0.98);
                    }
                    14% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                    84% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-6px) scale(0.985);
                    }
                }
                .empty-quote-anim {
                    animation: emptyQuotePulse 10s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes snakeAround {
                    from { stroke-dashoffset: 0; }
                    to   { stroke-dashoffset: -100; }
                }
                .list-snake-path {
                    stroke-dasharray: 24 76;
                    stroke-dashoffset: 0;
                    animation: snakeAround 1.5s linear 1 forwards;
                }
                @keyframes rainbowLoop {
                    0%   { background-position: 0% 50%; }
                    100% { background-position: 300% 50%; }
                }
                .hashtag-celebrate {
                    background: linear-gradient(90deg, #ff0080, #ff8c00, #ffe600, #00ff85, #00cfff, #b44aff, #ff0080, #ff8c00, #ffe600);
                    background-size: 300% 100%;
                    animation: rainbowLoop 1.2s linear infinite, hashtagPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    display: inline-block;
                    font-weight: 900;
                }
                @keyframes hashtagPopIn {
                    0%   { opacity: 0; transform: scale(0.5) translateY(8px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes hashtagFadeOut {
                    0%   { opacity: 1; transform: scale(1); }
                    80%  { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.85) translateY(-6px); }
                }
                @keyframes rainbowPulse {
                    0%   { background-position: 0% 50%; opacity: 0.85; transform: scale(1); }
                    50%  { background-position: 100% 50%; opacity: 1; transform: scale(1.18); }
                    100% { background-position: 0% 50%; opacity: 0; transform: scale(1.3); }
                }
                @keyframes rainbowSweep {
                    0%   { background-position: 0% 50%; opacity: 0; transform: scale(0.85); }
                    15%  { opacity: 1; transform: scale(1.05); }
                    60%  { background-position: 100% 50%; opacity: 1; transform: scale(1); }
                    100% { background-position: 200% 50%; opacity: 0; transform: scale(0.92); }
                }
                .hash-symbol-flash {
                    background: linear-gradient(90deg, #ff0080, #ff8c00, #ffe600, #00ff85, #00cfff, #b44aff, #ff0080);
                    background-size: 300% 100%;
                    animation: rainbowPulse 1.1s ease forwards;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    display: inline-block;
                }
                .hashtag-sweep {
                    background: linear-gradient(90deg, #ff0080, #ff8c00, #ffe600, #00ff85, #00cfff, #b44aff, #ff0080);
                    background-size: 300% 100%;
                    animation: rainbowSweep 1.7s ease forwards;
                    -webkit-background-clip: text;
                    background-clip: text;
                    -webkit-text-fill-color: transparent;
                    display: inline-block;
                    font-weight: bold;
                }
                @keyframes folderFabPulse {
                    0% {
                        transform: scale(0.9);
                        opacity: 0.68;
                    }
                    100% {
                        transform: scale(2.25);
                        opacity: 0;
                    }
                }
                .folder-fab-pulse-ring {
                    position: absolute;
                    inset: 0;
                    border-radius: 9999px;
                    border: 2px solid var(--pulse-color, #22d3ee);
                    animation: folderFabPulse 2.05s ease-out infinite;
                }
                .safe-shell {
                    /* Bottom safe-area is NOT reserved as empty space here — the footer
                       bars (list + editor) each extend their own background into it, so the
                       bar reads as one solid strip down to the screen edge with no white
                       band below it. Text stays in the top 28px, above the home indicator. */
                }
                .safe-top-pad {
                    padding-top: env(safe-area-inset-top, 0px);
                }
                .safe-top-bar {
                    height: env(safe-area-inset-top, 0px);
                }
                /* Editor's own status-bar spacer — separate class so the global
                   [data-theme=light] .safe-top-bar override doesn't force grey,
                   letting it take the note-color gradient instead. */
                .editor-top-safe {
                    height: env(safe-area-inset-top, 0px);
                }
                /* Note-color frame around the editor body. Hidden on phones (looked
                   odd cramped against the screen edge), shown on tablet/desktop. */
                .editor-frame { border: none; transition: border-color 0.3s ease; }
                @media (min-width: 640px) {
                    .editor-frame { border: 2px solid var(--frame-color, #888); }
                }
                @supports (-webkit-touch-callout: none) {
                    @media (max-width: 640px) {
                        .ios-mobile-header {
                            border-bottom-color: transparent !important;
                        }
                        .ios-mobile-main {
                            padding-top: 0 !important;
                            overscroll-behavior: none !important;
                        }
                        .ios-editor-scroll {
                            overscroll-behavior: none !important;
                        }
                        input,
                        textarea,
                        button {
                            -webkit-tap-highlight-color: transparent;
                            outline: none !important;
                            box-shadow: none !important;
                        }
                        input,
                        textarea,
                        select {
                            font-size: 16px !important;
                        }
                        .code-viewer-wrap textarea {
                            font-size: 13px !important;
                        }
                    }
                }
                input, textarea, button, select, [contenteditable] {
                    outline: none !important;
                    box-shadow: none !important;
                    -webkit-tap-highlight-color: transparent;
                }
                input:focus, textarea:focus, button:focus, select:focus, [contenteditable]:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }
                .note-textarea { font-size: 13px !important; }
            `}</style>



            {toast && (() => {
                const isError = toastIsError;
                const cx = typeof window !== "undefined" ? window.innerWidth / 2 : 200;
                const cy = 32;
                return (
                    <React.Fragment key={toastKey}>
                        {/* Confetti (non-error toasts only) — mini on every toast, bigger when explicitly requested */}
                        {!isError && Array.from({ length: toastConfetti ? 18 : 10 }).map((_, i) => {
                            const count = toastConfetti ? 18 : 10;
                            const angle = (i / count) * 360;
                            const dist = toastConfetti ? 44 + (i % 5) * 14 : 24 + (i % 4) * 7;
                            const size = toastConfetti ? 4 + (i % 4) : 2 + (i % 3);
                            const tx = Math.round(cx + Math.cos(angle * Math.PI / 180) * dist);
                            const ty = Math.round(cy + Math.sin(angle * Math.PI / 180) * dist);
                            const cols = toastRainbow
                                ? ["#ff0080","#ff8c00","#ffe600","#00ff85","#00cfff","#b44aff","#fff","#f472b6"]
                                : [toastColor, "#ffffff", "#FFD700", "#a78bfa", "#34d399", "#f472b6"];
                            return (
                                <div key={i} className="fixed z-[2147483646] pointer-events-none rounded-sm"
                                    style={{
                                        width: size, height: size,
                                        left: cx, top: cy,
                                        background: cols[i % cols.length],
                                        animation: `confettiShoot 1.2s cubic-bezier(0.2,1,0.3,1) ${i * 45}ms both`,
                                        ["--cx" as any]: `${tx - cx}px`,
                                        ["--cy" as any]: `${ty - cy}px`,
                                    }} />
                            );
                        })}
                        {/* Fire particles (error toasts only) */}
                        {isError && Array.from({ length: 8 }).map((_, i) => {
                            const angle = (i / 8) * 360;
                            const dist = 20 + (i % 4) * 8;
                            const tx = Math.round(cx + Math.cos(angle * Math.PI / 180) * dist);
                            const ty = Math.round(cy + Math.sin(angle * Math.PI / 180) * dist);
                            return (
                                <div key={i} className="fixed z-[2147483646] pointer-events-none text-sm"
                                    style={{
                                        left: cx, top: cy,
                                        animation: `confettiShoot 1.4s cubic-bezier(0.2,1,0.3,1) ${i * 60}ms both`,
                                        ["--cx" as any]: `${tx - cx}px`,
                                        ["--cy" as any]: `${ty - cy}px`,
                                    }}>🔥</div>
                            );
                        })}
                        {/* Toast pill — rendered via portal to escape any parent stacking context */}
                        {typeof document !== "undefined" && createPortal(
                            <div className="fixed z-[2147483647] pointer-events-auto" role="status" aria-live="polite" aria-atomic="true"
                                style={{
                                    left: 0, right: 0,
                                    top: "calc(env(safe-area-inset-top, 0px) + 14px)",
                                    display: "flex",
                                    justifyContent: "center",
                                    animation: "islandToastInOut 3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                                }}
                                onClick={(e) => e.stopPropagation()}>
                                {(() => {
                                    const hex = toastColor.replace("#", "");
                                    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
                                    const luma = (0.299*r + 0.587*g + 0.114*b) / 255;
                                    const textCol = (!toastRainbow && luma > 0.65) ? "#000" : "#fff";
                                    return (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer active:scale-95 transition-transform" style={{
                                            background: toastRainbow
                                                ? "linear-gradient(90deg,#ff0080,#ff8c00,#ffe600,#00ff85,#00cfff,#b44aff,#ff0080)"
                                                : toastColor,
                                            backgroundSize: toastRainbow ? "200% 100%" : undefined,
                                            animation: toastRainbow
                                                ? "islandToastInOut 3s cubic-bezier(0.16,1,0.3,1) forwards, rainbowLoop 1.5s linear infinite"
                                                : undefined,
                                            border: toastRainbow ? "1px solid rgba(255,255,255,0.3)" : `1px solid ${toastColor}99`,
                                            boxShadow: toastRainbow ? "0 8px 26px rgba(180,74,255,0.5)" : `0 8px 26px ${toastColor}66`,
                                            color: textCol,
                                        }}>
                                            <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={textCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>
                                                </svg>
                                            </span>
                                            <span className="font-bold tracking-tight text-[11px] sm:text-[12px] leading-snug max-w-[220px] break-words text-center">{toast}</span>
                                        </div>
                                    );
                                })()}
                            </div>,
                            document.body
                        )}
                    </React.Fragment>
                );
            })()}
            {undoDeleteTask && (
                <div className="fixed left-1/2 -translate-x-1/2 z-[2147483647] flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-white/20 shadow-xl"
                    style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}>
                    <span className="text-[11px] font-bold text-zinc-300">Deleted</span>
                    <button type="button"
                        onClick={() => {
                            if (!undoDeleteTask) return;
                            const lines = content.split("\n");
                            lines.splice(undoDeleteTask.lineIdx, 0, undoDeleteTask.text);
                            setContent(lines.join("\n"));
                            setUndoDeleteTask(null);
                            showToast("Restored");
                        }}
                        className="text-[11px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-wide transition">
                        Undo
                    </button>
                    <button type="button" onClick={() => setUndoDeleteTask(null)} className="text-zinc-500 hover:text-white text-xs leading-none">✕</button>
                </div>
            )}


            {/* ── two-panel layout ── */}
            <div ref={viewPanelRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">

                {/* RIGHT PANEL: editor — only shown in edit mode or when a note is open (mobile nav) */}
                <div className={`flex-1 flex flex-col overflow-hidden ${editorOpen || mainListMode === "tabs" ? "flex" : "hidden"} `} style={{ background: appTheme === "light" ? "#ffffff" : "#222222" }}>
                {editorOpen ? (
                <section className="flex-1 min-h-0 flex flex-col overflow-hidden overscroll-none" onClick={(e) => e.stopPropagation()}>
                    {pendingShare && (
                        <div
                            onClick={() => {
                                void secureCopy(pendingShare.content).then(() => {
                                    setPendingShare(null);
                                    showToast("Synced");
                                });
                            }}
                            className="absolute inset-0 z-[160] bg-black/75 backdrop-blur-sm flex items-center justify-center cursor-pointer p-6">
                            <div className="border border-white/30 bg-black px-6 py-5 flex items-center gap-3">
                                <DocumentDuplicateIcon className="w-8 h-8 text-cyan-300" />
                                <div>
                                    <div className="text-xs font-black uppercase tracking-wide text-white">Tap To Copy Shared Note</div>
                                    <div className="text-[10px] text-white/60 uppercase tracking-wide">Quick Clipboard Sync</div>
                                </div>
                            </div>
                        </div>
                    )}
                    {(() => {
                        // Solid full note-color header — status bar spacer + header bar are one
                        // uniform block of the note's color (the original, cohesive look). The
                        // .editor-top-safe class lets the status bar take the color in light mode
                        // too (the global .safe-top-bar override would otherwise force it grey).
                        const headerBg = noteColor || (appTheme === "light" ? "#f5f5f5" : "#1e1e1e");
                        const headerText = noteColor
                            ? (isLightColor(noteColor) ? "#1c1c1e" : "#fff")
                            : (appTheme === "light" ? "#1a1a1a" : "#fff");
                        return (
                    <>
                    <div className="editor-top-safe shrink-0" style={{ background: headerBg }} />
                    <div className="relative shrink-0 flex items-center h-[4rem] px-4" style={{ background: headerBg }}>
                        {/* Back button — hidden on desktop or in edit mode (left panel always visible) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); if (mainListMode === "tabs") { setMainListMode("list"); } void backToRootFromEditor(); }}
                            className="flex p-2 hover:bg-white/10 transition flex-shrink-0"
                            style={{ color: headerText }}
                            title={`Back to ${targetFolder || "folders"}`}
                            aria-label={`Back to ${targetFolder || "folders"}`}>
                            <ArrowLeftIcon className="w-[38px] h-[38px]" />
                        </button>
                        {/* Title only — Apple Notes style */}
                        <input ref={titleInputRef} defaultValue={title} key={`title-${editingNote?.id || "new"}`} readOnly={!!editingNote?.locked} onChange={(e) => { titleRaw.current = e.target.value; }} onBlur={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="hidden sm:block bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-1 min-w-0 flex-1 tracking-tight font-bold placeholder:text-zinc-500" style={{ caretColor: headerText, color: headerText, fontSize: "clamp(18px, 2vw, 24px)" }} placeholder="Note Title" />
                        {/* Mobile title moved inside editor panel */}
                        <div className="sm:hidden flex-grow" />

                        {/* Type badge removed — already shown in footer */}
                        {/* AI Magic — only on a brand-new draft, never while an existing
                            note's content is still loading (avoids a 1s icon flash). */}
                        {!content.trim() && !editingNote?.id && (
                        <>
                        {/* AI Magic */}
                        <button type="button"
                            onClick={() => { setAiPromptOpen(v => !v); setTimeout(() => aiPromptRef.current?.focus(), 100); }}
                            className={`p-2 sm:p-3 transition flex-shrink-0 ${aiPromptOpen || aiLoading ? "text-purple-400 animate-pulse" : "text-zinc-500 hover:text-purple-400"}`}
                            style={aiPromptOpen || aiLoading ? { filter: "drop-shadow(0 0 6px #a855f7)" } : undefined}
                            title="AI Magic">
                            <RobotIcon className="w-[24px] h-[24px] sm:w-[22px] sm:h-[22px]" />
                        </button>
                        </>
                        )}
                        {/* Checklist toggle — only when eligible or already on */}
                        {(canToggleChecklist || listMode) && (
                        <button type="button"
                            onClick={() => {
                                toggleListMode();
                            }}
                            className="p-2 sm:p-3 transition flex-shrink-0"
                            style={{ color: listMode ? noteColor : "#71717a" }}
                            title={listMode ? "Exit checklist" : "Checklist"}>
                            <CheckCircleIcon className="w-[26px] h-[26px] sm:w-6 sm:h-6" />
                        </button>
                        )}
                        {/* Share removed — available in note actions menu */}
                        {/* Editor header icons — in-flow at right (ml-auto) so they never overlap inline siblings.
                            NO grid view-mode switcher here: it cycles the list/tabs layout of the note
                            GRID, which is hidden at every breakpoint while the editor is open (the grid panel
                            carries `editorOpen ? "hidden"` with no sm: override). Inside an open note the
                            control had no visible referent and silently changed the layout you return to.
                            It lives at root/folder level only; the back button already exits tabs mode. */}
                        <div className="ml-auto flex items-center flex-shrink-0">
                            {/* Tab stepper — prev/next note with a position readout. Tablet and up
                                (iPad landscape/portrait, desktop): the tab strip only exists at >= 640px,
                                and touch devices have no arrow keys, so this is the only way to walk the
                                tabs there. Phones keep the header uncluttered (IS_PHONE also disables the
                                keyboard nav). Hidden entirely when there is nothing to step through. */}
                            {tabNav.notes.length > 1 && tabNav.index > -1 && (
                                <div className="hidden sm:flex items-center mr-1 rounded-lg overflow-hidden"
                                    style={{ background: isLightColor(headerBg) ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.13)" }}>
                                    <button type="button" onClick={() => stepTab(-1)} disabled={!canStepPrev}
                                        className="flex items-center justify-center px-2 h-8 transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70"
                                        style={{ color: headerText }} title="Previous note (←)" aria-label="Previous note">
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <span className="px-1 text-[11px] font-black tabular-nums select-none tracking-tight"
                                        style={{ color: headerText, opacity: 0.85 }}
                                        title={`Note ${tabNav.index + 1} of ${tabNav.notes.length}`}>
                                        {tabNav.index + 1}<span style={{ opacity: 0.5 }}>/{tabNav.notes.length}</span>
                                    </span>
                                    <button type="button" onClick={() => stepTab(1)} disabled={!canStepNext}
                                        className="flex items-center justify-center px-2 h-8 transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70"
                                        style={{ color: headerText }} title="Next note (→)" aria-label="Next note">
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            {/* In TABS mode the note grid is not the referent - the tab strip IS.
                                So the view-mode switcher belongs here (only in tabs mode): it is the
                                only way to leave tabs and return to the list. In single-note
                                editing it stays hidden per #10 (the grid it cycles is not visible). */}
                            {mainListMode === "tabs" && (
                                <HeaderIconBtn icon={viewModeIcon} label={viewModeLabel} color={headerText} onClick={cycleViewMode} />
                            )}
                            <HeaderIconBtn icon={MagnifyingGlassIcon} label="Search" color={headerText} onClick={() => { setShowCmdK(true); setCmdKQuery(""); setCmdKCursor(0); }} />
                            <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" color={headerText} onClick={() => { setShowNoteActions(v => !v); closeEditorTools(); }} />
                        </div>
                    </div>
                    </>
                    );
                    })()}
                    {/* AI PROMPT BAR — fills entire editor when active */}
                    {aiPromptOpen && (
                        <div className="flex-1 flex flex-col gap-2 px-3 py-2 overflow-hidden" style={{ background: noteColor || "#1a0d2e" }}>
                            <div className="flex items-start gap-2 flex-1">
                                <textarea
                                    ref={aiPromptRef as any}
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void runAiPrompt(); } if (e.key === "Escape") { setAiPromptOpen(false); setAiPrompt(""); } }}
                                    placeholder="Ask AI anything..."
                                    disabled={aiLoading}
                                    className="flex-1 bg-transparent outline-none font-mono resize-none overflow-y-auto ai-prompt-input"
                                    style={{ caretColor: "#000", color: "#1a1a1a", height: "100%", fontSize: "clamp(12px, 1.4vw, 17px)", lineHeight: 1.6 }}
                                />
                                {aiLoading && (
                                    <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-1.5" />
                                )}
                            </div>
                        </div>
                    )}
                    {/* ── Tab bar — folder notes or today's notes (no folder) ── */}
                    {(showTabs || mainListMode === "tabs") && typeof window !== "undefined" && (mainListMode === "tabs" || window.innerWidth >= 640) && (() => {
                        // Single source of truth: the ordered tab list, the active id and the
                        // in-folder/label bits all come from the `tabNav` memo above, which the
                        // header stepper reads too. Keeping the computation in one place means
                        // the strip and the stepper can never disagree about what "next" is.
                        // (Non-folder = flat, newest first, load-more pages in older notes;
                        // in a real folder = that folder's notes by edit time. An unsaved draft
                        // is injected as a synthetic tab so in-progress work is visible at once.)
                        const { notes: dayNotes, activeId, inFolder, dayLabel } = tabNav;
                        const tabNotes = dayNotes;
                        tabNavRef.current = { notes: dayNotes, activeId };
                        const dismissTab = (id: string) => {
                            setDismissedTabs(prev => {
                                const next = new Set(prev); next.add(id);
                                try { localStorage.setItem("stickies:dismissed-tabs:v1", JSON.stringify([...next])); } catch {}
                                return next;
                            });
                        };
                        const H = 30;
                        const btnCls = "flex-shrink-0 flex items-center justify-center text-zinc-500 hover:text-white transition";
                        return (
                            <div className="shrink-0 flex items-end" style={{ height: H + 8, background: appTheme === "light" ? "#e8e8ed" : "#2a2a2a" }}>
                                {/* + */}
                                <button type="button" onClick={() => openNewNote(undefined, inFolder && activeFolder ? activeFolder : "Today")} className={`${btnCls} px-2`} style={{ height: H }} title="New note">
                                    <PlusIcon className="w-3.5 h-3.5" />
                                </button>
                                {/* Tabs */}
                                <div className="flex items-end gap-0.5 sm:gap-0.5 flex-1 min-w-0 overflow-x-auto overflow-y-hidden" style={{ height: H + 8, scrollbarWidth: "none" }} ref={(el) => {
                                    tabScrollRef.current = el;
                                    if (el) { const a = el.querySelector("[data-tab-active]"); if (a) a.scrollIntoView({ inline: "nearest", block: "nearest" }); }
                                }}>
                                    {dayNotes.map(n => {
                                        const isActive = String(n.id) === activeId;
                                        const c = n.folder_color || (n.folder_name ? (folders.find(f => f.name === n.folder_name)?.color) : null) || "#888";
                                        return (
                                            <div key={n.id} {...(isActive ? { "data-tab-active": "" } : {})}
                                                className={`flex items-center transition-all ${isActive ? "relative z-10 flex-shrink-0" : "hover:brightness-110 opacity-75 flex-shrink-0 sm:flex-shrink"}`}
                                                style={{ background: isActive ? c : `${c}99`, color: folderTileForeground(appTheme), height: isActive ? H + 6 : H, borderRadius: isActive ? "8px 8px 0 0" : 0, minWidth: IS_PHONE ? 44 : undefined }}>
                                                <button type="button"
                                                    onClick={() => { if (!isActive) { if (mainListMode !== "tabs" && inFolder && n.folder_name && n.folder_name !== activeFolder) { const fr = dbData.find(r => r.is_folder && r.folder_name === n.folder_name); if (fr) enterFolder({ id: String(fr.id), name: n.folder_name, color: fr.folder_color || c }); } void openNote(n); } }}
                                                    className={`flex items-center gap-1 text-[10px] sm:text-[10px] font-bold truncate ${isActive ? "pl-2.5 pr-1 max-w-[180px]" : "px-2 max-w-[130px]"}`} style={{ height: "100%" }}
                                                    title={n.title || "Untitled"}>
                                                    {(() => {
                                                        const ni = noteIcons[String(n.id)];
                                                        const inner = ni
                                                            ? <FolderIconDisplay value={ni} folderName={n.title || "N"} className="w-3.5 h-3.5 flex-shrink-0" />
                                                            : <span className="font-black flex-shrink-0">{meaningfulInitial(n.title || "", "N")}</span>;
                                                        // Locked notes get a tiny lock badge on the icon's bottom-right.
                                                        const glyph = n.locked
                                                            ? <span className="relative flex-shrink-0 inline-flex">{inner}<LockClosedIcon className="absolute -bottom-0.5 -right-0.5 w-2 h-2 text-white" style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.9))", strokeWidth: 2.5 }} /></span>
                                                            : inner;
                                                        // Inactive tabs show the icon only so many more fit; the
                                                        // active tab keeps its title to stay identifiable.
                                                        if (!isActive) return glyph;
                                                        const t = n.title || "Untitled";
                                                        return <>{glyph}<span className="truncate">{t.slice(0, 24)}{t.length > 24 ? "…" : ""}</span></>;
                                                    })()}
                                                </button>
                                                {isActive && (
                                                    <button type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const nid = String(n.id);
                                                            // Drafts have a fake id — don't add to dismissedTabs (would
                                                            // permanently hide every future draft). Just back out.
                                                            if (nid === "__draft__") { void backToRootFromEditor(); return; }
                                                            dismissTab(nid);
                                                            // Activate the ADJACENT tab (the one that slides into the
                                                            // closed slot) instead of jumping to the first. Closing the
                                                            // last tab falls back to the new last.
                                                            const idx = dayNotes.findIndex(t => String(t.id) === nid);
                                                            const remaining = dayNotes.filter(t => String(t.id) !== nid);
                                                            if (remaining.length > 0) void openNote(remaining[Math.min(idx, remaining.length - 1)]);
                                                            else void backToRootFromEditor();
                                                        }}
                                                        className="pr-2 flex items-center justify-center hover:opacity-60 transition flex-shrink-0" style={{ height: "100%", color: isLightColor(c) ? "#1c1c1e" : "#fff" }}>
                                                        <span className="text-[9px] leading-none">✕</span>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Scroll + load-more nav (no dates): arrows page through all tabs;
                                    the right one loads older notes from the server when it hits the end. */}
                                <div className="flex-shrink-0 flex items-center sticky right-0 z-10" style={{ height: H, backdropFilter: "blur(8px)" }}>
                                    <button type="button" onClick={() => tabScrollRef.current?.scrollBy({ left: -Math.max(240, (tabScrollRef.current?.clientWidth ?? 240) * 0.8), behavior: "smooth" })} className={`${btnCls} px-1`} style={{ height: H }} title="Scroll back">
                                        <ChevronLeftIcon className="w-3 h-3" />
                                    </button>
                                    <span className="px-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wide select-none">{dayLabel} ({inFolder ? tabNotes.length : Math.max(allTotal, tabNotes.length)})</span>
                                    <button type="button"
                                        onClick={() => {
                                            const el = tabScrollRef.current;
                                            const atEnd = !el || el.scrollLeft + el.clientWidth >= el.scrollWidth - 48;
                                            // At the end of the loaded tabs, pull the next page of older
                                            // notes from the server; otherwise just scroll forward.
                                            if (atEnd && !inFolder && allTotal > allNotes.length) { void loadMoreAll(); }
                                            else el?.scrollBy({ left: Math.max(240, (el?.clientWidth ?? 240) * 0.8), behavior: "smooth" });
                                        }}
                                        className={`${btnCls} px-1`} style={{ height: H }} title="Scroll forward / load more">
                                        <ChevronRightIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    <div className={`editor-frame relative flex-1 flex flex-col overflow-hidden ${appTheme === "light" ? "bg-white" : "bg-black"} ${fireflyNoteId && editingNote?.id && String(editingNote.id) === fireflyNoteId ? "note-firefly" : ""}`} style={{ display: aiPromptOpen ? "none" : "flex", ["--frame-color" as any]: noteColor || "#888" }}>
                        {/* Firefly motes — only mounted during the Cmd+Delete vanish. Scattered
                            across the lower half so they read as rising off the note itself. */}
                        {fireflyNoteId && editingNote?.id && String(editingNote.id) === fireflyNoteId && (
                            <div aria-hidden className="absolute inset-0 overflow-hidden z-50 pointer-events-none">
                                {Array.from({ length: 14 }).map((_, i) => (
                                    <span key={i} className="firefly-mote" style={{
                                        left: `${8 + Math.random() * 84}%`,
                                        top: `${45 + Math.random() * 45}%`,
                                        ["--mote" as any]: noteColor || "#ffd166",
                                        ["--mx" as any]: `${(Math.random() - 0.5) * 90}px`,
                                        ["--my" as any]: `${-70 - Math.random() * 90}px`,
                                        ["--dur" as any]: `${520 + Math.random() * 260}ms`,
                                        ["--delay" as any]: `${Math.random() * 130}ms`,
                                    } as React.CSSProperties} />
                                ))}
                            </div>
                        )}
                    {/* iPad edge floats — big grey prev/next buttons pinned to the left/right
                        edges, vertically centered, so notes can be paged by thumb. Tablet only
                        (touch, no arrow keys); hidden on phones (too cramped) and desktop (mouse +
                        keyboard + header pager). Faded + non-interactive at the ends of the list. */}
                    {mounted && IS_TABLET && !aiPromptOpen && tabNav.notes.length > 1 && tabNav.index > -1 && (() => {
                        const floatBase = "absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 select-none";
                        const floatStyle = {
                            width: 56, height: 56,
                            background: appTheme === "light" ? "rgba(120,120,128,0.16)" : "rgba(120,120,128,0.32)",
                            backdropFilter: "blur(12px)",
                            WebkitBackdropFilter: "blur(12px)",
                            color: appTheme === "light" ? "#3a3a3c" : "#f2f2f7",
                            boxShadow: "0 6px 20px -6px rgba(0,0,0,0.35)",
                            border: appTheme === "light" ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.10)",
                        } as const;
                        return (
                            <>
                                <button type="button" aria-label="Previous note" title="Previous note"
                                    onClick={() => stepTab(-1)} disabled={!canStepPrev}
                                    className={`${floatBase} left-3 ${canStepPrev ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"}`}
                                    style={floatStyle}>
                                    <ChevronLeftIcon className="w-7 h-7" />
                                </button>
                                <button type="button" aria-label="Next note" title="Next note"
                                    onClick={() => stepTab(1)} disabled={!canStepNext}
                                    className={`${floatBase} right-3 ${canStepNext ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"}`}
                                    style={floatStyle}>
                                    <ChevronRightIcon className="w-7 h-7" />
                                </button>
                            </>
                        );
                    })()}
                    {/* Mobile title — inside editor panel top row */}
                    <input ref={titleInputMobileRef} defaultValue={title} key={`title-m-${editingNote?.id || "new"}`} readOnly={!!editingNote?.locked} onChange={(e) => { titleRaw.current = e.target.value; }} onBlur={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className={`sm:hidden bg-transparent border-0 border-b border-white/[0.06] appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-3 py-2 w-full min-w-0 placeholder:text-zinc-500 shrink-0 ${appTheme === "light" ? "text-black" : "text-white"}`} style={{ caretColor: appTheme === "light" ? "#000" : "#fff", border: "none", borderBottom: `1px solid ${noteColor || "#888"}33`, fontSize: "clamp(16px, 4vw, 20px)", fontWeight: 700 }} placeholder="Note Title" />
                    <div className={`relative flex-1 flex overflow-hidden font-mono`}
                        onDragOver={(e) => { if (isRichMode) return; if (Array.from(e.dataTransfer.items).some(i => i.kind === "file")) e.preventDefault(); }}
                        onDrop={(e) => {
                            // In rich mode, let TipTap's own handleDrop process the file (uploads + inline image node).
                            // The plain-text branch below would insert markdown `![](url)` which makes no sense inside ProseMirror.
                            if (isRichMode) return;
                            const files = Array.from(e.dataTransfer.files);
                            if (!files.length) return;
                            e.preventDefault();
                            // Accept by MIME OR by extension (heic/webp/etc. where the OS may omit type)
                            const isImageFile = (f: File) =>
                                f.type.startsWith("image/") ||
                                /\.(heic|heif|webp|avif|png|jpg|jpeg|gif|svg|bmp|tiff?|ico|jfif)$/i.test(f.name);
                            const images = files.filter(isImageFile);
                            const textFiles = files.filter(f => !isImageFile(f) && f.type !== "application/pdf");
                            if (images.length > 0) {
                                void (async () => {
                                    showToast(`Uploading ${images.length} image${images.length !== 1 ? "s" : ""}...`, "#a78bfa");
                                    const ta = editorTextRef.current;
                                    const pos = ta?.selectionStart ?? content.length;
                                    const urls: string[] = [];
                                    for (const file of images) { try { const u = await uploadImage(file); urls.push(`![${file.name}](${u.url})`); } catch (err) { console.error("[drop] image upload failed:", err); showError(`Upload failed: ${file.name}`); } }
                                    if (urls.length > 0) { handleEditorChange(content.slice(0, pos) + urls.join("\n") + "\n" + content.slice(pos)); showToast(`${urls.length} image${urls.length !== 1 ? "s" : ""} added`, "#34C759"); }
                                })();
                            } else if (textFiles.length === 1) {
                                void textFiles[0].text().then(text => {
                                    const ext = textFiles[0].name.includes(".") ? "." + textFiles[0].name.split(".").pop()!.toLowerCase() : "";
                                    const typeMap: Record<string, string> = { ".html": "html", ".htm": "html", ".md": "text", ".txt": "text", ".js": "javascript", ".ts": "typescript", ".py": "python", ".css": "css", ".sql": "sql", ".sh": "bash", ".json": "json" };
                                    setEditingNote(null); setTitle(textFiles[0].name.replace(/\.[^.]+$/, "")); setContent(text); latestContentRef.current = text;
                                    setPendingNoteType(typeMap[ext] || "text"); setTargetFolder(activeFolder || "CLAUDE");
                                    setNoteColor(palette12[Math.floor(Math.random() * palette12.length)]); noteEverDirtyRef.current = true; playSound("create");
                                });
                            }
                        }}>
                        {/* ── Note loading spinner — scoped to editor panel only ── */}
                        {/* Show the launch tile while loading OR whenever an already-saved
                            HTML/code note has no body yet — never let the preview paint a raw
                            blank-white pane (a dropped/raced/failed fetch used to do exactly that). */}
                        {(noteContentLoading || (editorOpen && !!editingNote?.id && (htmlMode || codeMode) && !content.trim())) && (() => {
                            const lc = noteColor || "#71717a";
                            return (
                            <div className="absolute inset-0 z-[50] flex items-center justify-center pointer-events-none"
                                style={{
                                    // No black flash in light mode — a soft frosted tint of the
                                    // note color in both themes (lighter on light, darker on dark).
                                    background: appTheme === "light" ? `${lc}14` : "rgba(0,0,0,0.5)",
                                    backdropFilter: "blur(10px)",
                                    WebkitBackdropFilter: "blur(10px)",
                                }}>
                                <div className="w-24 h-24 flex items-center justify-center font-black text-4xl note-launch-tile"
                                    style={{ backgroundColor: lc, color: isLightColor(lc) ? "#1c1c1e" : "#fff", borderRadius: "24%", boxShadow: `0 0 48px ${lc}bb` }}>
                                    {meaningfulInitial(title || editingNote?.title || "", "N")}
                                </div>
                            </div>
                            );
                        })()}
                        {/* ── Float copy pill — fades after 10s of editing ── */}
                        {/* ── Inline find bar (Cmd+F) ── */}
                        {showFindBar && (
                        <div className="absolute top-2 right-2 z-[2147483647] pointer-events-auto flex items-center gap-1 border border-white/10 shadow-2xl backdrop-blur-sm px-2 py-1.5" style={{ minWidth: 240, background: "rgba(24,24,27,0.97)" }}>
                            <MagnifyingGlassIcon className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                            <input
                                ref={findInputRef}
                                value={findQuery}
                                onChange={(e) => { setFindQuery(e.target.value); setFindCursor(0); }}
                                onKeyDown={(e) => {
                                    if (e.key === "Escape") { e.preventDefault(); setShowFindBar(false); editorTextRef.current?.focus(); }
                                    else if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); if (findMatches.length > 0) setFindCursor(v => (v - 1 + findMatches.length) % findMatches.length); }
                                    else if (e.key === "Enter") { e.preventDefault(); if (findMatches.length > 0) setFindCursor(v => (v + 1) % findMatches.length); }
                                }}
                                placeholder="Find in note…"
                                className="bg-transparent text-xs text-white outline-none placeholder-zinc-600 flex-1 font-mono"
                                style={{ minWidth: 130 }}
                            />
                            {findQuery.trim() && (
                                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: findMatches.length > 0 ? "#71717a" : "#ef4444" }}>
                                    {findMatches.length > 0 ? `${findCursor + 1}/${findMatches.length}` : "no match"}
                                </span>
                            )}
                            <button type="button" onClick={() => { if (findMatches.length > 0) setFindCursor(v => (v - 1 + findMatches.length) % findMatches.length); }} className="p-0.5 text-zinc-500 hover:text-white transition" title="Previous (Shift+Enter)"><ChevronUpIcon className="w-3 h-3" /></button>
                            <button type="button" onClick={() => { if (findMatches.length > 0) setFindCursor(v => (v + 1) % findMatches.length); }} className="p-0.5 text-zinc-500 hover:text-white transition" title="Next (Enter)"><ChevronDownIcon className="w-3 h-3" /></button>
                            <button type="button" onClick={() => { setShowFindBar(false); editorTextRef.current?.focus(); }} className="p-0.5 text-zinc-500 hover:text-white transition ml-0.5" title="Close (Esc)"><XMarkIcon className="w-3 h-3" /></button>
                        </div>
                        )}
                        {isRichMode ? (
                            // Rich editor stays black-on-white regardless of note color — the note color
                            // shows up only via the surrounding frame border (Apple-Notes pattern).
                            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "#ffffff" }}>
                                <RichEditor
                                    // Force fresh mount per note so opening "New Note" doesn't carry
                                    // the previous note's content in the TipTap editor instance.
                                    key={currentNoteId ?? "new-note"}
                                    initialDoc={richDoc}
                                    placeholder="Start writing…"
                                    accentColor={activeAccentColor}
                                    // Only auto-focus a brand-new note (so you can type right away).
                                    // For an EXISTING note, don't grab focus on open / tab-switch —
                                    // otherwise the contenteditable eats Left/Right and you can't
                                    // arrow past a rich-text tab. Click into the body to edit.
                                    autoFocus={!currentNoteId}
                                    onChange={({ doc, text }) => {
                                        latestRichDocRef.current = doc;
                                        latestContentRef.current = text;
                                        setRichDoc(doc);
                                        setContent(text);
                                        scheduleAutoSave();
                                    }}
                                    onUploadImage={async (file) => {
                                        const r = await uploadImage(file);
                                        return r.url;
                                    }}
                                />
                            </div>
                        ) : listMode ? (
                            <div
                                className="relative flex-1 min-h-0 overflow-y-auto"
                                style={{ transition: "box-shadow 0.15s ease", boxShadow: swipeLeftGlow ? "inset -6px 0 24px rgba(255,59,48,0.45)" : "none", touchAction: "pan-y" }}
                                onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest(".task-card-row") && !showAddTask) openAddTask(); }}
                                onTouchStart={(e) => { if (e.touches.length > 1) { e.preventDefault(); return; } listPullStartY.current = e.touches[0].clientY; mainSwipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }; listPullTriggered.current = false; }}
                                onTouchMove={(e) => {
                                    if (e.touches.length > 1) { e.preventDefault(); return; }
                                    if (showAddTask || listPullTriggered.current) return;
                                    const dy = e.touches[0].clientY - listPullStartY.current;
                                    if (dy > 64 && e.currentTarget.scrollTop === 0) { listPullTriggered.current = true; setSwipeLeftGlow(false); if (activeFolder) { void sync(); } else { openAddTask(); } return; }
                                    if (mainSwipeStart.current) {
                                        const dx = e.touches[0].clientX - mainSwipeStart.current.x;
                                        if (dx < -20 && Math.abs(dx) > Math.abs(dy)) setSwipeLeftGlow(true);
                                        else setSwipeLeftGlow(false);
                                    }
                                }}
                                onTouchEnd={(e) => {
                                    setSwipeLeftGlow(false);
                                    if (listPullTriggered.current) return;
                                    if (!mainSwipeStart.current) return;
                                    const dx = e.changedTouches[0].clientX - mainSwipeStart.current.x;
                                    const dy = e.changedTouches[0].clientY - mainSwipeStart.current.y;
                                    const dt = Date.now() - mainSwipeStart.current.time;
                                    const adx = Math.abs(dx), ady = Math.abs(dy);
                                    mainSwipeStart.current = null;
                                    if (dt > 600) return;
                                    if (ady > adx && ady > 50 && dy < 0) { if (showAddTask) { setShowAddTask(false); } else { const atBottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 2; if (atBottom) { listPullTriggered.current = true; closeNoteModal(); } } return; }
                                    if (showAddTask) return;
                                    if (adx > ady && adx > 50) { if (dx > 0) closeNoteModal(); return; }
                                }}
                            >
                                <div className="space-y-0">
                                {parsedTasks.length === 0 && !showAddTask ? (
                                    <div className="text-zinc-500 text-center pt-12 text-sm font-bold">NO TASKS — TAP + TO ADD ONE</div>
                                ) : (() => {
                                    const sorted = parsedTasks
                                        .map((task, origIdx) => ({ task, origIdx }))
                                        .sort((a, b) => Number(a.task.done) - Number(b.task.done));
                                    const undone = sorted.filter(t => !t.task.done);
                                    const done = sorted.filter(t => t.task.done);
                                    const renderRow = ({ task, origIdx }: { task: any; origIdx: number }, sortedIdx: number) => {
                                    const c = taskColor(origIdx, parsedTasks.length);
                                    const SNAP_W = 80;
                                    const DELETE_W = 220;
                                    const isSwipedOpen = swipedTaskIdx === origIdx;
                                    const isDragging = draggingTaskIdx === origIdx;
                                    const rowOffset = isDragging ? dragOffset : isSwipedOpen ? SNAP_W : 0;
                                    const isFullDelete = isDragging && dragOffset >= DELETE_W;
                                    return (
                                    <div key={origIdx}
                                        className={`group task-card-row w-full relative overflow-hidden transition-opacity ${task.done ? "hover:ring-1 hover:ring-red-500/60 hover:brightness-125" : ""} ${reorderDragOrigIdx === origIdx ? "opacity-40" : ""} ${!task.done && reorderOverOrigIdx === origIdx ? "ring-2 ring-white/40" : ""}`}
                                        draggable={!task.done}
                                        onDragStart={() => { setReorderDragOrigIdx(origIdx); }}
                                        onDragOver={(e) => { if (task.done) return; e.preventDefault(); setReorderOverOrigIdx(origIdx); }}
                                        onDragLeave={() => setReorderOverOrigIdx(null)}
                                        onDrop={(e) => { e.preventDefault(); if (reorderDragOrigIdx === null || reorderDragOrigIdx === origIdx) return; const from = parsedTasks[reorderDragOrigIdx].lineIdx; const to = parsedTasks[origIdx].lineIdx; reorderTask(from, to); setReorderDragOrigIdx(null); setReorderOverOrigIdx(null); }}
                                        onDragEnd={() => { setReorderDragOrigIdx(null); setReorderOverOrigIdx(null); }}
                                        onClick={(e) => {
                                            if (e.detail === 3) { e.stopPropagation(); toggleTask(task.lineIdx); }
                                            else if (e.detail === 2 && !task.done) { e.stopPropagation(); setEditingTaskIdx(origIdx); setEditingTaskText(task.text); setTimeout(() => editTaskInputRef.current?.focus(), 30); }
                                            else setActiveTaskIdx(i => i === origIdx ? null : origIdx);
                                        }}
                                        onTouchStart={(e) => {
                                            taskRowSwipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                                            setDraggingTaskIdx(origIdx);
                                            setDragOffset(isSwipedOpen ? SNAP_W : 0);
                                        }}
                                        onTouchMove={(e) => {
                                            if (!taskRowSwipeStart.current) return;
                                            const dx = taskRowSwipeStart.current.x - e.touches[0].clientX;
                                            const dy = Math.abs(e.touches[0].clientY - taskRowSwipeStart.current.y);
                                            if (dy > Math.abs(dx) && Math.abs(dx) < 12) { taskRowSwipeStart.current = null; setDraggingTaskIdx(null); return; }
                                            e.stopPropagation();
                                            const base = isSwipedOpen ? SNAP_W : 0;
                                            setDragOffset(Math.max(0, Math.min(DELETE_W + 20, base + dx)));
                                        }}
                                        onTouchEnd={(e) => {
                                            if (!taskRowSwipeStart.current) return;
                                            e.stopPropagation();
                                            taskRowSwipeStart.current = null;
                                            setDraggingTaskIdx(null);
                                            if (dragOffset >= DELETE_W) {
                                                setSwipedTaskIdx(null);
                                                deleteTask(task.lineIdx, task.text, c);
                                            } else if (dragOffset >= SNAP_W / 2) {
                                                setSwipedTaskIdx(origIdx);
                                            } else {
                                                setSwipedTaskIdx(null);
                                            }
                                        }}
                                    >
                                        {/* Delete backing — revealed on swipe */}
                                        <div className="absolute inset-y-0 right-0 flex items-center justify-center transition-all"
                                            style={{ width: rowOffset, background: isFullDelete ? "#ef4444" : "#991b1b" }}>
                                            <TrashIcon className="w-5 h-5 text-white" />
                                        </div>
                                        {/* Sliding content */}
                                        <div className="flex items-center gap-3 px-4 py-3 min-h-[54px] leading-snug relative overflow-hidden"
                                            style={{
                                                background: task.done ? (appTheme === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.04)") : (appTheme === "light" ? `linear-gradient(to right, ${c}55, ${c}18)` : `${c}50`),
                                                transform: `translateX(-${rowOffset}px)`,
                                                transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.25,1,0.5,1)",
                                            }}>
                                            <span className="task-card-pattern absolute inset-0 pointer-events-none" />
                                            {!task.done && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] sm:text-[16px] font-black leading-none pointer-events-none select-none" style={{ color: appTheme === "light" ? `${c}40` : "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>{String(sortedIdx + 1).padStart(2, "0")}</span>}
                                            <button type="button" onClick={() => toggleTask(task.lineIdx)} className="relative flex-shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all overflow-hidden" style={{ borderColor: task.done ? (appTheme === "light" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.25)") : c, backgroundColor: task.done ? (appTheme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)") : "transparent" }}>
                                                {task.done && (
                                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke={appTheme === "light" ? "#333" : "#000"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                )}
                                                {task.inProgress && !task.done && (
                                                    <span className="absolute left-0 right-0 bottom-0" style={{ height: "50%", background: c }} />
                                                )}
                                            </button>
                                            {editingTaskIdx === origIdx && !task.done ? (
                                                <input
                                                    ref={editTaskInputRef}
                                                    type="text"
                                                    value={editingTaskText}
                                                    onChange={(e) => setEditingTaskText(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") renameTask(task.lineIdx, editingTaskText); if (e.key === "Escape") setEditingTaskIdx(null); }}
                                                    onBlur={() => renameTask(task.lineIdx, editingTaskText || task.text)}
                                                    className="relative flex-1 bg-transparent text-[12px] sm:text-sm font-bold outline-none border-b pb-0.5"
                                                    style={{ color: appTheme === "light" ? "#1a1a1a" : "#ffffff", borderColor: appTheme === "light" ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.4)" }}
                                                    autoComplete="off"
                                                />
                                            ) : (
                                                <span className={`relative flex-1 text-left text-[12px] sm:text-sm font-bold truncate ${task.done ? (appTheme === "light" ? "text-zinc-400 line-through" : "text-zinc-600") : (appTheme === "light" ? "text-zinc-900" : "text-white")}`}>{task.text}</span>
                                            )}
                                            {!task.done && activeTaskIdx === origIdx && editingTaskIdx !== origIdx && (
                                                <button type="button"
                                                    onClick={(e) => { e.stopPropagation(); setEditingTaskIdx(origIdx); setEditingTaskText(task.text); setTimeout(() => editTaskInputRef.current?.focus(), 30); }}
                                                    className="relative z-10 flex-shrink-0 p-1 text-white/60 hover:text-white transition">
                                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {task.done && (
                                                <button type="button" onClick={(e) => { e.stopPropagation(); deleteTask(task.lineIdx, task.text, c); }} className="relative z-10 flex-shrink-0 p-1 text-transparent group-hover:text-zinc-500 hover:!text-red-400 transition" title="Delete"><TrashIcon className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </div>
                                    );
                                    };
                                    return (<>
                                        {undone.map((t, i) => renderRow(t, i))}
                                        {showAddTask && (
                                    <div className="relative overflow-hidden flex items-center gap-3 px-4 py-3 min-h-[62px] sm:min-h-[54px]" style={{ background: `${taskColor(parsedTasks.length, parsedTasks.length + 1)}50` }}>
                                        <span className="task-card-pattern absolute inset-0 pointer-events-none" />
                                        <span className="relative z-10 text-[11px] font-black w-6 text-right flex-shrink-0" style={{ color: taskColor(parsedTasks.length, parsedTasks.length + 1) }}>{String(parsedTasks.length + 1).padStart(2, "0")}</span>
                                        <input
                                            ref={addTaskInputRef}
                                            type="text"
                                            value={newTaskText}
                                            onChange={(e) => setNewTaskText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") confirmAddTask(); if (e.key === "Escape") { newTaskText.trim() ? confirmAddTask() : setShowAddTask(false); } }}
                                            onBlur={() => { if (newTaskText.trim()) confirmAddTask(); else setShowAddTask(false); }}
                                            className="flex-1 bg-transparent text-white text-[12px] sm:text-sm font-bold outline-none border-none shadow-none placeholder:text-zinc-400 caret-white relative z-10"
                                            style={{ color: "#fff", WebkitTextFillColor: "#fff" }}
                                            placeholder="Type a task..."
                                            autoComplete="off"
                                        />
                                        <button type="button" onClick={confirmAddTask} className="relative z-10 text-emerald-400 text-[11px] font-black hover:text-emerald-300 transition">ADD</button>
                                        <button type="button" onClick={() => setShowAddTask(false)} className="relative z-10 text-zinc-500 text-[11px] font-black hover:text-zinc-300 transition">ESC</button>
                                    </div>
                                )}
                                        {done.map((t, i) => renderRow(t, undone.length + i))}
                                    </>);
                                })()}
                                </div>
                                {!showAddTask && (
                                    <button type="button" onClick={openAddTask} aria-label="Add task" className="fab-float absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-110 transition-transform">
                                        <PlusIcon className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        ) : htmlMode ? (
                            <div className="flex-1 flex flex-col">
                                <iframe
                                    srcDoc={wrapHtmlWithTheme(content, appTheme === "dark")}
                                    className="flex-1 w-full border-0"
                                    sandbox="allow-scripts"
                                    title="HTML Preview"
                                />
                            </div>
                        ) : codeMode ? (
                            <CodeViewer
                                code={content}
                                language={noteType}
                                editing={codeEditMode}
                                theme={appTheme === "light" ? "light" : "dark"}
                                wordWrap={!codeEditMode}
                                searchTerm={showFindBar ? findQuery : ""}
                                searchIndex={findCursor}
                                onSearchResults={() => {}}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : jsonMode ? (
                            <CodeViewer
                                code={codeEditMode ? content : (jsonDetect.ok ? JSON.stringify(jsonDetect.parsed, null, 2) : content)}
                                language="json"
                                editing={codeEditMode}
                                theme={appTheme === "light" ? "light" : "dark"}
                                wordWrap={!codeEditMode}
                                searchTerm={showFindBar ? findQuery : ""}
                                searchIndex={findCursor}
                                onSearchResults={() => {}}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : (() => {
                            const stickyBg = appTheme === "light" ? "#ffffff" : "#000";
                            const stickyText = appTheme === "light" ? "#1a1a1a" : "#f8f8f2";
                            const stickyFont = "ui-monospace,'Fira Code','Cascadia Code',monospace";
                            const stickyFontSize = "clamp(8px, 1.2vw, 12px)";
                            return (
                            <div className="flex-1 flex overflow-auto relative" style={{ background: stickyBg, display: aiPromptOpen ? "none" : "flex" }}>
                                {/* Highlight backdrop for find-in-note */}
                                {showFindBar && findMatches.length > 0 && (
                                    <div aria-hidden="true" style={{
                                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                        pointerEvents: "none",
                                        fontFamily: stickyFont,
                                        fontSize: stickyFontSize, lineHeight: 1.6,
                                        paddingTop: 12, paddingBottom: 24, paddingLeft: 12, paddingRight: 12,
                                        whiteSpace: "pre", overflow: "hidden",
                                        color: "transparent", zIndex: 0,
                                    }}>
                                        {renderFindHighlights(content || "", findMatches, findCursor)}
                                    </div>
                                )}
                                {/* Native textarea — no cursor jump */}
                                <textarea
                                    ref={editorTextRef}
                                    value={content}
                                    readOnly={!!editingNote?.locked}
                                    onChange={(e) => handleEditorChange(e.target.value)}
                                    onClick={() => closeEditorTools()}
                                    onFocus={() => closeEditorTools()}
                                    onBlur={() => {}}
                                    onPaste={handleEditorPaste}
                                    onDragOver={(e) => { if (Array.from(e.dataTransfer.items).some(i => i.kind === "file")) e.preventDefault(); }}
                                    onDrop={(e) => {
                                        const files = Array.from(e.dataTransfer.files);
                                        const looksImage = (f: File) => f.type.startsWith("image/") || /\.(heic|heif|webp|avif|png|jpg|jpeg|gif|svg|bmp|tiff?|ico|jfif)$/i.test(f.name);
                                        if (files.some(f => looksImage(f) || f.type === "application/pdf")) e.preventDefault();
                                    }}
                                    className="ios-editor-scroll overscroll-none touch-pan-y"
                                    style={{
                                        flex: 1, background: "transparent", color: stickyText,
                                        fontFamily: stickyFont,
                                        fontSize: stickyFontSize, lineHeight: 1.6,
                                        paddingTop: 12, paddingBottom: 24, paddingLeft: 12, paddingRight: 12,
                                        outline: "none", resize: "none", caretColor: stickyText,
                                        overflowY: "auto",
                                        position: "relative", zIndex: 1,
                                    }}
                                    placeholder="START TYPING..."
                                />
                            </div>
                            );
                        })()}
                    </div>

                    {/* Image attachments */}
                    {(images.length > 0 || uploadingImages) && (() => {
                        const allImages = images.every(img => img.type?.startsWith("image/") || (!img.type?.includes("pdf")));
                        const isPageView = allImages && images.length > 2;
                        return isPageView ? (
                        // Full-width stacked view (PDF pages, many images)
                        <div className="overflow-y-auto bg-zinc-950 border-t border-white/[0.06]" style={{ maxHeight: "50vh" }}>
                            <div className="flex flex-col items-center gap-4 py-4 px-2">
                                {images.map((img, i) => (
                                    <div key={i} className="relative group w-full max-w-[800px]">
                                        <img src={img.url} alt={img.name} className="w-full rounded shadow-lg cursor-pointer" onClick={() => setLightboxUrl(img.url)} />
                                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                            <span className="text-[9px] text-white/50 bg-black/60 px-1.5 py-0.5 rounded">{i + 1}/{images.length}</span>
                                            <button onClick={(ev) => { ev.stopPropagation(); removeImage(i); }}
                                                className="w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center hover:bg-red-600 transition">✕</button>
                                        </div>
                                    </div>
                                ))}
                                {uploadingImages && (
                                    <div className="w-full max-w-[800px] h-32 rounded border border-white/10 flex items-center justify-center">
                                        <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>
                        ) : (
                        // Thumbnail strip (few images)
                        <div className="flex items-center gap-2 px-3 py-2 flex-wrap border-t border-white/[0.06] shrink-0 bg-black">
                            {images.map((img, i) => (
                                <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden shrink-0 cursor-pointer"
                                     onClick={() => img.type === "application/pdf" ? window.open(img.url, "_blank") : setLightboxUrl(img.url)}>
                                    {img.type === "application/pdf" ? (
                                        <div className="w-full h-full bg-red-950/60 flex flex-col items-center justify-center gap-0.5">
                                            <span className="text-red-400 text-lg">PDF</span>
                                            <span className="text-[7px] text-white/50 truncate max-w-[56px] px-0.5">{img.name}</span>
                                        </div>
                                    ) : (
                                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                                    )}
                                    <button
                                        onClick={(ev) => { ev.stopPropagation(); removeImage(i); }}
                                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full bg-black/70 text-white text-[9px] flex items-center justify-center leading-none">✕</button>
                                </div>
                            ))}
                            {uploadingImages && (
                                <div className="w-16 h-16 rounded-lg border border-white/10 flex items-center justify-center">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        );
                    })()}
                    </div>
                {/* ── Bottom status bar ── */}
                {editingNote && (() => {
                    const edited = editingNote.updated_at
                        ? new Date(editingNote.updated_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : null;
                    // Created date + time — shown bottom-left in the footer.
                    const createdDt = (() => {
                        const v = (editingNote as any)?.created_at;
                        if (!v) return null;
                        const d = new Date(v);
                        if (isNaN(d.getTime())) return null;
                        return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                    })();
                    // Relative age (e.g. "2h ago") shown next to the created date.
                    const createdAgo = (editingNote as any)?.created_at ? timeAgo((editingNote as any).created_at as string) : null;
                    return (
                        <div className="shrink-0 flex items-center justify-between px-3 select-none border-t relative overflow-x-auto overflow-y-hidden"
                            style={{
                                // 28px bar + the bg extended into the home-indicator safe area
                                height: "calc(28px + env(safe-area-inset-bottom, 0px))",
                                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                                fontSize: 10,
                                // Clean, uniform footer bar — solid neutral so the muted zinc
                                // status text/timestamps stay legible. Fixed 28px height with
                                // items-center keeps the chips vertically centered.
                                background: appTheme === "light" ? "#f2f2f7" : "#1e1e1e",
                                borderTopColor: appTheme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)",
                                scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
                            }}>
                            {showFindBar && findQuery.trim() && findMatches.length > 0 ? (
                                // Find mode — show match info in status bar
                                (() => {
                                    const total = findMatches.length;
                                    const match = findMatches[findCursor] ?? null;
                                    const line = match ? content.substring(0, match.start).split("\n").length : null;
                                    return (
                                        <div className="flex items-center gap-2 font-mono">
                                            <span style={{ color: "#FFD600" }} className="font-black">{findQuery}</span>
                                            <span className="text-zinc-500">—</span>
                                            <span className="text-zinc-400">{findCursor + 1} <span className="text-zinc-600">of</span> {total}</span>
                                            {line != null && <span className="text-zinc-600">· Ln {line}</span>}
                                            <span className="text-zinc-700 text-[9px]">↩ next · ⇧↩ prev · Esc close</span>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex items-center gap-1.5 font-mono overflow-x-auto" style={{ fontSize: 9 }}>
                                    {editingNote?.id && (() => {
                                        const byKey = (editingNote as any)?.created_by_key as string | undefined;
                                        const byMachine = (editingNote as any)?.created_by_machine as string | undefined;
                                        const isHubReport = isHubMachine(byMachine) && !appIconForKey(byKey) && /deep audit|health check|health report|mac health/i.test(editingNote?.title || title || "");
                                        const ownerBrowser = isOwnerBrowserNote(byKey, byMachine);
                                        const src = ownerBrowser ? OWNER_AVATAR : (appIconForKey(byKey) || (isHubReport ? hubMachineIcon() : null) || machineIcon(byMachine) || DEFAULT_APP_ICON);
                                        const who = ownerBrowser ? "me" : (byKey || (byMachine && !isHubMachine(byMachine) ? byMachine : null) || (isHubReport ? "M4" : "Stickies"));
                                        return (
                                            <span className="flex items-center flex-shrink-0" title={`Posted by ${who}`}>
                                                <img src={src} alt={who} className={`w-[14px] h-[14px] object-contain ${ownerBrowser ? "rounded-full object-cover" : "rounded-sm"}`} />
                                            </span>
                                        );
                                    })()}
                                    <span className="text-zinc-500 whitespace-nowrap tabular-nums" title="Created">{createdDt ?? edited ?? ""}</span>
                                    {createdAgo && <><span className="text-zinc-600">·</span><span className="text-zinc-500 whitespace-nowrap" title="Created">{createdAgo}</span></>}
                                </div>
                            )}
                            {editingNote?.id && (
                                <button type="button"
                                    onClick={() => { setShowNoteActions(false); closeEditorTools(); setConfirmDelete({ type: "note", noteId: String(editingNote.id), noteName: (title.trim() || editingNote.title || "Untitled").trim(), noteColor: noteColor || editingNote.folder_color || "#71717a" }); }}
                                    className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-1 text-red-500/60 hover:text-red-400 transition z-[1]"
                                    title="Delete note">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            )}
                            {/* Photo upload button removed — drag-and-drop handles images. */}
                            <div className="flex items-center gap-2 z-[2] flex-shrink-0">
                                {editingNote?.is_public && !editingNote?.locked && (
                                    <GlobeAltIcon className="w-3 h-3 text-emerald-400 flex-shrink-0" title="Public — anyone with the link" />
                                )}
                                {editingNote?.locked && (
                                    <LockClosedIcon className="w-3 h-3 text-sky-400 flex-shrink-0" title="Private — passcode to view" />
                                )}
                                {editingNote?.frozen && (
                                    <LockClosedIcon className="w-3 h-3 text-amber-400 flex-shrink-0" title="Locked — can't modify" />
                                )}
                                {/* Tags — first */}
                                {/* Folder pill with icon */}
                                {(() => {
                                    const fn = targetFolder || activeFolder || editingNote?.folder_name || "General";
                                    // Use the folder's real color (the same map the list uses) so the
                                    // pill matches the folder, not the note. Fall back only if unknown.
                                    const fc = folderColors[fn] || folders.find(f => f.name === fn)?.color || noteColor;
                                    const fi = folderIcons[fn] || "";
                                    return (
                                        <div className="relative" ref={(el) => { if (el) el.dataset.folderPillRef = "1"; }}>
                                            <button type="button"
                                                onClick={() => { if (pinnedFolders.size > 0) setShowFooterFolderPicker(v => !v); }}
                                                className="font-mono font-black uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded-full hover:brightness-125 transition flex items-center gap-1"
                                                style={{ fontSize: 8, background: fc, color: isLightColor(fc) ? "#1c1c1e" : "#fff", border: `1px solid ${fc}` }}>
                                                {fi ? <FolderIconDisplay value={fi} folderName={fn} className="w-2.5 h-2.5" /> : <FolderIcon className="w-2.5 h-2.5" />}
                                                {fn}
                                            </button>
                                        </div>
                                    );
                                })()}
                                {/* Type pill — it's just a file extension, so keep it dead
                                    simple: black badge, white text. No per-type rainbow. */}
                                {(() => {
                                    const badge = TYPE_BADGE[noteType] ?? TYPE_BADGE["text"];
                                    if (!badge) return null;
                                    const label = badge.label;
                                    return (
                                        <span
                                            className="font-mono font-black uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded-full"
                                            style={{
                                                fontSize: 8,
                                                background: "#1a1a1a",
                                                color: "#fff",
                                                border: appTheme === "dark" ? "1px solid rgba(255,255,255,0.18)" : "none",
                                                cursor: "default",
                                            }}
                                        >{label}</span>
                                    );
                                })()}
                                {(tagsExpanded ? noteTags : noteTags.slice(0, 3)).map((tag, i) => (
                                    <span key={i} className="font-mono font-bold whitespace-nowrap px-1.5 py-px rounded-full cursor-pointer hover:line-through text-sky-400"
                                        style={{ fontSize: 8, background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)" }}
                                        onClick={() => {
                                            const next = noteTags.filter((_, j) => j !== i);
                                            setNoteTags(next);
                                            if (editingNote?.id) notesApi.update(String(editingNote.id), { tags: next });
                                        }}
                                        title="Click to remove">{tag}</span>
                                ))}
                                {noteTags.length > 3 && (
                                    <span className="font-mono font-bold whitespace-nowrap px-1.5 py-px rounded-full cursor-pointer text-sky-400 hover:brightness-125 transition"
                                        style={{ fontSize: 8, background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)" }}
                                        onClick={() => setTagsExpanded(v => !v)}
                                        title={tagsExpanded ? "Show fewer" : "Show all tags"}>
                                        {tagsExpanded ? "−" : `+${noteTags.length - 3}`}
                                    </span>
                                )}
                                {/* Manual add-tag button removed — tags are auto-managed by
                                    smart-tag detection on save. Existing tags remain removable
                                    by tapping a chip. */}
                            </div>
                        </div>
                    );
                })()}
                </section>
                ) : (
                    /* Empty state — no note selected */
                    <div className="flex-1 flex flex-col items-center justify-center select-none gap-3" style={{ background: "#222222" }}>
                        <PencilSquareIcon className="w-8 h-8" style={{ color: "rgba(255,255,255,0.12)" }} />
                        <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.04em", textTransform: "uppercase" }}>Select a note</p>
                    </div>
                )}
                </div>{/* ── end right panel ── */}

                {/* LEFT NOTE LIST PANEL */}
                {(() => {
                    return (
                        <div className={`flex flex-col flex-1 min-h-0 overflow-hidden relative ${editorOpen || mainListMode === "tabs" ? "hidden" : ""}`}
                             style={{ background: "black" }}>

                            {/* TOP HEADER — breadcrumbs + buttons */}
                                <>
                                    <div className="safe-top-bar shrink-0" style={{ background: "black" }} />
                                    <header className="shrink-0 flex items-center h-[3.25rem] sm:h-[4rem] px-4 border-b border-white/[0.06] relative">
                                        {folderStack.length > 0 && (
                                            <>
                                                <button
                                                    onClick={() => { goBack(); }}
                                                    className="p-3 text-zinc-400 hover:bg-white/10 transition flex-shrink-0">
                                                    <ArrowLeftIcon className="w-8 h-8" />
                                                </button>
                                                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                                    {folderStack.map((frame, i) => (
                                                        <React.Fragment key={frame.id + i}>
                                                            {i > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                                                            <button
                                                                onClick={() => {
                                                                    if (i === folderStack.length - 1) {
                                                                        setIsGlobalSettings(false);
                                                                        setShowFolderColorPicker(false);
                                                                        setShowFolderIconPicker(false);
                                                                        setShowFolderMovePicker(false);
                                                                        setShowFolderActions(true);
                                                                    } else {
                                                                        goToIndex(i);
                                                                    }
                                                                }}
                                                                className={`flex items-center gap-1.5 font-normal tracking-tight truncate sm:max-w-[150px] flex-shrink-0 px-0.5 sm:px-1 transition text-xs ${i === folderStack.length - 1 ? "text-white hover:text-zinc-300" : "text-white hover:text-zinc-300"}`}
                                                                title={i === folderStack.length - 1 ? `${frame.name} settings` : frame.name}>
                                                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm font-black leading-none overflow-hidden" style={{ background: frame.name === "CLAUDE" ? "#fff" : frame.name === "Today" ? palette12[0] : (folderColors[frame.name] || frame.color || "#888"), color: folderTileForeground(appTheme, frame.name === "CLAUDE"), borderRadius: 4 } as React.CSSProperties}>
                                                                    {frame.name === "CLAUDE" ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" /> : <FolderIconDisplay value={frame.name === "Today" ? "__hero:CalendarDaysIcon" : frame.name === "All" ? "__hero:Squares2X2Icon" : (folderIcons[frame.name] || "")} folderName={frame.name} className="w-3.5 h-3.5" />}
                                                                </span>
                                                                <span className={`uppercase ${i === folderStack.length - 1 && folderStack.length <= 2 ? "inline" : "hidden sm:inline"}`} style={i === folderStack.length - 1 && frame.name !== "CLAUDE" ? { color: frame.name === "Today" ? palette12[0] : (folderColors[frame.name] || frame.color || "#888") } : undefined}>{frame.name}</span>
                                                            </button>
                                                        </React.Fragment>
                                                    ))}
                                                    <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>
                                                </div>
                                            </>
                                        )}
                                        {!activeFolder ? (
                                            <>
                                                <button type="button" onClick={() => { setShowCmdK(true); setCmdKQuery(""); setCmdKCursor(0); }}
                                                    className={`relative flex items-center transition-all duration-200 text-left ${search.trim() ? "flex-1" : "w-[220px]"} bg-transparent`}>
                                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 w-6 h-6 pointer-events-none" />
                                                    <span className="w-full pl-12 pr-3 py-3 text-sm font-black tracking-tight text-white/30">SEARCH</span>
                                                </button>
                                                <div className="absolute right-2 flex items-center">
                                                    <HeaderIconBtn icon={viewModeIcon} label={viewModeLabel} onClick={cycleViewMode} />
                                                    <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { setIsGlobalSettings(true); setShowFolderActions(true); }} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="absolute right-2 flex items-center">
                                                {isSelectMode ? (
                                                    <div className="flex items-center gap-2 pr-2">
                                                        <span className="text-xs font-bold text-blue-400 select-none">{selectedIds.size} selected</span>
                                                        <button
                                                            onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                                                            className="px-3 py-1.5 text-xs font-black text-white bg-white/10 hover:bg-white/20 transition">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : activeFolder === "TRASH" ? (
                                                    <button type="button" onClick={() => setShowEmptyTrashModal(true)} className="px-3 py-1.5 text-xs font-black text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded transition">
                                                        Empty Trash
                                                    </button>
                                                ) : (<>
                                                    {/* Search inside a folder / the All view. The root grid has its own
                                                        big SEARCH field, but the app now always LANDS in "All", so without
                                                        this the default view had no search affordance at all on touch -
                                                        Cmd+K needs a keyboard, which an iPad does not have. */}
                                                    <HeaderIconBtn icon={MagnifyingGlassIcon} label="Search" onClick={() => { setShowCmdK(true); setCmdKQuery(""); setCmdKCursor(0); }} />
                                                    <HeaderIconBtn icon={viewModeIcon} label={viewModeLabel} onClick={cycleViewMode} />
                                                    <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { setIsGlobalSettings(false); setShowFolderActions(true); }} />
                                                </>)}
                                            </div>
                                        )}
                                    </header>
                                </>

                            {/* NOTE LIST CONTENT */}
                            <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative" style={{ background: "black" }}>

                    <main ref={mainScrollRef}
                        onDragOver={(e) => { if (Array.from(e.dataTransfer.items).some(i => i.kind === "file")) e.preventDefault(); }}
                        onDrop={(e) => {
                            const items = Array.from(e.dataTransfer.items);
                            const files = Array.from(e.dataTransfer.files);
                            if (!items.length && !files.length) return;
                            e.preventDefault();

                            // Check for folder drop via webkitGetAsEntry
                            const entries = items.map(i => (i as any).webkitGetAsEntry?.() as FileSystemEntry | null).filter(Boolean);
                            const dirEntry = entries.find(e => e?.isDirectory) as FileSystemDirectoryEntry | undefined;
                            if (dirEntry) {
                                const folderName = dirEntry.name;
                                const readDir = (dir: FileSystemDirectoryEntry): Promise<File[]> => new Promise((resolve) => {
                                    const reader = dir.createReader();
                                    const results: File[] = [];
                                    const read = () => reader.readEntries(async (ents) => {
                                        if (!ents.length) { resolve(results); return; }
                                        for (const ent of ents) {
                                            if (ent.isFile && /\.(md|txt|pdf)$/i.test(ent.name)) {
                                                const file = await new Promise<File>((res) => (ent as FileSystemFileEntry).file(res));
                                                results.push(file);
                                            }
                                        }
                                        read();
                                    });
                                    read();
                                });
                                void (async () => {
                                    const allFiles = await readDir(dirEntry);
                                    if (!allFiles.length) { showToast(`No .md, .txt, or .pdf in "${folderName}"`, "#ef4444"); return; }
                                    showToast(`Importing ${allFiles.length} file${allFiles.length !== 1 ? "s" : ""} into "${folderName}"...`, "#a78bfa");
                                    let created = 0;
                                    for (const file of allFiles) {
                                        const ext = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
                                        const title = file.name.replace(/\.[^.]+$/, "");
                                        const color = palette12[Math.floor(Math.random() * palette12.length)];
                                        if (ext === ".pdf") {
                                            try {
                                                // Upload the PDF as-is; the server (pdf-parse) extracts its text.
                                                const { extractedText, ...img } = await uploadImage(file);
                                                const res = await fetch("/api/stickies", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ title, content: extractedText || `PDF: ${file.name}`, folder_name: folderName, folder_color: color, type: "text" }),
                                                });
                                                if (res.ok) {
                                                    const { id } = await res.json();
                                                    await fetch("/api/stickies", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ id, images: [img] }),
                                                    });
                                                    created++;
                                                }
                                            } catch (err) { console.error("PDF import failed:", err); }
                                        } else {
                                            const text = await file.text();
                                            const type = "text";
                                            try {
                                                await fetch("/api/stickies", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ title, content: text, folder_name: folderName, folder_color: color, type }),
                                                });
                                                created++;
                                            } catch (err) { console.error("File import failed:", err); }
                                        }
                                    }
                                    void sync();
                                    showToast(`Imported ${created} note${created !== 1 ? "s" : ""} into "${folderName}"`, "#34C759");
                                    playSound("create");
                                })();
                                return;
                            }

                            // Images → if editor open, upload and insert ![](url) inline
                            if (files.length && editorOpen && files.every(f => f.type.startsWith("image/") || /\.(heic|heif|webp|avif|png|jpg|jpeg|gif|svg|bmp|tiff?|ico|jfif)$/i.test(f.name))) {
                                void (async () => {
                                    showToast(`Uploading ${files.length} image${files.length !== 1 ? "s" : ""}...`, "#a78bfa");
                                    const ta = editorTextRef.current;
                                    const pos = ta?.selectionStart ?? content.length;
                                    const urls: string[] = [];
                                    for (const file of files) {
                                        try {
                                            const upload = await uploadImage(file);
                                            urls.push(`![${file.name}](${upload.url})`);
                                        } catch (err) { console.error("[drop] image upload failed:", err); showError(`Upload failed: ${file.name}`); }
                                    }
                                    if (urls.length > 0) {
                                        const md = urls.join("\n") + "\n";
                                        handleEditorChange(content.slice(0, pos) + md + content.slice(pos));
                                        showToast(`${urls.length} image${urls.length !== 1 ? "s" : ""} added`, "#34C759");
                                    }
                                })();
                                return;
                            }
                            // PDFs → if editor open, convert to images and insert
                            if (files.length && editorOpen && files.every(f => f.type === "application/pdf")) {
                                addImages(Array.from(files));
                                return;
                            }

                            // Text/HTML file dropped into editor → open as new note
                            if (files.length === 1 && editorOpen) {
                                const file = files[0];
                                const ext = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
                                if ([".html",".htm",".md",".txt",".js",".ts",".py",".css",".sql",".sh",".json"].includes(ext)) {
                                    void file.text().then(text => {
                                        const typeMap: Record<string, string> = { ".html": "html", ".htm": "html", ".md": "text", ".txt": "text", ".js": "javascript", ".ts": "typescript", ".py": "python", ".css": "css", ".sql": "sql", ".sh": "bash", ".json": "json" };
                                        setEditingNote(null);
                                        setTitle(file.name.replace(/\.[^.]+$/, ""));
                                        setContent(text);
                                        latestContentRef.current = text;
                                        setPendingNoteType(typeMap[ext] || "text");
                                        setTargetFolder(activeFolder || "CLAUDE");
                                        setNoteColor(palette12[Math.floor(Math.random() * palette12.length)]);
                                        noteEverDirtyRef.current = true;
                                        playSound("create");
                                    });
                                    return;
                                }
                            }

                            // Multiple files or single file drop → batch create notes
                            const extToType: Record<string, string> = {
                                ".js": "javascript", ".jsx": "javascript", ".ts": "typescript", ".tsx": "typescript",
                                ".py": "python", ".css": "css", ".sql": "sql", ".sh": "bash", ".bash": "bash",
                                ".html": "html", ".htm": "html", ".json": "json", ".md": "text", ".mdx": "text", ".txt": "text",
                            };
                            void (async () => {
                                const folderName = activeFolder || "Today";
                                showToast(`Importing ${files.length} file${files.length !== 1 ? "s" : ""}...`, "#a78bfa");
                                let created = 0;
                                for (const file of files) {
                                    const ext = file.name.includes(".") ? "." + file.name.split(".").pop()!.toLowerCase() : "";
                                    const title = file.name.replace(/\.[^.]+$/, "");
                                    const color = palette12[Math.floor(Math.random() * palette12.length)];
                                    try {
                                        if (file.type === "application/pdf") {
                                            // Upload the PDF as-is; the server (pdf-parse) extracts its text.
                                            const { extractedText, ...img } = await uploadImage(file);
                                            const res = await fetch("/api/stickies", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ title, content: extractedText || `PDF: ${file.name}`, folder_name: folderName, folder_color: color, type: "text" }),
                                            });
                                            if (res.ok) {
                                                const { id } = await res.json();
                                                await fetch("/api/stickies", {
                                                    method: "PATCH",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ id, images: [img] }),
                                                });
                                                created++;
                                            }
                                        } else if (file.type.startsWith("image/")) {
                                            const res = await fetch("/api/stickies", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ title, content: "", folder_name: folderName, folder_color: color, type: "text" }),
                                            });
                                            if (res.ok) {
                                                const { id } = await res.json();
                                                const upload = await uploadImage(file);
                                                await fetch("/api/stickies", {
                                                    method: "PATCH",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ id, images: [{ url: upload.url, name: upload.name, type: upload.type }] }),
                                                });
                                                created++;
                                            }
                                        } else {
                                            const text = await file.text();
                                            const type = extToType[ext] || "text";
                                            await fetch("/api/stickies", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ title, content: text, folder_name: folderName, folder_color: color, type }),
                                            });
                                            created++;
                                        }
                                    } catch (err) { console.error("[drop] file import failed:", err); showError(`Import failed: ${file.name}`); }
                                }
                                // Reload notes so list refreshes
                                if (activeFolder) void loadFolderNotes(activeFolder, false);
                                void sync();
                                showToast(`Imported ${created} note${created !== 1 ? "s" : ""}`, "#34C759");
                                playSound("create");
                            })();
                        }}
                        className="ios-mobile-main relative flex-1 overflow-x-hidden overflow-y-auto touch-pan-y overscroll-none bg-black pb-16 sm:pb-24"
                        style={{ display: "block" }}
                    >
                        {createdByFilter && (
                            <div className="px-4 py-2">
                                <button type="button" onClick={() => setCreatedByFilter(null)}
                                    className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
                                    style={{ color: "rgb(var(--foreground-rgb))", background: "rgba(52,199,89,0.14)", border: "1px solid rgba(52,199,89,0.4)" }}>
                                    {appIconForKey(createdByFilter) && <img src={appIconForKey(createdByFilter)!} alt={createdByFilter} className="w-4 h-4 rounded-sm object-contain" />}
                                    Posted by {createdByFilter}
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                </button>
                            </div>
                        )}
                        {filteredDisplayItems.map((item, idx) => {
                            // Section header sentinel
                            if (item._header) {
                                return (
                                    <div key={item.id || `hdr-${idx}`}
                                        className="px-4 pt-4 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase select-none">
                                        {item._header}
                                    </div>
                                );
                            }
                            const tileId = String(item.id || "");
                            const isDragging = draggingTileId === tileId;
                            const dt = dropTarget?.id === tileId ? dropTarget : null;
                            const canDrag = isFolderGridView || isNoteGridView;
                            return (
                                <div
                                    key={item.id || idx}
                                    data-note-id={tileId}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={item.is_folder ? `Folder ${item.name}` : (item.title || "Note")}
                                    onKeyDown={(e) => {
                                        if (e.key !== "Enter" && e.key !== " ") return;
                                        e.preventDefault();
                                        if (isSelectMode && !item.is_folder) {
                                            const id = String(item.id);
                                            setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
                                            return;
                                        }
                                        if (item.is_folder) {
                                            playSound("navigate");
                                            navTimestampRef.current = Date.now();
                                            enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                        } else {
                                            void openNote(item);
                                        }
                                    }}
                                    draggable={canDrag}
                                    onDragStart={(e) => handleTileDragStart(e, item)}
                                    onDragOver={(e) => handleTileDragOver(e, item)}
                                    onDragLeave={handleTileDragLeave}
                                    onDrop={(e) => { void handleTileDrop(e, item); }}
                                    onDragEnd={handleTileDragEnd}
                                    onMouseEnter={(e) => {
                                        if (!IS_PHONE) playSound("hover");
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = ((e.clientX - rect.left) / rect.width) * 100, y = ((e.clientY - rect.top) / rect.height) * 100;
                                        const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]");
                                        if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 50%, transparent 100%)`;
                                        // Shake folder icon (inner icon only) on root hover
                                        if (item.is_folder && !activeFolder) {
                                            const inner = e.currentTarget.querySelector<HTMLElement>(".folder-icon-badge svg, .folder-icon-badge img");
                                            if (inner) { inner.style.animation = "iconShake 0.4s ease 2"; inner.addEventListener("animationend", () => { inner.style.animation = ""; }, { once: true }); }
                                        }
                                    }}
                                    onMouseMove={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = ((e.clientX - rect.left) / rect.width) * 100, y = ((e.clientY - rect.top) / rect.height) * 100;
                                        const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]");
                                        const rc = getComputedStyle(e.currentTarget).getPropertyValue("--row-color").trim() || "#fff";
                                        if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, ${rc}22 0%, ${rc}0d 50%, transparent 100%)`;
                                    }}
                                    onMouseLeave={(e) => { const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = ""; }}
                                    onTouchStart={(e) => {
                                        // Track swipe-to-delete start on NOTE rows only (not folders, not select mode).
                                        if (!item.is_folder && !isSelectMode && e.touches.length === 1) {
                                            rowSwipeStart.current = { id: String(item.id), x: e.touches[0].clientX, y: e.touches[0].clientY };
                                        }
                                        longPressTimer.current = setTimeout(() => {
                                            longPressTimer.current = null;
                                            suppressOpenRef.current = true;
                                            if (item.is_folder) {
                                                enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                                setIsGlobalSettings(false);
                                                setShowFolderActions(true);
                                            } else {
                                                setIsSelectMode(true);
                                                setSelectedIds(new Set([String(item.id)]));
                                            }
                                        }, 500);
                                    }}
                                    onTouchMove={(e) => {
                                        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                                        // Finger-track a left swipe on this note row (DOM-only, no re-render).
                                        const s = rowSwipeStart.current;
                                        if (!s || s.id !== String(item.id)) return;
                                        const dx = e.touches[0].clientX - s.x;
                                        const dy = e.touches[0].clientY - s.y;
                                        if (dx < 0 && Math.abs(dx) > Math.abs(dy)) {
                                            const el = e.currentTarget as HTMLElement;
                                            el.style.transition = "none";
                                            el.style.transform = `translateX(${dx}px)`;
                                            el.style.opacity = String(Math.max(0.35, 1 + dx / (el.offsetWidth || 320)));
                                        }
                                    }}
                                    onTouchEnd={(e) => {
                                        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                                        const s = rowSwipeStart.current;
                                        rowSwipeStart.current = null;
                                        if (!s || s.id !== String(item.id)) return;
                                        const el = e.currentTarget as HTMLElement;
                                        const dx = e.changedTouches[0].clientX - s.x;
                                        const dy = e.changedTouches[0].clientY - s.y;
                                        const w = el.offsetWidth || 320;
                                        // "All the way": past half the row width, clearly horizontal -> delete.
                                        if (dx <= -w * 0.5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
                                            suppressOpenRef.current = true; // don't also open on the trailing click
                                            el.style.transition = "transform .16s ease, opacity .16s ease";
                                            el.style.transform = `translateX(-${w}px)`;
                                            el.style.opacity = "0";
                                            void swipeDeleteNote(item);
                                        } else {
                                            // Snap back.
                                            el.style.transition = "transform .2s cubic-bezier(.2,.8,.2,1), opacity .2s";
                                            el.style.transform = "translateX(0)";
                                            el.style.opacity = "1";
                                        }
                                    }}
                                    onContextMenu={(e) => {
                                        if (item.is_folder) {
                                            e.preventDefault();
                                            enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                            setIsGlobalSettings(false);
                                            setShowFolderActions(true);
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (suppressOpenRef.current) { suppressOpenRef.current = false; return; }
                                        e.stopPropagation();
                                        if (isSelectMode && !item.is_folder) {
                                            const id = String(item.id);
                                            setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
                                            return;
                                        }
                                        // Guard: ignore ALL clicks within 900ms of folder navigation (prevents bleed-through on mobile)
                                        if (!item.is_folder && Date.now() - navTimestampRef.current < 900) return;
                                        if (item.is_folder) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            playSound("navigate");
                                            navTimestampRef.current = Date.now();
                                            suppressOpenRef.current = true;
                                            setTimeout(() => { suppressOpenRef.current = false; }, 1000);
                                            enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                        } else {
                                            void openNote(item);
                                            setTimeout(() => playSound("click"), 0);
                                        }
                                    }}
                                    style={noteTileStyle(item, {
                                        showFileIcons,
                                        activeFolder: !!activeFolder,
                                        parentColor: activeFolder
                                            ? (folderStack.at(-1)?.color || folders.find(f => f.name === activeFolder)?.color || item.color || item.folder_color || "#888888")
                                            : (item.color || item.folder_color || "#888888"),
                                        appTheme,
                                        idx,
                                        total: filteredDisplayItems.length,
                                    }) as React.CSSProperties}
                                    className={noteTileClassName(item, {
                                        isDragging,
                                        dropMode: dt?.mode ?? null,
                                        incoming: incomingNoteIds.has(String(item.id)),
                                        removing: removingNoteIds.has(String(item.id)),
                                        isSelectMode,
                                        selected: selectedIds.has(String(item.id)),
                                    })}>
                                    {/* Cursor spotlight glow — DOM-only, no React state */}
                                    <div data-glow className="absolute inset-0 pointer-events-none z-[-1]" style={{ transition: "background 0.4s ease" }} />
                                    {/* Insertion line indicator — before */}
                                    {dt?.mode === "before" && (
                                        <div className="absolute z-20 bg-cyan-400 pointer-events-none left-0 right-0 top-0 h-0.5" />
                                    )}
                                    {/* Insertion line indicator — after */}
                                    {dt?.mode === "after" && (
                                        <div className="absolute z-20 bg-cyan-400 pointer-events-none left-0 right-0 bottom-0 h-0.5" />
                                    )}
                                    <NoteTileListBody
                                            item={item}
                                            selected={selectedIds.has(String(item.id))}
                                            showFileIcons={showFileIcons}
                                            activeFolder={activeFolder}
                                            isSelectMode={isSelectMode}
                                            pinned={pinnedIds.has(String(item.id))}
                                            createdByFilter={createdByFilter}
                                            noteIcon={noteIcons[String(item.id)]}
                                            iconAnim={false}
                                            iconSpin={false}
                                            onOpen={() => { void openNote(item); }}
                                            onIconOpen={() => { void openNote(item); closeEditorTools(); }}
                                            onEnterFolder={() => { navTimestampRef.current = Date.now(); suppressOpenRef.current = true; setTimeout(() => { suppressOpenRef.current = false; }, 1000); enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] }); }}
                                            onSetFilter={setCreatedByFilter}
                                    />
                                </div>
                            );
                        })}
                        {/* Today: Load-more widens the window by another 24h each click. All: fetches the next 20-note page */}
                        {(activeFolder === "Today" || (activeFolder === "All" && allNotes.length < allTotal)) && filteredDisplayItems.some((i: any) => !i._header && !i.is_folder) && (
                            <div className="flex flex-col items-center py-5">
                                <button
                                    type="button"
                                    onClick={activeFolder === "All" ? loadMoreAll : loadMoreToday}
                                    disabled={todayLoadingMore || allLoadingMore}
                                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50"
                                    style={appTheme === "light"
                                        ? { color: "rgba(0,0,0,0.72)", background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.16)" }
                                        : { color: "rgba(255,255,255,0.88)", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.2)" }}>
                                    {(todayLoadingMore || allLoadingMore)
                                        ? <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: appTheme === "light" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.3)", borderTopColor: appTheme === "light" ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.88)" }} />
                                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>}
                                    Load more
                                </button>
                            </div>
                        )}
                        {/* Infinite scroll sentinel + loading indicator */}
                        {activeFolder && (
                            <div
                                ref={notesEndRef}
                                className="h-4 w-full"
                            />
                        )}
                        {activeFolder && folderNotesLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                        )}
{isEmptyView && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center px-6 sm:px-10">
                                <div key={quoteIndex} className="empty-quote-anim max-w-[760px] text-center">
                                    <p className="text-white/85 text-base sm:text-xl font-semibold leading-relaxed tracking-tight">{EMPTY_QUOTES[quoteIndex]}</p>
                                </div>
                            </div>
                        )}
                        {/* Stats footer — desktop only */}
                        {!isEmptyView && (
                            <div className="hidden sm:block text-right px-4 py-2 text-[10px] text-zinc-700 font-medium select-none pointer-events-none">
                                {listStatsSummary({
                                    items: filteredDisplayItems,
                                    atRoot: !activeFolder && !search.trim(),
                                    folderCounts,
                                    dbNoteCount: dbData.filter((r) => !r.is_folder && !r.trashed_at).length,
                                })}
                            </div>
                        )}
                    </main>

                    {/* Pinned count bar — always visible at bottom of the list column */}
                    {(() => {
                        const realItems = filteredDisplayItems.filter((i: any) => !i._header);
                        const fCount = realItems.filter((i: any) => i.is_folder).length;
                        // At the root list (no active folder, not searching) every note lives inside
                        // a folder, so counting only root-level items reads "0 notes". Show the global
                        // total across all folders (server counts, excluding TRASH) instead.
                        const atRoot = !activeFolder && !search.trim();
                        const totalFromCounts = Object.entries(folderCounts).reduce((s, [name, c]) => s + (name === "TRASH" ? 0 : c), 0);
                        const nCount = atRoot
                            ? (totalFromCounts > 0 ? totalFromCounts : dbData.filter((r) => !r.is_folder && !r.trashed_at).length)
                            : realItems.filter((i: any) => !i.is_folder).length;
                        const parts = [fCount > 0 && `${fCount} folder${fCount !== 1 ? "s" : ""}`, `${nCount} note${nCount !== 1 ? "s" : ""}`].filter(Boolean);
                        return (
                            <div className="flex-shrink-0 flex items-center justify-between px-4 font-medium text-zinc-500 border-t select-none pointer-events-none tabular-nums"
                                style={{
                                    // 28px bar + the bg extended into the home-indicator safe area
                                    height: "calc(28px + env(safe-area-inset-bottom, 0px))",
                                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                                    fontSize: 10,
                                    background: appTheme === "light" ? "#f2f2f7" : "#1e1e1e",
                                    borderTopColor: appTheme === "light" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)",
                                }}>
                                <span className="flex items-center gap-1.5">
                                    <span className="uppercase tracking-wide">{now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
                                    <span className="opacity-50">/</span>
                                    <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span>{parts.join(" · ")}</span>
                                    {activeFolder && (
                                        <button type="button" onClick={() => void randomizeFolderColors()} title="Randomize note colors in this folder"
                                            className="hidden sm:inline-flex pointer-events-auto opacity-50 hover:opacity-100 transition-opacity active:scale-125 ml-1"
                                            style={{ fontSize: 11, lineHeight: 1, background: "none", border: "none", padding: "0 1px" }}>🎲</button>
                                    )}
                                </span>
                            </div>
                        );
                    })()}

                    {/* FAB — floating + button with speed dial */}
                    {!isSelectMode && (
                        <div className="fixed bottom-5 right-4 z-[130]" style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.55))" }}>
                            {/* Speed dial bubbles */}
                            {showFabMenu && (
                                <>
                                    <div className="fixed inset-0 z-[-1]" onClick={() => setShowFabMenu(false)} onTouchMove={() => setShowFabMenu(false)} />
                                    {(() => {
                                        const radius = 70;
                                        const items = [
                                            { angle: 225, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, action: () => { setShowFabMenu(false); openNewNote(); }, label: "File" },
                                            { angle: 270, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>, action: () => { setShowFabMenu(false); openCreateFolder(); }, label: "Folder" },
                                        ];
                                        return items.map((item, i) => {
                                            const rad = (item.angle * Math.PI) / 180;
                                            const x = Math.cos(rad) * radius;
                                            const y = Math.sin(rad) * radius;
                                            return (
                                                <button key={i} type="button"
                                                    onClick={item.action}
                                                    className="absolute rounded-full flex items-center justify-center bg-white text-black hover:scale-110 active:scale-95 transition-all shadow-lg"
                                                    style={{ width: 42, height: 42, bottom: 3 - y, right: 3 - x, animation: `fabFanIn 0.2s ease-out ${i * 0.06}s both` }}
                                                    title={item.label}>
                                                    {item.icon}
                                                </button>
                                            );
                                        });
                                    })()}
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowFabMenu(v => !v)}
                                className="fab-alive rounded-full flex items-center justify-center text-black"
                                style={{
                                    width: 48,
                                    height: 48,
                                    background: "#ffffff",
                                    boxShadow: "0 0 0 2px rgba(0,0,0,0.25), 0 8px 28px rgba(255,255,255,0.35)",
                                    transform: showFabMenu ? "rotate(45deg)" : "rotate(0deg)",
                                    transition: "transform 0.2s ease",
                                }}>
                                <PlusIcon style={{ width: 24, height: 24 }} />
                            </button>
                        </div>
                    )}



                    {/* MULTI-SELECT ACTION BAR */}
                    {isSelectMode && (
                        <div className="fixed bottom-0 left-0 right-0 z-[150] bg-zinc-900/97 border-t border-white/10 px-4 py-3 flex items-center gap-3">
                            <span className="text-xs text-zinc-400 flex-1 font-bold">
                                {selectedIds.size === 0 ? "Tap notes to select" : `${selectedIds.size} note${selectedIds.size !== 1 ? "s" : ""} selected`}
                            </span>
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={() => void bulkDeleteSelected()}
                                    className="px-4 py-2 bg-red-500/20 text-red-400 text-xs font-black border border-red-500/30 hover:bg-red-500/30 transition">
                                    Delete {selectedIds.size}
                                </button>
                            )}
                            <button
                                onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                                className="px-4 py-2 bg-white/10 text-white text-xs font-black hover:bg-white/15 transition">
                                Cancel
                            </button>
                        </div>
                    )}

                            </div>
                        </div>
                    );
                })()}


            </div>{/* ── end two-panel wrapper ── */}


            {/* NOTE TYPE PICKER */}
            {showNoteTypePicker && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowNoteTypePicker(false)}>
                    <div className="flex flex-col items-center gap-6 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">New Note</div>
                        <div className="flex items-center gap-8">
                            <button
                                type="button"
                                onClick={() => { setShowNoteTypePicker(false); openNewNote(); }}
                                className="flex flex-col items-center gap-3 group"
                            >
                                <div className="w-28 h-28 rounded-full flex items-center justify-center transition-transform active:scale-95 group-hover:scale-105"
                                    style={{ background: "linear-gradient(135deg, #ffffff 0%, #d4d4d4 100%)", boxShadow: "0 0 40px rgba(255,255,255,0.2), 0 8px 32px rgba(0,0,0,0.5)" }}>
                                    <svg className="w-12 h-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.5 19.213l-4 1 1-4L16.862 3.487z" />
                                    </svg>
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-white">Type</span>
                            </button>

                        </div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-widest">or tap outside to cancel</div>
                    </div>
                </div>
            )}

            {/* Footer folder picker — rendered at top level to escape overflow-hidden */}
            {showFooterFolderPicker && (
                <>
                    <div className="fixed inset-0 z-[999]" onClick={() => setShowFooterFolderPicker(false)} />
                    <div className="fixed z-[1000] w-48 max-h-[240px] overflow-y-auto rounded-xl bg-zinc-900 border border-white/15 shadow-2xl py-1" style={{ scrollbarWidth: "thin", bottom: 30, right: 16 }}>
                        {(() => {
                            const currentFolder = targetFolder || activeFolder || editingNote?.folder_name;
                            const seen = new Set<string>();
                            const pinned = folders.filter(f => {
                                if (!pinnedFolders.has(f.name)) return false;
                                if (f.name === "TRASH" || f.name === currentFolder) return false;
                                if (seen.has(f.name)) return false;
                                seen.add(f.name);
                                return true;
                            }).sort((a, b) => a.order - b.order);
                            return pinned;
                        })().map(f => (
                            <button key={f.name} type="button"
                                onClick={() => {
                                    setShowFooterFolderPicker(false);
                                    void moveToFolder(f.name);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide transition text-zinc-400 hover:text-white hover:bg-white/5">
                                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded overflow-hidden" style={{ background: f.color, color: isLightColor(f.color) ? "#1c1c1e" : "#fff", fontSize: 8 }}>
                                    <FolderIconDisplay value={folderIcons[f.name] || ""} folderName={f.name} className="w-2.5 h-2.5" />
                                </span>
                                {f.name}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {showNoteActions && (
                <div className="fixed inset-0 z-[510] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 lg:bg-transparent lg:backdrop-blur-none lg:items-stretch lg:justify-end lg:p-0" onClick={() => { setShowNoteActions(false); closeEditorTools(); }}>
                    <div
                        ref={editorToolsRef}
                        className="note-actions-panel bg-zinc-900 border w-full max-w-sm flex flex-col overflow-hidden rounded-2xl lg:max-w-[300px] lg:w-[300px] lg:h-full lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:rounded-none"
                        style={{ borderColor: noteColor }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center">
                            <h2 className="text-sm font-black tracking-widest text-white truncate">{title.trim() || editingNote?.title || "Untitled"}</h2>
                        </div>


                        <div className="flex flex-col divide-y divide-white/10 overflow-y-auto max-h-[70vh] lg:max-h-none lg:flex-1">
                            {/* SHARE */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                onClick={() => { setSharePickerOpen(true); setShowNoteActions(false); closeEditorTools(); }}
                            >
                                <PaperAirplaneIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">Share</span>
                            </button>
                            {/* LOCK — write-protect: a locked note can't be edited, updated, or deleted */}
                            {(() => {
                                const isFrozen = !!(editingNote?.frozen);
                                return (
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => {
                                        const noteId = editingNote?.id ? String(editingNote.id) : "";
                                        if (!noteId) return;
                                        const newFrozen = !isFrozen;
                                        void notesApi.update(noteId, { frozen: newFrozen });
                                        setEditingNote((prev: any) => prev ? { ...prev, frozen: newFrozen } : prev);
                                        setDbData((prev: any[]) => prev.map((r: any) => String(r.id) === noteId ? { ...r, frozen: newFrozen } : r));
                                        showToast(newFrozen ? "Locked — can't modify" : "Unlocked", newFrozen ? "#f59e0b" : "#22c55e");
                                        setShowNoteActions(false);
                                    }}
                                >
                                    {isFrozen
                                        ? <LockOpenIcon className="w-5 h-5 flex-shrink-0 text-amber-400" />
                                        : <LockClosedIcon className="w-5 h-5 flex-shrink-0" />}
                                    <span className="text-xs font-black tracking-wide flex-1">{isFrozen ? "Unlock" : "Lock"}</span>
                                    {isFrozen && <span className="text-[10px] text-amber-400 font-bold">LOCKED</span>}
                                </button>
                                );
                            })()}
                            {/* COLOR */}
                            <div>
                                <button
                                    type="button"
                                    className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${showColorPicker ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                    onClick={() => { setShowColorPicker((v) => !v); setShowSwitcher(false); }}
                                >
                                    <SwatchIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Color</span>
                                    <div className="w-5 h-5 border border-white/30 flex-shrink-0" style={{ backgroundColor: noteColor, borderRadius: 4 }} />
                                </button>
                                {showColorPicker && (
                                    <div className="grid grid-cols-7 gap-2 px-5 pb-5 pt-1">
                                        {colorPickerPalette.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                aria-label={`Set color ${c}`}
                                                onClick={() => { setNoteColor(c); setShowColorPicker(false); }}
                                                className="aspect-square w-full transition-all"
                                                style={{
                                                    background: c,
                                                    border: noteColor === c ? `2.5px solid rgba(255,255,255,0.9)` : `1.5px solid rgba(255,255,255,0.15)`,
                                                    boxShadow: noteColor === c ? `0 0 0 2px ${c}80` : "none",
                                                    borderRadius: 4,
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* MOVE */}
                            <div>
                                <button
                                    type="button"
                                    className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${showSwitcher ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                    onClick={() => { const next = !showSwitcher; setShowSwitcher(next); setShowColorPicker(false); if (next) { setFolderSearchQuery(""); setTimeout(() => folderSearchRef.current?.focus(), 50); } }}
                                >
                                    <ArrowRightIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Move</span>
                                    <span className="text-[10px] text-cyan-400 font-bold truncate max-w-[100px]">{targetFolder}</span>
                                </button>
                                {showSwitcher && (() => {
                                    const q = folderSearchQuery.toLowerCase();
                                    const filtered = folderNames.filter((n) => {
                                        if (!n.toLowerCase().includes(q)) return false;
                                        // When no query, only show top-level folders (no parent)
                                        if (!q) {
                                            const row = dbData.find((r) => r.is_folder && r.folder_name === n);
                                            return !row?.parent_folder_name;
                                        }
                                        return true;
                                    });
                                    return (
                                        <div className="px-4 pb-4 flex flex-col gap-1.5">
                                            <input
                                                ref={folderSearchRef}
                                                type="text"
                                                value={folderSearchQuery}
                                                onChange={(e) => {
                                                    setFolderSearchQuery(e.target.value);
                                                    folderSearchCursorRef.current = 0;
                                                    // reset DOM highlights
                                                    folderSearchListRef.current?.querySelectorAll<HTMLElement>("[data-fi]").forEach((el, i) => {
                                                        el.setAttribute("data-fi-active", i === 0 ? "1" : "0");
                                                    });
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const items = folderSearchListRef.current?.querySelectorAll<HTMLElement>("[data-fi]");
                                                        if (!items || items.length === 0) return;
                                                        const next = e.key === "ArrowDown"
                                                            ? Math.min(folderSearchCursorRef.current + 1, items.length - 1)
                                                            : Math.max(folderSearchCursorRef.current - 1, 0);
                                                        folderSearchCursorRef.current = next;
                                                        items.forEach((el, i) => el.setAttribute("data-fi-active", i === next ? "1" : "0"));
                                                        items[next]?.scrollIntoView({ block: "nearest" });
                                                    } else if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        const name = filtered[folderSearchCursorRef.current];
                                                        if (name) moveToFolder(name);
                                                    } else if (e.key === "Escape") {
                                                        setShowSwitcher(false); setFolderSearchQuery("");
                                                        folderSearchCursorRef.current = 0;
                                                    }
                                                }}
                                                placeholder="search folders..."
                                                className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono mb-1"
                                            />
                                            <div ref={folderSearchListRef} className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                                                {filtered.map((name, idx) => {
                                                    const color = folders.find((f) => f.name === name)?.color || palette12[0];
                                                    const folderIcon = folderIcons[name] || "";
                                                    const selected = targetFolder === name;
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            data-fi={idx}
                                                            data-fi-active={idx === 0 ? "1" : "0"}
                                                            onClick={() => moveToFolder(name)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border transition folder-search-item ${selected ? "bg-white/10 border-white/30 text-white" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/5"}`}
                                                        >
                                                            <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black leading-none border border-white/25" style={{ backgroundColor: color, color: "#fff", borderRadius: 4 }}>
                                                                <FolderIconDisplay value={folderIcon} folderName={name} className="w-3 h-3" />
                                                            </span>
                                                            <span className="text-[12px] font-bold truncate flex-1">{name}</span>
                                                            {selected && <CheckIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                                {filtered.length === 0 && <p className="text-[10px] text-zinc-600 px-1 py-2">No folders match</p>}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* VIEW MODE DROPDOWN */}
                            <div className="px-6 py-3 border-b border-white/[0.06]">
                                <div className="flex items-center gap-4 mb-2">
                                    <EyeIcon className="w-5 h-5 flex-shrink-0 text-zinc-400" />
                                    <span className="text-xs font-black tracking-wide flex-1 text-zinc-300">View</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5" style={{ background: `${noteColor}25`, color: noteColor }}>{noteViewMode}</span>
                                </div>
                                <div className="grid grid-cols-3 overflow-hidden" style={{ border: `1px solid ${appTheme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}`, borderRadius: 10 }}>
                                    {(["Text", "Rich", "Checklist"] as const).map((mode, i) => {
                                        const active = noteViewMode === mode;
                                        const disabled = mode !== "Text" && mode !== "Rich" && contentLineCount < 15;
                                        const icon = mode === "Text" ? (
                                            <Bars3Icon className="w-4 h-4" />
                                        ) : mode === "Rich" ? (
                                            <SwatchIcon className="w-4 h-4" />
                                        ) : mode === "Checklist" ? (
                                            <CheckCircleIcon className="w-4 h-4" />
                                        ) : (
                                            <RectangleStackIcon className="w-4 h-4" />
                                        );
                                        return (
                                            <button key={mode} type="button"
                                                disabled={disabled}
                                                onClick={() => {
                                                    if (disabled) return;
                                                    if (mode === "Rich") {
                                                        if (listMode) toggleListMode();
                                                        void switchNoteFormat("rich");
                                                    } else if (mode === "Checklist") {
                                                        if (isRichMode) void switchNoteFormat("text");
                                                        toggleListMode();
                                                    } else {
                                                        if (isRichMode) void switchNoteFormat("text");
                                                        if (listMode) toggleListMode();
                                                        if (mode === "Text") {
                                                            if (htmlMode) toggleHtmlMode();
                                                        }
                                                    }
                                                    if (window.innerWidth < 1024) setShowNoteActions(false);
                                                }}
                                                className={`flex flex-col items-center gap-1.5 py-3 px-1 transition-all text-[10px] font-black${disabled ? " cursor-not-allowed" : ""}`}
                                                style={{
                                                    background: active ? `${noteColor}25` : "transparent",
                                                    color: active ? noteColor : "#71717a",
                                                    borderLeft: i > 0 ? `1px solid ${appTheme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}` : "none",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {icon}
                                                <span>{mode}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>

                        {/* Delete / Discard */}
                        <div className="border-t border-white/10 px-4 py-3 flex justify-center">
                            <button
                                type="button"
                                className="flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition text-xs font-black uppercase tracking-wide"
                                onClick={() => {
                                    setShowNoteActions(false);
                                    closeEditorTools();
                                    setConfirmDelete({
                                        type: "note",
                                        noteId: editingNote?.id ? String(editingNote.id) : null,
                                        noteName: (title.trim() || editingNote?.title || "Untitled").trim(),
                                        noteColor: noteColor || editingNote?.folder_color || "#71717a",
                                    });
                                }}
                            >
                                <TrashIcon className="w-4 h-4 flex-shrink-0" />
                                {editingNote?.id ? "Delete Note" : "Discard Draft"}
                            </button>
                        </div>

                        {/* Close */}
                        <div className="border-t border-white/10 p-4">
                            <button
                                type="button"
                                onClick={() => { setShowNoteActions(false); closeEditorTools(); }}
                                className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-wide hover:bg-zinc-100 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SETTINGS + INTEGRATIONS PANEL (single sliding container) */}
            {showFolderActions && (
                <div className="fixed inset-0 z-[510] flex items-center justify-center p-4 lg:items-stretch lg:justify-end lg:p-0" onClick={() => { setShowFolderActions(false); setIsGlobalSettings(false); setShowIntegrationsPanel(false); setConfiguringIntegration(null); setShowAutomationsPanel(false); setSelectedAutomation(null); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); setShowDefaultFolderPicker(false); }}>
                    <div className="note-actions-panel bg-zinc-900 border border-white/15 w-full max-w-sm flex flex-col overflow-hidden rounded-2xl lg:max-w-[300px] lg:w-[300px] lg:h-full lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:rounded-none relative" onClick={(e) => e.stopPropagation()}>

                        {/* Depth level watermark */}
                        <div className="absolute inset-0 flex items-end justify-end pointer-events-none z-0 overflow-hidden pb-16 pr-4">
                            <span className="text-[160px] font-black text-white/[0.02] select-none leading-none tracking-tighter">
                                {isGlobalSettings ? "APP" : `L${Math.min(folderStack.length + 1, 3)}`}
                            </span>
                        </div>

                        {/* INTEGRATIONS PAGE — slides in from right over settings */}
                        <div className={`absolute inset-0 z-10 flex flex-col bg-zinc-900 transition-transform duration-300 ease-in-out ${showIntegrationsPanel ? "translate-x-0" : "translate-x-full"}`}>
                            {/* Header */}
                            <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                                <button type="button" onClick={() => { setShowIntegrationsPanel(false); setConfiguringIntegration(null); }} className="p-1 -ml-1 text-zinc-400 hover:text-white transition">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                </button>
                                <PuzzlePieceIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-white flex-1">Integrations</h2>
                            </div>
                            {/* List */}
                            <div className="flex-1 overflow-y-auto">
                                {integrationsSnapshot.length === 0 ? (
                                    <div className="px-6 py-10 text-center">
                                        <PuzzlePieceIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                        <p className="text-xs font-black text-zinc-500 uppercase tracking-wide">No integrations configured</p>
                                        <p className="text-[10px] text-zinc-700 mt-1">Connect services via the integrations table in Supabase</p>
                                    </div>
                                ) : (() => {
                                    const TRIGGER_TYPES = ["stickies_api"];
                                    const META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
                                        hue: {
                                            label: "Philips Hue", color: "#FFB800",
                                            icon: <img src="/icons/hue.svg" className="w-full h-full object-cover" alt="Philips Hue" />,
                                        },
                                        stickies_api: {
                                            label: "Stickies API", color: "#007AFF",
                                            icon: <img src="/icons/stickies/android-chrome-192x192.png" className="w-full h-full object-cover" alt="Stickies" />,
                                        },
                                    };
                                    const ALLOWED_TYPES = new Set(["hue"]);
                                    const visible = integrationsSnapshot.filter(ig => ALLOWED_TYPES.has(ig.type));
                                    const triggers = visible.filter(ig => TRIGGER_TYPES.includes(ig.type));
                                    const actions  = visible.filter(ig => !TRIGGER_TYPES.includes(ig.type));

                                    const renderRow = (ig: typeof integrationsSnapshot[0], i: number) => {
                                        const meta = META[ig.type] ?? { label: ig.type, color: "#71717a", icon: <span className="text-xl">🔌</span> };
                                        const isTrigger = TRIGGER_TYPES.includes(ig.type);
                                        return (
                                            <button key={i} type="button"
                                                className="w-full px-5 py-3.5 flex items-center gap-4 text-left hover:bg-white/5 active:bg-white/10 transition"
                                                onClick={async () => {
                                                    setConfiguringIntegration(ig);
                                                    if (ig.type === "hue") {
                                                        setHueGroupsLoading(true);
                                                        fetch("/api/hue/groups", { headers: {  } })
                                                            .then(r => r.json())
                                                            .then(d => { setHueGroups(d.groups ?? []); })
                                                            .catch(() => {})
                                                            .finally(() => setHueGroupsLoading(false));
                                                    }
                                                }}>
                                                {/* Icon */}
                                                <div className="w-9 h-9 flex-shrink-0 overflow-hidden">
                                                    {meta.icon}
                                                </div>
                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-black text-white truncate">{meta.label}</span>
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 flex-shrink-0"
                                                            style={{
                                                                color: isTrigger ? "#38bdf8" : "#fb923c",
                                                                background: isTrigger ? "#38bdf810" : "#fb923c10",
                                                                border: `1px solid ${isTrigger ? "#38bdf830" : "#fb923c30"}`,
                                                            }}>
                                                            {isTrigger ? "↓ Trigger" : "↗ Action"}
                                                        </span>
                                                    </div>
                                                    {isTrigger ? (
                                                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                                                            POST <span className="text-zinc-400">/api/stickies</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                                                            when: <span className="text-zinc-400">{ig.trigger}</span>
                                                            {ig.config?.group_name && <span className="text-zinc-600"> → {ig.config.group_name}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                                <ChevronRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                            </button>
                                        );
                                    };

                                    return (
                                        <>
                                            {triggers.length > 0 && (
                                                <div>
                                                    <div className="px-5 pt-4 pb-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Triggers</div>
                                                    <div className="divide-y divide-white/[0.06]">{triggers.map(renderRow)}</div>
                                                </div>
                                            )}
                                            {actions.length > 0 && (
                                                <div className={triggers.length > 0 ? "mt-3" : ""}>
                                                    <div className="px-5 pt-4 pb-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Actions</div>
                                                    <div className="divide-y divide-white/[0.06]">{actions.map(renderRow)}</div>
                                                </div>
                                            )}
                                            {/* Google Drive */}
                                            <div className="mt-4 border-t border-white/[0.06]">
                                                <div className="px-5 pt-4 pb-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Storage</div>
                                                <button type="button"
                                                    className="w-full px-5 py-3.5 flex items-center gap-4 text-left hover:bg-white/5 active:bg-white/10 transition"
                                                    onClick={async () => {
                                                        const res = await fetch("/api/stickies/gdrive/status", { headers: {  } });
                                                        const { connected } = await res.json().catch(() => ({ connected: false }));
                                                        setGdriveConnected(connected);
                                                        if (connected) {
                                                            // Test actual upload ability
                                                            showToast("Testing upload...", "#a78bfa");
                                                            try {
                                                                const blob = new Blob(["test"], { type: "text/plain" });
                                                                const fd = new FormData();
                                                                fd.append("file", new File([blob], ".stickies-test.txt", { type: "text/plain" }));
                                                                fd.append("folder", "test");
                                                                const testRes = await fetch("/api/stickies/gdrive", { method: "POST", headers: {  }, body: fd });
                                                                if (testRes.ok) { showToast("Google Drive working", "#34C759"); }
                                                                else { showError("Token expired - reconnecting..."); setGdriveConnected(false); window.location.href = "/api/stickies/gdrive/auth"; }
                                                            } catch { showError("Upload test failed"); setGdriveConnected(false); }
                                                        } else {
                                                            window.location.href = "/api/stickies/gdrive/auth";
                                                        }
                                                    }}>
                                                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                                                        <svg viewBox="0 0 87.3 78" className="w-7 h-7"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85z" fill="#ea4335"/><path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h22.5c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="M73.4 26.5 60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.6 25l16.2 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-black text-white flex items-center gap-1.5">Google Drive <span className={`inline-block w-1.5 h-1.5 rounded-full ${gdriveConnected ? "bg-green-400" : "bg-red-400"}`} /></div>
                                                        <div className="text-[10px] text-zinc-500">{gdriveConnected ? "Connected" : "Not connected"}</div>
                                                    </div>
                                                    <ChevronRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                                </button>
                                            </div>
                                            {/* Automations entry */}
                                            <div className="mt-4 border-t border-white/[0.06]">
                                                <div className="px-5 pt-4 pb-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Automations</div>
                                                <button type="button"
                                                    className="w-full px-5 py-3.5 flex items-center gap-4 text-left hover:bg-white/5 active:bg-white/10 transition"
                                                    onClick={async () => {
                                                        setShowAutomationsPanel(true);
                                                        fetch("/api/stickies/automations", { headers: {  } })
                                                            .then(r => r.json())
                                                            .then(d => setAutomationsList(Array.isArray(d) ? d : []))
                                                            .catch(() => {});
                                                    }}>
                                                    <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-purple-500/10">
                                                        <BoltIcon className="w-5 h-5 text-purple-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-black text-white">Automations</div>
                                                        <div className="text-[10px] text-zinc-500">Rules, triggers &amp; logs</div>
                                                    </div>
                                                    <ChevronRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* CONFIGURE SUB-PAGE — slides in from right */}
                            <div className={`absolute inset-0 z-20 flex flex-col bg-zinc-900 transition-transform duration-300 ease-in-out ${configuringIntegration ? "translate-x-0" : "translate-x-full"}`}>
                                {/* Header */}
                                <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                                    <button type="button" onClick={() => setConfiguringIntegration(null)} className="p-1 -ml-1 text-zinc-400 hover:text-white transition">
                                        <ArrowLeftIcon className="w-5 h-5" />
                                    </button>
                                    {configuringIntegration && (() => {
                                        const META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
                                            hue: { label: "Philips Hue", color: "#FFB800", icon: <img src="/icons/hue.svg" className="w-full h-full object-cover" alt="Philips Hue" /> },
                                            stickies_api: { label: "Stickies API", color: "#007AFF", icon: <img src="/icons/stickies/android-chrome-192x192.png" className="w-full h-full object-cover" alt="Stickies" /> },
                                        };
                                        const meta = META[configuringIntegration.type] ?? { label: configuringIntegration.type, color: "#71717a", icon: <span className="text-xl">🔌</span> };
                                        return (
                                            <>
                                                <div className="w-6 h-6 flex-shrink-0 overflow-hidden">{meta.icon}</div>
                                                <h2 className="text-sm font-black uppercase tracking-widest text-white flex-1">{meta.label}</h2>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto">
                                    {configuringIntegration?.type === "hue" && (
                                        <div>
                                            <p className="px-5 pt-5 pb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Target Light Group</p>
                                            {hueGroupsLoading ? (
                                                <div className="px-5 py-8 text-center text-xs text-zinc-500">Loading groups…</div>
                                            ) : hueGroups.length === 0 ? (
                                                <div className="px-5 py-8 text-center text-xs text-zinc-500">No groups found — check Hue bridge connection</div>
                                            ) : (
                                                <div className="divide-y divide-white/[0.06]">
                                                    {hueGroups.map((grp) => {
                                                        const isSelected = configuringIntegration.config?.group_id === grp.id;
                                                        return (
                                                            <button key={grp.id} type="button"
                                                                className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-white/5 active:bg-white/10 transition"
                                                                onClick={async () => {
                                                                    const updatedConfig = { ...(configuringIntegration.config ?? {}), group_id: grp.id, group_name: grp.name };
                                                                    // Update local state immediately
                                                                    setConfiguringIntegration(prev => prev ? { ...prev, config: updatedConfig } : prev);
                                                                    setIntegrationsSnapshot(prev => prev.map(ig =>
                                                                        ig.id === configuringIntegration.id ? { ...ig, config: updatedConfig } : ig
                                                                    ));
                                                                    // Persist to DB
                                                                    if (configuringIntegration.id) {
                                                                        try {
                                                                            await fetch(`/api/stickies/integrations/${configuringIntegration.id}`, {
                                                                                method: "PATCH",
                                                                                headers: {
                                                                                    "Content-Type": "application/json",
                                                                                },
                                                                                body: JSON.stringify({ config: updatedConfig }),
                                                                            });
                                                                        } catch { /* ignore */ }
                                                                    }
                                                                    playSound("move");
                                                                    showToast(`Target set to "${grp.name}"`, "#FFB800");
                                                                }}>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-sm font-bold text-white truncate">{grp.name}</div>
                                                                    <div className="text-[10px] text-zinc-500 capitalize">{grp.type}</div>
                                                                </div>
                                                                {isSelected
                                                                    ? <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                                                    : <div className="w-4 h-4 border border-zinc-600 flex-shrink-0" />
                                                                }
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {configuringIntegration?.type !== "hue" && configuringIntegration && (
                                        <div className="px-5 py-10 text-center text-xs text-zinc-500">No configuration options available</div>
                                    )}
                                </div>
                            </div>

                            {/* AUTOMATIONS PANEL — z-30 */}
                            <div className={`absolute inset-0 z-30 flex flex-col bg-zinc-900 transition-transform duration-300 ease-in-out ${showAutomationsPanel ? "translate-x-0" : "translate-x-full"}`}>
                                <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                                    <button type="button" onClick={() => { setShowAutomationsPanel(false); setSelectedAutomation(null); }} className="p-1 -ml-1 text-zinc-400 hover:text-white transition">
                                        <ArrowLeftIcon className="w-5 h-5" />
                                    </button>
                                    <BoltIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                    <h2 className="text-sm font-black uppercase tracking-widest text-white flex-1">Automations</h2>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {(() => {
                                    const stickyAutomations = automationsList.filter(a => a.trigger_type?.startsWith("note_"));
                                    return stickyAutomations.length === 0 ? (
                                        <div className="px-6 py-10 text-center">
                                            <BoltIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                            <p className="text-xs font-black text-zinc-500 uppercase tracking-wide">No automations yet</p>
                                            <p className="text-[10px] text-zinc-700 mt-1">Run the SQL migration in Supabase to get started</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/[0.06]">
                                            {stickyAutomations.map((auto) => (
                                                <div key={auto.id} className="w-full px-5 py-3.5 flex items-center gap-3">
                                                    {/* Active toggle */}
                                                    <button type="button"
                                                        className="flex-shrink-0"
                                                        onClick={async () => {
                                                            const next = !auto.active;
                                                            setAutomationsList(prev => prev.map(a => a.id === auto.id ? { ...a, active: next } : a));
                                                            await fetch(`/api/stickies/automations/${auto.id}`, {
                                                                method: "PATCH",
                                                                headers: { "Content-Type": "application/json" },
                                                                body: JSON.stringify({ active: next }),
                                                            }).catch(() => {});
                                                        }}>
                                                        <div className="w-9 h-5 rounded-full transition-colors relative" style={{ background: auto.active ? "#22c55e" : (appTheme === "light" ? "#d1d1d6" : "#48484a"), border: appTheme === "light" && !auto.active ? "1px solid rgba(0,0,0,0.1)" : "none" }}>
                                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${auto.active ? "translate-x-5" : "translate-x-1"}`} style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                                                        </div>
                                                    </button>
                                                    {/* Info — tap to open logs */}
                                                    <button type="button" className="flex-1 min-w-0 text-left"
                                                        onClick={async () => {
                                                            setSelectedAutomation(auto);
                                                            setAutomationLogsLoading(true);
                                                            fetch(`/api/stickies/automation-logs?automation_id=${auto.id}&limit=20`, { headers: {  } })
                                                                .then(r => r.json())
                                                                .then(d => setAutomationLogs(Array.isArray(d) ? d : []))
                                                                .catch(() => setAutomationLogs([]))
                                                                .finally(() => setAutomationLogsLoading(false));
                                                        }}>
                                                        <div className="text-xs font-black text-white truncate">{auto.name}</div>
                                                        <div className="text-[10px] text-zinc-500 mt-0.5">
                                                            <span className="text-sky-400/80">{auto.trigger_type}</span>
                                                            <span className="text-zinc-700 mx-1">→</span>
                                                            <span className="text-orange-400/80">{auto.action_type}</span>
                                                            {auto.last_fired && <span className="text-zinc-600 ml-2">{timeAgo(auto.last_fired)}</span>}
                                                        </div>
                                                        {Object.keys(auto.condition ?? {}).length > 0 && (
                                                            <div className="mt-1 flex gap-1 flex-wrap">
                                                                {Object.entries(auto.condition ?? {}).map(([k, v]) => (
                                                                    <span key={k} className="text-[9px] px-1.5 py-0.5 bg-white/5 text-zinc-500 rounded">{k}: {v}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </button>
                                                    <ChevronRightIcon className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                                                </div>
                                            ))}
                                        </div>
                                    );
                                    })()}
                                </div>

                                {/* LOGS PANEL — z-40 */}
                                <div className={`absolute inset-0 z-40 flex flex-col bg-zinc-900 transition-transform duration-300 ease-in-out ${selectedAutomation ? "translate-x-0" : "translate-x-full"}`}>
                                    <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                                        <button type="button" onClick={() => setSelectedAutomation(null)} className="p-1 -ml-1 text-zinc-400 hover:text-white transition">
                                            <ArrowLeftIcon className="w-5 h-5" />
                                        </button>
                                        <h2 className="text-sm font-black uppercase tracking-widest text-white flex-1 truncate">{selectedAutomation?.name ?? "Logs"}</h2>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        {automationLogsLoading ? (
                                            <div className="px-5 py-8 text-center text-xs text-zinc-500">Loading…</div>
                                        ) : automationLogs.length === 0 ? (
                                            <div className="px-6 py-10 text-center">
                                                <p className="text-xs text-zinc-600">No logs yet</p>
                                                <p className="text-[10px] text-zinc-700 mt-1">Logs appear when this automation fires</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-white/[0.04]">
                                                {automationLogs.map((log) => {
                                                    const dot = log.result === "ok" ? "bg-emerald-400" : log.result === "error" ? "bg-red-400" : log.result === "lights_off" ? "bg-amber-400" : "bg-zinc-600";
                                                    const col = log.result === "ok" ? "text-emerald-400" : log.result === "error" ? "text-red-400" : log.result === "lights_off" ? "text-amber-400" : "text-zinc-500";
                                                    return (
                                                        <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                                                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-xs font-black ${col}`}>{log.result}</span>
                                                                    {log.via && <span className="text-[9px] text-zinc-700">via {log.via}</span>}
                                                                    <span className="text-[9px] text-zinc-700 ml-auto">{timeAgo(log.triggered_at)}</span>
                                                                </div>
                                                                {log.detail && <div className="text-[10px] text-zinc-600 mt-0.5 truncate">{log.detail}</div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Header — icon + folder name */}
                        <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
                            {activeFolder && !isGlobalSettings ? (
                                <>
                                    <button type="button"
                                        onClick={() => { setShowFolderColorPicker((v) => !v); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }}
                                        className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-black leading-none overflow-hidden rounded-lg cursor-pointer hover:brightness-110 transition"
                                        style={{ backgroundColor: activeFolder === "CLAUDE" ? "#fff" : (activeFolderColor || "#888"), color: activeFolder === "CLAUDE" ? "#000" : "#fff" }}
                                        title="Change color">
                                        {activeFolder === "CLAUDE" ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-1" /> : <FolderIconDisplay value={activeFolder === "Today" ? "__hero:CalendarDaysIcon" : activeFolder === "All" ? "__hero:Squares2X2Icon" : (folderIcons[activeFolder] || "")} folderName={activeFolder} className="w-4 h-4" />}
                                    </button>
                                    {isEditingFolderTitle ? (
                                        <input autoFocus
                                            className="text-sm font-black text-white bg-transparent outline-none border-b border-white/40 flex-1 min-w-0 pb-0.5"
                                            value={editingFolderTitleValue}
                                            onChange={(e) => setEditingFolderTitleValue(e.target.value)}
                                            onBlur={() => { setIsEditingFolderTitle(false); void renameFolderTo(editingFolderTitleValue); }}
                                            onKeyDown={(e) => { if (e.key === "Enter") { setIsEditingFolderTitle(false); void renameFolderTo(editingFolderTitleValue); } if (e.key === "Escape") setIsEditingFolderTitle(false); }}
                                        />
                                    ) : (
                                        <button type="button" className="text-sm font-black text-white hover:text-zinc-300 transition text-left truncate flex-1 min-w-0"
                                            onClick={() => { setEditingFolderTitleValue(activeFolder); setIsEditingFolderTitle(true); }}>
                                            {activeFolder}
                                        </button>
                                    )}
                                </>
                            ) : (<>
                                <h2 className="text-sm font-black uppercase tracking-widest text-white flex-1">Stickies</h2>
                                <button type="button" title="Open Today's workspace"
                                    onClick={() => {
                                        setShowFolderActions(false); setIsGlobalSettings(false);
                                        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                                        const latest = dbData
                                            .filter(n => !n.is_folder && !n.trashed_at && new Date(n.updated_at || n.created_at || 0) >= todayStart)
                                            .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
                                        if (latest.length > 0) {
                                            const note = latest[0];
                                            if (note.folder_name) {
                                                const fr = dbData.find(r => r.is_folder && r.folder_name === note.folder_name);
                                                if (fr) enterFolder({ id: String(fr.id), name: note.folder_name, color: fr.folder_color || "#888" });
                                            }
                                            void openNote(note);
                                        } else { showToast("No notes today"); }
                                    }}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                                </button>
                            </>)}
                        </div>
                        {/* Color swatches — shown below header when icon is clicked */}
                        {activeFolder && !isGlobalSettings && showFolderColorPicker && (
                            <div className="border-b border-white/10 px-5 py-3">
                                <div className="grid grid-cols-7 gap-2">
                                    {colorPickerPalette.map((c) => (
                                        <button key={c} type="button"
                                            onClick={() => { applySingleFolderColor(c); setShowFolderColorPicker(false); }}
                                            className="aspect-square w-full transition-all"
                                            style={{
                                                background: c,
                                                border: activeFolderColor === c ? `2.5px solid rgba(255,255,255,0.9)` : `1.5px solid rgba(255,255,255,0.15)`,
                                                boxShadow: activeFolderColor === c ? `0 0 0 2px ${c}80` : "none",
                                                borderRadius: 4,
                                            }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col divide-y divide-white/10 overflow-y-auto flex-1">
                            {/* ICON ROW */}
                            {activeFolder && !isGlobalSettings && (
                                <div>
                                    <button type="button"
                                        onClick={() => { setShowFolderIconPicker((v) => !v); setShowFolderColorPicker(false); setShowFolderMovePicker(false); }}
                                        className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition">
                                        <FolderIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black tracking-wide flex-1">Icon</span>
                                        <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black border border-white/40" style={{ borderRadius: 4 }}>
                                            <FolderIconDisplay value={folderIcons[activeFolder] || ""} folderName={activeFolder} className="w-4 h-4" />
                                        </span>
                                    </button>
                                    {showFolderIconPicker && (() => {
                                        const q = iconPickerSearch.toLowerCase();
                                        const curIcon = folderIcons[activeFolder] || "";
                                        const selectIcon = (val: string) => { setFolderIcons((prev) => ({ ...prev, [activeFolder]: val })); void saveFolderIconToDb(activeFolder, val); setShowFolderIconPicker(false); setIconPickerSearch(""); };
                                        const clearIcon = () => { setFolderIcons((prev) => { const next = { ...prev }; delete next[activeFolder]; return next; }); void saveFolderIconToDb(activeFolder, ""); setShowFolderIconPicker(false); setIconPickerSearch(""); };
                                        const filteredHero = FOLDER_HERO_ICONS.filter(e => !q || e.label.includes(q) || e.key.toLowerCase().includes(q));
                                        return (
                                            <div className="px-4 pb-4">
                                                <div className="flex gap-1 mb-3 border-b border-white/10 pb-2">
                                                    <span className="px-3 py-1 text-[11px] font-black tracking-wide text-white">ICONS</span>
                                                    <button type="button" onClick={clearIcon} className="ml-auto px-3 py-1 text-[11px] font-black tracking-wide text-zinc-600 hover:text-zinc-300 transition-colors">NONE</button>
                                                </div>
                                                <input type="text" value={iconPickerSearch} onChange={e => setIconPickerSearch(e.target.value)} placeholder="Search..." className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 font-mono mb-2 rounded-lg" />
                                                <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto">
                                                    {filteredHero.map(({ key, label, Icon }) => {
                                                        const val = `__hero:${key}`;
                                                        return (
                                                            <button key={key} type="button" title={label} onClick={() => selectIcon(val)}
                                                                className={`aspect-square flex items-center justify-center transition-all hover:bg-white/15 rounded ${curIcon === val ? "bg-white/20 ring-1 ring-white/60" : ""}`}>
                                                                <Icon className="w-4 h-4 text-white" />
                                                            </button>
                                                        );
                                                    })}
                                                    {filteredHero.length === 0 && <p className="col-span-8 text-[10px] text-zinc-600 py-2 text-center">No icons match</p>}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            {/* NEW SUBFOLDER */}
                            {activeFolder && !isGlobalSettings && (<>
                                <button type="button"
                                    className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => { if (activeFolder) togglePinFolder(activeFolder); }}>
                                    {pinnedFolders.has(activeFolder || "") ? <HeartSolidIcon className="w-5 h-5 flex-shrink-0 text-red-400" /> : <HeartIcon className="w-5 h-5 flex-shrink-0" />}
                                    <span className="text-xs font-black tracking-wide">{pinnedFolders.has(activeFolder || "") ? "Unpin" : "Pin"}</span>
                                </button>
                                <button type="button"
                                    className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => { setShowFolderActions(false); openCreateFolder(); }}>
                                    <span className="relative flex-shrink-0 w-5 h-5">
                                        <FolderIcon className="w-5 h-5" />
                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white text-black flex items-center justify-center" style={{ fontSize: 8, fontWeight: 900, lineHeight: 1 }}>+</span>
                                    </span>
                                    <span className="text-xs font-black tracking-wide">New Folder</span>
                                </button>
                            </>)}
                            {/* MOVE FOLDER */}
                            {activeFolder && !isGlobalSettings && (
                                <div>
                                    <button type="button"
                                        onClick={() => { setShowFolderMovePicker((v) => !v); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setTimeout(() => folderMoveSearchRef.current?.focus(), 50); }}
                                        className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition">
                                        <ArrowRightIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black tracking-wide flex-1">Move</span>
                                    </button>
                                    {showFolderMovePicker && (() => {
                                        const q = folderMoveQuery.toLowerCase();
                                        const moveTargets = folderNames.filter((n) => {
                                            if (n === activeFolder || !n.toLowerCase().includes(q)) return false;
                                            if (!q) {
                                                const row = dbData.find((r) => r.is_folder && r.folder_name === n);
                                                return !row?.parent_folder_name;
                                            }
                                            return true;
                                        });
                                        return (
                                            <div className="px-4 pb-4 flex flex-col gap-1.5">
                                                <input
                                                    ref={folderMoveSearchRef}
                                                    type="text"
                                                    value={folderMoveQuery}
                                                    onChange={(e) => {
                                                        setFolderMoveQuery(e.target.value);
                                                        folderMoveCursorRef.current = 0;
                                                        folderMoveListRef.current?.querySelectorAll<HTMLElement>("[data-fi]").forEach((el, i) => {
                                                            el.setAttribute("data-fi-active", i === 0 ? "1" : "0");
                                                        });
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                                            e.preventDefault(); e.stopPropagation();
                                                            const items = folderMoveListRef.current?.querySelectorAll<HTMLElement>("[data-fi]");
                                                            if (!items || items.length === 0) return;
                                                            const next = e.key === "ArrowDown"
                                                                ? Math.min(folderMoveCursorRef.current + 1, items.length - 1)
                                                                : Math.max(folderMoveCursorRef.current - 1, 0);
                                                            folderMoveCursorRef.current = next;
                                                            items.forEach((el, i) => el.setAttribute("data-fi-active", i === next ? "1" : "0"));
                                                            items[next]?.scrollIntoView({ block: "nearest" });
                                                        } else if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            const name = moveTargets[folderMoveCursorRef.current];
                                                            if (name) void moveFolderToParent(name);
                                                        } else if (e.key === "Escape") {
                                                            setShowFolderMovePicker(false); setFolderMoveQuery("");
                                                            folderMoveCursorRef.current = 0;
                                                        }
                                                    }}
                                                    placeholder="search folders..."
                                                    className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono mb-1"
                                                />
                                                <div ref={folderMoveListRef} className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                                                    <button type="button"
                                                        onClick={() => void moveFolderToParent(null)}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left border border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5 transition">
                                                        <span className="text-[12px] font-bold truncate flex-1">Root</span>
                                                    </button>
                                                    {moveTargets.map((name, idx) => {
                                                        const color = folders.find((f) => f.name === name)?.color || palette12[0];
                                                        const iconVal = folderIcons[name] || "";
                                                        return (
                                                            <button key={name} type="button"
                                                                data-fi={idx}
                                                                data-fi-active={idx === 0 ? "1" : "0"}
                                                                onClick={() => void moveFolderToParent(name)}
                                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left border transition folder-search-item border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5">
                                                                <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black leading-none border border-white/25" style={{ backgroundColor: color, color: "#fff", borderRadius: 4 }}>
                                                                    <FolderIconDisplay value={iconVal} folderName={name} className="w-3 h-3" />
                                                                </span>
                                                                <span className="text-[12px] font-bold truncate flex-1">{name}</span>
                                                            </button>
                                                        );
                                                    })}
                                                    {moveTargets.length === 0 && <p className="text-[10px] text-zinc-600 px-1 py-2">No folders match</p>}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            {/* EMPTY TRASH (TRASH folder only) */}
                            {activeFolder === "TRASH" && !isGlobalSettings && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition"
                                    onClick={() => { setShowFolderActions(false); setConfirmDelete({ type: "folder", folderName: "TRASH" }); }}>
                                    <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide">Empty Trash</span>
                                </button>
                            )}
                            {/* DELETE FOLDER (non-TRASH folders only) */}
                            {activeFolder && activeFolder !== "TRASH" && !isGlobalSettings && canDeleteActiveFolder && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition"
                                    onClick={() => { setShowFolderActions(false); setConfirmDelete({ type: "folder", folderName: activeFolder }); }}>
                                    <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide">Delete</span>
                                </button>
                            )}
                            {/* Global App Settings — shown when gear is clicked or at root level */}
                            {(folderStack.length === 0 || isGlobalSettings) && (<>
                                {/* DEFAULT NOTEBOOK */}
                                {(() => {
                                    const df = folders.find(f => f.name === defaultFolder);
                                    const dfColor = df?.color;
                                    return (
                                        <div className="px-6 py-2 border-b border-white/[0.06]">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Default Notebook</p>
                                            <button type="button"
                                                onClick={(e) => { e.stopPropagation(); setShowDefaultFolderPicker(v => !v); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition rounded"
                                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                                {dfColor ? (
                                                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[11px] font-black leading-none overflow-hidden rounded" style={{ backgroundColor: defaultFolder === "CLAUDE" ? "#fff" : dfColor, color: isLightColor(dfColor) ? "#1c1c1e" : "#fff", fontSize: 13 }}>
                                                        {defaultFolder === "CLAUDE"
                                                            ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                            : <FolderIconDisplay value={folderIcons[defaultFolder] || ""} folderName={defaultFolder || "F"} className="w-3.5 h-3.5" />}
                                                    </span>
                                                ) : <span className="w-5 h-5 flex-shrink-0" />}
                                                <span className="text-xs font-bold flex-1 truncate text-white">{defaultFolder || "None"}</span>
                                                <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                            </button>
                                            {showDefaultFolderPicker && (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {folders.filter(f => f.name && !(f as any).parent_folder_name && f.name !== defaultFolder).map(f => (
                                                        <button key={f.name} type="button"
                                                            onClick={(e) => { e.stopPropagation(); setDefaultFolder(f.name); localStorage.setItem(DEFAULT_FOLDER_KEY, f.name); setShowDefaultFolderPicker(false); setShowFolderActions(false); }}
                                                            className="flex items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-white/5 rounded">
                                                            <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[11px] font-black leading-none overflow-hidden rounded" style={{ backgroundColor: f.name === "CLAUDE" ? "#fff" : f.color, color: isLightColor(f.color) ? "#1c1c1e" : "#fff", fontSize: 13, border: f.name === "CLAUDE" || isLightColor(f.color) ? "1px solid rgba(0,0,0,0.15)" : "none" }}>
                                                                {f.name === "CLAUDE"
                                                                    ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                                    : <FolderIconDisplay value={folderIcons[f.name] || ""} folderName={f.name || "F"} className="w-3.5 h-3.5" />}
                                                            </span>
                                                            <span className="text-xs font-bold flex-1 truncate text-zinc-400 uppercase">{f.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                {/* THEME */}
                                <div className="px-6 py-3 border-b border-white/[0.06]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Theme</p>
                                    {/* iOS-style segmented control — a defined track so the buttons
                                        never blend into the white modal in light mode. */}
                                    <div className="flex gap-1 p-1 rounded-xl"
                                        style={{
                                            background: appTheme === "light" ? "#e8e8ed" : "rgba(255,255,255,0.06)",
                                            border: appTheme === "light" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
                                        }}>
                                        {(["auto", "light", "dark"] as const).map((mode) => {
                                            const selected = appThemeMode === mode;
                                            return (
                                            <button key={mode} type="button"
                                                onClick={() => setAppThemeMode(mode)}
                                                className="flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition"
                                                style={selected
                                                    ? {
                                                        background: appTheme === "light" ? "#ffffff" : "#3a3a3c",
                                                        color: appTheme === "light" ? "#1a1a1a" : "#ffffff",
                                                        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                                                    }
                                                    : {
                                                        background: "transparent",
                                                        color: appTheme === "light" ? "#6b7280" : "#a1a1aa",
                                                    }}>
                                                {mode === "auto" ? "Auto" : mode === "light" ? "Light" : "Dark"}
                                            </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* TODAY TABS */}
                                <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                    <span className="text-xs font-black tracking-wide text-zinc-300">Today Tabs</span>
                                    <button type="button"
                                        onClick={() => { const v = !showTabs; setShowTabs(v); try { localStorage.setItem("stickies:show-tabs:v1", String(v)); } catch {} }}
                                        className="relative w-11 h-6 rounded-full transition-colors duration-200"
                                        style={{ background: showTabs ? "#22c55e" : (appTheme === "light" ? "#d1d1d6" : "#48484a"), border: appTheme === "light" && !showTabs ? "1px solid rgba(0,0,0,0.1)" : "none" }}>
                                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200" style={{ transform: showTabs ? "translateX(20px)" : "translateX(0)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                                    </button>
                                </div>
                                {/* SUB-FOLDER ICONS */}
                                <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between">
                                    <span className="text-xs font-black tracking-wide text-zinc-300">Sub-folder Icons</span>
                                    <button type="button"
                                        onClick={() => { const v = !showFileIcons; setShowFileIcons(v); try { localStorage.setItem(SHOW_FILE_ICONS_KEY, String(v)); } catch {} }}
                                        className="relative w-11 h-6 rounded-full transition-colors duration-200"
                                        style={{ background: showFileIcons ? "#22c55e" : (appTheme === "light" ? "#d1d1d6" : "#48484a"), border: appTheme === "light" && !showFileIcons ? "1px solid rgba(0,0,0,0.1)" : "none" }}>
                                        <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200" style={{ transform: showFileIcons ? "translateX(20px)" : "translateX(0)", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                                    </button>
                                </div>
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => { setIntegrationsSnapshot([...integrationsRef.current]); setShowIntegrationsPanel(true); }}>
                                    <PuzzlePieceIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Integrations</span>
                                    <div className="flex items-center gap-2">
                                        {integrationsRef.current.length > 0 && (
                                            <span className="text-[10px] font-black text-emerald-400">{integrationsRef.current.length} active</span>
                                        )}
                                        <ArrowRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                    </div>
                                </button>
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={async () => { setShowFolderActions(false); setIsGlobalSettings(false); setShowImportGuide(true); if (!importApiKey) { try { const res = await fetch("/api/stickies?apikey=1"); if (res.ok) { const { key } = await res.json(); setImportApiKey(key); } } catch {} } }}>
                                    <RobotIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">AI Import Guide</span>
                                    <ArrowRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                </button>
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => { setShowFolderActions(false); setIsGlobalSettings(false); enterFolder({ id: String(dbData.find(r => r.is_folder && r.folder_name === "TRASH")?.id || ""), name: "TRASH", color: "#8E8E93" }); }}>
                                    <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Trash</span>
                                    <div className="flex items-center gap-2">
                                        {(() => { const tc = dbData.filter(r => !r.is_folder && r.folder_name === "TRASH").length; return tc > 0 ? <span className="text-[10px] font-black text-red-400">{tc}</span> : null; })()}
                                        <ArrowRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                    </div>
                                </button>
                            </>)}
                        </div>
                        <div className="border-t border-white/10 p-4 flex gap-3">
                            <button type="button" onClick={() => { setShowFolderActions(false); setIsGlobalSettings(false); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }}
                                className="flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-wide transition"
                                style={appTheme === "light"
                                    ? { background: "#f4f4f5", color: "#1a1a1a", border: "1px solid rgba(0,0,0,0.12)" }
                                    : { background: "#ffffff", color: "#000000" }}>Close</button>
                            {(folderStack.length === 0 || isGlobalSettings) && (
                                <button type="button"
                                    onClick={async () => {
                                        setShowFolderActions(false);
                                        setIsGlobalSettings(false);
                                        const farewells = ["Later!", "See ya!", "Peace out!", "Catch you later!", "Adios!", "So long!", "Bye for now!", "Take care!", "Until next time!"];
                                        showToast(farewells[Math.floor(Math.random() * farewells.length)]);
                                        await fetch("/api/stickies/logout", { method: "POST" });
                                        setTimeout(() => { window.location.href = "/sign-in"; }, 1800);
                                    }}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition font-black uppercase text-xs tracking-wide">
                                    <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
                                    Sign Out
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CMD+K SEARCH PALETTE */}
            <CmdKPalette
                showCmdK={showCmdK} setShowCmdK={setShowCmdK}
                cmdKQuery={cmdKQuery} setCmdKQuery={setCmdKQuery}
                cmdKCursor={cmdKCursor} setCmdKCursor={setCmdKCursor}
                cmdKGlobal={cmdKGlobal} setCmdKGlobal={setCmdKGlobal}
                cmdKInFile={cmdKInFile} cmdKInputRef={cmdKInputRef}
                cmdKResults={cmdKResults} openNoteFromCmdK={openNoteFromCmdK}
                openAllFromCmdK={openAllFromCmdK}
                activeFolder={activeFolder} dbData={dbData} pinnedIds={pinnedIds}
                enterFolder={enterFolder} loadFolderNotes={loadFolderNotes}
            />



            {qrModalOpen && (
                <QrModal
                    qrType={qrType}
                    qrData={qrData}
                    accentColor={activeAccentColor}
                    copied={qrLinkCopied}
                    onCopy={async () => {
                        await secureCopy(qrData);
                        setQrLinkCopied(true);
                        setTimeout(() => setQrLinkCopied(false), 2500);
                    }}
                    onClose={() => { setQrModalOpen(false); setQrLinkCopied(false); }}
                />
            )}


            {sharePickerOpen && (() => {
                const iconColor = appTheme === "light" ? "text-black" : "text-white";
                const shareBtn = `w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition hover:brightness-110 active:scale-95 ${iconColor}`;
                return (
                <div className="fixed inset-0 z-[520] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSharePickerOpen(false)}>
                    <div
                        className="bg-zinc-900 w-full max-w-sm flex flex-col overflow-hidden rounded-2xl"
                        style={{ border: `2px solid ${activeAccentColor}` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Share Note</p>
                            <p className="text-xs font-black text-white truncate mt-0.5">{title.trim() || editingNote?.title || "Untitled"}</p>
                        </div>

                        {/* Public toggle */}
                        {(() => {
                            const isOn = !!(editingNote?.is_public);
                            return (
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                                <div className="flex-1">
                                    <p className="text-xs font-black text-white tracking-wide">Public</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">
                                        {publicLinkCopied ? "Link copied to clipboard ✓" : "Anyone with the link can view"}
                                    </p>
                                </div>
                                {/* Toggle switch */}
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isOn}
                                    onClick={() => {
                                        const noteId = editingNote?.id ? String(editingNote.id) : "";
                                        if (!noteId) return;
                                        const newPublic = !isOn;
                                        // Turning Public off also releases the lock + clears the
                                        // password - a locked-but-unshared note serves no purpose,
                                        // matching the "lock = freeze for sharing" mental model.
                                        // Server clears lock_password_hash whenever locked goes false.
                                        const fields: Record<string, unknown> = { is_public: newPublic };
                                        if (!newPublic) fields.locked = false;
                                        void notesApi.update(noteId, fields);
                                        setEditingNote((prev: any) => prev ? { ...prev, is_public: newPublic, ...(newPublic ? {} : { locked: false }) } : prev);
                                        setDbData((prev: any[]) => prev.map((r: any) => String(r.id) === noteId ? { ...r, is_public: newPublic, ...(newPublic ? {} : { locked: false }) } : r));
                                        if (newPublic) {
                                            const prodBase = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://stickies-bheng.vercel.app";
                                            const url = `${prodBase}/share?noteId=${noteId}&theme=${appTheme === "dark" ? "dark" : "light"}`;
                                            secureCopy(url).then(() => {
                                                setPublicLinkCopied(true);
                                                setTimeout(() => setPublicLinkCopied(false), 3000);
                                            });
                                        }
                                    }}
                                    className="flex-shrink-0 relative transition-all duration-200"
                                    style={{
                                        width: 44,
                                        height: 26,
                                        borderRadius: 13,
                                        background: isOn ? "#22c55e" : (appTheme === "light" ? "#d1d1d6" : "#48484a"),
                                        border: appTheme === "light" && !isOn ? "1px solid rgba(0,0,0,0.1)" : "none",
                                        cursor: "pointer",
                                        padding: 0,
                                    }}
                                >
                                    <span style={{
                                        position: "absolute",
                                        top: 3,
                                        left: isOn ? 21 : 3,
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        background: "#fff",
                                        transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                    }} />
                                </button>
                            </div>
                            );
                        })()}

                        {/* Private toggle — passcode-gates the public share link (visibility only,
                            does NOT write-protect; that's the separate note Lock in the actions menu) */}
                        {(() => {
                            const isLocked = !!(editingNote?.locked);
                            return (
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                                <div className="flex-1">
                                    <p className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                                        {isLocked ? <LockClosedIcon className="w-3 h-3 text-sky-400" /> : <LockOpenIcon className="w-3 h-3" />}
                                        Private
                                    </p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">{isLocked ? "Passcode required to open the link" : "Require a passcode to view"}</p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isLocked}
                                    onClick={() => {
                                        const noteId = editingNote?.id ? String(editingNote.id) : "";
                                        if (!noteId) return;
                                        const newLocked = !isLocked;
                                        const wasPublic = !!(editingNote?.is_public);

                                        // Locking → ask for a password that gates the public /raw link.
                                        // Empty password is allowed = "share without a gate" (write-protect only).
                                        let lockPassword: string | null = null;
                                        if (newLocked) {
                                            const entered = window.prompt("Set a password for the share link (leave blank for no password):", "");
                                            if (entered === null) return; // user cancelled
                                            lockPassword = entered.trim();
                                        }

                                        // Locking a note implies "freeze it for sharing", so flip
                                        // is_public on at the same time if it wasn't already and copy
                                        // the share link. Unlocking leaves is_public alone - never
                                        // surprise-unpublish a link the user may have already shared.
                                        const fields: Record<string, unknown> = { locked: newLocked };
                                        if (newLocked && !wasPublic) fields.is_public = true;
                                        if (newLocked) fields.lock_password = lockPassword ?? "";
                                        void notesApi.update(noteId, fields);
                                        setEditingNote((prev: any) => prev ? { ...prev, locked: newLocked, ...(newLocked && !wasPublic ? { is_public: true } : {}) } : prev);
                                        setDbData((prev: any[]) => prev.map((r: any) => String(r.id) === noteId ? { ...r, locked: newLocked, ...(newLocked && !wasPublic ? { is_public: true } : {}) } : r));
                                        const lockLabel = newLocked
                                            ? (wasPublic ? "Private — passcode required" : "Private + shared")
                                            : "Public — no passcode";
                                        showToast(lockLabel, newLocked ? "#0ea5e9" : "#22c55e");
                                        if (newLocked && !wasPublic) {
                                            const prodBase = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://stickies-bheng.vercel.app";
                                            const url = `${prodBase}/share?noteId=${noteId}&theme=${appTheme === "dark" ? "dark" : "light"}`;
                                            secureCopy(url).then(() => {
                                                setPublicLinkCopied(true);
                                                setTimeout(() => setPublicLinkCopied(false), 3000);
                                            });
                                        }
                                    }}
                                    className="flex-shrink-0 relative transition-all duration-200"
                                    style={{
                                        width: 44, height: 26, borderRadius: 13,
                                        background: isLocked ? "#0ea5e9" : (appTheme === "light" ? "#d1d1d6" : "#48484a"),
                                        border: appTheme === "light" && !isLocked ? "1px solid rgba(0,0,0,0.1)" : "none",
                                        cursor: "pointer", padding: 0,
                                    }}
                                >
                                    <span style={{
                                        position: "absolute", top: 3, left: isLocked ? 21 : 3,
                                        width: 20, height: 20, borderRadius: "50%", background: "#fff",
                                        transition: "left 0.2s cubic-bezier(0.4,0,0.2,1)",
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                    }} />
                                </button>
                            </div>
                            );
                        })()}

                        {/* Link row — Copy · Curl · QR · Data */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Link</p>
                            <button type="button"
                                onClick={() => {
                                    const noteId = editingNote?.id ? String(editingNote.id) : "";
                                    if (!noteId) return;
                                    // A copied /raw link is useless if the note isn't public, so
                                    // auto-publish before copying - the link always resolves.
                                    if (!editingNote?.is_public) {
                                        void notesApi.update(noteId, { is_public: true });
                                        setEditingNote((prev: any) => prev ? { ...prev, is_public: true } : prev);
                                        setDbData((prev: any[]) => prev.map((r: any) => String(r.id) === noteId ? { ...r, is_public: true } : r));
                                    }
                                    const prodBase = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://stickies-bheng.vercel.app";
                                    const url = `${prodBase}/share?noteId=${noteId}&theme=${appTheme === "dark" ? "dark" : "light"}`;
                                    secureCopy(url).then(() => {
                                        setPublicLinkCopied(true);
                                        setTimeout(() => setPublicLinkCopied(false), 3000);
                                        showToast("Link copied", noteColor || "#34C759");
                                    });
                                    setSharePickerOpen(false);
                                }}
                                className={`${shareBtn} bg-blue-500`} title="Copy public link">
                                <DocumentDuplicateIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Copy</span>
                            </button>
                            <button type="button"
                                onClick={() => {
                                    const noteId = editingNote?.id ? String(editingNote.id) : "";
                                    if (!noteId) return;
                                    // Auto-publish then copy a ready-to-run pipe command - the note
                                    // serves verbatim at /raw (no ?as=text needed for non-HTML).
                                    if (!editingNote?.is_public) {
                                        void notesApi.update(noteId, { is_public: true });
                                        setEditingNote((prev: any) => prev ? { ...prev, is_public: true } : prev);
                                        setDbData((prev: any[]) => prev.map((r: any) => String(r.id) === noteId ? { ...r, is_public: true } : r));
                                    }
                                    const prodBase = process.env.NEXT_PUBLIC_APP_BASE_URL || "https://stickies-bheng.vercel.app";
                                    const cmd = `curl -s "${prodBase}/share?noteId=${noteId}"`;
                                    secureCopy(cmd).then(() => {
                                        setPublicLinkCopied(true);
                                        setTimeout(() => setPublicLinkCopied(false), 3000);
                                        showToast("curl command copied", noteColor || "#34C759");
                                    });
                                    setSharePickerOpen(false);
                                }}
                                className={`${shareBtn} bg-violet-500`} title="Copy curl command (raw, pipeable)">
                                <CommandLineIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Curl</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); openNoteLinkQr(); }} className={`${shareBtn} bg-emerald-500`} title="QR link">
                                <QrCodeIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">QR</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); openNoteDataQr(); }} className={`${shareBtn} bg-pink-500`} title="QR data">
                                <CodeBracketIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Data</span>
                            </button>
                        </div>

                        {/* Download row — full-length PNG of the note */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Download</p>
                            <button type="button" onClick={() => { void downloadNotePng(); }}
                                className={`${shareBtn} bg-violet-500`} title="Download the entire note as a PNG (full scroll height)">
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">PNG</span>
                            </button>
                        </div>

                        <button type="button"
                            onClick={() => setSharePickerOpen(false)}
                            className="mx-5 my-4 py-2.5 rounded-xl border border-white/15 text-zinc-400 font-black uppercase text-xs tracking-wide hover:border-white/30 hover:text-white transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
                );
            })()}

            {/* AI content replace confirmation */}
            {aiConfirmPending && (
                <div className="fixed inset-0 z-[620] bg-black/90 flex items-center justify-center p-4" onClick={() => setAiConfirmPending(null)}>
                    <div className="bg-zinc-900 border-2 border-purple-500 p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center" style={{ background: "#7c3aed", borderRadius: 8 }}>
                            <BoltIcon className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-base font-black text-white mb-1">{aiConfirmPending === "grammar" ? "Fix Grammar" : "AI Magic"}</p>
                        <p className="text-[11px] text-zinc-400 mb-5">This will replace the current note content.</p>
                        <div className="flex flex-col gap-2">
                            <button type="button"
                                onClick={() => { setAiConfirmPending(null); if (aiConfirmPending === "grammar") void runAiGrammarFix(); else void executeAiPrompt(); }}
                                className="w-full py-3 bg-purple-600 text-white font-black uppercase text-xs tracking-widest hover:bg-purple-500 transition">
                                Continue
                            </button>
                            <button type="button" onClick={() => setAiConfirmPending(null)} className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-widest">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI IMPORT GUIDE MODAL */}
            {showImportGuide && (() => {
                const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://stickies-bheng.vercel.app";
                const copyBlock = (text: string) => { void secureCopy(text); showToast("Copied", noteColor || "#34C759"); };
                const CodeBlock = ({ label, text, color = "text-emerald-400" }: { label: string; text: string; color?: string }) => (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
                        <div className="relative group/cb">
                            <pre className={`bg-black/40 px-3 py-2 rounded-lg text-xs font-mono ${color} overflow-x-auto whitespace-pre-wrap`}>{text}</pre>
                            <button type="button" onClick={() => copyBlock(text)} className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white opacity-0 group-hover/cb:opacity-100 transition">Copy</button>
                        </div>
                    </div>
                );
                const maskedKey = importApiKey ? importApiKey.slice(0, 8) + "..." + importApiKey.slice(-4) : "loading...";
                return (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowImportGuide(false)}>
                    <div className="w-full max-w-lg bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-6 pt-6 pb-3 flex items-center gap-3 border-b border-white/10">
                            <RobotIcon className="w-6 h-6 text-white" />
                            <h3 className="text-lg font-bold text-white flex-1">AI Import Guide</h3>
                            <button type="button" onClick={() => copyBlock(importApiKey)} className="px-2 py-1 rounded text-[10px] font-bold bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white transition">Copy Key</button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-zinc-300 space-y-4" style={{ scrollbarWidth: "thin" }}>
                            <CodeBlock label="Endpoint" text={`POST ${baseUrl}/api/stickies/ext`} />
                            <CodeBlock label="API Key" text={maskedKey} color="text-yellow-400" />
                            <CodeBlock label="Auth Header" text={`Authorization: Bearer ${importApiKey || "<STICKIES_API_KEY>"}`} color="text-yellow-400" />
                            <CodeBlock label="JSON Body" text={`{
  "title": "My Note Title",
  "content": "<h1>Heading</h1><p>Body text here...</p>",
  "type": "html",
  "folder_name": "CLAUDE",
  "folder_color": "#AF52DE",
  "tags": ["ai", "report"]
}`} color="text-blue-300" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Folder Targeting</p>
                                <ul className="space-y-1 text-xs text-zinc-400">
                                    <li><span className="text-white font-bold">folder_name</span> — target folder. Use <code className="text-emerald-400">/</code> for subfolders:</li>
                                    <li className="pl-3"><code className="text-emerald-400">"Reporting"</code> → root folder</li>
                                    <li className="pl-3"><code className="text-emerald-400">"Today/PM2026"</code> → PM2026 inside Today</li>
                                    <li className="pl-3"><code className="text-emerald-400">"Work/Team/Sprint"</code> → deep nesting (auto-creates missing folders)</li>
                                    <li><span className="text-white font-bold">Default:</span> <code className="text-emerald-400">CLAUDE</code> if omitted</li>
                                    <li><span className="text-white font-bold">folder_color</span> — hex color (e.g. <code className="text-emerald-400">"#FF3B30"</code>)</li>
                                </ul>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Supported Types</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {["text", "checklist", "json", "javascript", "typescript", "python", "css", "sql", "bash", "html"].map(t => (
                                        <span key={t} className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-zinc-300">{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">HTML Notes</p>
                                <ul className="space-y-1 text-xs text-zinc-400">
                                    <li>Send self-contained HTML with inline <code className="text-emerald-400">style="..."</code> (no <code className="text-emerald-400">&lt;style&gt;</code> block)</li>
                                    <li>Use <code className="text-emerald-400">max-width:100%</code> so it reads well on mobile</li>
                                    <li>Real <code className="text-emerald-400">&lt;table&gt;</code> for tabular / status data</li>
                                    <li>Plain <code className="text-emerald-400">text</code> is the other accepted format</li>
                                </ul>
                            </div>
                            <CodeBlock label="CLI Example" text={`stickies "My quick note" --path=/AI
echo "content" | stickies --title="Note" --tags=ai
stickies --file ./report.html --path=/Reporting`} color="text-cyan-300" />
                            <CodeBlock label="cURL — Root Folder" text={`curl -X POST \\
  ${baseUrl}/api/stickies/ext \\
  -H "Authorization: Bearer ${importApiKey || "$STICKIES_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Weekly Report",
    "content": "<h2>Summary</h2><ul><li>Item 1</li><li>Item 2</li></ul>",
    "type": "html",
    "folder_name": "Reporting"
  }'`} color="text-orange-300" />
                            <CodeBlock label="cURL — Subfolder (auto-creates if missing)" text={`curl -X POST \\
  ${baseUrl}/api/stickies/ext \\
  -H "Authorization: Bearer ${importApiKey || "$STICKIES_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Sprint Retro",
    "content": "<h2>Retro Notes</h2><ul><li>What went well</li><li>What to improve</li></ul>",
    "type": "html",
    "folder_name": "Today/PM2026"
  }'`} color="text-cyan-300" />
                        </div>
                        <div className="px-6 pb-6 pt-3">
                            <button type="button" onClick={() => setShowImportGuide(false)} className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-100 transition">Close</button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* EMPTY TRASH MODAL */}
            {showEmptyTrashModal && (() => {
                const trashNotes = dbData.filter(r => !r.is_folder && r.folder_name === "TRASH");
                return (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowEmptyTrashModal(false)}>
                        <div className="w-full max-w-sm bg-zinc-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="px-6 pt-8 pb-4 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-red-500/15">
                                    <TrashIcon className="w-8 h-8 text-red-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">Empty Trash?</h3>
                                <p className="text-sm text-zinc-400">
                                    {trashNotes.length === 0
                                        ? "Trash is already empty."
                                        : <>Permanently delete <span className="text-red-400 font-bold">{trashNotes.length}</span> {trashNotes.length === 1 ? "note" : "notes"}? This cannot be undone.</>}
                                </p>
                            </div>
                            <div className="px-6 pb-6 pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowEmptyTrashModal(false)} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/15 transition">Cancel</button>
                                {trashNotes.length > 0 && (
                                    <button type="button" onClick={() => { const deletable = trashNotes.filter(n => !(n as any).frozen); deletable.forEach(n => void notesApi.delete(String(n.id)).catch(err => console.error("Empty trash delete failed:", err))); setDbData(prev => prev.filter(n => n.is_folder || n.folder_name !== "TRASH" || (n as any).frozen)); setShowEmptyTrashModal(false); showToast(trashNotes.length > deletable.length ? "Trash emptied - locked notes kept" : "Trash emptied"); }} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition">Delete All</button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {confirmDelete && (() => {
                const isFolder = confirmDelete.type === "folder";
                const isTrash = isFolder ? confirmDelete.folderName === "TRASH" : dbData.find(r => String(r.id) === (confirmDelete as any).noteId)?.folder_name === "TRASH";
                const label = isFolder ? confirmDelete.folderName : (confirmDelete as any).noteName || "Untitled";
                const folderColor = isFolder ? (folderColors[confirmDelete.folderName] || "#3a3a3a") : null;
                const nc = isFolder ? null : ((confirmDelete as any).noteColor || "#71717a");
                const initial = isFolder ? null : meaningfulInitial(label, "N");
                return (
                    <div className="fixed inset-0 z-[620] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
                        <div className="bg-zinc-900 border-2 rounded-2xl p-6 w-full max-w-xs text-center" style={{ borderColor: nc || folderColor || "#71717a" }} onClick={e => e.stopPropagation()}>
                            {/* Icon */}
                            {isFolder ? (
                                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center rounded-xl" style={{ background: folderColor ?? "#3a3a3a" }}>
                                    <FolderIcon className="w-7 h-7 text-white" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center font-black overflow-hidden"
                                    style={{ background: nc!, color: "#fff", borderRadius: "6px", fontSize: 26, boxShadow: `2px 3px 8px ${nc}55` }}>
                                    {initial}
                                </div>
                            )}
                            <p className="text-base font-black text-white mb-4 truncate px-2">{label}</p>
                            <div className="flex flex-col gap-2">
                                <button type="button"
                                    onClick={() => { const action = confirmDelete; setConfirmDelete(null); if (action.type === "folder") void deleteFolderByName(action.folderName); else void deleteCurrentNote(action.noteId, action.noteName); }}
                                    className="w-full py-3 rounded-xl bg-red-600 text-white font-black uppercase text-xs tracking-widest">
                                    {isTrash ? "Delete Forever" : isFolder ? "Delete Folder" : "Move to Trash"}
                                </button>
                                <button type="button" onClick={() => setConfirmDelete(null)} className="w-full py-3 rounded-xl bg-white text-black font-black uppercase text-xs tracking-widest">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {iconPickerFolder !== null && (() => {
                const isNotePicker = iconPickerFolder.startsWith("__note:");
                const noteId = isNotePicker ? iconPickerFolder.slice(7) : "";
                const pickerLabel = isNotePicker ? (title || "Note") : iconPickerFolder;
                const q2 = iconPickerSearch.toLowerCase();
                const cur2 = isNotePicker ? (noteIcons[noteId] || "") : (folderIcons[iconPickerFolder] || "");
                const selectIcon2 = (val: string) => {
                    if (isNotePicker) {
                        setNoteIcons((prev) => ({ ...prev, [noteId]: val }));
                        void notesApi.update(noteId, { icon: val });
                    } else {
                        setFolderIcons((prev) => ({ ...prev, [iconPickerFolder]: val }));
                        void saveFolderIconToDb(iconPickerFolder, val);
                    }
                    setIconPickerFolder(null); setIconPickerSearch("");
                };
                const clearIcon2 = () => {
                    if (isNotePicker) {
                        setNoteIcons((prev) => { const next = { ...prev }; delete next[noteId]; return next; });
                        void notesApi.update(noteId, { icon: "" });
                    } else {
                        setFolderIcons((prev) => { const next = { ...prev }; delete next[iconPickerFolder]; return next; });
                        void saveFolderIconToDb(iconPickerFolder, "");
                    }
                    setIconPickerFolder(null); setIconPickerSearch("");
                };
                const filteredHero2 = FOLDER_HERO_ICONS.filter(e => !q2 || e.label.includes(q2) || e.key.toLowerCase().includes(q2));
                return (
                    <div className="fixed inset-0 z-[630] bg-black/90 flex items-center justify-center p-4" onClick={() => { setIconPickerFolder(null); setIconPickerSearch(""); }}>
                        <div className="bg-zinc-900 border border-white/15 p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-black uppercase tracking-wider text-white">{isNotePicker ? "Note Icon" : "Folder Icon"}</h2>
                                <span className="text-xs text-zinc-400 uppercase truncate max-w-[150px]">{pickerLabel}</span>
                            </div>
                            <div className="flex gap-1 mb-3 border-b border-white/10 pb-2">
                                <span className="px-3 py-1 text-[11px] font-black tracking-wide text-white">ICONS</span>
                                <button type="button" onClick={clearIcon2} className="ml-auto px-3 py-1 text-[11px] font-black tracking-wide text-zinc-600 hover:text-zinc-300 transition-colors">NONE</button>
                            </div>
                            {/* Search */}
                            <input type="text" value={iconPickerSearch} onChange={e => setIconPickerSearch(e.target.value)}
                                placeholder="Search..." autoFocus
                                className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 font-mono mb-3" />
                            {(
                                <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
                                    {filteredHero2.map(({ key, label, Icon }) => {
                                        const val = `__hero:${key}`;
                                        return (
                                            <button key={key} type="button" title={label} onClick={() => selectIcon2(val)}
                                                className={`aspect-square flex items-center justify-center transition-all hover:bg-white/15 rounded ${cur2 === val ? "bg-white/20 ring-1 ring-cyan-400" : ""}`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </button>
                                        );
                                    })}
                                    {filteredHero2.length === 0 && <p className="col-span-8 text-[10px] text-zinc-600 py-2 text-center">No icons match</p>}
                                </div>
                            )}
                            <button type="button" onClick={() => { setIconPickerFolder(null); setIconPickerSearch(""); }} className="w-full mt-4 py-2.5 bg-zinc-800 text-white font-black uppercase text-xs tracking-wide hover:bg-zinc-700 transition-colors">Cancel</button>
                        </div>
                    </div>
                );
            })()}

            {showCreateFolder && (() => {
                const suggestedIcon = matchNoteIcon(newFolderName, "") || "";
                const displayIcon = newFolderIcon || suggestedIcon;
                const showNewFolderIcons = showFolderIconPicker;
                return (
                <div className="fixed inset-0 z-[620] bg-black/90 flex items-center justify-center p-4" onClick={() => { setShowCreateFolder(false); setShowFolderIconPicker(false); }}>
                    <div className="bg-zinc-900 border border-white/15 p-7 sm:p-9 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <button type="button"
                            onClick={() => setShowFolderIconPicker(v => !v)}
                            className="w-16 h-16 mx-auto mb-3 flex items-center justify-center bg-zinc-800 border border-white/10 hover:border-cyan-400 transition cursor-pointer"
                            title="Change icon">
                            {displayIcon
                                ? <FolderIconDisplay value={displayIcon} folderName={newFolderName || "F"} className="w-8 h-8 text-cyan-400" />
                                : <FolderIcon className="w-8 h-8 text-cyan-400" />}
                        </button>
                        <h2 className="text-sm font-black tracking-wide text-white mb-4 text-center">New Folder</h2>
                        <input
                            ref={newFolderInputRef}
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void confirmCreateFolder();
                                if (e.key === "Escape") setShowCreateFolder(false);
                            }}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            className="w-full bg-black border border-white/20 outline-none focus:border-cyan-400 px-4 py-3 text-sm text-white font-bold tracking-tight mb-3"
                            placeholder="Folder name"
                        />
                        {showNewFolderIcons && (
                            <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto mb-3">
                                {FOLDER_HERO_ICONS.map(({ key, label, Icon }) => {
                                    const val = `__hero:${key}`;
                                    return (
                                        <button key={key} type="button" title={label}
                                            onClick={() => { setNewFolderIcon(val); setShowFolderIconPicker(false); }}
                                            className={`aspect-square flex items-center justify-center transition-all hover:bg-white/15 rounded ${displayIcon === val ? "bg-white/20 ring-1 ring-cyan-400" : ""}`}>
                                            <Icon className="w-4 h-4 text-white" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => void confirmCreateFolder()} disabled={!newFolderName.trim()} className="w-full py-3 bg-white text-black font-black text-xs tracking-wide disabled:opacity-30 disabled:cursor-not-allowed">
                                Create
                            </button>
                            <button type="button" onClick={() => { setShowCreateFolder(false); setShowFolderIconPicker(false); }} className="w-full py-3 bg-zinc-800 text-white font-black text-xs tracking-wide">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}


            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
                    onClick={() => setLightboxUrl(null)}>
                    <img src={lightboxUrl} alt="Attachment" className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl" />
                </div>
            )}
        </div>
    );
}

