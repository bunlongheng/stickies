"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { usePageMeta } from "@/lib/usePageMeta";

// Icons
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import Bars3Icon from "@heroicons/react/24/outline/Bars3Icon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import ArrowRightIcon from "@heroicons/react/24/outline/ArrowRightIcon";
import FolderIcon from "@heroicons/react/24/outline/FolderIcon";
import SwatchIcon from "@heroicons/react/24/outline/SwatchIcon";
import DocumentDuplicateIcon from "@heroicons/react/24/outline/DocumentDuplicateIcon";
import ListBulletIcon from "@heroicons/react/24/outline/ListBulletIcon";
import ShareIcon from "@heroicons/react/24/outline/ShareIcon";
import CheckCircleIcon from "@heroicons/react/24/solid/CheckCircleIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import QrCodeIcon from "@heroicons/react/24/outline/QrCodeIcon";
import FireIcon from "@heroicons/react/24/outline/FireIcon";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import ArrowRightOnRectangleIcon from "@heroicons/react/24/outline/ArrowRightOnRectangleIcon";
import Cog6ToothIcon from "@heroicons/react/24/outline/Cog6ToothIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import EyeIcon from "@heroicons/react/24/outline/EyeIcon";
import CodeBracketIcon from "@heroicons/react/24/outline/CodeBracketIcon";
import FaceSmileIcon from "@heroicons/react/24/outline/FaceSmileIcon";
import CubeTransparentIcon from "@heroicons/react/24/outline/CubeTransparentIcon";
import Squares2X2Icon from "@heroicons/react/24/outline/Squares2X2Icon";
import { marked } from "marked";
import { QRCodeSVG } from "qrcode.react";
import PusherClient from "pusher-js";

// Lazy to avoid build-time errors when env vars are not set
const getSupabase = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const supabase = { from: (...a: Parameters<ReturnType<typeof getSupabase>["from"]>) => getSupabase().from(...a) } as ReturnType<typeof getSupabase>;

// Server-side API helper — all writes go here (bypasses RLS via service role)
const STICKIES_KEY = process.env.NEXT_PUBLIC_STICKIES_API_KEY ?? "";
const notesApi = {
    update: async (id: string, fields: Record<string, unknown>) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${STICKIES_KEY}` },
            body: JSON.stringify({ id, ...fields }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "update failed"); }
        return res.json() as Promise<{ note: Record<string, unknown> }>;
    },
    bulkUpdate: async (updates: Array<{ id: string } & Record<string, unknown>>) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${STICKIES_KEY}` },
            body: JSON.stringify({ updates }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "bulk update failed"); }
    },
    insert: async (payload: Record<string, unknown>) => {
        const res = await fetch("/api/stickies?raw=1", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${STICKIES_KEY}` },
            body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "insert failed"); }
        return res.json() as Promise<{ note: Record<string, unknown> }>;
    },
    delete: async (id: string) => {
        const res = await fetch(`/api/stickies?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${STICKIES_KEY}` },
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "delete failed"); }
    },
    deleteByFolder: async (folderName: string) => {
        const res = await fetch(`/api/stickies?folder_name=${encodeURIComponent(folderName)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${STICKIES_KEY}` },
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "delete folder failed"); }
    },
    updateByFolder: async (filter: { folder_name?: string; parent_folder_name?: string }, fields: Record<string, unknown>) => {
        // Bulk-rename: fetch matching IDs then batch-update
        const q = getSupabase().from("notes").select("id");
        if (filter.folder_name !== undefined) void (q as any).eq("folder_name", filter.folder_name);
        if (filter.parent_folder_name !== undefined) void (q as any).eq("parent_folder_name", filter.parent_folder_name);
        const { data } = await (filter.folder_name !== undefined
            ? getSupabase().from("notes").select("id").eq("folder_name", filter.folder_name!)
            : getSupabase().from("notes").select("id").eq("parent_folder_name", filter.parent_folder_name!));
        if (!data || data.length === 0) return;
        await notesApi.bulkUpdate(data.map((r: any) => ({ id: String(r.id), ...fields })));
    },
};

const palette12 = ["#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00", "#D4E157", "#34C759", "#00C7BE", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#B0B0B8", "#555560", "#8B1A2E", "#6B7A1E", "#0D2B6B"];

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function shortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}
const EMPTY_QUOTES = ["🧠 Your second brain starts here. Write it down.", "✨ Great ideas deserve a home. Start now.", "📌 No more forgetting. Capture it.", "🚀 Dreams without notes are just wishes.", "📝 Plan it. Track it. Win it.", "🎯 Nothing works without priorities. Start here.", "💡 One note today. Clarity tomorrow.", "📚 Build your thinking system. One note at a time.", "⚡ Preparing is everything. Write first.", "🏆 Goals become real when you record them."];
const VIEW_STATE_KEY = "stickies:last-view:v1";
const ACTIVE_DRAFT_KEY = "stickies:active-draft:v1";
const FOLDER_COLOR_KEY = "stickies:folder-colors:v1";
const FOLDER_ICON_KEY = "stickies:folder-icons:v1";
const looksLikeMarkdown = (text: string) =>
    /^#{1,6}\s|\*\*|^[*-]\s|^>\s|`|\[.+\]\(/.test(text);
const looksLikeHtml = (text: string) =>
    /^\s*<!DOCTYPE\s+html/i.test(text) || /^\s*<html[\s>]/i.test(text);
const MAIN_LIST_MODE_KEY = "stickies:main-list-mode:v1";
const LIST_MODE_KEY = "stickies:list-mode-notes:v1";
const GRAPH_MODE_KEY = "stickies:graph-mode-notes:v1";
const MARKDOWN_MODE_KEY = "stickies:markdown-mode-notes:v1";
const HTML_MODE_KEY = "stickies:html-mode-notes:v1";

const FOLDER_ICON_EMOJIS = [
    // Folders & files
    "📁","📂","🗂️","📋","📌","📍","🏷️","🗒️","📎","🔖",
    // Work & business
    "💼","📊","📈","📉","💰","🏦","🏢","⚙️","🔧","🔨","📡","🛠️",
    // Creative
    "🎨","✏️","🖊️","📝","🖼️","🎭","🎬","🎵","🎸","🎹","🎤","📸",
    // Tech
    "💻","🖥️","📱","⌨️","💡","🔌","🔋","🤖","🧠","👾",
    // Learning
    "📚","📖","🎓","🧪","🔬","🔭","🧮","✍️","🏫",
    // Life & home
    "🏠","🏡","🛒","🧹","🛋️","🛁","🌱","🌍","✈️","🚗","🚀","⚓",
    // Food & drink
    "🍕","🍔","🌮","☕","🍵","🍎","🎂","🥗",
    // Health & sport
    "🏋️","🧘","❤️","💊","🩺","🏃","⚽","🎯","🏆","🥇",
    // Social & fun
    "👥","🎉","🎁","🎮","🎲","🧩","🃏","🎪","😂","🤝",
    // Nature
    "🌿","🌺","🌊","🔥","⚡","❄️","☀️","🌙","⭐","🌈","🦋","🐾",
];
const FLOATING_FAB_VIEWPORT_PAD = 8;
const toUrlToken = (value: string) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const reorderById = (items: any[], fromId: string, toId: string) => {
    const fromIndex = items.findIndex((item) => String(item.id) === fromId);
    const toIndex = items.findIndex((item) => String(item.id) === toId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

const insertById = (items: any[], fromId: string, toId: string, side: "before" | "after") => {
    const fromIndex = items.findIndex((item) => String(item.id) === fromId);
    if (fromIndex === -1) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    const toIndex = next.findIndex((item) => String(item.id) === toId);
    if (toIndex === -1) return items;
    next.splice(side === "before" ? toIndex : toIndex + 1, 0, moved);
    return next;
};

const secureCopy = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
    } catch (err) {
        console.error("Copy fallback failed", err);
    }
    document.body.removeChild(textArea);
    return Promise.resolve();
};

export default function NotesMaster() {
    const [mounted, setMounted] = useState(false);
    const [gridCols, setGridCols] = useState(3);
    const [isUrlChecking, setIsUrlChecking] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dbData, setDbData] = useState<any[]>([]);
    const [ripples, setRipples] = useState<any[]>([]);
    const [folderStack, setFolderStack] = useState<{ id: string; name: string; color: string }[]>([]);
    const activeFolder = folderStack.at(-1)?.name ?? null;
    // Compat shim — keeps all existing setActiveFolder() call sites working unchanged
    const setActiveFolder = useCallback((name: string | null) => {
        setFolderStack(name ? [{ id: `virtual-${name}`, name, color: palette12[0] }] : []);
    }, []);
    const enterFolder = useCallback((frame: { id: string; name: string; color: string }) => {
        setFolderStack((prev) => {
            // Build full parent chain so URL always reflects the complete path
            const buildPath = (name: string): { id: string; name: string; color: string }[] => {
                const row = dbData.find((r: any) => r.is_folder && r.folder_name === name);
                const parent = row?.parent_folder_name;
                const color = row?.folder_color || palette12[0];
                const f = { id: row?.id || `virtual-${name}`, name, color };
                if (!parent) return [f];
                return [...buildPath(parent), f];
            };
            // If we're already in a parent that matches, just append; otherwise rebuild from root
            const fullPath = buildPath(frame.name);
            const alreadyCorrect = prev.length > 0 && fullPath.slice(0, -1).map(f => f.name).join("/") === prev.map(f => f.name).join("/");
            return alreadyCorrect ? [...prev, frame] : fullPath;
        });
    }, [dbData]);
    const goBack = useCallback(() => {
        setFolderStack((prev) => prev.slice(0, -1));
    }, []);
    const goToIndex = useCallback((i: number) => {
        setFolderStack((prev) => prev.slice(0, i + 1));
    }, []);
    const [search, setSearch] = useState("");
    const [toast, setToast] = useState("");
    const [toastColor, setToastColor] = useState("#34C759");
    const [flashColor, setFlashColor] = useState("#ffffff");
    const [flashNote, setFlashNote] = useState<any | null>(null);

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<any | null>(null);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [activeLine, setActiveLine] = useState(0);
    const [editorScrollTop, setEditorScrollTop] = useState(0);
    const [editorLineHeight, setEditorLineHeight] = useState(20);
    const [editorPaddingTop, setEditorPaddingTop] = useState(12);
    const [pendingRestoreNoteId, setPendingRestoreNoteId] = useState<string | null>(null);
    const [pendingFolderQuery, setPendingFolderQuery] = useState<string | null>(null);
    const [pendingNoteQuery, setPendingNoteQuery] = useState<string | null>(null);
    const [pendingNoteIdQuery, setPendingNoteIdQuery] = useState<string | null>(null);
    const [hydratedViewState, setHydratedViewState] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [folderSearchQuery, setFolderSearchQuery] = useState("");
    const folderSearchRef = useRef<HTMLInputElement | null>(null);
    const [targetFolder, setTargetFolder] = useState("General");
    const [noteColor, setNoteColor] = useState(palette12[0]);
    const [folderColors, setFolderColors] = useState<Record<string, string>>({});
    const [folderIcons, setFolderIcons] = useState<Record<string, string>>({});
    const [iconPickerFolder, setIconPickerFolder] = useState<string | null>(null);
    const [pendingShare, setPendingShare] = useState<{ content: string } | null>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState("");
    const [qrIsBurn, setQrIsBurn] = useState(false);
    const [qrLinkCopied, setQrLinkCopied] = useState(false);
    const [sharePickerOpen, setSharePickerOpen] = useState(false);
    const [showNoteActions, setShowNoteActions] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<{ type: "note"; noteId: string | null; noteName: string } | { type: "folder"; folderName: string } | null>(null);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [newFolderIcon, setNewFolderIcon] = useState("");
    const newFolderInputRef = useRef<HTMLInputElement | null>(null);
    const [mainScrollable, setMainScrollable] = useState(false);
    const [editorScrollable, setEditorScrollable] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);
    const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
    const draggingTileIdRef = useRef<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string; mode: "before" | "after" | "into" } | null>(null);
    const [pendingFolderOrder, setPendingFolderOrder] = useState<string[] | null>(null);
    const [pendingNoteOrder, setPendingNoteOrder] = useState<string[] | null>(null);
    const [listModeNotes, setListModeNotes] = useState<Set<string>>(new Set());
    const [graphModeNotes, setGraphModeNotes] = useState<Set<string>>(new Set());
    const [markdownModeNotes, setMarkdownModeNotes] = useState<Set<string>>(new Set());
    const [htmlModeNotes, setHtmlModeNotes] = useState<Set<string>>(new Set());
    const [copiedContent, setCopiedContent] = useState(false);
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTaskText, setNewTaskText] = useState("");
    const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
    const addTaskInputRef = useRef<HTMLInputElement | null>(null);
    const graphContainerRef = useRef<HTMLDivElement | null>(null);
    const graphNodesRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);
    const graphAnimRef = useRef<number | null>(null);
    const [graphTick, setGraphTick] = useState(0);
    const globalGraphContainerRef = useRef<HTMLDivElement | null>(null);
    const globalGraphAnimRef = useRef<number | null>(null);
    const globalGraphNodesRef = useRef<{ id: string; type: "folder" | "note"; label: string; color: string; folderName?: string; r: number; x: number; y: number; vx: number; vy: number }[]>([]);
    const [globalGraphTick, setGlobalGraphTick] = useState(0);
    const [showFolderActions, setShowFolderActions] = useState(false);
    const [isEditingFolderTitle, setIsEditingFolderTitle] = useState(false);
    const [editingFolderTitleValue, setEditingFolderTitleValue] = useState("");
    const [showFolderColorPicker, setShowFolderColorPicker] = useState(false);
    const [showFolderIconPicker, setShowFolderIconPicker] = useState(false);
    const [showFolderMovePicker, setShowFolderMovePicker] = useState(false);
    const [folderMoveQuery, setFolderMoveQuery] = useState("");
    const folderMoveSearchRef = useRef<HTMLInputElement | null>(null);
    const [showGlobalGraph, setShowGlobalGraph] = useState(false);
    const [selectedGraphFolder, setSelectedGraphFolder] = useState<string | null>(null);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [folderFabOffset, setFolderFabOffset] = useState({ x: 0, y: 0 });
    const [isFolderFabDragging, setIsFolderFabDragging] = useState(false);
    const [pusherFlash, setPusherFlash] = useState(false);
    const [aiMode, setAiMode] = useState<{ active: boolean; message: string }>({ active: false, message: "" });
    const [botColor, setBotColor] = useState({ primary: "#7c3aed", secondary: "#a78bfa", light: "#c4b5fd" });
    const [mainListMode, setMainListMode] = useState(true);

    const isSavingRef = useRef(false);
    const localWriteRef = useRef<Map<string, number>>(new Map()); // noteId → timestamp, self-echo guard
    const flashQueueRef = useRef<Array<{ note: any; color: string }>>([]);
    const integrationsRef = useRef<Array<{ trigger: string; condition: Record<string, string>; type: string; config: Record<string, string> }>>([]);
    const isFlashingRef = useRef(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressOpenRef = useRef(false);
    const mainScrollRef = useRef<HTMLElement | null>(null);
    const editorTextRef = useRef<HTMLTextAreaElement | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const editorToolsRef = useRef<HTMLDivElement | null>(null);
    const folderFabShellRef = useRef<HTMLDivElement | null>(null);
    const folderFabOffsetRef = useRef({ x: 0, y: 0 });
    const folderFabAnimFrameRef = useRef<number | null>(null);
    const folderFabDragRef = useRef({
        pointerId: null as number | null,
        lastX: 0,
        lastY: 0,
        velocityX: 0,
        velocityY: 0,
        dragged: false,
    });
    const shouldFocusTitleOnOpenRef = useRef(false);

    const origin = process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
    usePageMeta({
        title: "Stickies",
        description: "Online notes",
        url: `${origin}/tools/stickies`,
        basePath: "/icons/stickies",
    });

    const setFolderFabOffsetWithRef = useCallback((next: { x: number; y: number }) => {
        folderFabOffsetRef.current = next;
        setFolderFabOffset(next);
    }, []);

    const stopFolderFabAnimation = useCallback(() => {
        if (folderFabAnimFrameRef.current !== null) {
            cancelAnimationFrame(folderFabAnimFrameRef.current);
            folderFabAnimFrameRef.current = null;
        }
    }, []);

    const clampFolderFabDelta = useCallback((dx: number, dy: number) => {
        const shell = folderFabShellRef.current;
        if (!shell) return { dx, dy };
        const rect = shell.getBoundingClientRect();
        let nextDx = dx;
        let nextDy = dy;

        const projectedLeft = rect.left + dx;
        const projectedRight = rect.right + dx;
        const projectedTop = rect.top + dy;
        const projectedBottom = rect.bottom + dy;

        if (projectedLeft < FLOATING_FAB_VIEWPORT_PAD) {
            nextDx += FLOATING_FAB_VIEWPORT_PAD - projectedLeft;
        }
        if (projectedRight > window.innerWidth - FLOATING_FAB_VIEWPORT_PAD) {
            nextDx -= projectedRight - (window.innerWidth - FLOATING_FAB_VIEWPORT_PAD);
        }
        if (projectedTop < FLOATING_FAB_VIEWPORT_PAD) {
            nextDy += FLOATING_FAB_VIEWPORT_PAD - projectedTop;
        }
        if (projectedBottom > window.innerHeight - FLOATING_FAB_VIEWPORT_PAD) {
            nextDy -= projectedBottom - (window.innerHeight - FLOATING_FAB_VIEWPORT_PAD);
        }

        return { dx: nextDx, dy: nextDy };
    }, []);

    const animateFolderFabBack = useCallback(
        (initialVx = 0, initialVy = 0) => {
            stopFolderFabAnimation();
            let x = folderFabOffsetRef.current.x;
            let y = folderFabOffsetRef.current.y;
            let vx = initialVx;
            let vy = initialVy;
            const stiffness = 0.1;
            const damping = 0.84;

            const step = () => {
                vx = (vx - x * stiffness) * damping;
                vy = (vy - y * stiffness) * damping;
                x += vx;
                y += vy;
                if (Math.abs(x) < 0.35 && Math.abs(y) < 0.35 && Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2) {
                    setFolderFabOffsetWithRef({ x: 0, y: 0 });
                    folderFabAnimFrameRef.current = null;
                    return;
                }
                setFolderFabOffsetWithRef({ x, y });
                folderFabAnimFrameRef.current = requestAnimationFrame(step);
            };

            folderFabAnimFrameRef.current = requestAnimationFrame(step);
        },
        [setFolderFabOffsetWithRef, stopFolderFabAnimation],
    );

    // --- CORE SYNC ---
    const sync = async () => {
        try {
            const [notesResult, iconsResult] = await Promise.all([
                supabase.from("notes").select("*").order("updated_at", { ascending: false }),
                fetch("/api/stickies/folder-icon", {
                    headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_STICKIES_API_KEY ?? "sk_stickies_d218dfa0abe37b82c5269f40bd478ddca7b567bbd1310efc"}` },
                }).then((r) => r.ok ? r.json() : { icons: {} }).catch(() => ({ icons: {} })),
            ]);
            if (notesResult.error) {
                console.error("Failed to sync notes:", notesResult.error);
            } else if (notesResult.data) {
                setDbData(notesResult.data);
            }
            if (iconsResult.icons && Object.keys(iconsResult.icons).length > 0) {
                setFolderIcons((prev) => ({ ...prev, ...iconsResult.icons }));
            }
        } finally {
            setIsDataLoaded(true);
        }
    };

    useEffect(() => {
        const updateCols = () => {
            if (window.matchMedia("(min-width: 768px)").matches) setGridCols(6);
            else if (window.matchMedia("(min-width: 480px)").matches) setGridCols(4);
            else setGridCols(3);
        };
        updateCols();
        window.addEventListener("resize", updateCols);
        return () => window.removeEventListener("resize", updateCols);
    }, []);

    useEffect(() => {
        setMounted(true);
        void sync();

        // Load active integrations from Supabase
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/integrations?active=eq.true&select=trigger,condition,type,config`, {
            headers: {
                "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                "Authorization": `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
        }).then(r => r.json()).then((rows: any[]) => {
            if (Array.isArray(rows)) integrationsRef.current = rows;
        }).catch(() => {});

        let restoredFromUrl = false;
        let shouldWaitForInitialTarget = false;
        try {
            const params = new URLSearchParams(window.location.search);
            const sharedDataParam = params.get("data");
            const folderParam = params.get("folder");
            const noteParam = params.get("note");
            const noteIdParam = params.get("noteId");
            if (sharedDataParam) {
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
                    setActiveLine(0);
                    setEditorScrollTop(0);
                    shouldFocusTitleOnOpenRef.current = true;
                    setEditorOpen(true);
                    window.history.replaceState({}, "", window.location.pathname);
                } catch (decodeErr) {
                    console.error("Failed to decode shared note data:", decodeErr);
                } finally {
                    setIsUrlChecking(false);
                }
            } else if (folderParam || noteParam || noteIdParam) {
                restoredFromUrl = true;
                shouldWaitForInitialTarget = true;
                setIsUrlChecking(true);
                if (folderParam) setPendingFolderQuery(folderParam);
                if (noteParam) setPendingNoteQuery(noteParam);
                if (noteIdParam) setPendingNoteIdQuery(noteIdParam);
            }
        } catch (err) {
            console.error("Failed to restore URL state:", err);
        }

        if (!restoredFromUrl) {
            try {
                const raw = localStorage.getItem(VIEW_STATE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed?.folderStack) && parsed.folderStack.length > 0) {
                        setFolderStack(parsed.folderStack);
                    } else if (typeof parsed?.activeFolder === "string") {
                        setActiveFolder(parsed.activeFolder);
                    }
                    if ((parsed?.editorOpen || parsed?.noteModalOpen) && parsed?.editingNoteId) {
                        shouldWaitForInitialTarget = true;
                        setPendingRestoreNoteId(String(parsed.editingNoteId));
                    }
                }
            } catch (err) {
                console.error("Failed to restore local view state:", err);
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
        } catch { /* ignore */ }
        try {
            const rawList = localStorage.getItem(LIST_MODE_KEY);
            if (rawList) {
                const arr = JSON.parse(rawList);
                if (Array.isArray(arr)) setListModeNotes(new Set(arr));
            }
        } catch { /* ignore */ }
        try {
            const rawGraph = localStorage.getItem(GRAPH_MODE_KEY);
            if (rawGraph) {
                const arr = JSON.parse(rawGraph);
                if (Array.isArray(arr)) setGraphModeNotes(new Set(arr));
            }
        } catch { /* ignore */ }
        try {
            const rawMd = localStorage.getItem(MARKDOWN_MODE_KEY);
            if (rawMd) {
                const arr = JSON.parse(rawMd);
                if (Array.isArray(arr)) setMarkdownModeNotes(new Set(arr));
            }
        } catch { /* ignore */ }
        try {
            const rawMainList = localStorage.getItem(MAIN_LIST_MODE_KEY);
            if (rawMainList) setMainListMode(rawMainList === "true");
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

    // Sync folder icons from DB (content field on is_folder rows) — DB wins over localStorage
    useEffect(() => {
        if (!dbData || dbData.length === 0) return;
        const fromDb: Record<string, string> = {};
        dbData.forEach((row: any) => {
            if (row.is_folder && row.folder_name && row.content && row.content.trim()) {
                fromDb[String(row.folder_name)] = row.content.trim();
            }
        });
        if (Object.keys(fromDb).length > 0) {
            setFolderIcons((prev) => ({ ...prev, ...fromDb }));
        }
    }, [dbData]);

    useEffect(() => {
        try {
            localStorage.setItem(LIST_MODE_KEY, JSON.stringify([...listModeNotes]));
        } catch { /* ignore */ }
    }, [listModeNotes]);

    useEffect(() => {
        try {
            localStorage.setItem(GRAPH_MODE_KEY, JSON.stringify([...graphModeNotes]));
        } catch { /* ignore */ }
    }, [graphModeNotes]);

    useEffect(() => {
        try {
            localStorage.setItem(MARKDOWN_MODE_KEY, JSON.stringify([...markdownModeNotes]));
        } catch { /* ignore */ }
    }, [markdownModeNotes]);

    useEffect(() => {
        try {
            localStorage.setItem(HTML_MODE_KEY, JSON.stringify([...htmlModeNotes]));
        } catch { /* ignore */ }
    }, [htmlModeNotes]);

    useEffect(() => {
        try { localStorage.setItem(MAIN_LIST_MODE_KEY, String(mainListMode)); } catch { /* ignore */ }
    }, [mainListMode]);

    // Pusher — real-time note events + ai-mode signals
    useEffect(() => {
        if (!mounted) return;
        const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!pusherKey || !pusherCluster) return;
        const pusher = new PusherClient(pusherKey, { cluster: pusherCluster });
        pusher.connection.bind("connected", () => { localWriteRef.current.set("__socket_id__", pusher.connection.socket_id as any); });
        const channel = pusher.subscribe("stickies");

const fireIntegrations = (trigger: string, note: any) => {
            for (const integration of integrationsRef.current) {
                if (integration.trigger !== trigger) continue;
                const cond = integration.condition ?? {};
                if (cond.color && cond.color !== note.folder_color) continue;
                if (cond.folder && cond.folder !== note.folder_name) continue;
                if (integration.type === "hue") {
                    const { group_id } = integration.config;
                    // Server-side relay — avoids browser cert/CORS issues (IFTTT-style)
                    fetch("/api/hue/trigger", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ color: note.folder_color || "#FFCC00", group_id }),
                    }).catch(() => {});
                }
            }
        };

        const processFlashQueue = () => {
            if (isFlashingRef.current || flashQueueRef.current.length === 0) return;
            const { note, color } = flashQueueRef.current.shift()!;
            isFlashingRef.current = true;
            setFlashColor(color);
            setFlashNote(note);
            setPusherFlash(true);
            setTimeout(() => {
                setPusherFlash(false);
                setFlashNote(null);
                isFlashingRef.current = false;
                processFlashQueue();
            }, 2000);
        };

        channel.bind("note-created", (note: any) => {
            if (!note?.id) return;
            setDbData((prev) => {
                if (prev.some((r) => String(r.id) === String(note.id))) return prev;
                return [...prev, note];
            });
            const color = note.folder_color || "#34C759";
            showToast(`+ ${note.title || "New note"}`, color);
            flashQueueRef.current.push({ note, color });
            processFlashQueue();

            // 🔌 Integration engine — fire matching triggers
            fireIntegrations("note_created", note);
        });

        channel.bind("note-updated", (note: any) => {
            if (!note?.id) return;
            const lastWrite = localWriteRef.current.get(String(note.id));
            if (lastWrite && Date.now() - lastWrite < 3000) return;
            setDbData((prev) => prev.map((r) => String(r.id) === String(note.id) ? { ...r, ...note } : r));
            setEditingNote((prev: any) => {
                if (!prev || String(prev.id) !== String(note.id)) return prev;
                if (note.content !== undefined) setContent(note.content);
                if (note.title   !== undefined) setTitle(note.title);
                if (note.list_mode !== undefined) {
                    if (note.list_mode) setListModeNotes((s) => new Set([...s, String(note.id)]));
                    else setListModeNotes((s) => { const n = new Set(s); n.delete(String(note.id)); return n; });
                }
                return { ...prev, ...note };
            });
        });

        channel.bind("ai-mode-start", (data: any) => {
            setAiMode({ active: true, message: data?.message ?? "AI is organizing your stickies…" });
            const pick = palette12[Math.floor(Math.random() * palette12.length)];
            const r = parseInt(pick.slice(1, 3), 16), g = parseInt(pick.slice(3, 5), 16), b = parseInt(pick.slice(5, 7), 16);
            setBotColor({ primary: pick, secondary: `rgba(${r},${g},${b},0.72)`, light: `rgba(${r},${g},${b},0.45)` });
        });
        channel.bind("ai-mode-end", () => {
            setAiMode({ active: false, message: "" });
            sync();
        });

        return () => { channel.unbind_all(); pusher.unsubscribe("stickies"); pusher.disconnect(); };
    }, [mounted]);

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

    useEffect(() => {
        if (!pendingRestoreNoteId || !isDataLoaded) return;
        const note = dbData.find((n) => !n.is_folder && String(n.id) === String(pendingRestoreNoteId));
        if (note) {
            setActiveFolder(note.folder_name || null);
            setEditingNote(note);
            setTitle(note.title || "");
            setContent(note.content || "");
            setTargetFolder(note.folder_name || "General");
            setNoteColor(note.folder_color || palette12[0]);
            setActiveLine(0);
            setEditorScrollTop(0);
            if (note.id && looksLikeMarkdown(note.content || "")) {
                setMarkdownModeNotes((prev) => new Set([...prev, String(note.id)]));
            }
            if (note.id && looksLikeHtml(note.content || "")) {
                setHtmlModeNotes((prev) => new Set([...prev, String(note.id)]));
            }
            if (note.id && note.list_mode) {
                setListModeNotes((prev) => new Set([...prev, String(note.id)]));
            }
            setEditorOpen(true);
        }
        setPendingRestoreNoteId(null);
        setIsUrlChecking(false);
    }, [pendingRestoreNoteId, dbData, isDataLoaded]);

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

        // Restore full folder stack for nested paths
        if (folderSegments.length > 1) {
            const stackFrames: { id: string; name: string; color: string }[] = [];
            for (const seg of folderSegments) {
                const name = allFolders.find((n) => toUrlToken(n) === seg);
                if (name) {
                    const row = dbData.find((r) => r.is_folder && r.folder_name === name);
                    stackFrames.push({ id: row?.id || `virtual-${name}`, name, color: row?.folder_color || palette12[0] });
                }
            }
            if (stackFrames.length > 0) setFolderStack(stackFrames);
        }

        let matchedNote: any = null;
        let matchedDraft: any = null;
        if (noteIdToken) {
            matchedNote = allNotes.find((item) => String(item.id) === noteIdToken && (!matchedFolder || item.folder_name === matchedFolder)) || allNotes.find((item) => String(item.id) === noteIdToken) || null;
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
            setEditingNote(matchedNote);
            setTitle(matchedNote.title || "");
            setContent(matchedNote.content || "");
            setTargetFolder(matchedNote.folder_name || matchedFolder || "General");
            setNoteColor(matchedNote.folder_color || palette12[0]);
            setActiveLine(0);
            setEditorScrollTop(0);
            setEditorOpen(true);
        } else if (matchedDraft) {
            const draftFolder = matchedDraft.folder_name || matchedFolder || "General";
            setActiveFolder(draftFolder || null);
            setEditingNote(null);
            setTitle(matchedDraft.title || "");
            setContent(matchedDraft.content || "");
            setTargetFolder(draftFolder);
            setNoteColor(matchedDraft.folder_color || palette12[0]);
            setActiveLine(0);
            setEditorScrollTop(0);
            setEditorOpen(true);
        } else if (matchedFolder) {
            if (folderSegments.length <= 1) {
                // Single folder — simple activate
                const row = dbData.find((r) => r.is_folder && r.folder_name === matchedFolder);
                setFolderStack([{ id: row?.id || `virtual-${matchedFolder}`, name: matchedFolder, color: row?.folder_color || palette12[0] }]);
            }
            // Multi-segment stack already set above
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
            const noteToken = editorOpen ? toUrlToken(title) : "";
            const noteIdToken = editorOpen && editingNote?.id ? String(editingNote.id) : "";

            // Encode full nested stack as "parent/child" path
            const stackForUrl = folderStack.length > 0
                ? folderStack
                : (editorOpen && (targetFolder || activeFolder || editingNote?.folder_name))
                    ? [{ name: targetFolder || activeFolder || editingNote?.folder_name || "" }]
                    : [];
            const folderPath = stackForUrl.map((f) => toUrlToken(f.name)).filter(Boolean).join("/");
            if (folderPath) next.searchParams.set("folder", folderPath);
            else next.searchParams.delete("folder");

            if (noteToken) next.searchParams.set("note", noteToken);
            else next.searchParams.delete("note");

            if (noteIdToken) next.searchParams.set("noteId", noteIdToken);
            else next.searchParams.delete("noteId");

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
    }, [editorOpen, editingNote?.id, editingNote?.folder_name, activeFolder]);

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
            noteCountByFolder.set(folderName, (noteCountByFolder.get(folderName) || 0) + 1);
            if (!firstNoteColorByFolder.has(folderName) && item.folder_color) firstNoteColorByFolder.set(folderName, item.folder_color);
        });

        const folderRowsByName = new Map<string, any>();
        dbData
            .filter((item) => item.is_folder)
            .forEach((row) => {
                const folderName = String(row.folder_name || "General");
                if (!folderRowsByName.has(folderName)) folderRowsByName.set(folderName, row);
            });

        // Compute latest note updated_at per folder for sorting
        const latestUpdatedByFolder = new Map<string, string>();
        dbData.filter((item) => !item.is_folder).forEach((item) => {
            const fn = String(item.folder_name || "General");
            const t = String(item.updated_at || "");
            if (!latestUpdatedByFolder.has(fn) || t > latestUpdatedByFolder.get(fn)!) {
                latestUpdatedByFolder.set(fn, t);
            }
        });

        const foldersFromRows = Array.from(folderRowsByName.values())
            .map((row) => {
                const folderName = String(row.folder_name || "General");
                return {
                    id: row.id,
                    order: typeof row.order === "number" ? row.order : Number.MAX_SAFE_INTEGER,
                    latestUpdatedAt: latestUpdatedByFolder.get(folderName) || String(row.updated_at || ""),
                    name: folderName,
                    color: folderColors[folderName] || row.folder_color || palette12[0],
                    count: noteCountByFolder.get(folderName) || 0,
                    subfolderCount: subfolderCountByFolder.get(folderName) || 0,
                    icon: folderIcons[folderName] || "",
                };
            })
            .sort((a, b) => b.latestUpdatedAt.localeCompare(a.latestUpdatedAt));

        const missingFolders = Array.from(noteCountByFolder.keys())
            .filter((folderName) => !folderRowsByName.has(folderName))
            .sort((a, b) => a.localeCompare(b))
            .map((folderName) => ({
                id: `virtual-${folderName}`,
                order: Number.MAX_SAFE_INTEGER,
                name: folderName,
                color: folderColors[folderName] || firstNoteColorByFolder.get(folderName) || palette12[0],
                count: noteCountByFolder.get(folderName) || 0,
                subfolderCount: subfolderCountByFolder.get(folderName) || 0,
                icon: folderIcons[folderName] || "",
            }));

        const all = [...foldersFromRows, ...missingFolders];
        const SYSTEM_BOTTOM = ["PAGES", "CLAUDE"];
        if (pendingFolderOrder) {
            const idx = new Map(pendingFolderOrder.map((name, i) => [name, i]));
            const sorted = [...all].sort((a, b) => (idx.has(a.name) ? idx.get(a.name)! : all.length) - (idx.has(b.name) ? idx.get(b.name)! : all.length));
            return [...sorted.filter(f => !SYSTEM_BOTTOM.includes(f.name)), ...sorted.filter(f => SYSTEM_BOTTOM.includes(f.name))];
        }
        return [...all.filter(f => !SYSTEM_BOTTOM.includes(f.name)), ...all.filter(f => SYSTEM_BOTTOM.includes(f.name))];
    }, [dbData, folderColors, folderIcons, pendingFolderOrder]);

    // Folders visible at the current navigation level (root or sub-folder)
    const currentLevelFolders = useMemo(() => {
        const parentFilter = folderStack.length === 0 ? null : activeFolder;
        return folders
            .filter((f) => {
                const row = dbData.find((r) => r.is_folder && r.folder_name === f.name);
                return (row?.parent_folder_name ?? null) === parentFilter;
            })
            .map((f) => ({ ...f, is_folder: true as const }));
    }, [folders, folderStack, activeFolder, dbData]);

    const displayItems = useMemo(() => {
        const byUpdated = (a: any, b: any) =>
            String(b.updated_at || "").localeCompare(String(a.updated_at || "")) ||
            String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
        if (search.trim()) {
            const q = search.toLowerCase();
            return dbData.filter((n) => !n.is_folder && (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || String(n.folder_name || "").toLowerCase().includes(q))).sort(byUpdated);
        }
        if (activeFolder) {
            let notes = dbData.filter((n) => !n.is_folder && n.folder_name === activeFolder).sort(byUpdated);
            if (pendingNoteOrder) {
                const idx = new Map(pendingNoteOrder.map((id, i) => [id, i]));
                notes = [...notes].sort((a, b) => (idx.has(String(a.id)) ? idx.get(String(a.id))! : notes.length) - (idx.has(String(b.id)) ? idx.get(String(b.id))! : notes.length));
            }
            return [...currentLevelFolders, ...notes];
        }
        return currentLevelFolders;
    }, [dbData, activeFolder, search, currentLevelFolders, pendingNoteOrder]);
    const activeFolderNoteCount = useMemo(() => {
        if (!activeFolder) return 0;
        const folderMeta = folders.find((folder) => folder.name === activeFolder);
        if (folderMeta) return Number(folderMeta.count) || 0;
        return dbData.filter((row) => !row.is_folder && String(row.folder_name || "") === activeFolder).length;
    }, [activeFolder, folders, dbData]);
    const canDeleteActiveFolder = Boolean(activeFolder);
    const isEmptyView = isDataLoaded && !editorOpen && !search.trim() && displayItems.length === 0;
    const folderNames = useMemo(() => {
        const names = new Set<string>();
        dbData.forEach((n) => {
            if (n?.folder_name) names.add(String(n.folder_name));
        });
        if (activeFolder) names.add(activeFolder);
        if (targetFolder) names.add(targetFolder);
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
            const prevColor = editingNote.folder_color || palette12[0];
            return nextTitle !== prevTitle || content !== prevContent || nextFolder !== prevFolder || nextColor !== prevColor;
        }
        return Boolean(title.trim() || content.trim() || nextFolder !== "General");
    }, [editorOpen, title, content, targetFolder, activeFolder, noteColor, editingNote]);

    // Debounced auto-save while typing — broadcasts to other devices via Pusher
    useEffect(() => {
        if (!editorOpen || !isDraftDirty) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => { void saveNote({ silent: true }); }, 2000);
        return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, title, editorOpen]);

    const saveNote = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            // Never save notes with no real content
            if (!title.trim() && !content.trim()) return true;
            if (!isDraftDirty) return true;
            if (isSavingRef.current) return true;
            isSavingRef.current = true;

            const folderName = targetFolder || activeFolder || editingNote?.folder_name || "General";
            const payload = {
                title: title.trim() || "Untitled",
                content,
                folder_name: folderName,
                folder_color: noteColor || folders.find((f) => f.name === folderName)?.color || editingNote?.folder_color || palette12[0],
                is_folder: false,
                updated_at: new Date().toISOString(),
            };
            const existingNoteId = editingNote?.id ?? null;
            const existingNoteIdStr = existingNoteId !== null ? String(existingNoteId) : null;
            const optimisticId = existingNoteIdStr || `local-${Date.now()}`;
            const existingSnapshot = existingNoteIdStr ? dbData.find((n) => String(n.id) === existingNoteIdStr) || null : null;

            const optimisticNote = {
                ...(editingNote || {}),
                id: optimisticId,
                ...payload,
                created_at: editingNote?.created_at || new Date().toISOString(),
            };

            setDbData((prev) => {
                if (existingNoteIdStr) {
                    return prev.map((n) => (String(n.id) === existingNoteIdStr ? { ...n, ...payload } : n));
                }
                return [...prev, optimisticNote];
            });

            try {
                if (existingNoteId !== null) {
                    localWriteRef.current.set(String(existingNoteId), Date.now());
                    await notesApi.update(String(existingNoteId), payload);
                    setEditingNote((prev: any) => (prev ? { ...prev, ...payload } : prev));
                    void sync();
                } else {
                    const { note: data } = await notesApi.insert(payload);
                    if (data) {
                        setEditingNote(data);
                        setDbData((prev) => prev.map((n) => (String(n.id) === optimisticId ? data : n)));
                    }
                }
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                if (!silent) showToast("Saved", payload.folder_color || "#34C759");
                return true;
            } catch (err) {
                console.error("Save Error:", err);
                if (existingNoteIdStr && existingSnapshot) {
                    setDbData((prev) => prev.map((n) => (String(n.id) === existingNoteIdStr ? existingSnapshot : n)));
                } else if (!existingNoteIdStr) {
                    setDbData((prev) => prev.filter((n) => String(n.id) !== optimisticId));
                }
                showToast("Save Failed");
                return false;
            } finally {
                isSavingRef.current = false;
            }
        },
        [isDraftDirty, targetFolder, noteColor, activeFolder, editingNote, title, content, folders, dbData],
    );

    const closeEditorTools = useCallback(() => {
        setShowColorPicker(false);
        setShowSwitcher(false);
    }, []);

    const moveToFolder = useCallback(
        async (name: string) => {
            const color = folders.find((f) => f.name === name)?.color || palette12[0];
            setTargetFolder(name);
            setNoteColor(color);
            setShowSwitcher(false);
            setFolderSearchQuery("");
            showToast(`→ ${name}`, color);
            if (editingNote?.id) {
                try {
                    await notesApi.update(String(editingNote.id), { folder_name: name, folder_color: color });
                    setDbData((prev) =>
                        prev.map((r) =>
                            String(r.id) === String(editingNote.id)
                                ? { ...r, folder_name: name, folder_color: color }
                                : r,
                        ),
                    );
                    setEditingNote((prev: any) => (prev ? { ...prev, folder_name: name, folder_color: color } : prev));
                    // Update breadcrumb to reflect new location
                    const folderRow = folders.find((f) => f.name === name);
                    const folderId = folderRow?.id ?? `virtual-${name}`;
                    setActiveFolder(name);
                    setFolderStack([{ id: folderId, name, color }]);
                } catch (err) {
                    console.error("Move failed:", err);
                    showToast("Move Failed");
                }
            }
        },
        [folders, editingNote],
    );

    const closeNoteModal = useCallback(() => {
        void saveNote();
        closeEditorTools();
        setEditorOpen(false);
    }, [saveNote, closeEditorTools]);

    const backToRootFromEditor = useCallback(() => {
        void saveNote();
        closeEditorTools();
        setEditorOpen(false);
        // Stay in the note's folder; only go to root if no folder
        setActiveFolder(targetFolder || null);
        setSearch("");
    }, [saveNote, closeEditorTools, targetFolder]);

    // Pick a random palette color, avoiding the last-used one if possible
    const pickUniqueColor = useCallback(() => {
        const recentColors = new Set(
            dbData.filter((r: any) => !r.is_folder && r.folder_color)
                  .slice(-3)
                  .map((r: any) => String(r.folder_color).toUpperCase())
        );
        const available = palette12.filter(c => !recentColors.has(c.toUpperCase()));
        const pool = available.length > 0 ? available : palette12;
        return pool[Math.floor(Math.random() * pool.length)];
    }, [dbData]);

    const openNewNote = useCallback(() => {
        setEditingNote(null);
        setTitle("");
        setContent("");
        setTargetFolder(activeFolder || "General");
        setNoteColor(pickUniqueColor());
        shouldFocusTitleOnOpenRef.current = true;
        closeEditorTools();
        setActiveLine(0);
        setEditorScrollTop(0);
        setEditorOpen(true);
    }, [activeFolder, closeEditorTools, pickUniqueColor]);

    const showToast = (msg: string, color = "#34C759") => {
        setToastColor(color);
        setToast(msg);
        setTimeout(() => setToast(""), 3000);
    };

    const handleCursorUpdate = (e: any) => {
        const target = e.target as HTMLTextAreaElement;
        const styles = window.getComputedStyle(target);
        const nextLineHeight = parseFloat(styles.lineHeight);
        const nextPaddingTop = parseFloat(styles.paddingTop);
        if (!Number.isNaN(nextLineHeight)) setEditorLineHeight(nextLineHeight);
        if (!Number.isNaN(nextPaddingTop)) setEditorPaddingTop(nextPaddingTop);
        const textBeforeCursor = target.value.substring(0, target.selectionStart || 0);
        setActiveLine(textBeforeCursor.split("\n").length - 1);
    };

    const handleEditorScroll = (e: any) => {
        const target = e.target as HTMLTextAreaElement;
        const styles = window.getComputedStyle(target);
        const nextLineHeight = parseFloat(styles.lineHeight);
        const nextPaddingTop = parseFloat(styles.paddingTop);
        if (!Number.isNaN(nextLineHeight)) setEditorLineHeight(nextLineHeight);
        if (!Number.isNaN(nextPaddingTop)) setEditorPaddingTop(nextPaddingTop);
        setEditorScrollTop(target.scrollTop || 0);
    };

    const copyCurrentNoteLink = async () => {
        const noteTitle = title.trim() || editingNote?.title || "untitled";
        const folderName = targetFolder || activeFolder || editingNote?.folder_name || "general";
        const url = new URL(window.location.href);
        // Use full stack path for correct nested folder URL
        const stackPath = folderStack.length > 0
            ? folderStack.map((f) => toUrlToken(f.name)).filter(Boolean).join("/")
            : toUrlToken(folderName);
        url.searchParams.set("folder", stackPath);
        url.searchParams.set("note", toUrlToken(noteTitle));
        if (editingNote?.id) url.searchParams.set("noteId", String(editingNote.id));
        else url.searchParams.delete("noteId");
        await secureCopy(url.toString());
        showToast("Link Copied");
    };

    const openNoteQrShare = useCallback(() => {
        const base = typeof window !== "undefined" ? window.location.origin : "https://bheng.vercel.app";
        const payload = {
            title: title.trim() || editingNote?.title || "Untitled",
            content: content || editingNote?.content || "",
            folder_name: targetFolder || activeFolder || editingNote?.folder_name || "General",
            color: noteColor || editingNote?.color || "",
        };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        setQrData(`${base}/stickies-share?data=${encoded}`);
        setQrIsBurn(false);
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, content, targetFolder, activeFolder, noteColor]);

    const shareBurnLink = useCallback(async () => {
        const payload = {
            title: title.trim() || editingNote?.title || "Untitled",
            content: content || editingNote?.content || "",
            color: noteColor || editingNote?.color || "",
            folder_name: targetFolder || activeFolder || editingNote?.folder_name || "General",
        };
        try {
            const res = await fetch("/api/stickies/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) { showToast("Failed to create link"); return; }
            const { token } = await res.json();
            const base = typeof window !== "undefined" ? window.location.origin : "https://bheng.vercel.app";
            const burnUrl = `${base}/stickies-share?token=${token}`;
            setQrData(burnUrl);
            setQrIsBurn(true);
            setQrLinkCopied(false);
            setQrModalOpen(true);
        } catch {
            showToast("Failed to create link");
        }
    }, [editingNote, title, content, noteColor, targetFolder, activeFolder]);

    const deleteCurrentNote = useCallback(
        async (noteId: string | null, noteName: string) => {
            const resolvedNoteName = noteName.trim() || "Untitled";
            if (!noteId) {
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                setEditingNote(null);
                setTitle("");
                setContent("");
                setActiveLine(0);
                setEditorScrollTop(0);
                setEditorOpen(false);
                showToast(`${resolvedNoteName} deleted`);
                return;
            }
            try {
                await notesApi.delete(noteId);
                setDbData((prev) => prev.filter((row) => String(row.id) !== noteId));
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                setEditingNote(null);
                setTitle("");
                setContent("");
                setActiveLine(0);
                setEditorScrollTop(0);
                setEditorOpen(false);
                showToast(`${resolvedNoteName} deleted`);
            } catch (err) {
                console.error("Delete note failed:", err);
                showToast("Delete Failed");
            }
        },
        [closeEditorTools],
    );

    const deleteFolderByName = useCallback(
        async (folderName: string) => {
            if (!folderName) return;
            try {
                await notesApi.deleteByFolder(folderName);
                setDbData((prev) => prev.filter((row) => String(row.folder_name || "") !== folderName));
                setFolderColors((prev) => {
                    const next = { ...prev };
                    delete next[folderName];
                    return next;
                });
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                setEditingNote(null);
                setTitle("");
                setContent("");
                setActiveLine(0);
                setEditorScrollTop(0);
                setEditorOpen(false);
                setActiveFolder(null);
                setSearch("");
                showToast("Folder Deleted");
            } catch (err) {
                console.error("Delete folder failed:", err);
                showToast("Delete Failed");
            }
        },
        [closeEditorTools, dbData],
    );

    const stripBulletSpacing = () => {
        const cleaned = content.replace(/^\s*([0-9]+\.|[-*•+_])\s+/gm, "$1");
        setContent(cleaned);
        showToast("Bullet Spacing Cleaned");
    };

    const currentNoteId = editingNote?.id ? String(editingNote.id) : null;
    const listMode = currentNoteId ? listModeNotes.has(currentNoteId) : false;
    const graphMode = currentNoteId ? graphModeNotes.has(currentNoteId) : false;
    const markdownMode = currentNoteId ? markdownModeNotes.has(currentNoteId) : false;
    const htmlMode = currentNoteId ? htmlModeNotes.has(currentNoteId) : false;

    const saveFolderIconToDb = useCallback(async (folderName: string, icon: string) => {
        try {
            const res = await fetch("/api/stickies/folder-icon", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${STICKIES_KEY}`,
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
        setConfirmDeleteTask(null);
        if (graphModeNotes.has(currentNoteId)) {
            setGraphModeNotes((prev) => { const next = new Set(prev); next.delete(currentNoteId); return next; });
        }
        setListModeNotes((prev) => {
            const next = new Set(prev);
            const newVal = !next.has(currentNoteId);
            if (newVal) next.add(currentNoteId); else next.delete(currentNoteId);
            localWriteRef.current.set(currentNoteId, Date.now());
            void notesApi.update(currentNoteId, { list_mode: newVal });
            return next;
        });
    }, [currentNoteId, graphModeNotes]);

    const toggleGraphMode = useCallback(() => {
        if (!currentNoteId) return;
        setShowAddTask(false);
        setConfirmDeleteTask(null);
        if (listModeNotes.has(currentNoteId)) {
            setListModeNotes((prev) => { const next = new Set(prev); next.delete(currentNoteId); return next; });
        }
        setGraphModeNotes((prev) => {
            const next = new Set(prev);
            if (next.has(currentNoteId)) next.delete(currentNoteId);
            else next.add(currentNoteId);
            return next;
        });
    }, [currentNoteId, listModeNotes]);

    const toggleMarkdownMode = useCallback(() => {
        if (!currentNoteId) return;
        setMarkdownModeNotes((prev) => {
            const next = new Set(prev);
            if (next.has(currentNoteId)) next.delete(currentNoteId);
            else next.add(currentNoteId);
            return next;
        });
    }, [currentNoteId]);

    const toggleHtmlMode = useCallback(() => {
        if (!currentNoteId) return;
        setHtmlModeNotes((prev) => {
            const next = new Set(prev);
            if (next.has(currentNoteId)) next.delete(currentNoteId);
            else next.add(currentNoteId);
            return next;
        });
    }, [currentNoteId]);

    const contentLineCount = useMemo(() => content.split("\n").filter((l) => l.trim().length > 0).length, [content]);
    const isListEligible = contentLineCount >= 2;
    const isGraphEligible = contentLineCount >= 2;

    const parsedTasks = useMemo(() => {
        if (!listMode && !graphMode) return [];
        return content.split("\n").filter((l) => l.trim().length > 0).map((line) => {
            const trimmed = line.trim();
            const done = /^\[x\]/i.test(trimmed);
            const text = trimmed.replace(/^\[x\]\s*/i, "").replace(/^\s*[-*•+_]\s*/, "").replace(/^\s*\d+\.\s*/, "").trim();
            return { done, text };
        });
    }, [content, listMode, graphMode]);

    const toggleTask = useCallback((taskIndex: number) => {
        const lines = content.split("\n");
        let nonEmptyIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().length > 0) {
                nonEmptyIdx++;
                if (nonEmptyIdx === taskIndex) {
                    const trimmed = lines[i].trim();
                    if (/^\[x\]/i.test(trimmed)) {
                        lines[i] = lines[i].replace(/^\s*\[x\]\s*/i, "");
                    } else {
                        lines[i] = `[x] ${lines[i]}`;
                    }
                    break;
                }
            }
        }
        setContent(lines.join("\n"));
    }, [content]);

    const deleteTask = useCallback((taskIndex: number) => {
        const lines = content.split("\n");
        let nonEmptyIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().length > 0) {
                nonEmptyIdx++;
                if (nonEmptyIdx === taskIndex) {
                    lines.splice(i, 1);
                    break;
                }
            }
        }
        setContent(lines.join("\n"));
        setConfirmDeleteTask(null);
    }, [content]);

    const openAddTask = useCallback(() => {
        setNewTaskText("");
        setShowAddTask(true);
        setTimeout(() => addTaskInputRef.current?.focus(), 50);
    }, []);

    const confirmAddTask = useCallback(() => {
        const text = newTaskText.trim();
        if (!text) { setShowAddTask(false); return; }
        setContent((prev) => (prev.trim() ? prev.trimEnd() + "\n" + text : text));
        setNewTaskText("");
        setTimeout(() => addTaskInputRef.current?.focus(), 50);
    }, [newTaskText]);

    // --- Graph/bubble force simulation ---
    useEffect(() => {
        if (!graphMode || parsedTasks.length === 0) {
            if (graphAnimRef.current) { cancelAnimationFrame(graphAnimRef.current); graphAnimRef.current = null; }
            graphNodesRef.current = [];
            return;
        }
        const container = graphContainerRef.current;
        if (!container) return;
        const W = container.clientWidth;
        const H = container.clientHeight;
        const R = Math.min(80, Math.max(40, Math.min(W, H) / (parsedTasks.length + 1)));
        const nodes = graphNodesRef.current;
        // Init or resize nodes
        while (nodes.length < parsedTasks.length) {
            const angle = (nodes.length / parsedTasks.length) * Math.PI * 2;
            const spread = Math.min(W, H) * 0.3;
            nodes.push({ x: W / 2 + Math.cos(angle) * spread + (Math.random() - 0.5) * 40, y: H / 2 + Math.sin(angle) * spread + (Math.random() - 0.5) * 40, vx: 0, vy: 0 });
        }
        while (nodes.length > parsedTasks.length) nodes.pop();
        let settled = 0;
        const step = () => {
            const pad = R + 4;
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                // Center gravity
                n.vx += (W / 2 - n.x) * 0.002;
                n.vy += (H / 2 - n.y) * 0.002;
                // Repulsion from other nodes
                for (let j = i + 1; j < nodes.length; j++) {
                    const o = nodes[j];
                    let dx = n.x - o.x, dy = n.y - o.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const minDist = R * 4.5;
                    if (dist < minDist) {
                        const force = (minDist - dist) / dist * 0.8;
                        dx *= force; dy *= force;
                        n.vx += dx; n.vy += dy;
                        o.vx -= dx; o.vy -= dy;
                    }
                }
                // Link attraction to neighbors
                if (i < nodes.length - 1) {
                    const o = nodes[i + 1];
                    const dx = o.x - n.x, dy = o.y - n.y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const ideal = R * 5;
                    const force = (dist - ideal) / dist * 0.03;
                    n.vx += dx * force; n.vy += dy * force;
                    o.vx -= dx * force; o.vy -= dy * force;
                }
            }
            let totalV = 0;
            for (const n of nodes) {
                n.vx *= 0.88; n.vy *= 0.88;
                n.x += n.vx; n.y += n.vy;
                if (n.x < pad) { n.x = pad; n.vx *= -0.5; }
                if (n.x > W - pad) { n.x = W - pad; n.vx *= -0.5; }
                if (n.y < pad) { n.y = pad; n.vy *= -0.5; }
                if (n.y > H - pad) { n.y = H - pad; n.vy *= -0.5; }
                totalV += Math.abs(n.vx) + Math.abs(n.vy);
            }
            setGraphTick((t) => t + 1);
            if (totalV > 0.2 && settled < 300) { settled++; graphAnimRef.current = requestAnimationFrame(step); }
            else { graphAnimRef.current = null; }
        };
        settled = 0;
        graphAnimRef.current = requestAnimationFrame(step);
        return () => { if (graphAnimRef.current) { cancelAnimationFrame(graphAnimRef.current); graphAnimRef.current = null; } };
    }, [graphMode, parsedTasks.length]);

    // --- Global graph (all folders + notes) ---
    useEffect(() => {
        if (!showGlobalGraph) {
            if (globalGraphAnimRef.current) { cancelAnimationFrame(globalGraphAnimRef.current); globalGraphAnimRef.current = null; }
            globalGraphNodesRef.current = [];
            return;
        }
        const timer = setTimeout(() => {
            const container = globalGraphContainerRef.current;
            if (!container) return;
            const W = container.clientWidth, H = container.clientHeight;
            const folderList = folders;
            const noteList = dbData.filter((r: any) => !r.is_folder);
            const folderR = Math.min(52, Math.max(26, Math.min(W, H) / (folderList.length * 2 + 4)));
            const noteR = Math.max(10, folderR * 0.45);
            const nodes: typeof globalGraphNodesRef.current = [];
            folderList.forEach((f, i) => {
                const angle = (i / Math.max(folderList.length, 1)) * Math.PI * 2;
                const spread = Math.min(W, H) * 0.18;
                nodes.push({ id: `f:${f.name}`, type: "folder", label: f.icon || f.name.charAt(0), color: f.color, r: folderR, x: W / 2 + Math.cos(angle) * spread, y: H / 2 + Math.sin(angle) * spread, vx: 0, vy: 0 });
            });
            noteList.forEach((n: any) => {
                const fi = nodes.findIndex((nd) => nd.id === `f:${n.folder_name}`);
                const fx = fi >= 0 ? nodes[fi].x : W / 2;
                const fy = fi >= 0 ? nodes[fi].y : H / 2;
                const a = Math.random() * Math.PI * 2;
                nodes.push({ id: `n:${n.id}`, type: "note", label: (n.title || "N").charAt(0).toUpperCase(), color: n.folder_color || "#555", folderName: String(n.folder_name || ""), r: noteR, x: fx + Math.cos(a) * folderR * 1.5 + (Math.random() - 0.5) * 20, y: fy + Math.sin(a) * folderR * 1.5 + (Math.random() - 0.5) * 20, vx: 0, vy: 0 });
            });
            globalGraphNodesRef.current = nodes;
            let settled = 0;
            const step = () => {
                const ns = globalGraphNodesRef.current;
                for (let i = 0; i < ns.length; i++) {
                    const n = ns[i];
                    n.vx += (W / 2 - n.x) * 0.001;
                    n.vy += (H / 2 - n.y) * 0.001;
                    for (let j = i + 1; j < ns.length; j++) {
                        const o = ns[j];
                        let dx = n.x - o.x, dy = n.y - o.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const minD = (n.r + o.r) * 3.2;
                        if (dist < minD) { const f = (minD - dist) / dist * 0.65; n.vx += dx * f; n.vy += dy * f; o.vx -= dx * f; o.vy -= dy * f; }
                    }
                    if (n.type === "note" && n.folderName) {
                        const fi = ns.findIndex((f) => f.id === `f:${n.folderName}`);
                        if (fi >= 0) {
                            const f = ns[fi];
                            const dx = f.x - n.x, dy = f.y - n.y;
                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                            const ideal = f.r * 2.2;
                            const force = (dist - ideal) / dist * 0.07;
                            n.vx += dx * force; n.vy += dy * force;
                            f.vx -= dx * force * 0.08; f.vy -= dy * force * 0.08;
                        }
                    }
                }
                let totalV = 0;
                for (const n of ns) {
                    n.vx *= 0.84; n.vy *= 0.84;
                    n.x += n.vx; n.y += n.vy;
                    const pad = n.r + 6;
                    if (n.x < pad) { n.x = pad; n.vx *= -0.3; }
                    if (n.x > W - pad) { n.x = W - pad; n.vx *= -0.3; }
                    if (n.y < pad) { n.y = pad; n.vy *= -0.3; }
                    if (n.y > H - pad) { n.y = H - pad; n.vy *= -0.3; }
                    totalV += Math.abs(n.vx) + Math.abs(n.vy);
                }
                setGlobalGraphTick((t) => t + 1);
                if (totalV > 0.25 && settled < 500) { settled++; globalGraphAnimRef.current = requestAnimationFrame(step); }
                else globalGraphAnimRef.current = null;
            };
            settled = 0;
            globalGraphAnimRef.current = requestAnimationFrame(step);
        }, 60);
        return () => { clearTimeout(timer); if (globalGraphAnimRef.current) { cancelAnimationFrame(globalGraphAnimRef.current); globalGraphAnimRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showGlobalGraph, folders.length, dbData.length]);

    const pickRandomPaletteColor = useCallback(() => palette12[Math.floor(Math.random() * palette12.length)], []);

    const applySingleFolderColor = useCallback(
        (color: string) => {
            if (!activeFolder) return;
            setFolderColors((prev) => ({ ...prev, [activeFolder]: color }));
            setFolderStack((prev) => prev.map((f) => f.name === activeFolder ? { ...f, color } : f));
            showToast("Folder Color Updated");
        },
        [activeFolder],
    );

    const renameFolderTo = useCallback(async (newName: string) => {
        if (!activeFolder || !newName.trim() || newName.trim() === activeFolder) return;
        const trimmed = newName.trim();
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
            await notesApi.updateByFolder({ folder_name: activeFolder }, { folder_name: trimmed });
            await notesApi.updateByFolder({ parent_folder_name: activeFolder }, { parent_folder_name: trimmed });
            showToast("Folder Renamed");
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
            showToast(parentName ? `→ ${parentName}` : "→ Root", color);
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
        setShowCreateFolder(false);
        setNewFolderName("");
        if (newFolderIcon) setFolderIcons((prev) => ({ ...prev, [folderName]: newFolderIcon }));
        setNewFolderIcon("");

        const exists = folderNames.some((name) => name.toLowerCase() === folderName.toLowerCase());
        if (exists) {
            showToast("Folder Exists");
            return;
        }

        const color = pickRandomPaletteColor();
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
        try {
            const { note: data } = await notesApi.insert(payload);
            if (data) {
                setDbData((prev) => prev.map((row) => (String(row.id) === optimisticId ? data : row)));
            }
            showToast("Folder Created");
        } catch (err) {
            console.error("Create folder failed:", err);
            setDbData((prev) => prev.filter((row) => String(row.id) !== optimisticId));
            showToast("Create Failed");
        }
    }, [newFolderName, folderNames, pickRandomPaletteColor]);

    const handleFolderFabPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            event.stopPropagation();
            event.preventDefault();
            stopFolderFabAnimation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setIsFolderFabDragging(true);
            folderFabDragRef.current = {
                pointerId: event.pointerId,
                lastX: event.clientX,
                lastY: event.clientY,
                velocityX: 0,
                velocityY: 0,
                dragged: false,
            };
        },
        [stopFolderFabAnimation],
    );

    const handleFolderFabPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = folderFabDragRef.current;
            if (drag.pointerId !== event.pointerId) return;
            event.stopPropagation();
            event.preventDefault();

            const rawDx = event.clientX - drag.lastX;
            const rawDy = event.clientY - drag.lastY;
            if (rawDx === 0 && rawDy === 0) return;

            const { dx, dy } = clampFolderFabDelta(rawDx, rawDy);
            const next = {
                x: folderFabOffsetRef.current.x + dx,
                y: folderFabOffsetRef.current.y + dy,
            };
            setFolderFabOffsetWithRef(next);

            drag.velocityX = drag.velocityX * 0.45 + dx * 0.55;
            drag.velocityY = drag.velocityY * 0.45 + dy * 0.55;
            drag.lastX = event.clientX;
            drag.lastY = event.clientY;
            if (!drag.dragged && Math.hypot(next.x, next.y) > 4) drag.dragged = true;
        },
        [clampFolderFabDelta, setFolderFabOffsetWithRef],
    );

    const handleFolderFabPointerUp = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = folderFabDragRef.current;
            if (drag.pointerId !== event.pointerId) return;
            event.stopPropagation();
            event.preventDefault();
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                // no-op
            }
            setIsFolderFabDragging(false);
            const didDrag = drag.dragged || Math.hypot(folderFabOffsetRef.current.x, folderFabOffsetRef.current.y) > 4;
            const launchX = drag.velocityX * 1.3;
            const launchY = drag.velocityY * 1.3;
            folderFabDragRef.current = {
                pointerId: null,
                lastX: 0,
                lastY: 0,
                velocityX: 0,
                velocityY: 0,
                dragged: false,
            };
            if (didDrag) {
                animateFolderFabBack(launchX, launchY);
                return;
            }
            openCreateFolder();
        },
        [animateFolderFabBack, openCreateFolder],
    );

    const handleFolderFabPointerCancel = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = folderFabDragRef.current;
            if (drag.pointerId !== event.pointerId) return;
            event.stopPropagation();
            event.preventDefault();
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                // no-op
            }
            setIsFolderFabDragging(false);
            folderFabDragRef.current = {
                pointerId: null,
                lastX: 0,
                lastY: 0,
                velocityX: 0,
                velocityY: 0,
                dragged: false,
            };
            if (Math.hypot(folderFabOffsetRef.current.x, folderFabOffsetRef.current.y) > 0.5) {
                animateFolderFabBack(0, 0);
            }
        },
        [animateFolderFabBack],
    );

    const isFolderGridView = !activeFolder && !search.trim();
    const isNoteGridView = Boolean(activeFolder) && !search.trim();
    const fitAllMode = (isFolderGridView || isNoteGridView) && displayItems.length > 12;
    const fitCols = fitAllMode ? Math.ceil(Math.sqrt(displayItems.length)) : 0;
    const fitRows = fitAllMode ? Math.ceil(displayItems.length / fitCols) : 0;

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


    const handleTileDragStart = useCallback(
        (event: React.DragEvent<HTMLDivElement>, item: any) => {
            const id = String(item?.id || "");
            if (!id) return;
            if (!isFolderGridView && !isNoteGridView) return;
            suppressOpenRef.current = true;
            draggingTileIdRef.current = id;
            setDraggingTileId(id);
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
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
            let mode: "before" | "after" | "into" = "after";
            if (mainListMode) {
                const relY = (event.clientY - rect.top) / rect.height;
                if (item?.is_folder && relY > 0.25 && relY < 0.75) mode = "into";
                else mode = relY < 0.5 ? "before" : "after";
            } else {
                const relX = (event.clientX - rect.left) / rect.width;
                if (item?.is_folder && relX > 0.2 && relX < 0.8) mode = "into";
                else mode = relX < 0.5 ? "before" : "after";
            }
            setDropTarget({ id: targetId, mode });
        },
        [mainListMode],
    );

    const handleTileDragLeave = useCallback(() => {
        setDropTarget(null);
    }, []);

    const handleTileDragEnd = useCallback(() => {
        draggingTileIdRef.current = null;
        setDraggingTileId(null);
        setDropTarget(null);
        window.setTimeout(() => { suppressOpenRef.current = false; }, 0);
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
                    } else if (!sourceItem?.is_folder) {
                        // Note into folder → move
                        await notesApi.update(sourceId, { folder_name: destFolder });
                        setDbData((prev) => prev.map((r) => String(r.id) === sourceId ? { ...r, folder_name: destFolder } : r));
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

    const recalcMainScrollable = useCallback(() => {
        const el = mainScrollRef.current;
        if (!el) return;
        const canScrollY = el.scrollHeight - el.clientHeight > 1;
        const canScrollX = el.scrollWidth - el.clientWidth > 1;
        setMainScrollable(canScrollY || canScrollX);
    }, []);

    const recalcEditorScrollable = useCallback(() => {
        const el = editorTextRef.current;
        if (!el) return;
        const canScrollY = el.scrollHeight - el.clientHeight > 1;
        const canScrollX = el.scrollWidth - el.clientWidth > 1;
        setEditorScrollable(canScrollY || canScrollX);
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(recalcMainScrollable);
        return () => cancelAnimationFrame(frame);
    }, [recalcMainScrollable, displayItems, activeFolder, search, editorOpen]);

    useEffect(() => {
        if (!editorOpen) {
            setEditorScrollable(false);
            return;
        }
        const frame = requestAnimationFrame(recalcEditorScrollable);
        return () => cancelAnimationFrame(frame);
    }, [editorOpen, content, recalcEditorScrollable]);

    useEffect(() => {
        const onResize = () => {
            recalcMainScrollable();
            recalcEditorScrollable();
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [recalcMainScrollable, recalcEditorScrollable]);

    useEffect(() => {
        return () => {
            if (folderFabAnimFrameRef.current !== null) {
                cancelAnimationFrame(folderFabAnimFrameRef.current);
                folderFabAnimFrameRef.current = null;
            }
        };
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
                setShowGlobalGraph(false);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown, { passive: true });
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [editorOpen, showColorPicker, showSwitcher, closeEditorTools]);

    const createRipple = (e: any, color: string) => {
        const ripple = {
            x: e.clientX,
            y: e.clientY,
            color: color || "#FFFFFF",
            id: `${Date.now()}-${Math.random()}`,
        };
        setRipples((prev) => [...prev, ripple]);
        setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== ripple.id)), 1400);
    };

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

    useEffect(() => {
        if (!editorOpen) return;
        const frame = requestAnimationFrame(() => {
            const el = editorTextRef.current;
            if (!el) return;
            const styles = window.getComputedStyle(el);
            const lh = parseFloat(styles.lineHeight);
            const pt = parseFloat(styles.paddingTop);
            if (!Number.isNaN(lh)) setEditorLineHeight(lh);
            if (!Number.isNaN(pt)) setEditorPaddingTop(pt);
        });
        return () => cancelAnimationFrame(frame);
    }, [editorOpen]);

    if (!mounted || isUrlChecking) return <div className="h-screen bg-black" />;
    const activeAccentColor = noteColor || editingNote?.folder_color || folders.find((f) => f.name === activeFolder)?.color || "#22d3ee";
    const noteBadgeInitial = (title.trim() || editingNote?.title || "N").charAt(0).toUpperCase();
    const activeFolderColor = (activeFolder
        ? (folderStack.at(-1)?.color
            || dbData.find((r) => r.is_folder && r.folder_name === activeFolder)?.folder_color
            || folderColors[activeFolder])
        : null) || "#22d3ee";
    const activeFolderInitial = (activeFolder || "F").trim().charAt(0).toUpperCase();
    const showEmptyFolderPulse = Boolean(activeFolder && isEmptyView);

    return (
        <div className="safe-shell box-border h-[100dvh] bg-black text-white font-sans select-none overflow-hidden overscroll-none flex flex-col" onClick={(e) => createRipple(e, folders.find((f) => f.name === activeFolder)?.color || "#FFFFFF")}>

            {/* ── AI Cleanup Mode Overlay ── */}
            {aiMode.active && (
                <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "transparent", backdropFilter: "blur(2px)", pointerEvents: "none" }}>
                    <style>{`
                        @keyframes botBounceX {
                            from { left: 20px; }
                            to   { left: calc(100vw - 92px); }
                        }
                        @keyframes botBounceY {
                            from { top: 20px; }
                            to   { top: calc(100vh - 110px); }
                        }
                        @keyframes botArm {
                            0%, 100% { transform: rotate(-20deg); }
                            50%       { transform: rotate(20deg); }
                        }
                        @keyframes botEye {
                            0%, 90%, 100% { transform: scaleY(1); }
                            95%           { transform: scaleY(0.1); }
                        }
                        @keyframes sweep {
                            0%, 100% { transform: rotate(-30deg); }
                            50%       { transform: rotate(30deg); }
                        }
                        @keyframes dustPop {
                            0%   { opacity: 0; transform: scale(0); }
                            30%  { opacity: 1; transform: scale(1.2); }
                            100% { opacity: 0; transform: scale(0) translateY(-20px); }
                        }
                    `}</style>

                    {/* Pong-bouncing bot */}
                    <div style={{
                        position: "absolute",
                        pointerEvents: "none",
                        animation: "botBounceX 1.4s linear infinite alternate, botBounceY 1.1s linear infinite alternate",
                    }}>
                        <svg width="72" height="80" viewBox="0 0 72 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {/* Broom */}
                            <g style={{ transformOrigin: "36px 60px", animation: "sweep 0.6s ease-in-out infinite" }}>
                                <line x1="36" y1="58" x2="14" y2="74" stroke={botColor.secondary} strokeWidth="2.5" strokeLinecap="round"/>
                                <rect x="6" y="72" width="16" height="5" rx="2" fill={botColor.primary}/>
                            </g>
                            {/* Body */}
                            <rect x="18" y="28" width="36" height="30" rx="8" fill="#1e1e2e" stroke={botColor.primary} strokeWidth="2"/>
                            {/* Head */}
                            <rect x="20" y="8" width="32" height="24" rx="7" fill="#1e1e2e" stroke={botColor.secondary} strokeWidth="2"/>
                            {/* Antenna */}
                            <line x1="36" y1="8" x2="36" y2="2" stroke={botColor.secondary} strokeWidth="2" strokeLinecap="round"/>
                            <circle cx="36" cy="2" r="2.5" fill={botColor.light}/>
                            {/* Eyes */}
                            <g style={{ animation: "botEye 3s ease-in-out infinite" }}>
                                <rect x="24" y="16" width="8" height="8" rx="2" fill={botColor.primary}/>
                                <rect x="40" y="16" width="8" height="8" rx="2" fill={botColor.primary}/>
                                <circle cx="27" cy="19" r="2" fill={botColor.light}/>
                                <circle cx="43" cy="19" r="2" fill={botColor.light}/>
                            </g>
                            {/* Mouth */}
                            <path d="M28 30 Q36 35 44 30" stroke={botColor.secondary} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                            {/* Arms */}
                            <g style={{ transformOrigin: "18px 36px", animation: "botArm 0.6s ease-in-out infinite" }}>
                                <rect x="8" y="32" width="12" height="7" rx="3.5" fill="#1e1e2e" stroke={botColor.primary} strokeWidth="1.5"/>
                            </g>
                            <rect x="52" y="32" width="12" height="7" rx="3.5" fill="#1e1e2e" stroke={botColor.primary} strokeWidth="1.5"/>
                            {/* Legs */}
                            <rect x="23" y="56" width="10" height="12" rx="4" fill="#1e1e2e" stroke={botColor.primary} strokeWidth="1.5"/>
                            <rect x="39" y="56" width="10" height="12" rx="4" fill="#1e1e2e" stroke={botColor.primary} strokeWidth="1.5"/>
                            {/* Dust particles */}
                            <circle cx="10" cy="76" r="3" fill={botColor.light} style={{ animation: "dustPop 0.6s ease-out infinite" }}/>
                            <circle cx="4"  cy="72" r="2" fill={botColor.primary} style={{ animation: "dustPop 0.6s ease-out 0.2s infinite" }}/>
                        </svg>
                        {/* Label under bot */}
                        <p style={{ color: botColor.light, fontSize: 11, fontWeight: 600, textAlign: "center", marginTop: 6, letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{aiMode.message}</p>
                    </div>
                </div>
            )}

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
                @keyframes noteCardFlash {
                    0%   { opacity: 0; transform: scale(0.85); }
                    12%  { opacity: 1; transform: scale(1); }
                    80%  { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(1.04); }
                }
                @keyframes rippleEffect {
                    0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; border-width: 4px; }
                    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; border-width: 1px; }
                }
                html, body { background-color: #000 !important; }
                .ripple-ring {
                    position: fixed;
                    pointer-events: none;
                    z-index: 9999;
                    width: 560px;
                    height: 560px;
                    border: 2px solid var(--c);
                    border-radius: 50% !important;
                    transform: translate(-50%, -50%) scale(0);
                    will-change: transform, opacity;
                    animation: rippleEffect 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fabFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .fab-float {
                    animation: fabFloat 2.2s ease-in-out infinite;
                }
                .task-card-pattern {
                    background-image: radial-gradient(circle, rgba(0,0,0,0.2) 1px, transparent 1px);
                    background-size: 8px 8px;
                }
                .md-preview { color: #e4e4e7; line-height: 1.6; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9px; text-align: left; }
                .md-preview h1,.md-preview h2,.md-preview h3,.md-preview h4,.md-preview h5,.md-preview h6 { font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; color: #fff; margin: 1em 0 0.4em; line-height: 1.2; text-align: left; }
                .md-preview h1 { font-size: 1.3rem; border-bottom: 2px solid rgba(255,255,255,0.12); padding-bottom: 0.3em; }
                .md-preview h2 { font-size: 1.05rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.2em; }
                .md-preview h3 { font-size: 0.9rem; }
                .md-preview h4,.md-preview h5,.md-preview h6 { font-size: 0.8rem; color: #a1a1aa; }
                .md-preview p { margin: 0.75em 0; text-align: left; }
                .md-preview ul,.md-preview ol { padding-left: 1.5em; margin: 0.75em 0; }
                .md-preview li { margin: 0.25em 0; }
                .md-preview ul li { list-style-type: disc; }
                .md-preview ol li { list-style-type: decimal; }
                .md-preview li::marker { color: #71717a; }
                .md-preview strong { font-weight: 900; color: #fff; }
                .md-preview em { font-style: italic; color: #d4d4d8; }
                .md-preview code { font-family: ui-monospace, monospace; font-size: 0.82em; background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 3px; color: #67e8f9; }
                .md-preview pre { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); padding: 1em; margin: 0.75em 0; overflow-x: auto; border-radius: 4px; }
                .md-preview pre code { background: none; padding: 0; color: #a5f3fc; font-size: 0.85em; }
                .md-preview blockquote { border-left: 3px solid rgba(255,255,255,0.2); padding-left: 1em; margin: 0.75em 0; color: #71717a; font-style: italic; }
                .md-preview a { color: #38bdf8; text-decoration: underline; }
                .md-preview hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5em 0; }
                .md-preview table { width: 100%; border-collapse: collapse; margin: 0.75em 0; font-size: 0.85em; }
                .md-preview th { background: rgba(255,255,255,0.06); color: #fff; font-weight: 900; text-transform: uppercase; font-size: 0.75em; letter-spacing: 0.05em; }
                .md-preview th,.md-preview td { border: 1px solid rgba(255,255,255,0.1); padding: 0.5em 0.75em; text-align: left; }
                .md-preview tr:nth-child(even) td { background: rgba(255,255,255,0.02); }
                .md-preview input[type="checkbox"] { accent-color: #22d3ee; margin-right: 0.4em; }
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
                .bubble-text-clamp {
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    word-break: break-word;
                }
                .list-row-hover {
                    transition: background-color 0.3s ease;
                }
                .list-row-hover:hover {
                    background-color: color-mix(in srgb, var(--row-color, #ffffff) 12%, transparent) !important;
                }
                @keyframes islandToastInOut {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-10px) scale(0.72);
                    }
                    14% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                    82% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(-8px) scale(0.78);
                    }
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
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
                .safe-top-pad {
                    padding-top: env(safe-area-inset-top, 0px);
                }
                .safe-top-bar {
                    height: env(safe-area-inset-top, 0px);
                }
                @supports (-webkit-touch-callout: none) {
                    @media (max-width: 640px) {
                        .ios-mobile-header {
                            border-bottom-color: transparent !important;
                        }
                        .ios-mobile-main {
                            gap: 1px !important;
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
                .md-preview { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
            `}</style>

            <div className="fixed inset-0 pointer-events-none z-[9999]">
                {ripples.map((r) => (
                    <div key={r.id} className="ripple-ring" style={{ left: r.x, top: r.y, "--c": r.color } as any} />
                ))}
            </div>

            {toast && (
                <div
                    className="fixed left-1/2 -translate-x-1/2 z-[100002] pointer-events-none"
                    style={{
                        top: "calc(env(safe-area-inset-top, 0px) + 6px)",
                        animation: "islandToastInOut 3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                    }}>
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-white" style={{
                        background: toastColor,
                        border: `1px solid ${toastColor}99`,
                        boxShadow: `0 8px 26px ${toastColor}66`,
                    }}>
                        <span className="font-black uppercase tracking-wide text-[7px] sm:text-[8px] leading-none whitespace-nowrap">{toast}</span>
                    </div>
                </div>
            )}

            {editorOpen ? (
                <section className="flex-1 min-h-0 border-2 flex flex-col overflow-hidden overscroll-none" style={{ borderColor: activeAccentColor }} onClick={(e) => e.stopPropagation()}>
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
                    <div className="safe-top-bar shrink-0" style={{ backgroundColor: activeAccentColor }} />
                    <div className="relative h-auto min-h-[3.5rem] sm:min-h-[4rem] px-2 sm:px-4 bg-zinc-900 border-b border-white/10 flex items-center gap-1 sm:gap-2 shrink-0">
                        <button
                            onClick={(e) => { e.stopPropagation(); void backToRootFromEditor(); }}
                            className="p-2 text-blue-500 hover:bg-white/10 transition flex-shrink-0"
                            title={`Back to ${targetFolder || "folders"}`}
                            aria-label={`Back to ${targetFolder || "folders"}`}>
                            <ArrowLeftIcon className="w-8 h-8" />
                        </button>

                        {/* Desktop: folder breadcrumbs + note title inline */}
                        <div className="hidden sm:flex items-center gap-1 min-w-0 overflow-hidden flex-1">
                            {folderStack.map((frame, i) => (
                                <React.Fragment key={frame.id + i}>
                                    {i > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                                    <button type="button"
                                        onClick={() => { goToIndex(i); void backToRootFromEditor(); }}
                                        className="flex items-center gap-1.5 font-black tracking-tight text-zinc-400 hover:text-white transition flex-shrink-0 text-xs px-1">
                                        <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-sm font-black text-white leading-none" style={{ backgroundColor: frame.color }}>
                                            {folderIcons[frame.name] || (frame.name || "F").charAt(0).toUpperCase()}
                                        </span>
                                        {frame.name}
                                    </button>
                                </React.Fragment>
                            ))}
                            {folderStack.length > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                            <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-sm font-black leading-none" style={{ border: `1.5px solid ${activeAccentColor}99`, color: activeAccentColor }}>
                                {noteBadgeInitial}
                            </span>
                            <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-1 min-w-0 flex-1 font-black tracking-tight text-xs text-white placeholder:text-zinc-500" style={{ caretColor: activeAccentColor }} placeholder="NOTE TITLE" />
                        </div>

                        {/* Mobile: badge + title */}
                        <span className="sm:hidden w-[22px] h-[22px] inline-flex items-center justify-center text-[10px] font-black leading-none flex-shrink-0" style={{ border: `1.5px solid ${activeAccentColor}99`, color: activeAccentColor }}>
                            {noteBadgeInitial}
                        </span>
                        <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="sm:hidden bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-2 flex-grow text-sm text-white placeholder:text-zinc-500" style={{ caretColor: activeAccentColor, border: "none" }} placeholder="NOTE TITLE" />

                        <button type="button"
                            onClick={() => { setSharePickerOpen(true); setShowNoteActions(false); closeEditorTools(); }}
                            className="p-2 sm:p-3 text-zinc-300 hover:text-white active:text-white transition flex-shrink-0">
                            <ShareIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                        <button type="button"
                            onClick={() => { setShowNoteActions(true); closeEditorTools(); }}
                            className="p-2 sm:p-3 text-zinc-300 hover:text-white active:text-white transition flex-shrink-0">
                            <Cog6ToothIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                        </button>
                    </div>
                    <div className="flex-1 flex overflow-hidden bg-black font-mono">
                        {graphMode ? (
                            <div ref={graphContainerRef} className="relative flex-1 overflow-hidden">
                                {parsedTasks.length === 0 ? (
                                    <div className="text-zinc-500 text-center pt-12 text-sm font-bold">NO TASKS — SWITCH TO LIST MODE TO ADD</div>
                                ) : (
                                <>
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                    {graphNodesRef.current.map((node, i) => {
                                        if (i >= graphNodesRef.current.length - 1) return null;
                                        const next = graphNodesRef.current[i + 1];
                                        return <line key={`l${i}`} x1={node.x} y1={node.y} x2={next.x} y2={next.y} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />;
                                    })}
                                </svg>
                                {graphNodesRef.current.map((node, i) => {
                                    if (i >= parsedTasks.length) return null;
                                    const task = parsedTasks[i];
                                    const c = palette12[i % palette12.length];
                                    const size = Math.min(160, Math.max(80, 60 + task.text.length * 1.8));
                                    const numSize = Math.max(28, size * 0.45);
                                    const r = size / 2;
                                    const textR = r - 10;
                                    const pathId = `bp${i}`;
                                    return (
                                        <button key={i} type="button" onClick={() => toggleTask(i)}
                                            className={`bubble-idle absolute rounded-full overflow-hidden transition-shadow ${task.done ? "opacity-50 ring-2 ring-emerald-500" : "hover:shadow-[0_0_24px_rgba(255,255,255,0.25)]"}`}
                                            style={{
                                                left: node.x - r, top: node.y - r,
                                                width: size, height: size,
                                                background: `${c}${task.done ? "30" : "70"}`,
                                                animationDelay: `${i * 0.4}s`,
                                                zIndex: 1,
                                            }}>
                                            <span className="task-card-pattern absolute inset-0 rounded-full pointer-events-none" />
                                            <span className="absolute inset-0 flex items-center justify-center font-black pointer-events-none select-none" style={{ fontSize: numSize, color: "rgba(255,255,255,0.15)", lineHeight: 1 }}>{i + 1}</span>
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2]" viewBox={`0 0 ${size} ${size}`}>
                                                <defs>
                                                    <path id={pathId} d={`M ${r},${r - textR} A ${textR},${textR} 0 1,1 ${r - 0.01},${r - textR}`} fill="none" />
                                                </defs>
                                                <text fill={task.done ? "#777" : "#fff"} fontSize={size < 100 ? "9" : "11"} fontWeight="700" fontFamily="monospace">
                                                    <textPath href={`#${pathId}`} startOffset="0%">{task.text}</textPath>
                                                </text>
                                            </svg>
                                        </button>
                                    );
                                })}
                                </>
                                )}
                                {!showAddTask ? (
                                    <button type="button" onClick={openAddTask} aria-label="Add task" className="fab-float absolute bottom-4 right-4 w-16 h-16 rounded-full bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-110 transition-transform z-10">
                                        <PlusIcon className="w-8 h-8" />
                                    </button>
                                ) : (
                                    <div className="absolute bottom-4 left-3 right-3 flex items-center gap-2 px-3 py-2 bg-black/80 border border-white/10 rounded-lg z-10">
                                        <input ref={addTaskInputRef} type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmAddTask(); if (e.key === "Escape") setShowAddTask(false); }} className="flex-1 bg-transparent text-white text-[12px] sm:text-sm font-bold outline-none border-none shadow-none placeholder:text-zinc-600" placeholder="Type a task..." autoComplete="off" />
                                        <button type="button" onClick={confirmAddTask} className="text-emerald-400 text-[11px] font-black">ADD</button>
                                        <button type="button" onClick={() => setShowAddTask(false)} className="text-zinc-500 text-[11px] font-black">ESC</button>
                                    </div>
                                )}
                            </div>
                        ) : listMode ? (
                            <div className="relative flex-1 overflow-y-auto p-3 sm:p-6" style={{ paddingRight: "80px" }}>
                                <div className="space-y-2">
                                {parsedTasks.length === 0 && !showAddTask ? (
                                    <div className="text-zinc-500 text-center pt-12 text-sm font-bold">NO TASKS — TAP + TO ADD ONE</div>
                                ) : parsedTasks.map((task, i) => {
                                    const c = palette12[i % palette12.length];
                                    const isConfirming = confirmDeleteTask === i;
                                    return (
                                    <div key={i} className="group task-card-row w-full flex items-center gap-3 px-3 py-3 relative overflow-hidden transition-all cursor-pointer" style={{ borderLeft: `3px solid ${c}`, background: task.done ? `${c}20` : `${c}50` }} onClick={() => toggleTask(i)}>
                                        <span className="task-card-pattern absolute inset-0 pointer-events-none" />
                                        {/* Checkbox */}
                                        <span className="relative flex-shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all" style={{ borderColor: task.done ? c : `${c}80`, backgroundColor: task.done ? c : "transparent" }}>
                                            {task.done && (
                                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            )}
                                        </span>
                                        <span className={`relative flex-1 text-left text-[12px] sm:text-sm font-bold truncate ${task.done ? "line-through text-zinc-600" : "text-white"}`}>{task.text}</span>
                                        <span className="relative flex items-center gap-1 flex-shrink-0">
                                            {isConfirming ? (
                                                <>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDeleteTask(null); }} className="p-1 text-zinc-400 hover:text-white transition" title="Cancel"><span className="text-[13px] font-black">✕</span></button>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteTask(i); }} className="p-1 text-red-400 hover:text-red-300 transition" title="Confirm delete"><CheckCircleIcon className="w-5 h-5" /></button>
                                                </>
                                            ) : (
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDeleteTask(i); }} className="p-1 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition" title="Delete"><TrashIcon className="w-4 h-4" /></button>
                                            )}
                                        </span>
                                    </div>
                                    );
                                })}
                                {showAddTask && (
                                    <div className="relative overflow-hidden flex items-center gap-3 px-3 py-2" style={{ borderLeft: `3px solid ${palette12[parsedTasks.length % palette12.length]}`, background: `${palette12[parsedTasks.length % palette12.length]}50` }}>
                                        <span className="task-card-pattern absolute inset-0 pointer-events-none" />
                                        <span className="text-[11px] font-black w-6 text-right flex-shrink-0" style={{ color: palette12[parsedTasks.length % palette12.length] }}>{String(parsedTasks.length + 1).padStart(2, "0")}</span>
                                        <input
                                            ref={addTaskInputRef}
                                            type="text"
                                            value={newTaskText}
                                            onChange={(e) => setNewTaskText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") confirmAddTask(); if (e.key === "Escape") setShowAddTask(false); }}
                                            className="flex-1 bg-transparent text-white text-[12px] sm:text-sm font-bold outline-none border-none shadow-none placeholder:text-zinc-600"
                                            placeholder="Type a task..."
                                            autoComplete="off"
                                        />
                                        <button type="button" onClick={confirmAddTask} className="text-emerald-400 text-[11px] font-black hover:text-emerald-300 transition">ADD</button>
                                        <button type="button" onClick={() => setShowAddTask(false)} className="text-zinc-500 text-[11px] font-black hover:text-zinc-300 transition">ESC</button>
                                    </div>
                                )}
                                </div>
                                {!showAddTask && (
                                    <button type="button" onClick={openAddTask} aria-label="Add task" className="fab-float absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white text-black shadow-[0_8px_20px_rgba(0,0,0,0.4)] flex items-center justify-center hover:scale-110 transition-transform">
                                        <PlusIcon className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        ) : htmlMode ? (
                            <iframe
                                srcDoc={content}
                                className="flex-1 w-full border-0"
                                sandbox="allow-scripts"
                                title="HTML Preview"
                            />
                        ) : markdownMode ? (
                            <div
                                className="flex-1 overflow-y-auto p-4 sm:p-8 ios-editor-scroll"
                                onClick={toggleMarkdownMode}
                                title="Click to edit"
                            >
                                {content.trim() ? (
                                    <div
                                        className="md-preview w-full"
                                        dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-zinc-600 text-sm font-bold uppercase tracking-wide">No content — click to edit</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                        <>
                        <div className="hidden sm:block w-10 bg-black/60 border-r border-white/10 text-white/60 text-[9px] font-black select-none overflow-hidden" aria-hidden="true">
                            <div style={{ transform: `translateY(-${editorScrollTop}px)`, paddingTop: `${editorPaddingTop}px` }}>
                                {content.split("\n").map((_, i) => (
                                    <div key={i} className={`text-center transition-colors ${activeLine === i ? "text-white" : "text-white/60"}`} style={{ height: `${editorLineHeight}px`, lineHeight: `${editorLineHeight}px` }}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative flex-1">
                            <textarea
                                ref={editorTextRef}
                                value={content}
                                onChange={(e) => {
                                    setContent(e.target.value);
                                    handleCursorUpdate(e);
                                }}
                                onKeyUp={handleCursorUpdate}
                                onClick={(e) => {
                                    closeEditorTools();
                                    handleCursorUpdate(e);
                                }}
                                onScroll={handleEditorScroll}
                                onFocus={(e) => {
                                    closeEditorTools();
                                    handleCursorUpdate(e);
                                }}
                                onBlur={() => {
                                    void saveNote({ silent: false });
                                }}
                                className={`note-textarea ios-editor-scroll relative z-10 w-full h-full bg-black pt-2 px-3 pb-3 sm:pt-2 sm:px-8 sm:pb-8 outline-none resize-none font-mono leading-5 sm:leading-relaxed overflow-x-hidden overscroll-none ${editorScrollable ? "touch-pan-y" : "touch-none"}`}
                                style={{ caretColor: activeAccentColor, paddingRight: "80px" }}
                                placeholder="START TYPING..."
                            />
                            {/* Floating copy button */}
                            {content && (
                                <button
                                    type="button"
                                    aria-label="Copy content"
                                    onClick={() => {
                                        secureCopy(content);
                                        setCopiedContent(true);
                                        setTimeout(() => setCopiedContent(false), 2000);
                                    }}
                                    className="absolute top-2 right-2 z-20 flex items-center justify-center w-7 h-7 rounded-md transition-all"
                                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.15)"; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
                                >
                                    {copiedContent
                                        ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                                        : <DocumentDuplicateIcon className="w-3.5 h-3.5 text-zinc-400" />
                                    }
                                </button>
                            )}
                        </div>
                        </>
                        )}
                    </div>
                </section>
            ) : (
                <>
                    <div className="safe-top-bar shrink-0 bg-black sticky top-0 z-40" />
                    <header className="ios-mobile-header relative h-auto min-h-[3.5rem] sm:min-h-[4rem] px-2 sm:px-4 border-b border-transparent sm:border-white/10 flex items-center gap-1 sm:gap-2 sticky top-0 bg-zinc-900 z-40 shrink-0">
                        {folderStack.length > 0 && (
                            <>
                                <button
                                    onClick={() => { goBack(); }}
                                    className="p-3 text-blue-500 hover:bg-white/10 transition flex-shrink-0">
                                    <ArrowLeftIcon className="w-8 h-8" />
                                </button>
                                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                    {folderStack.map((frame, i) => (
                                        <React.Fragment key={frame.id + i}>
                                            {i > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                                            <button
                                                onClick={() => { goToIndex(i); }}
                                                className={`flex items-center gap-1.5 font-black tracking-tight truncate max-w-[120px] sm:max-w-[150px] flex-shrink-0 px-1 transition text-xs sm:text-xs ${i === folderStack.length - 1 ? "text-white" : "text-zinc-400 hover:text-white"}`}
                                                title={frame.name}>
                                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm font-black text-white leading-none" style={{ backgroundColor: frame.color }}>
                                                    {folderIcons[frame.name] || (frame.name || "F").charAt(0).toUpperCase()}
                                                </span>
                                                {frame.name}
                                            </button>
                                        </React.Fragment>
                                    ))}
                                    <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>
                                </div>
                            </>
                        )}

                        {!activeFolder ? (
                            <>
                                <div className={`relative py-2 sm:py-0 transition-all duration-200 ${searchFocused || search.trim() ? "flex-1" : "w-[62%] sm:w-[320px]"}`}>
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 w-6 h-6 pointer-events-none" />
                                    <input value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="search" className="w-full bg-zinc-900 sm:bg-white/5 border-0 outline-none focus:outline-none focus:ring-0 shadow-none appearance-none pl-12 pr-3 py-3 text-xs sm:text-sm font-black tracking-tight" placeholder="search" />
                                </div>
                                <div className="ml-auto flex items-center gap-1">
                                    <HeaderIconBtn icon={PlusIcon} label="New folder" onClick={openCreateFolder} />
                                    <HeaderIconBtn icon={mainListMode ? Squares2X2Icon : ListBulletIcon} label={mainListMode ? "Grid view" : "List view"} onClick={() => setMainListMode((v) => !v)} />
                                    <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => setShowFolderActions(true)} />
                                </div>
                            </>
                        ) : (
                            <div className="ml-auto flex items-center gap-1 pr-1 sm:pr-0">
                                <HeaderIconBtn icon={mainListMode ? Squares2X2Icon : ListBulletIcon} label={mainListMode ? "Grid view" : "List view"} onClick={() => setMainListMode((v) => !v)} />
                                <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => setShowFolderActions(true)} />
                            </div>
                        )}
                    </header>

                    <main ref={mainScrollRef}
                        className={`ios-mobile-main relative flex-1 overflow-x-hidden overflow-y-auto touch-pan-y overscroll-none bg-black ${(!showGlobalGraph) ? "pb-24 sm:pb-32" : ""} ${!mainListMode ? "p-1.5 sm:p-2" : ""}`}
                        style={mainListMode
                            ? { display: "block" }
                            : { display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: "6px", alignContent: "start", alignItems: "start" }}
                    >
                        {displayItems.map((item, idx) => {
                            const tileId = String(item.id || "");
                            const isDragging = draggingTileId === tileId;
                            const dt = dropTarget?.id === tileId ? dropTarget : null;
                            const canDrag = isFolderGridView || isNoteGridView;
                            return (
                                <div
                                    key={item.id || idx}
                                    draggable={canDrag}
                                    onDragStart={(e) => handleTileDragStart(e, item)}
                                    onDragOver={(e) => handleTileDragOver(e, item)}
                                    onDragLeave={handleTileDragLeave}
                                    onDrop={(e) => { void handleTileDrop(e, item); }}
                                    onDragEnd={handleTileDragEnd}
                                    onClick={(e) => {
                                        if (suppressOpenRef.current) { suppressOpenRef.current = false; return; }
                                        e.stopPropagation();
                                        createRipple(e, item.color || item.folder_color || "#FFFFFF");
                                        if (item.is_folder) {
                                            enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                        } else {
                                            setEditingNote(item);
                                            setTitle(item.title);
                                            setContent(item.content);
                                            setTargetFolder(item.folder_name || activeFolder || "General");
                                            setNoteColor(item.folder_color || folders.find((f) => f.name === (item.folder_name || activeFolder))?.color || palette12[0]);
                                            setShowColorPicker(false);
                                            setShowSwitcher(false);
                                            setActiveLine(0);
                                            setEditorScrollTop(0);
                                            if (item.id && looksLikeMarkdown(item.content || "")) {
                                                setMarkdownModeNotes((prev) => new Set([...prev, String(item.id)]));
                                            }
                                            if (item.id && looksLikeHtml(item.content || "")) {
                                                setHtmlModeNotes((prev) => new Set([...prev, String(item.id)]));
                                            }
                                            if (item.id && item.list_mode) {
                                                setListModeNotes((prev) => new Set([...prev, String(item.id)]));
                                            }
                                            setEditorOpen(true);
                                        }
                                    }}
                                    style={mainListMode
                                        ? { position: "relative", "--row-color": item.color || item.folder_color || "#ffffff" } as React.CSSProperties
                                        : { position: "relative", backgroundColor: item.color || item.folder_color }}
                                    className={`${mainListMode
                                        ? `list-row-hover flex items-center gap-3 px-4 py-2 border-b border-white/5 cursor-pointer select-none transition-colors hover:bg-white/5 active:bg-white/10 ${isDragging ? "opacity-30" : dt?.mode === "into" ? "bg-cyan-950/60 ring-1 ring-inset ring-cyan-400" : ""}`
                                        : `relative min-w-0 cursor-pointer transition-all hover:opacity-90 group ${isDragging ? "opacity-30 scale-95" : dt?.mode === "into" ? "ring-4 ring-cyan-400 ring-inset z-10" : ""}`}`}>
                                    {/* Insertion line indicator — before */}
                                    {dt?.mode === "before" && (
                                        <div className={`absolute z-20 bg-cyan-400 pointer-events-none ${mainListMode ? "left-0 right-0 top-0 h-0.5" : "top-0 left-0 bottom-0 w-1"}`} />
                                    )}
                                    {/* Insertion line indicator — after */}
                                    {dt?.mode === "after" && (
                                        <div className={`absolute z-20 bg-cyan-400 pointer-events-none ${mainListMode ? "left-0 right-0 bottom-0 h-0.5" : "top-0 right-0 bottom-0 w-1"}`} />
                                    )}
                                    {mainListMode ? (
                                        <>
                                            {canDrag && (
                                                <Bars3Icon className="w-4 h-4 text-zinc-700 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                                            )}
                                            {(() => {
                                                const c = item.color || item.folder_color || palette12[0];
                                                const hex = c.replace("#", "");
                                                const r = parseInt(hex.substring(0, 2), 16);
                                                const g = parseInt(hex.substring(2, 4), 16);
                                                const b = parseInt(hex.substring(4, 6), 16);
                                                return (
                                                    <div className="flex-shrink-0 aspect-square w-14 sm:w-12 lg:w-10 flex items-center justify-center text-2xl sm:text-xl lg:text-lg font-black"
                                                        style={item.is_folder
                                                            ? { backgroundColor: c, color: "#fff", boxShadow: (item.name === "PAGES" || item.name === "CLAUDE") ? "inset 0 0 0 1px rgba(255,255,255,0.85)" : undefined }
                                                            : { backgroundColor: "transparent", border: `1.5px solid rgba(${r},${g},${b},0.6)`, color: `rgba(${r},${g},${b},0.9)` }}>
                                                        {item.is_folder
                                                            ? (item.icon || [...(item.name || "F")][0])
                                                            : [...(item.title || "N")][0]}
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm sm:text-xs font-semibold tracking-tight text-white truncate">
                                                    {item.is_folder ? item.name : item.title}
                                                </div>
                                                {item.is_folder ? (
                                                    <div className="text-xs sm:text-[10px] text-zinc-500 font-medium">
                                                        {item.subfolderCount > 0 && <span>{item.subfolderCount} folder{item.subfolderCount !== 1 ? "s" : ""}{item.count > 0 ? " · " : ""}</span>}
                                                        {item.count > 0 && <span>{item.count} note{item.count !== 1 ? "s" : ""}</span>}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs sm:text-[10px] text-zinc-500 truncate">{(() => { const s = (item.content || "").split("\n").find((l: string) => l.trim()) || ""; const w = typeof window !== "undefined" ? window.innerWidth : 1024; const max = w < 640 ? 15 : w < 1024 ? 30 : 100; return s.length > max ? s.slice(0, max) + "..." : s; })()}</div>
                                                )}
                                            </div>
                                            {!item.is_folder && item.updated_at && (
                                                <span className="text-[10px] text-zinc-500 flex-shrink-0 font-medium flex items-center gap-1">
                                                    <span>{timeAgo(item.updated_at)}</span>
                                                    <span className="hidden sm:inline opacity-50">·</span>
                                                    <span className="hidden sm:inline">{shortDate(item.updated_at)}</span>
                                                </span>
                                            )}
                                            {item.is_folder && <ArrowRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
                                        </>
                                    ) : (
                                        <>
                                            {/* padding-bottom:100% forces height = width = perfect square in any grid context */}
                                            <div style={{ paddingBottom: "100%" }} />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1.5 overflow-hidden">
                                                {item.is_folder ? (
                                                    <>
                                                        {item.icon
                                                            ? <div style={{ fontSize: fitAllMode ? "clamp(2rem, 5.2vw, 5.2rem)" : "clamp(2.6rem, 7.8vw, 9.1rem)", lineHeight: 1 }}>{item.icon}</div>
                                                            : <div style={{ fontSize: fitAllMode ? "clamp(2.6rem, 6.5vw, 7.2rem)" : "clamp(3.25rem, 10.4vw, 11.7rem)", lineHeight: 1 }} className="font-black text-white">{(item.name || "F").charAt(0).toUpperCase()}</div>
                                                        }
                                                        <div className="mt-0.5 text-[7px] sm:text-[9px] font-medium text-white tracking-tight line-clamp-1 w-full text-center">
                                                            {item.name} <span className="opacity-70">({item.count})</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className={`${fitAllMode ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"} font-black text-white uppercase leading-none`}>{[...(item.title || "N")][0]}</div>
                                                        <div className="text-[7px] sm:text-[8px] font-semibold text-white leading-tight mt-0.5 line-clamp-2 w-full">{item.title}</div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {isNoteGridView && !mainListMode && !fitAllMode && displayItems.length > 0 && Array.from({ length: (gridCols - (displayItems.length % gridCols)) % gridCols }).map((_, i) => (
                            <button
                                key={`filler-${i}`}
                                onClick={(e) => { e.stopPropagation(); openNewNote(); }}
                                className="relative min-w-0 border-2 border-dashed border-zinc-800 hover:border-zinc-600 transition-colors group"
                            >
                                <div style={{ paddingBottom: "100%" }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <PlusIcon className="w-6 h-6 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                                </div>
                            </button>
                        ))}
                        {isEmptyView && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center px-6 sm:px-10">
                                <div key={quoteIndex} className="empty-quote-anim max-w-[760px] text-center">
                                    <p className="text-white/85 text-base sm:text-xl font-semibold leading-relaxed tracking-tight">{EMPTY_QUOTES[quoteIndex]}</p>
                                </div>
                            </div>
                        )}
                    </main>

                    {!showGlobalGraph && !showFolderActions && activeFolder ? (
                        <div className="fixed right-5 bottom-5 sm:right-8 sm:bottom-8 z-[10000] w-16 h-16">
                            {showEmptyFolderPulse && (
                                <div className="absolute inset-0 pointer-events-none" style={{ "--pulse-color": activeFolderColor } as React.CSSProperties}>
                                    <span className="folder-fab-pulse-ring" />
                                    <span className="folder-fab-pulse-ring" style={{ animationDelay: "320ms" }} />
                                    <span className="folder-fab-pulse-ring" style={{ animationDelay: "640ms" }} />
                                </div>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openNewNote();
                                }}
                                aria-label="Add note"
                                className="fab-float relative z-10 w-20 h-20 rounded-full bg-white text-black border border-black/20 shadow-[0_10px_24px_rgba(0,0,0,0.45)] flex items-center justify-center hover:border-2 hover:border-black/50 transition-all">
                                <PlusIcon className="w-10 h-10" />
                            </button>
                        </div>
                    ) : null}
                </>
            )}

            {showNoteActions && (
                <div className="fixed inset-0 z-[510] bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 lg:bg-transparent lg:backdrop-blur-none lg:items-stretch lg:justify-end lg:p-0" onClick={() => { setShowNoteActions(false); closeEditorTools(); }}>
                    <div
                        ref={editorToolsRef}
                        className="note-actions-panel bg-zinc-900 border w-full max-w-sm flex flex-col overflow-hidden lg:max-w-[300px] lg:w-[300px] lg:h-full lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:rounded-none"
                        style={{ borderColor: noteColor }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center">
                            <h2 className="text-sm font-black tracking-widest text-white truncate">{title.trim() || editingNote?.title || "Untitled"}</h2>
                        </div>


                        <div className="flex flex-col divide-y divide-white/10 overflow-y-auto max-h-[70vh] lg:max-h-none lg:flex-1">
                            {/* COLOR */}
                            <div>
                                <button
                                    type="button"
                                    className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${showColorPicker ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                    onClick={() => { setShowColorPicker((v) => !v); setShowSwitcher(false); }}
                                >
                                    <SwatchIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Color</span>
                                    <div className="w-4 h-4 border border-white/30" style={{ backgroundColor: noteColor }} />
                                </button>
                                {showColorPicker && (
                                    <div className="px-6 pb-4 flex flex-wrap gap-2.5">
                                        {palette12.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                aria-label={`Set color ${c}`}
                                                onClick={() => { setNoteColor(c); setShowColorPicker(false); }}
                                                className="w-7 h-7 border border-white/20 hover:border-2 hover:border-white/80 transition-all relative"
                                                style={{ backgroundColor: c }}
                                            >
                                                {noteColor === c && <CheckIcon className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />}
                                            </button>
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
                                    const filtered = folderNames.filter((n) => n.toLowerCase().includes(q));
                                    const selectFirst = () => {
                                        if (filtered.length === 0) return;
                                        moveToFolder(filtered[0]);
                                    };
                                    return (
                                        <div className="px-4 pb-4 flex flex-col gap-1.5">
                                            <input
                                                ref={folderSearchRef}
                                                type="text"
                                                value={folderSearchQuery}
                                                onChange={(e) => setFolderSearchQuery(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); selectFirst(); } if (e.key === "Escape") { setShowSwitcher(false); setFolderSearchQuery(""); } }}
                                                placeholder="search folders..."
                                                className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono mb-1"
                                            />
                                            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                                                {filtered.map((name, idx) => {
                                                    const color = folders.find((f) => f.name === name)?.color || palette12[0];
                                                    const folderIcon = folderIcons[name] || "";
                                                    const initial = name.trim().charAt(0).toUpperCase() || "F";
                                                    const selected = targetFolder === name;
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => moveToFolder(name)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border transition ${idx === 0 && folderSearchQuery ? "border-white/30 bg-white/5 text-white" : selected ? "bg-white/10 border-white/30 text-white" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/5"}`}
                                                        >
                                                            <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black text-white leading-none border border-white/25" style={{ backgroundColor: color }}>
                                                                {folderIcon || initial}
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

                            {/* LINK */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                onClick={() => { setShowNoteActions(false); void copyCurrentNoteLink(); }}
                            >
                                <DocumentDuplicateIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide">Link</span>
                            </button>

                            {/* QR */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left transition text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"
                                onClick={() => { setShowNoteActions(false); openNoteQrShare(); }}
                            >
                                <QrCodeIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">QR</span>
                            </button>

                            {/* BURN */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left transition text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"
                                onClick={() => { setShowNoteActions(false); shareBurnLink(); }}
                            >
                                <FireIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">Burn</span>
                                <span className="text-[10px] font-black text-zinc-600">1×</span>
                            </button>

                            {/* CHECKLIST MODE */}
                            <button
                                type="button"
                                disabled={!isListEligible}
                                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${!isListEligible ? "opacity-30 cursor-not-allowed" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                onClick={() => { if (!isListEligible) return; toggleListMode(); if (window.innerWidth < 1024) setShowNoteActions(false); }}
                            >
                                <ListBulletIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">Checklist</span>
                                <span className="inline-flex w-8 h-4 items-center flex-shrink-0 transition-colors" style={{ backgroundColor: !isListEligible ? "#3f3f46" : listMode ? noteColor : "#3f3f46" }}>
                                    <span className={`w-3 h-3 bg-white transition-transform ${listMode && isListEligible ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                </span>
                            </button>

                            {/* GRAPH MODE */}
                            <button
                                type="button"
                                disabled={!isGraphEligible}
                                className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${!isGraphEligible ? "opacity-30 cursor-not-allowed" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                onClick={() => { if (!isGraphEligible) return; toggleGraphMode(); if (window.innerWidth < 1024) setShowNoteActions(false); }}
                            >
                                <ShareIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">Graph</span>
                                <span className="inline-flex w-8 h-4 items-center flex-shrink-0 transition-colors" style={{ backgroundColor: !isGraphEligible ? "#3f3f46" : graphMode ? noteColor : "#3f3f46" }}>
                                    <span className={`w-3 h-3 bg-white transition-transform ${graphMode && isGraphEligible ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                </span>
                            </button>

                            {/* MARKDOWN PREVIEW */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left transition text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"
                                onClick={() => { toggleMarkdownMode(); if (window.innerWidth < 1024) setShowNoteActions(false); }}
                            >
                                <EyeIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">Markdown</span>
                                <span className="inline-flex w-8 h-4 items-center flex-shrink-0 transition-colors" style={{ backgroundColor: markdownMode ? noteColor : "#3f3f46" }}>
                                    <span className={`w-3 h-3 bg-white transition-transform ${markdownMode ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                </span>
                            </button>

                            {/* HTML PREVIEW */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left transition text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"
                                onClick={() => { toggleHtmlMode(); if (window.innerWidth < 1024) setShowNoteActions(false); }}
                            >
                                <CodeBracketIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">HTML</span>
                                <span className="inline-flex w-8 h-4 items-center flex-shrink-0 transition-colors" style={{ backgroundColor: htmlMode ? noteColor : "#3f3f46" }}>
                                    <span className={`w-3 h-3 bg-white transition-transform ${htmlMode ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                                </span>
                            </button>

                            {/* DELETE / DISCARD */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition"
                                onClick={() => {
                                    setShowNoteActions(false);
                                    closeEditorTools();
                                    setConfirmDelete({
                                        type: "note",
                                        noteId: editingNote?.id ? String(editingNote.id) : null,
                                        noteName: (title.trim() || editingNote?.title || "Untitled").trim(),
                                    });
                                }}
                            >
                                <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wide">{editingNote?.id ? "Delete Note" : "Discard Draft"}</span>
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

            {/* FOLDER ACTIONS PANEL */}
            {showFolderActions && (
                <div className="fixed inset-0 z-[510] flex items-center justify-center p-4 lg:items-stretch lg:justify-end lg:p-0" onClick={() => { setShowFolderActions(false); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }}>
                    <div className="note-actions-panel bg-zinc-900 border border-white/15 w-full max-w-sm flex flex-col overflow-hidden lg:max-w-[300px] lg:w-[300px] lg:h-full lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:rounded-none" onClick={(e) => e.stopPropagation()}>
                        {/* Header — icon + folder name */}
                        <div className="border-b border-white/10 px-6 py-4 flex items-center gap-3">
                            {activeFolder ? (
                                <>
                                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-black text-white leading-none"
                                        style={{ backgroundColor: activeFolderColor }}>
                                        {folderIcons[activeFolder] || [...(activeFolder || "F")][0].toUpperCase()}
                                    </div>
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
                            ) : (
                                <h2 className="text-sm font-black uppercase tracking-widest text-white">Stickies</h2>
                            )}
                        </div>
                        <div className="flex flex-col divide-y divide-white/10 overflow-y-auto flex-1">
                            {/* COLOR ROW */}
                            {activeFolder && (
                                <div>
                                    <button type="button"
                                        onClick={() => { setShowFolderColorPicker((v) => !v); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }}
                                        className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition">
                                        <SwatchIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black tracking-wide flex-1">Color</span>
                                        <div className="w-7 h-7 flex-shrink-0 border border-white/40" style={{ backgroundColor: activeFolderColor }} />
                                    </button>
                                    {showFolderColorPicker && (
                                        <div className="px-6 pb-4 flex flex-wrap gap-2.5">
                                            {palette12.map((c) => (
                                                <button key={c} type="button"
                                                    onClick={() => { applySingleFolderColor(c); setShowFolderColorPicker(false); }}
                                                    className="w-7 h-7 border border-white/20 hover:border-2 hover:border-white/80 transition-all relative"
                                                    style={{ backgroundColor: c }}>
                                                    {activeFolderColor === c && <CheckIcon className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* ICON ROW */}
                            {activeFolder && (
                                <div>
                                    <button type="button"
                                        onClick={() => { setShowFolderIconPicker((v) => !v); setShowFolderColorPicker(false); setShowFolderMovePicker(false); }}
                                        className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition">
                                        <FolderIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black tracking-wide flex-1">Icon</span>
                                        <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black border border-white/40">
                                            {folderIcons[activeFolder] || [...(activeFolder || "F")][0].toUpperCase()}
                                        </span>
                                    </button>
                                    {showFolderIconPicker && (
                                        <div className="px-6 pb-4">
                                            {folderIcons[activeFolder] && (
                                                <button type="button"
                                                    onClick={() => { setFolderIcons((prev) => { const next = { ...prev }; delete next[activeFolder]; return next; }); void saveFolderIconToDb(activeFolder, ""); setShowFolderIconPicker(false); }}
                                                    className="w-full mb-2 py-1.5 text-xs font-bold tracking-wide text-zinc-400 border border-white/10 hover:border-white/30 hover:text-white transition-colors">
                                                    Remove icon
                                                </button>
                                            )}
                                            <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto">
                                                {FOLDER_ICON_EMOJIS.map((emoji) => (
                                                    <button key={emoji} type="button"
                                                        onClick={() => { setFolderIcons((prev) => ({ ...prev, [activeFolder]: emoji })); void saveFolderIconToDb(activeFolder, emoji); setShowFolderIconPicker(false); }}
                                                        className={`aspect-square flex items-center justify-center text-xl transition-all hover:bg-white/15 ${folderIcons[activeFolder] === emoji ? "bg-white/20 ring-1 ring-white/60" : ""}`}>
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* MOVE FOLDER */}
                            {activeFolder && (
                                <div>
                                    <button type="button"
                                        className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${showFolderMovePicker ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                        onClick={() => { const next = !showFolderMovePicker; setShowFolderMovePicker(next); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); if (next) { setFolderMoveQuery(""); setTimeout(() => folderMoveSearchRef.current?.focus(), 50); } }}>
                                        <ArrowRightIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black tracking-wide flex-1">Move</span>
                                        {(() => { const row = dbData.find((r) => r.is_folder && r.folder_name === activeFolder); const parent = row?.parent_folder_name; return parent ? <span className="text-[10px] text-cyan-400 font-bold truncate max-w-[100px]">{String(parent)}</span> : <span className="text-[10px] text-zinc-600 font-bold">root</span>; })()}
                                    </button>
                                    {showFolderMovePicker && (() => {
                                        const q = folderMoveQuery.toLowerCase();
                                        const options = [
                                            { name: "— Root —", value: null },
                                            ...folders.filter((f) => f.name !== activeFolder).map((f) => ({ name: f.name, value: f.name })),
                                        ].filter((o) => o.name.toLowerCase().includes(q));
                                        return (
                                            <div className="px-4 pb-4 flex flex-col gap-1.5">
                                                <input
                                                    ref={folderMoveSearchRef}
                                                    type="text"
                                                    value={folderMoveQuery}
                                                    onChange={(e) => setFolderMoveQuery(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Escape") { setShowFolderMovePicker(false); setFolderMoveQuery(""); } }}
                                                    placeholder="search folders..."
                                                    className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono mb-1"
                                                />
                                                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                                                    {options.map((opt) => {
                                                        const color = opt.value ? (folders.find((f) => f.name === opt.value)?.color || palette12[0]) : "#444";
                                                        const icon = opt.value ? (folderIcons[opt.value] || opt.value.trim().charAt(0).toUpperCase()) : "↑";
                                                        const currentParent = dbData.find((r) => r.is_folder && r.folder_name === activeFolder)?.parent_folder_name ?? null;
                                                        const selected = currentParent === opt.value;
                                                        return (
                                                            <button key={opt.name} type="button"
                                                                onClick={() => void moveFolderToParent(opt.value)}
                                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border transition ${selected ? "bg-white/10 border-white/30 text-white" : "bg-black/30 border-white/10 text-zinc-300 hover:bg-white/5"}`}>
                                                                <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black text-white leading-none border border-white/25" style={{ backgroundColor: color }}>{icon}</span>
                                                                <span className="text-[12px] font-bold truncate flex-1">{opt.name}</span>
                                                                {selected && <CheckIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                    {options.length === 0 && <p className="text-[10px] text-zinc-600 px-1 py-2">No folders match</p>}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            {/* GLOBAL GRAPH */}
                            {!activeFolder && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => { setShowFolderActions(false); setShowGlobalGraph(true); }}>
                                    <CubeTransparentIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Graph</span>
                                </button>
                            )}
                            {/* DELETE FOLDER */}
                            {activeFolder && canDeleteActiveFolder && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition"
                                    onClick={() => { setShowFolderActions(false); setConfirmDelete({ type: "folder", folderName: activeFolder }); }}>
                                    <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide">Delete</span>
                                </button>
                            )}
                            {/* LOCK — global only */}
                            {!activeFolder && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={async () => { setShowFolderActions(false); await fetch("/api/stickies/logout", { method: "POST" }); window.location.href = "/sign-in"; }}>
                                    <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Sign Out</span>
                                </button>
                            )}
                        </div>
                        <div className="border-t border-white/10 p-4">
                            <button type="button" onClick={() => { setShowFolderActions(false); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }} className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-wide hover:bg-zinc-100 transition">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* GLOBAL GRAPH OVERLAY */}
            {showGlobalGraph && (
                <div className="fixed inset-0 z-[600] bg-black flex flex-col" onClick={() => { setShowGlobalGraph(false); setSelectedGraphFolder(null); }}>
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-black uppercase tracking-widest text-white">All Notes Graph</span>
                        <button type="button" onClick={() => { setShowGlobalGraph(false); setSelectedGraphFolder(null); }} className="text-zinc-400 hover:text-white transition text-xs font-black uppercase tracking-wide px-3 py-1 border border-white/15 hover:border-white/40">Close</button>
                    </div>
                    <div ref={globalGraphContainerRef} className="relative flex-1 overflow-hidden" onClick={(e) => { e.stopPropagation(); setSelectedGraphFolder(null); }}>
                        {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                        {globalGraphTick >= 0 && (() => {
                            const ns = globalGraphNodesRef.current;
                            const folderNodes = ns.filter((n) => n.type === "folder");
                            const noteNodes = ns.filter((n) => n.type === "note");
                            const hasSel = selectedGraphFolder !== null;
                            return (
                                <>
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                        {noteNodes.map((n) => {
                                            const f = ns.find((nd) => nd.id === `f:${n.folderName}`);
                                            if (!f) return null;
                                            const active = !hasSel || selectedGraphFolder === f.id;
                                            return <line key={n.id} x1={n.x} y1={n.y} x2={f.x} y2={f.y} stroke={f.color} strokeWidth={active ? "1.5" : "0.5"} strokeOpacity={active ? 0.55 : 0.1} />;
                                        })}
                                    </svg>
                                    {noteNodes.map((n) => {
                                        const active = !hasSel || selectedGraphFolder === `f:${n.folderName}`;
                                        return (
                                            <div key={n.id} className="absolute flex items-center justify-center font-black text-white text-[9px] uppercase transition-none select-none"
                                                style={{ left: n.x - n.r, top: n.y - n.r, width: n.r * 2, height: n.r * 2, backgroundColor: n.color, borderRadius: "50%", opacity: active ? 0.9 : 0.2 }}>
                                                {n.label}
                                            </div>
                                        );
                                    })}
                                    {folderNodes.map((n) => {
                                        const isSelected = selectedGraphFolder === n.id;
                                        const dimmed = hasSel && !isSelected;
                                        return (
                                            <div key={n.id} className="absolute flex flex-col items-center justify-center font-black text-white uppercase transition-none select-none cursor-pointer"
                                                onClick={(e) => { e.stopPropagation(); setSelectedGraphFolder(isSelected ? null : n.id); }}
                                                style={{ left: n.x - n.r, top: n.y - n.r, width: n.r * 2, height: n.r * 2, backgroundColor: n.color, borderRadius: "50%", opacity: dimmed ? 0.3 : 1, boxShadow: isSelected ? `0 0 0 3px #fff, 0 0 12px ${n.color}` : "none" }}>
                                                <span className="text-xl leading-none">{n.label}</span>
                                            </div>
                                        );
                                    })}
                                </>
                            );
                        })()}
                        {globalGraphNodesRef.current.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm font-bold uppercase">Loading...</div>
                        )}
                    </div>
                </div>
            )}

            {qrModalOpen && (
                <div className="fixed inset-0 z-[520] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setQrModalOpen(false); setQrLinkCopied(false); }}>
                    <div
                        className="bg-zinc-900 p-6 sm:p-8 flex flex-col items-center gap-4 w-full max-w-[360px]"
                        style={{ border: `2px solid ${qrIsBurn ? "#FF6B00" : activeAccentColor}` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Title */}
                        <div className="flex items-center gap-2">
                            {qrIsBurn && <span className="text-lg">🔥</span>}
                            <h2
                                className="font-black uppercase tracking-widest text-sm sm:text-base"
                                style={{ color: qrIsBurn ? "#FF6B00" : activeAccentColor }}
                            >
                                {qrIsBurn ? "Burn Link — 1× Only" : "QR Share"}
                            </h2>
                        </div>

                        {/* QR code */}
                        <div className="p-3 bg-white" style={{ border: `4px solid ${qrIsBurn ? "#FF6B00" : activeAccentColor}` }}>
                            <QRCodeSVG value={qrData} size={220} level="M" />
                        </div>


                        {/* Copy link button */}
                        <button
                            type="button"
                            onClick={async () => {
                                await secureCopy(qrData);
                                setQrLinkCopied(true);
                                setTimeout(() => setQrLinkCopied(false), 2500);
                                if (qrIsBurn) showToast("Burn link copied 🔥");
                            }}
                            className="w-full py-3 font-black uppercase text-xs tracking-wide transition-colors flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: qrLinkCopied ? "#22c55e" : (qrIsBurn ? "#FF6B00" : activeAccentColor),
                                color: "#000",
                            }}
                        >
                            {qrLinkCopied ? (
                                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Copied</>
                            ) : (
                                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy Link</>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => { setQrModalOpen(false); setQrLinkCopied(false); }}
                            className="w-full py-2.5 border border-white/15 text-zinc-400 font-black uppercase text-xs tracking-wide hover:border-white/30 hover:text-white transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {sharePickerOpen && (
                <div className="fixed inset-0 z-[520] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSharePickerOpen(false)}>
                    <div
                        className="bg-zinc-900 w-full max-w-sm flex flex-col overflow-hidden"
                        style={{ border: `2px solid ${activeAccentColor}` }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Share Note</p>
                            <p className="text-xs font-black text-white truncate mt-0.5">{title.trim() || editingNote?.title || "Untitled"}</p>
                        </div>

                        {/* Copy Link */}
                        <button type="button"
                            className="flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 active:bg-white/10 transition border-b border-white/5"
                            onClick={() => { setSharePickerOpen(false); void copyCurrentNoteLink(); }}
                        >
                            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.2)" }}>
                                <DocumentDuplicateIcon className="w-4 h-4 text-zinc-300" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-white tracking-wide">Copy Link</p>
                                <p className="text-[10px] text-zinc-500">Direct URL to this note</p>
                            </div>
                        </button>

                        {/* QR Share */}
                        <button type="button"
                            className="flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 active:bg-white/10 transition border-b border-white/5"
                            onClick={() => { setSharePickerOpen(false); openNoteQrShare(); }}
                        >
                            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: `${activeAccentColor}22`, border: `1.5px solid ${activeAccentColor}66` }}>
                                <QrCodeIcon className="w-4 h-4" style={{ color: activeAccentColor }} />
                            </div>
                            <div>
                                <p className="text-xs font-black text-white tracking-wide">QR Code</p>
                                <p className="text-[10px] text-zinc-500">Scan to open on any device</p>
                            </div>
                        </button>

                        {/* Burn Link */}
                        <button type="button"
                            className="flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 active:bg-white/10 transition border-b border-white/5"
                            onClick={() => { setSharePickerOpen(false); shareBurnLink(); }}
                        >
                            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,0,0.12)", border: "1.5px solid rgba(255,107,0,0.4)" }}>
                                <FireIcon className="w-4 h-4 text-orange-400" />
                            </div>
                            <div>
                                <p className="text-xs font-black text-white tracking-wide">Burn Link <span className="text-orange-400">1×</span></p>
                                <p className="text-[10px] text-zinc-500">Self-destructs after first open</p>
                            </div>
                        </button>

                        {/* Gmail */}
                        <button type="button"
                            className="flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 active:bg-white/10 transition border-b border-white/5"
                            onClick={() => {
                                const t = encodeURIComponent(title.trim() || editingNote?.title || "Note");
                                const b = encodeURIComponent((content || editingNote?.content || "").slice(0, 2000));
                                window.open(`https://mail.google.com/mail/?view=cm&su=${t}&body=${b}`, "_blank");
                                setSharePickerOpen(false);
                            }}
                        >
                            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,67,53,0.12)", border: "1.5px solid rgba(234,67,53,0.4)" }}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="#EA4335" opacity="0.15"/>
                                    <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-black text-white tracking-wide">Gmail</p>
                                <p className="text-[10px] text-zinc-500">Open Gmail compose in browser</p>
                            </div>
                        </button>

                        {/* Email App */}
                        <button type="button"
                            className="flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 active:bg-white/10 transition"
                            onClick={() => {
                                const t = encodeURIComponent(title.trim() || editingNote?.title || "Note");
                                const b = encodeURIComponent((content || editingNote?.content || "").slice(0, 2000));
                                window.location.href = `mailto:?subject=${t}&body=${b}`;
                                setSharePickerOpen(false);
                            }}
                        >
                            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,122,255,0.12)", border: "1.5px solid rgba(0,122,255,0.4)" }}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.5">
                                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-black text-white tracking-wide">Email App</p>
                                <p className="text-[10px] text-zinc-500">Open default mail client</p>
                            </div>
                        </button>

                        <button type="button"
                            onClick={() => setSharePickerOpen(false)}
                            className="mx-5 my-4 py-2.5 border border-white/15 text-zinc-400 font-black uppercase text-xs tracking-wide hover:border-white/30 hover:text-white transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 z-[620] bg-black/90 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border-2 border-red-500 p-7 sm:p-9 w-full max-w-sm text-center">
                        <ExclamationTriangleIcon className="w-14 h-14 text-red-500 mx-auto mb-4" />
                        <h2 className="text-sm font-black uppercase tracking-wider text-red-400 mb-2">{confirmDelete.type === "folder" ? "Delete Folder?" : confirmDelete.noteId ? "Delete Note?" : "Discard Draft?"}</h2>
                        <p className="text-[11px] text-white/70 uppercase tracking-wide mb-5">{confirmDelete.type === "folder" ? `All notes inside will also be deleted. This cannot be undone.` : "This action cannot be undone."}</p>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const action = confirmDelete;
                                    setConfirmDelete(null);
                                    if (action.type === "folder") {
                                        void deleteFolderByName(action.folderName);
                                    } else {
                                        void deleteCurrentNote(action.noteId, action.noteName);
                                    }
                                }}
                                className="w-full py-3 bg-red-600 text-white font-black uppercase text-xs tracking-wide">
                                Confirm
                            </button>
                            <button type="button" onClick={() => setConfirmDelete(null)} className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-wide">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {iconPickerFolder !== null && (
                <div className="fixed inset-0 z-[630] bg-black/90 flex items-center justify-center p-4" onClick={() => setIconPickerFolder(null)}>
                    <div className="bg-zinc-900 border border-white/15 p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-black uppercase tracking-wider text-white">Folder Icon</h2>
                            <span className="text-xs text-zinc-400 uppercase">{iconPickerFolder}</span>
                        </div>
                        {/* Clear */}
                        {folderIcons[iconPickerFolder] && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFolderIcons((prev) => {
                                        const next = { ...prev };
                                        delete next[iconPickerFolder];
                                        return next;
                                    });
                                    void saveFolderIconToDb(iconPickerFolder, "");
                                    setIconPickerFolder(null);
                                }}
                                className="w-full mb-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-400 border border-white/10 hover:border-white/30 hover:text-white transition-colors"
                            >
                                Remove icon (use first letter)
                            </button>
                        )}
                        <div className="grid grid-cols-8 gap-1.5 max-h-64 overflow-y-auto">
                            {FOLDER_ICON_EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                        setFolderIcons((prev) => ({ ...prev, [iconPickerFolder]: emoji }));
                                        void saveFolderIconToDb(iconPickerFolder, emoji);
                                        setIconPickerFolder(null);
                                    }}
                                    className={`aspect-square flex items-center justify-center text-2xl rounded transition-all hover:bg-white/15 ${folderIcons[iconPickerFolder] === emoji ? "bg-white/20 ring-1 ring-cyan-400" : ""}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => setIconPickerFolder(null)} className="w-full mt-4 py-2.5 bg-zinc-800 text-white font-black uppercase text-xs tracking-wide hover:bg-zinc-700 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {showCreateFolder && (
                <div className="fixed inset-0 z-[620] bg-black/90 flex items-center justify-center p-4" onClick={() => setShowCreateFolder(false)}>
                    <div className="bg-zinc-900 border border-white/15 p-7 sm:p-9 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center bg-zinc-800 border border-white/10">
                            {newFolderIcon ? (
                                <span className="text-4xl">{newFolderIcon}</span>
                            ) : (
                                <FolderIcon className="w-8 h-8 text-cyan-400" />
                            )}
                        </div>
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
                        {/* Icon quick-pick row */}
                        <div className="mb-4">
                            <p className="text-[9px] tracking-widest text-zinc-500 mb-2">Icon (optional)</p>
                            <div className="flex flex-wrap gap-1.5">
                                {FOLDER_ICON_EMOJIS.slice(0, 20).map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setNewFolderIcon((prev) => prev === emoji ? "" : emoji)}
                                        className={`w-8 h-8 flex items-center justify-center text-xl rounded transition-all hover:bg-white/15 ${newFolderIcon === emoji ? "bg-white/20 ring-1 ring-cyan-400" : ""}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => void confirmCreateFolder()} disabled={!newFolderName.trim()} className="w-full py-3 bg-white text-black font-black text-xs tracking-wide disabled:opacity-30 disabled:cursor-not-allowed">
                                Create
                            </button>
                            <button type="button" onClick={() => setShowCreateFolder(false)} className="w-full py-3 bg-zinc-800 text-white font-black text-xs tracking-wide">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const EditorIconBtn = ({ icon: Icon, label, onClick, active = false }: any) => (
    <button type="button" onClick={onClick} className={`p-3 transition ${active ? "text-white bg-white/15 ring-1 ring-white/30" : "text-zinc-300 hover:text-white hover:bg-white/10"}`} title={label} aria-label={label}>
        <Icon className="w-6 h-6" />
    </button>
);

const MobileEditorIconBtn = ({ icon: Icon, label, onClick, active = false }: any) => (
    <button type="button" onClick={onClick} className={`p-5 transition ${active ? "text-white bg-white/15 ring-1 ring-inset ring-white/30" : "text-zinc-300 active:text-white active:bg-white/10"}`} title={label} aria-label={label}>
        <Icon className="w-10 h-10" />
    </button>
);

const HeaderIconBtn = ({ icon: Icon, label, onClick }: any) => (
    <button type="button" onClick={onClick} className="p-3 text-zinc-300 hover:text-white hover:bg-white/10 transition" title={label} aria-label={label}>
        <Icon className="w-6 h-6" />
    </button>
);
