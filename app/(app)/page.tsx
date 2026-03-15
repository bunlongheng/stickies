"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { usePageMeta } from "@/lib/usePageMeta";
import dynamic from "next/dynamic";
import LZString from "lz-string";
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor").then(m => m.RichTextEditor), { ssr: false });
const MermaidRenderer = dynamic(() => import("@/components/MermaidRenderer").then(m => m.MermaidRenderer), { ssr: false });
const VoiceRecorder = dynamic(() => import("@/components/VoiceRecorder").then(m => m.VoiceRecorder), { ssr: false });
const MarkdownWithMermaid = dynamic(() => import("@/components/MarkdownWithMermaid").then(m => m.MarkdownWithMermaid), { ssr: false });
const CodeViewer = dynamic(() => import("@/components/CodeViewer").then(m => m.CodeViewer), { ssr: false });

// Icons
import MagnifyingGlassIcon from "@heroicons/react/24/outline/MagnifyingGlassIcon";
import BookmarkIcon from "@heroicons/react/24/solid/BookmarkIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import Bars3Icon from "@heroicons/react/24/outline/Bars3Icon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import ArrowRightIcon from "@heroicons/react/24/outline/ArrowRightIcon";
import FolderIcon from "@heroicons/react/24/solid/FolderIcon";
import SwatchIcon from "@heroicons/react/24/outline/SwatchIcon";
import DocumentDuplicateIcon from "@heroicons/react/24/outline/DocumentDuplicateIcon";
import ListBulletIcon from "@heroicons/react/24/outline/ListBulletIcon";
import PaperAirplaneIcon from "@heroicons/react/24/outline/PaperAirplaneIcon";
import CheckCircleIcon from "@heroicons/react/24/solid/CheckCircleIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import QrCodeIcon from "@heroicons/react/24/outline/QrCodeIcon";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import ArrowRightOnRectangleIcon from "@heroicons/react/24/outline/ArrowRightOnRectangleIcon";
import Cog6ToothIcon from "@heroicons/react/24/outline/Cog6ToothIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import ClipboardDocumentListIcon from "@heroicons/react/24/outline/ClipboardDocumentListIcon";
import EyeIcon from "@heroicons/react/24/outline/EyeIcon";
import CodeBracketIcon from "@heroicons/react/24/outline/CodeBracketIcon";
import FaceSmileIcon from "@heroicons/react/24/outline/FaceSmileIcon";
import CubeTransparentIcon from "@heroicons/react/24/outline/CubeTransparentIcon";
import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import ClipboardIcon from "@heroicons/react/24/outline/ClipboardIcon";
import DevicePhoneMobileIcon from "@heroicons/react/24/outline/DevicePhoneMobileIcon";
import CalendarDaysIcon from "@heroicons/react/24/outline/CalendarDaysIcon";
import PuzzlePieceIcon from "@heroicons/react/24/outline/PuzzlePieceIcon";
import ChevronRightIcon from "@heroicons/react/24/outline/ChevronRightIcon";
import BoltIcon from "@heroicons/react/24/outline/BoltIcon";
import LightBulbIcon from "@heroicons/react/24/outline/LightBulbIcon";
import ShareIcon from "@heroicons/react/24/outline/ShareIcon";
import CursorArrowRaysIcon from "@heroicons/react/24/outline/CursorArrowRaysIcon";
import RectangleStackIcon from "@heroicons/react/24/outline/RectangleStackIcon";
import Squares2X2Icon from "@heroicons/react/24/outline/Squares2X2Icon";
import ViewColumnsIcon from "@heroicons/react/24/outline/ViewColumnsIcon";
import HeartIcon from "@heroicons/react/24/outline/HeartIcon";
import HeartSolidIcon from "@heroicons/react/24/solid/HeartIcon";
import MicrophoneIcon from "@heroicons/react/24/outline/MicrophoneIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import ArrowTopRightOnSquareIcon from "@heroicons/react/24/outline/ArrowTopRightOnSquareIcon";
import ComputerDesktopIcon from "@heroicons/react/24/outline/ComputerDesktopIcon";
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";
import PencilSquareIcon from "@heroicons/react/24/outline/PencilSquareIcon";
import { marked, Renderer } from "marked";

// Custom renderer: wraps code blocks with a copy button
const mdRenderer = new Renderer();
mdRenderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const langBadge = lang ? `<span class="code-lang-badge">${lang}</span>` : "";
    return `<div class="code-block-wrapper">${langBadge}<button class="copy-code-btn" aria-label="Copy code">Copy</button><pre><code>${escaped}</code></pre></div>`;
};
import { QRCodeSVG } from "qrcode.react";
import PusherClient from "pusher-js";

// Lazy to avoid build-time errors when env vars are not set
const getSupabase = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const supabase = { from: (...a: Parameters<ReturnType<typeof getSupabase>["from"]>) => getSupabase().from(...a) } as ReturnType<typeof getSupabase>;

async function getAuthToken(): Promise<string> {
    if (process.env.NODE_ENV === 'development') {
        return process.env.NEXT_PUBLIC_STICKIES_API_KEY ?? "";
    }
    // Use the SSR-aware browser client — reads session from cookies (set by @supabase/ssr)
    const sb = createBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return "";
    // Proactively refresh if the token expires within 60 seconds
    const expiresAt = (session as any).expires_at as number | undefined;
    if (expiresAt !== undefined && expiresAt - Math.floor(Date.now() / 1000) < 60) {
        const { data } = await sb.auth.refreshSession();
        return data.session?.access_token ?? "";
    }
    return session.access_token;
}
const notesApi = {
    update: async (id: string, fields: Record<string, unknown>) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
            body: JSON.stringify({ id, ...fields }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "update failed"); }
        return res.json() as Promise<{ note: Record<string, unknown> }>;
    },
    bulkUpdate: async (updates: Array<{ id: string } & Record<string, unknown>>) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
            body: JSON.stringify({ updates }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "bulk update failed"); }
    },
    insert: async (payload: Record<string, unknown>) => {
        const res = await fetch("/api/stickies?raw=1", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
            body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "insert failed"); }
        return res.json() as Promise<{ note: Record<string, unknown> }>;
    },
    delete: async (id: string) => {
        const res = await fetch(`/api/stickies?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${await getAuthToken()}` },
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "delete failed"); }
    },
    deleteByFolder: async (folderName: string) => {
        const res = await fetch(`/api/stickies?folder_name=${encodeURIComponent(folderName)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${await getAuthToken()}` },
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

const palette12 = ["#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00", "#D4E157", "#34C759", "#00C7BE", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55"];

const VIVID12 = palette12.slice(0, 12);

/** Step through the curated palette at even intervals so fewer items get
 *  well-spaced colors without jumping to raw hue-wheel extremes.
 *  4 items → every 3rd color (red, yellow, cyan, purple)
 *  6 items → every 2nd · 12 items → sequential · >12 → wraps */
function taskColor(i: number, total: number): string {
    const step = Math.max(1, Math.floor(VIVID12.length / Math.min(total, VIVID12.length)));
    return VIVID12[(i * step) % VIVID12.length];
}

/** Returns the first letter/digit/emoji from text — skips punctuation like "?" */
function meaningfulInitial(text: string, fallback = "N"): string {
    const first = [...(text || "")].find(c => /[\p{L}\p{N}\p{Emoji_Presentation}]/u.test(c));
    return (first ?? fallback).toUpperCase();
}

/** Auto-detect full HTML documents — only DOCTYPE or <html> tag, not TipTap fragment HTML */
function detectHtml(text: string): boolean {
    const t = text.trim();
    return /<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t);
}

function htmlToPlainLines(html: string): string {
    if (!/<[a-z][^>]*>/i.test(html)) return html;
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "")
        .replace(/<\/?(p|div|tr|dt|dd|h[1-6])[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function detectJson(text: string): { ok: boolean; parsed?: any } {
    const t = text.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) return { ok: false };
    try { return { ok: true, parsed: JSON.parse(t) }; } catch { return { ok: false }; }
}

function syntaxHighlightJson(obj: any): string {
    const json = JSON.stringify(obj, null, 2);
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
            if (/^"/.test(match)) {
                if (/:$/.test(match)) return `<span style="color:#66d9e8;font-weight:600">${match}</span>`; // key — monokai cyan
                return `<span style="color:#e6db74">${match}</span>`; // string — monokai yellow
            }
            if (/true|false/.test(match)) return `<span style="color:#ae81ff">${match}</span>`; // bool — monokai purple
            if (/null/.test(match)) return `<span style="color:#f92672">${match}</span>`; // null — monokai pink
            return `<span style="color:#ae81ff">${match}</span>`; // number — monokai purple
        }
    );
}

const MERMAID_KEYWORDS = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im;

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    javascript: { label: "Javascript",  color: "#f97316" },
    typescript: { label: "Typescript",  color: "#3b82f6" },
    python:     { label: "Python",      color: "#eab308" },
    css:        { label: "CSS",         color: "#8b5cf6" },
    sql:        { label: "SQL",         color: "#14b8a6" },
    bash:       { label: "Bash",        color: "#22c55e" },
    markdown:   { label: "Markdown",    color: "#a78bfa" },
    html:       { label: "HTML",        color: "#f43f5e" },
    json:       { label: "JSON",        color: "#fbbf24" },
    mermaid:    { label: "Mermaid",     color: "#06b6d4" },
    voice:      { label: "Voice",       color: "#ef4444" },
    checklist:  { label: "Checklist",   color: "#22c55e" },
    rich:       { label: "Rich Text",   color: "#e879f9" },
};

/** Client-side fallback type detection — used only when DB type is null (legacy notes) */
function detectNoteType(content: string): string {
    const t = content.trim();
    if (!t) return "text";
    if (t.startsWith('{"_type":"voice"') || t.startsWith('[{"_type":"voice"')) {
        try {
            const p = JSON.parse(t);
            if (p?._type === "voice" || (Array.isArray(p) && p[0]?._type === "voice")) return "voice";
        } catch {}
    }
    // TipTap JSON — must check before generic JSON detection
    try { const p = JSON.parse(t); if (p?.type === "doc" && Array.isArray(p.content)) return "rich"; } catch {}
    if (MERMAID_KEYWORDS.test(extractMermaid(t))) return "mermaid";
    if ((t.startsWith("{") || t.startsWith("[")) && detectJson(t).ok) return "json";
    if (/^\s*<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t)) return "html";
    if (/^#{1,6}\s|^\*\*|^>\s/m.test(t) && !/<[a-z][^>]*>/i.test(t)) return "markdown";
    return "text";
}

/** Extract raw mermaid code — strips ```mermaid fences, YAML frontmatter, and leading/trailing whitespace */
function extractMermaid(text: string): string {
    let t = text.trim();
    // Strip ```mermaid ... ``` fences
    const fenced = t.match(/^```mermaid\s*\n?([\s\S]*?)```\s*$/im);
    if (fenced) t = fenced[1].trim();
    // Strip YAML frontmatter (---\ntitle: ...\n---) and inject title as %% comment
    const frontmatter = t.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/m);
    if (frontmatter) {
        const titleMatch = frontmatter[1].match(/^title:\s*(.+)$/m);
        const body = frontmatter[2].trim();
        if (titleMatch) {
            // Insert %% title after the first diagram-type line
            const lines = body.split("\n");
            lines.splice(1, 0, `%% ${titleMatch[1].trim()}`);
            return lines.join("\n");
        }
        return body;
    }
    return t;
}

function detectMermaid(text: string): boolean {
    return MERMAID_KEYWORDS.test(extractMermaid(text));
}

/** Strip ```mermaid fences + YAML frontmatter, inject title as %% comment */
function cleanMermaidContent(text: string): string {
    let t = text.trim();
    // Strip ```mermaid ... ``` fences but keep frontmatter intact
    const fenced = t.match(/^```mermaid\s*\n?([\s\S]*?)```\s*$/im);
    if (fenced) t = fenced[1].trim();
    return t;
}

function mermaidSubType(text: string): string {
    const t = extractMermaid(text);
    const m = t.match(/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im);
    if (!m) return "Mermaid";
    const map: Record<string, string> = {
        flowchart: "Flow", graph: "Flow", sequencediagram: "Sequence",
        classdiagram: "Class", statediagram: "State", erdiagram: "ER",
        gantt: "Gantt", pie: "Pie", gitgraph: "Git", mindmap: "Mindmap",
        timeline: "Timeline", xychart: "XY Chart", quadrantchart: "Quadrant",
        requirementdiagram: "Requirement", zenuml: "ZenUML",
        sankey: "Sankey", "block-beta": "Block",
    };
    return map[m[1].toLowerCase()] ?? m[1];
}

/** Auto-detect Markdown — strong signals only; plain `-` lists or `*` bullets do NOT qualify */
function detectMarkdown(text: string): boolean {
    const t = text.trim();
    if (/^#{1,6}\s+\S/m.test(t)) return true;      // # Heading
    if (/\*\*\S[^*\n]+\*\*/.test(t)) return true;   // **bold**
    if (/```/.test(t)) return true;                  // ``` code block
    if (/\[.+?\]\(.+?\)/.test(t)) return true;       // [link](url)
    if (/^>\s+\S/m.test(t)) return true;             // > blockquote
    if (/\|.+\|.+\|/.test(t)) return true;           // | table |
    return false;
}

/** Detect plain URL content — single line, no whitespace, http(s) scheme */
/** Strip base64 images and HTML tags for safe single-line preview text */
function previewText(raw: string): string {
    const t = raw.trim();
    // Voice notes: show summary or transcript
    if (t.startsWith('{"_type":"voice"') || t.startsWith('[{"_type":"voice"')) {
        try {
            const p = JSON.parse(t);
            const entries = Array.isArray(p) ? p : [p];
            if (entries[0]?._type === "voice") {
                const all = entries.map((v: any) => v.transcript || v.summary).filter(Boolean).join(" · ");
                return all || `🎙 ${entries.length} voice note${entries.length > 1 ? "s" : ""}`;
            }
        } catch {}
    }
    return raw
        .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]") // base64 images → placeholder
        .replace(/<[^>]+>/g, "")                           // HTML tags
        .replace(/\s+/g, " ")
        .trim();
}

/** Resize an image in markdown content by src. Replaces or wraps with HTML img tag. */
function resizeImageInContent(md: string, src: string, width: string): string {
    const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Replace existing <img> tag with this src
    md = md.replace(new RegExp(`<img[^>]*src=["']${escapedSrc}["'][^>]*>`, "g"), (match) => {
        const alt = match.match(/alt=["']([^"']*)["']/)?.[1] ?? "";
        return width === "100%" ? `![${alt}](${src})` : `<img src="${src}" alt="${alt}" style="width:${width};max-width:100%">`;
    });
    // Replace markdown image syntax ![alt](src)
    md = md.replace(new RegExp(`!\\[([^\\]]*)\\]\\(${escapedSrc}\\)`, "g"), (_match, alt) => {
        return width === "100%" ? `![${alt}](${src})` : `<img src="${src}" alt="${alt}" style="width:${width};max-width:100%">`;
    });
    return md;
}

function looksLikeUrl(text: string): boolean {
    const t = text.trim();
    return /^https?:\/\/\S+$/.test(t);
}

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
function dateGroup(dateStr: string | null): string {
    if (!dateStr) return "Older";
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff <= 7) return "This Week";
    if (diff <= 30) return "This Month";
    return "Older";
}
const PINNED_KEY = "stickies_pinned_ids";
const EMPTY_QUOTES =["🧠 Your second brain starts here. Write it down.", "✨ Great ideas deserve a home. Start now.", "📌 No more forgetting. Capture it.", "🚀 Dreams without notes are just wishes.", "📝 Plan it. Track it. Win it.", "🎯 Nothing works without priorities. Start here.", "💡 One note today. Clarity tomorrow.", "📚 Build your thinking system. One note at a time.", "⚡ Preparing is everything. Write first.", "🏆 Goals become real when you record them."];
const VIEW_STATE_KEY = "stickies:last-view:v1";
const ACTIVE_DRAFT_KEY = "stickies:active-draft:v1";
const FOLDER_COLOR_KEY = "stickies:folder-colors:v1";
const FOLDER_ICON_KEY = "stickies:folder-icons:v1";
const looksLikeMarkdown = (text: string) =>
    /^#{1,6}\s|\*\*|^[*-]\s|^>\s|`|\[.+\]\(/.test(text);
const looksLikeHtml = (text: string) =>
    /^\s*<!DOCTYPE\s+html/i.test(text) || /^\s*<html[\s>]/i.test(text);
const MAIN_LIST_MODE_KEY = "stickies:main-list-mode:v1";
const NAV_MODE_KEY = "stickies:nav-mode:v1";
const KANBAN_MODE_KEY = "stickies:kanban-mode:v1";
const APP_THEME_KEY = "stickies:app-theme:v1";
const EDIT_MODE_KEY = "stickies:edit-mode:v1";
const LIST_MODE_KEY = "stickies:list-mode-notes:v1";
const GRAPH_MODE_KEY = "stickies:graph-mode-notes:v1";
const MARKDOWN_MODE_KEY = "stickies:markdown-mode-notes:v1";
const HTML_MODE_KEY = "stickies:html-mode-notes:v1";
const MINDMAP_MODE_KEY = "stickies:mindmap-mode-notes:v1";
const STACK_MODE_KEY = "stickies:stack-mode-notes:v1";
const DEFAULT_FOLDER_KEY = "stickies:default-folder:v1";

// --- Mindmap ---
const MIND_COLORS = ["#FF3B30","#FF9500","#FFCC00","#34C759","#00C7BE","#007AFF","#5856D6","#AF52DE","#FF2D55","#FF6B4E"];
// Layout constants
const MM_NODE_H = 34;    // height of each child node
const MM_NODE_GAP = 8;   // gap between nodes
const MM_PAD = 20;       // top/bottom padding
const MM_ROOT_W = 88;    // root box width
const MM_ROOT_H = 36;    // root box height
const MM_ROOT_CX = MM_PAD + MM_ROOT_W / 2;           // root center-x
const MM_NODES_LX = MM_ROOT_CX + MM_ROOT_W / 2 + 60; // left edge of all child boxes
const MM_NUM_W = 50;     // space reserved for the big number to the left of boxes

type MindNode = { text: string; done: boolean; children: MindNode[] };
type PlacedNode = { text: string; done: boolean; x: number; y: number; color: string; orderNum: number; isRoot?: boolean };

function parseMindmap(content: string): MindNode[] {
    const roots: MindNode[] = [];
    let lastL1: MindNode | null = null;
    let lastL2: MindNode | null = null;
    for (const raw of content.split("\n")) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        let level = 1; let text = trimmed;
        const doneMatch = /^\[x\]\s*/i.test(text);
        if (doneMatch) text = text.replace(/^\[x\]\s*/i, "");
        // strip leading list markers after done check
        const h3m = text.match(/^#{3,}\s+(.*)/); const h2m = text.match(/^##\s+(.*)/); const h1m = text.match(/^#\s+(.*)/); const listm = text.match(/^[-*+]\s+(.*)/); const numm = text.match(/^\d+[.)]\s+(.*)/);
        if (h3m) { level = 3; text = h3m[1]; }
        else if (h2m) { level = 2; text = h2m[1]; }
        else if (h1m) { level = 1; text = h1m[1]; }
        else if (listm) { const indent = raw.search(/\S/); level = indent >= 4 ? 3 : indent >= 2 ? 2 : 1; text = listm[1]; }
        else if (numm) { const indent = raw.search(/\S/); level = indent >= 4 ? 3 : indent >= 2 ? 2 : 1; text = numm[1]; }
        const node: MindNode = { text, done: doneMatch, children: [] };
        if (level === 1) { roots.push(node); lastL1 = node; lastL2 = null; }
        else if (level === 2) { if (lastL1) { lastL1.children.push(node); lastL2 = node; } else { roots.push(node); lastL1 = node; } }
        else { if (lastL2) lastL2.children.push(node); else if (lastL1) lastL1.children.push(node); }
    }
    return roots;
}

function layoutMindmap(title: string, roots: MindNode[]): { nodes: PlacedNode[]; width: number; height: number; nodeW: number } {
    // Flatten tree pre-order so all nodes share the same vertical list
    const flat: MindNode[] = [];
    function walk(n: MindNode) { flat.push(n); n.children.forEach(walk); }
    roots.forEach(walk);

    // Compute node width from longest text (approx 5.4px per char at 9px font + 24px padding, min 140, max 520)
    const maxChars = Math.max(...flat.map(n => n.text.length), 10);
    const nodeW = Math.min(Math.max(maxChars * 5.4 + 24, 140), 520);

    const n = flat.length;
    // Extra bottom pad (30px) so the big order number doesn't clip below last node
    const svgH = Math.max(n * (MM_NODE_H + MM_NODE_GAP) - MM_NODE_GAP + MM_PAD + MM_PAD + 30, MM_ROOT_H + MM_PAD * 2, 180);
    const nodesCX = MM_NODES_LX + nodeW / 2;
    const svgW = MM_NODES_LX + nodeW + MM_PAD;

    const rootY = svgH / 2;
    const placed: PlacedNode[] = [{ text: title || "Note", done: false, x: MM_ROOT_CX, y: rootY, color: "#ffffff", orderNum: 0, isRoot: true }];

    flat.forEach((node, i) => {
        const y = MM_PAD + i * (MM_NODE_H + MM_NODE_GAP) + MM_NODE_H / 2;
        placed.push({ text: node.text, done: node.done, x: nodesCX, y, color: MIND_COLORS[i % MIND_COLORS.length], orderNum: i + 1 });
    });

    return { nodes: placed, width: svgW, height: svgH, nodeW };
}

// ── Voice Note Player ─────────────────────────────────────────────────────────
function VoiceNotePlayer({ data, index, onTranscriptChange, onDelete, onConvertToText }: {
    data: { audioUrl: string; transcript: string; summary: string; duration: number; recordedAt: string };
    index: number;
    onTranscriptChange?: (t: string) => void;
    onDelete?: () => void;
    onConvertToText: () => void;
}) {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [transcript, setTranscript] = useState(data.transcript || "");
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const txRef = useRef<HTMLTextAreaElement>(null);

    // Auto-size transcript on mount so full text is visible without focus
    useEffect(() => {
        const el = txRef.current;
        if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
    }, [transcript]);

    const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

    // Karaoke: split transcript into words and highlight proportionally
    const words = transcript.trim().split(/(\s+)/);
    const nonSpaceWords = words.filter(w => w.trim().length > 0);
    const progress = data.duration > 0 ? currentTime / data.duration : 0;
    const highlightedCount = Math.ceil(progress * nonSpaceWords.length);
    let wordIdx = 0;

    // Seed bars from transcript length for a unique-looking static waveform
    const staticBars = React.useMemo(() => {
        const seed = data.transcript?.length || data.duration * 10 || 42;
        return Array.from({ length: 40 }, (_, i) => {
            const x = Math.sin(i * 0.7 + seed * 0.01) * 0.5 + 0.5;
            return 0.08 + x * 0.75;
        });
    }, [data.transcript, data.duration]);

    const drawBars = React.useCallback((progress = 0, analyser?: AnalyserNode) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        const count = 40;
        const barW = (W / count) - 2;

        let freqData: Uint8Array<ArrayBuffer> | null = null;
        if (analyser) {
            freqData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
            analyser.getByteFrequencyData(freqData);
        }

        for (let i = 0; i < count; i++) {
            const played = i / count < progress;
            let h: number;
            if (freqData) {
                const idx = Math.floor((i / count) * (freqData.length * 0.6));
                h = Math.max(3, (freqData[idx] / 255) * H * 0.95);
            } else {
                h = staticBars[i] * H;
            }
            const x = i * (W / count);
            const y = (H - h) / 2;
            ctx.fillStyle = played ? "#ef4444" : "rgba(255,255,255,0.18)";
            if (played) { ctx.shadowBlur = 4; ctx.shadowColor = "#ef4444"; }
            else ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.roundRect(x + 1, y, barW, h, 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }, [staticBars]);

    // Redraw bars on time update
    useEffect(() => {
        drawBars(currentTime / (data.duration || 1));
    }, [currentTime, data.duration, drawBars]);

    const toggle = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) {
            a.pause();
            setPlaying(false);
        } else {
            a.play().then(() => setPlaying(true)).catch((err) => console.warn("Audio play failed:", err));
        }
    };

    return (
        <div className="flex flex-col px-5 py-4 border-b border-zinc-800/40 gap-3">
            <audio ref={audioRef} src={data.audioUrl} preload="metadata"
                onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
                onEnded={() => { setPlaying(false); setCurrentTime(0); }}
                onError={(e) => console.warn("Audio load error:", (e.target as HTMLAudioElement).error)} />

            {/* Top row: play + waveform + duration + spacer + timestamp + actions */}
            <div className="flex items-center gap-3">
                {/* Row number */}
                <span className="text-[10px] font-black text-zinc-600 w-5 flex-shrink-0 select-none tabular-nums">{index + 1}</span>

                {/* Play button */}
                <button onClick={toggle}
                    className="w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-400 active:scale-95 transition-all"
                    style={{ boxShadow: "0 0 14px rgba(239,68,68,0.5)" }}>
                    {playing
                        ? <span className="flex gap-[3px]"><span className="w-[3px] h-3.5 bg-white rounded-full" /><span className="w-[3px] h-3.5 bg-white rounded-full" /></span>
                        : <span className="w-0 h-0 border-t-[6px] border-b-[6px] border-l-[11px] border-t-transparent border-b-transparent border-l-white ml-0.5" />}
                </button>

                {/* Waveform */}
                <canvas ref={canvasRef} width={240} height={48} style={{ background: "transparent", width: 80, height: 22, flexShrink: 0 }} />

                {/* Duration */}
                <span className="text-[11px] font-mono text-zinc-500 flex-shrink-0 tabular-nums">{fmt(currentTime > 0 ? currentTime : data.duration)}</span>

                <div className="flex-1" />

                {/* Timestamp */}
                {data.recordedAt && (
                    <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0 hidden sm:block">
                        {new Date(data.recordedAt).toLocaleString()}
                    </span>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                        href={data.audioUrl}
                        download={`voice-${data.recordedAt ? new Date(data.recordedAt).toISOString().slice(0,19).replace(/[:.]/g,"-") : index + 1}.webm`}
                        className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-cyan-400 transition-colors"
                        title="Download">
                        <ArrowDownTrayIcon className="w-5 h-5" />
                    </a>
                    {transcript && (
                        <button
                            onClick={() => navigator.clipboard.writeText(transcript)}
                            className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-emerald-400 transition-colors"
                            title="Copy transcript">
                            <DocumentDuplicateIcon className="w-5 h-5" />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete}
                            className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors"
                            title="Delete">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Transcript */}
            <div className="ml-8 flex flex-col gap-1">
                {playing && transcript ? (
                    <p className="text-[12px] leading-relaxed text-zinc-400" style={{ fontFamily: "inherit" }}>
                        {words.map((chunk, i) => {
                            if (!chunk.trim()) return <span key={i}>{chunk}</span>;
                            const isHighlighted = wordIdx < highlightedCount;
                            const isCurrent = wordIdx === highlightedCount - 1;
                            wordIdx++;
                            return (
                                <span key={i} style={{
                                    color: isHighlighted ? "#ffffff" : "#52525b",
                                    background: isCurrent ? "rgba(239,68,68,0.25)" : "transparent",
                                    borderRadius: 2,
                                    transition: "color 0.1s, background 0.1s",
                                    padding: isCurrent ? "0 2px" : undefined,
                                }}>{chunk}</span>
                            );
                        })}
                    </p>
                ) : (
                    <textarea
                        ref={txRef}
                        value={transcript}
                        onChange={(e) => {
                            setTranscript(e.target.value);
                            onTranscriptChange?.(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        placeholder="No transcript…"
                        className="w-full bg-transparent text-[12px] text-zinc-300 leading-relaxed resize-none outline-none border-none placeholder:text-zinc-600 overflow-hidden"
                        rows={1}
                        style={{ fontFamily: "inherit", height: "auto", minHeight: "1.5rem" }}
                    />
                )}
                {data.summary && (
                    <p className="text-[11px] text-zinc-600 leading-snug italic">{data.summary}</p>
                )}
            </div>
        </div>
    );
}

function MindmapView({ title, content, onToggle }: { title: string; content: string; onToggle?: (nodeIdx: number) => void }) {
    const roots = React.useMemo(() => parseMindmap(content), [content]);
    const { nodes, width, height, nodeW } = React.useMemo(() => layoutMindmap(title, roots), [title, roots]);
    const rootNode = nodes[0];

    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(1);
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const dragging = React.useRef(false);
    const lastMouse = React.useRef({ x: 0, y: 0 });
    const lastTouchDist = React.useRef<number | null>(null);

    const clampScale = (s: number) => Math.max(0.1, Math.min(4, s));

    const fitToScreen = React.useCallback(() => {
        const el = containerRef.current;
        if (!el) return;
        const s = clampScale(Math.min(el.clientWidth / (width + 60), el.clientHeight / (height + 100)));
        setScale(s);
        setPan({ x: 0, y: 0 });
    }, [width, height]);

    React.useEffect(() => { setTimeout(fitToScreen, 0); }, [fitToScreen]);

    // Non-passive wheel & touch listeners
    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            setScale(s => clampScale(s * (e.deltaY < 0 ? 1.12 : 0.88)));
        };
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                if (lastTouchDist.current !== null) {
                    setScale(s => clampScale(s * (dist / lastTouchDist.current!)));
                }
                lastTouchDist.current = dist;
            }
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        return () => { el.removeEventListener("wheel", onWheel); el.removeEventListener("touchmove", onTouchMove); };
    }, []);

    const onMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("button")) return;
        dragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging.current) return;
        setPan(p => ({ x: p.x + e.clientX - lastMouse.current.x, y: p.y + e.clientY - lastMouse.current.y }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => { dragging.current = false; };

    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist.current = Math.hypot(dx, dy);
        }
    };
    const onTouchStartSingle = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
            setPan(p => ({ x: p.x + tx - lastMouse.current.x, y: p.y + ty - lastMouse.current.y }));
            lastMouse.current = { x: tx, y: ty };
        }
    };
    const onTouchEnd = () => { lastTouchDist.current = null; };

    const ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2];

    return (
        <div className="relative flex-1 overflow-hidden select-none" style={{ background: "#050507" }}>
            <div ref={containerRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart} onTouchMove={onTouchStartSingle} onTouchEnd={onTouchEnd}>
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "center center", willChange: "transform" }}>
                        <svg className="mindmap-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
                            {/* Edges: root → each child */}
                            {nodes.slice(1).map((node, i) => {
                                const px = MM_ROOT_CX + MM_ROOT_W / 2;
                                const py = rootNode.y;
                                const cx = MM_NODES_LX;
                                const cy = node.y;
                                const mx = (px + cx) / 2;
                                const muted = node.done;
                                return <path key={`e${i}`} d={`M ${px} ${py} C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}`}
                                    fill="none" stroke={muted ? "#3f3f46" : node.color} strokeWidth="1.5" strokeOpacity={muted ? 0.25 : 0.5}
                                    style={{ animation: "mindmapEdgeIn 0.3s ease both", animationDelay: `${i * 0.06 + 0.15}s` }} />;
                            })}
                            {/* Root node */}
                            <g transform={`translate(${rootNode.x}, ${rootNode.y})`}>
                                <g style={{ animation: "mindmapRootIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both" }}>
                                    <rect x={-MM_ROOT_W / 2} y={-MM_ROOT_H / 2} width={MM_ROOT_W} height={MM_ROOT_H} rx={MM_ROOT_H / 2}
                                        fill="rgba(255,255,255,0.08)" stroke="#ffffff" strokeWidth={2} />
                                    <text x={0} y={5} textAnchor="middle" fill="#ffffff" fontSize={10} fontWeight="800"
                                        fontFamily="system-ui,-apple-system,sans-serif">
                                        {rootNode.text.length > 12 ? rootNode.text.slice(0, 11) + "…" : rootNode.text}
                                    </text>
                                </g>
                            </g>
                            {/* Child nodes — all left-aligned at MM_NODES_LX */}
                            {nodes.slice(1).map((node, i) => {
                                const muted = node.done;
                                const strokeColor = muted ? "#3f3f46" : node.color;
                                const fillColor = muted ? "rgba(255,255,255,0.025)" : `${node.color}18`;
                                const textColor = muted ? "#3f3f46" : node.color;
                                const nodesCX = MM_NODES_LX + nodeW / 2;
                                return (
                                    <g key={`n${i}`} transform={`translate(${nodesCX}, ${node.y})`}
                                        style={{ cursor: onToggle ? "pointer" : "default" }}
                                        onDoubleClick={() => onToggle?.(i)}>
                                        <g style={{ animation: "mindmapNodeIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both", animationDelay: `${i * 0.06 + 0.08}s` }}>
                                            <text x={-nodeW / 2 - 6} y={5} textAnchor="end" dominantBaseline="middle"
                                                fill={muted ? "#27272a" : node.color} fontSize={36} fontWeight="900"
                                                fontFamily="monospace" opacity={muted ? 0.35 : 0.22}>
                                                {node.orderNum}
                                            </text>
                                            <rect x={-nodeW / 2} y={-MM_NODE_H / 2} width={nodeW} height={MM_NODE_H} rx={MM_NODE_H / 2}
                                                fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
                                            <foreignObject x={-nodeW / 2} y={-MM_NODE_H / 2} width={nodeW} height={MM_NODE_H}>
                                                <div style={{
                                                    width: "100%", height: "100%",
                                                    display: "flex", alignItems: "center",
                                                    padding: "2px 8px",
                                                    fontFamily: "system-ui,-apple-system,sans-serif",
                                                    fontSize: "9px", fontWeight: 800,
                                                    color: textColor,
                                                    wordBreak: "break-word", overflowWrap: "break-word",
                                                    overflow: "hidden", lineHeight: "1.25",
                                                    textDecoration: muted ? "line-through" : "none",
                                                    boxSizing: "border-box",
                                                }}>
                                                    {node.text}
                                                </div>
                                            </foreignObject>
                                        </g>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>

            {/* Zoom control bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-zinc-900/95 backdrop-blur-md border border-white/15 rounded-full shadow-xl z-50 px-1 h-9">
                <button onClick={() => setScale(s => clampScale(+(s - 0.1).toFixed(2)))} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white text-base transition">−</button>
                <span className="w-11 text-center text-[11px] font-black text-zinc-200 tabular-nums">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => clampScale(+(s + 0.1).toFixed(2)))} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white text-base transition">+</button>
                <div className="w-px h-4 bg-white/15 mx-0.5" />
                {ZOOM_PRESETS.map(z => (
                    <button key={z} onClick={() => { setScale(z); setPan({ x: 0, y: 0 }); }}
                        className={`px-2 h-8 text-[11px] font-bold transition ${Math.abs(scale - z) < 0.04 ? "text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
                        {z * 100}%
                    </button>
                ))}
                <div className="w-px h-4 bg-white/15 mx-0.5" />
                <button onClick={fitToScreen} className="px-3 h-7 text-[11px] font-black text-zinc-200 bg-white/10 hover:bg-white/20 rounded-full transition mx-0.5">Fit</button>
            </div>
        </div>
    );
}

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
        (document.activeElement as HTMLElement)?.blur();
        return navigator.clipboard.writeText(text);
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
    } catch (err) {
        console.error("Copy fallback failed", err);
    }
    textArea.blur();
    document.body.removeChild(textArea);
    return Promise.resolve();
};

type SoundType = "create" | "delete" | "move" | "add" | "check" | "uncheck" | "hover" | "click" | "toast" | "toast-error" | "navigate";
let _lastHoverSoundAt = 0;
function playSound(type: SoundType) {
    try {
        if (type === "hover") {
            const now = Date.now();
            if (now - _lastHoverSoundAt < 80) return;
            _lastHoverSoundAt = now;
        }
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = ctx.currentTime;
        const tone = (freq: number, delay: number, vol: number, dur: number, oscType: OscillatorType = "sine") => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = oscType;
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.012);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.start(now + delay); osc.stop(now + delay + dur + 0.02);
        };
        if (type === "hover") {
            tone(1200, 0, 0.028, 0.055, "sine");
        } else if (type === "click") {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = "triangle";
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.055);
            g.gain.setValueAtTime(0.096, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === "navigate") {
            tone(440, 0,    0.064, 0.10); // A4
            tone(660, 0.07, 0.056, 0.12); // E5
        } else if (type === "toast") {
            tone(784, 0,    0.08, 0.14); // G5
            tone(988, 0.09, 0.072, 0.16); // B5
            tone(1175, 0.18, 0.056, 0.18); // D6
        } else if (type === "toast-error") {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.20);
            g.gain.setValueAtTime(0.08, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now); osc.stop(now + 0.24);
        } else if (type === "create") {
            tone(523, 0,    0.112, 0.18); // C5
            tone(659, 0.09, 0.096, 0.18); // E5
        } else if (type === "add") {
            tone(659, 0, 0.104, 0.16);   // E5 pop
        } else if (type === "check") {
            tone(659, 0,    0.096, 0.13); // E5
            tone(784, 0.07, 0.08, 0.15); // G5
        } else if (type === "uncheck") {
            tone(784, 0,    0.064, 0.12); // G5
            tone(523, 0.07, 0.056, 0.14); // C5
        } else if (type === "delete") {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(380, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);
            g.gain.setValueAtTime(0.104, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
            osc.start(now); osc.stop(now + 0.26);
        } else if (type === "move") {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(720, now + 0.13);
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.08, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now); osc.stop(now + 0.20);
        }
        setTimeout(() => ctx.close(), 800);
    } catch { /* silently ignore — sound is non-critical */ }
}

export default function NotesMaster() {
    const [mounted, setMounted] = useState(false);
    const [gridCols, setGridCols] = useState(3);
    const [isUrlChecking, setIsUrlChecking] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dbData, setDbData] = useState<any[]>([]);
    const [ripples, setRipples] = useState<any[]>([]);
    const [folderStack, setFolderStack] = useState<{ id: string; name: string; color: string }[]>([]);
    const activeFolder = folderStack.at(-1)?.name ?? null;
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isFolderSelectMode, setIsFolderSelectMode] = useState(false);
    const [selectedFolderNames, setSelectedFolderNames] = useState<string[]>([]);
    // Compat shim — keeps all existing setActiveFolder() call sites working unchanged
    const setActiveFolder = useCallback((name: string | null) => {
        setFolderStack(name ? [{ id: `virtual-${name}`, name, color: palette12[0] }] : []);
    }, []);
    const enterFolder = useCallback((frame: { id: string; name: string; color: string }) => {
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
        setFolderStack((prev) => prev.slice(0, -1));
        setIsSelectMode(false);
        setSelectedIds(new Set());
        setTypeFilter(null);
    }, []);
    const goToIndex = useCallback((i: number) => {
        setFolderStack((prev) => prev.slice(0, i + 1));
    }, []);
    const [search, setSearch] = useState("");
    const [toast, setToast] = useState("");
    const [toastColor, setToastColor] = useState("#34C759");
    const [toastConfetti, setToastConfetti] = useState(false);
    const [undoDeleteTask, setUndoDeleteTask] = useState<{ text: string; lineIdx: number } | null>(null);
    const taskContentHistory = useRef<string[]>([]);
    useEffect(() => { if (!undoDeleteTask) return; const t = setTimeout(() => setUndoDeleteTask(null), 5000); return () => clearTimeout(t); }, [undoDeleteTask]);
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
    const [showMerger, setShowMerger] = useState(false);
    const [mergeQuery, setMergeQuery] = useState("");
    const mergerSearchRef = useRef<HTMLInputElement | null>(null);
    const [targetFolder, setTargetFolder] = useState("General");
    const [noteColor, setNoteColor] = useState(palette12[0]);
    const [folderColors, setFolderColors] = useState<Record<string, string>>({});
    const [folderIcons, setFolderIcons] = useState<Record<string, string>>({});
    const [iconPickerFolder, setIconPickerFolder] = useState<string | null>(null);
    const [pendingShare, setPendingShare] = useState<{ content: string } | null>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrData, setQrData] = useState("");
    const [qrIsBurn, setQrIsBurn] = useState(false);
    const [qrType, setQrType] = useState<"link" | "data" | "burn">("link");
    const [qrLinkCopied, setQrLinkCopied] = useState(false);
    const [sharePickerOpen, setSharePickerOpen] = useState(false);
    const [calModalOpen, setCalModalOpen] = useState(false);
    const [calTarget, setCalTarget] = useState<"apple" | "google">("google");
    const [calDate, setCalDate] = useState("");
    const [calTime, setCalTime] = useState("09:00");
    const [calRepeat, setCalRepeat] = useState<"none" | "daily" | "weekly" | "monthly">("none");
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
    const [mindmapModeNotes, setMindmapModeNotes] = useState<Set<string>>(new Set());
    const [stackModeNotes, setStackModeNotes] = useState<Set<string>>(new Set());
    const [copiedContent, setCopiedContent] = useState(false);
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTaskText, setNewTaskText] = useState("");
    const [confirmDeleteTask, setConfirmDeleteTask] = useState<number | null>(null);
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
    const mainSwipeLocked = useRef<"h" | "v" | null>(null);
    const [swipeLeftGlow, setSwipeLeftGlow] = useState(false);
    const [editingTaskText, setEditingTaskText] = useState("");
    const editTaskInputRef = useRef<HTMLInputElement | null>(null);
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
    const [lightMode, setLightMode] = useState<"off" | "flash" | "ambient">("flash");
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
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const isAdmin = userEmail === "bheng.code@gmail.com";
    const [mainListMode, setMainListMode] = useState(false);
    const [defaultFolder, setDefaultFolder] = useState<string>("CLAUDE");
    const [showDefaultFolderPicker, setShowDefaultFolderPicker] = useState(false);
    const [navMode, setNavMode] = useState<"folders-and-files" | "files-only">("folders-and-files");
    const [kanbanMode, setKanbanMode] = useState(false);
    const [appTheme, setAppTheme] = useState<"dark" | "light" | "monokai">("dark");
    const [mermaidShowCode, setMermaidShowCode] = useState(false);
    const [codeEditMode, setCodeEditMode] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [pendingNoteType, setPendingNoteType] = useState<string | null>(null);
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
    const [voiceAutoStart, setVoiceAutoStart] = useState(false);
    const [showNoteTypePicker, setShowNoteTypePicker] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const colDragNoteRef = useRef<string | null>(null);
    const [colDragOver, setColDragOver] = useState<string | null>(null);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const [glowCard, setGlowCard] = useState<{ id: string; x: number; y: number } | null>(null);
    const [imgPopover, setImgPopover] = useState<{ src: string; alt: string; x: number; y: number } | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [showCmdK, setShowCmdK] = useState(false);
    const [cmdKQuery, setCmdKQuery] = useState("");
    const [cmdKCursor, setCmdKCursor] = useState(0);
    const cmdKInputRef = useRef<HTMLInputElement | null>(null);
    const [showCmdB, setShowCmdB] = useState(false);
    const [cmdBQuery, setCmdBQuery] = useState("");
    const [cmdBCursor, setCmdBCursor] = useState(0);
    const cmdBInputRef = useRef<HTMLInputElement | null>(null);
    const [bookmarksData, setBookmarksData] = useState<any[]>([]);
    const [images, setImages] = useState<Array<{ url: string; name: string; type: string }>>([]);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [uploadingImages, setUploadingImages] = useState(false);

    const isSavingRef = useRef(false);
    const localWriteRef = useRef<Map<string, number>>(new Map()); // noteId → timestamp, self-echo guard
    const flashQueueRef = useRef<Array<{ note: any; color: string }>>([]);
    const integrationsRef = useRef<Array<{ trigger: string; condition: Record<string, string>; type: string; config: Record<string, string> }>>([]);
    const isFlashingRef = useRef(false);
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressOpenRef = useRef(false);
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mainScrollRef = useRef<HTMLElement | null>(null);
    const editorTextRef = useRef<HTMLTextAreaElement | null>(null);
    const tower3dRef = useRef<HTMLDivElement | null>(null);
    const tower3dDrag = useRef({ active: false, startX: 0, startY: 0, rotX: 12, rotY: -28 });
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
    // Most recently updated note — drives the live favicon
    const lastNote = useMemo(() => {
        return [...dbData]
            .filter(n => !n.is_folder && (n.title || "").trim())
            .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0] ?? null;
    }, [dbData]);

    usePageMeta({
        title: "Stickies",
        description: "Personal sticky notes",
        url: `${origin}/`,
        basePath: "/icons/stickies",
        themeColor: lastNote?.color || lastNote?.folder_color || "#007AFF",
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
            const token = await getAuthToken();
            const [notesRes, foldersRes, iconsResult, integrationsResult] = await Promise.all([
                fetch("/api/stickies", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : { notes: [] }).catch(() => ({ notes: [] })),
                fetch("/api/stickies?folders=1", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : { folders: [] }).catch(() => ({ folders: [] })),
                fetch("/api/stickies/folder-icon", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : { icons: {} }).catch(() => ({ icons: {} })),
                fetch("/api/stickies/integrations", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : []).catch(() => []),
            ]);
            const allItems = [
                ...(foldersRes.folders ?? []).map((f: any) => ({ ...f, is_folder: true })),
                ...(notesRes.notes ?? []),
            ];
            setDbData(allItems);
            if (iconsResult.icons && Object.keys(iconsResult.icons).length > 0) {
                setFolderIcons((prev) => ({ ...prev, ...iconsResult.icons }));
            }
            if (Array.isArray(integrationsResult)) {
                integrationsRef.current = integrationsResult;
                // Sync lightMode from persisted Hue config on initial load
                const hueInt = integrationsResult.find((ig: any) => ig.type === "hue");
                if (hueInt?.config?.mode) setLightMode(hueInt.config.mode as any);
            }
        } finally {
            setIsDataLoaded(true);
        }
    };

    useEffect(() => {
        const updateCols = () => {
            if (window.matchMedia("(min-width: 1600px)").matches) setGridCols(10);
            else if (window.matchMedia("(min-width: 1280px)").matches) setGridCols(8);
            else if (window.matchMedia("(min-width: 1024px)").matches) setGridCols(7);
            else if (window.matchMedia("(min-width: 768px)").matches) setGridCols(6);
            else if (window.matchMedia("(min-width: 480px)").matches) setGridCols(4);
            else setGridCols(3);
        };
        updateCols();
        window.addEventListener("resize", updateCols);
        return () => window.removeEventListener("resize", updateCols);
    }, []);

    useEffect(() => {
        createBrowserClient().auth.getUser().then(({ data }) => {
            setUserEmail(data.user?.email ?? null);
        });
    }, []);

    useEffect(() => {
        setMounted(true);
        void sync();

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
                    setNoteColor(palette12[0]);
                    setShowColorPicker(false);
                    setShowSwitcher(false);
                    setActiveLine(0);
                    setEditorScrollTop(0);
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
            // Load default folder
            const savedDefaultFolder = localStorage.getItem(DEFAULT_FOLDER_KEY) || "CLAUDE";
            setDefaultFolder(savedDefaultFolder);

            // On first load of a new session, open default folder + thumbnail view
            const isNewSession = !sessionStorage.getItem("stickies:session-started");
            if (isNewSession) {
                sessionStorage.setItem("stickies:session-started", "1");
                if (savedDefaultFolder) setActiveFolder(savedDefaultFolder);
                setMainListMode(false); // thumbnail as default
            } else {
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
            const rawMindmap = localStorage.getItem(MINDMAP_MODE_KEY);
            if (rawMindmap) { const arr = JSON.parse(rawMindmap); if (Array.isArray(arr)) setMindmapModeNotes(new Set(arr)); }
        } catch { /* ignore */ }
        try {
            const rawStack = localStorage.getItem(STACK_MODE_KEY);
            if (rawStack) { const arr = JSON.parse(rawStack); if (Array.isArray(arr)) setStackModeNotes(new Set(arr)); }
        } catch { /* ignore */ }
        try {
            const rawMainList = localStorage.getItem(MAIN_LIST_MODE_KEY);
            if (rawMainList) setMainListMode(rawMainList === "true");
        } catch { /* ignore */ }
        try {
            const rawNavMode = localStorage.getItem(NAV_MODE_KEY);
            if (rawNavMode === "files-only" || rawNavMode === "folders-and-files") setNavMode(rawNavMode);
        } catch { /* ignore */ }
        try {
            const rawKanban = localStorage.getItem(KANBAN_MODE_KEY);
            if (rawKanban) setKanbanMode(rawKanban === "true");
            const rawEdit = localStorage.getItem(EDIT_MODE_KEY);
            if (rawEdit) setEditMode(rawEdit === "true");
        } catch { /* ignore */ }
        try {
            const rawTheme = localStorage.getItem(APP_THEME_KEY);
            if (rawTheme === "light" || rawTheme === "dark" || rawTheme === "monokai") setAppTheme(rawTheme);
        } catch { /* ignore */ }

        // URL params override localStorage (read last so they win)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const themeParam = urlParams.get("theme");
            if (themeParam === "light" || themeParam === "dark" || themeParam === "monokai") setAppTheme(themeParam);
            const viewParam = urlParams.get("view");
            if (viewParam === "list") { setMainListMode(true); setKanbanMode(false); }
            else if (viewParam === "thumb") { setMainListMode(false); setKanbanMode(false); }
            else if (viewParam === "kanban") { setMainListMode(false); setKanbanMode(true); }
            const navParam = urlParams.get("nav");
            if (navParam === "folders" || navParam === "folders-and-files") setNavMode("folders-and-files");
            else if (navParam === "files" || navParam === "files-only") setNavMode("files-only");
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
        try {
            localStorage.setItem(MINDMAP_MODE_KEY, JSON.stringify([...mindmapModeNotes]));
        } catch { /* ignore */ }
    }, [mindmapModeNotes]);

    useEffect(() => {
        try {
            localStorage.setItem(STACK_MODE_KEY, JSON.stringify([...stackModeNotes]));
        } catch { /* ignore */ }
    }, [stackModeNotes]);

    useEffect(() => {
        try { localStorage.setItem(MAIN_LIST_MODE_KEY, String(mainListMode)); } catch { /* ignore */ }
    }, [mainListMode]);
    useEffect(() => {
        try { localStorage.setItem(NAV_MODE_KEY, navMode); } catch { /* ignore */ }
    }, [mainListMode]);

    useEffect(() => {
        if (!showAddMenu) return;
        const close = () => setShowAddMenu(false);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [showAddMenu]);

    useEffect(() => {
        try { localStorage.setItem(KANBAN_MODE_KEY, String(kanbanMode)); } catch { /* ignore */ }
    }, [kanbanMode]);

    useEffect(() => {
        try { localStorage.setItem(APP_THEME_KEY, appTheme); } catch { /* ignore */ }
        document.documentElement.setAttribute("data-theme", appTheme);
    }, [appTheme]);

    useEffect(() => {
        try { localStorage.setItem(EDIT_MODE_KEY, String(editMode)); } catch { /* ignore */ }
    }, [editMode]);

    // Always open mermaid notes in code view first; reset code edit mode on note switch
    useEffect(() => {
        if (editorOpen && mermaidMode) setMermaidShowCode(true);
        setCodeEditMode(false);
    }, [editorOpen, editingNote?.id]);

    // Load pinned note IDs from localStorage
    useEffect(() => {
        try {
            const s = localStorage.getItem(PINNED_KEY);
            if (s) setPinnedIds(new Set(JSON.parse(s)));
        } catch { /* ignore */ }
    }, []);

    // Cmd+K / Cmd+J global shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "j")) {
                e.preventDefault();
                setShowCmdK(v => { if (!v) { setCmdKQuery(""); setCmdKCursor(0); } return !v; });
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "b") {
                e.preventDefault();
                setShowCmdB(v => { if (!v) { setCmdBQuery(""); setCmdBCursor(0); } return !v; });
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Fetch bookmarks from DB
    useEffect(() => {
        if (!showCmdB || bookmarksData.length > 0) return;
        getAuthToken().then(token => {
            fetch("/api/stickies/bookmarks", { headers: { Authorization: `Bearer ${token}` } })
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setBookmarksData(data); })
                .catch(() => {});
        });
    }, [showCmdB]);

    // Live clock — tick every minute
    useEffect(() => {
        const tick = () => setNow(new Date());
        const ms = 60000 - (Date.now() % 60000);
        const t = setTimeout(() => { tick(); const i = setInterval(tick, 60000); return () => clearInterval(i); }, ms);
        return () => clearTimeout(t);
    }, []);

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
                    const isChecklist = note.list_mode || note.type === "checklist";
                    if (isChecklist) setListModeNotes((s) => new Set([...s, String(note.id)]));
                    else setListModeNotes((s) => { const n = new Set(s); n.delete(String(note.id)); return n; });
                }
                if (note.mindmap_mode !== undefined) {
                    if (note.mindmap_mode) setMindmapModeNotes((s) => new Set([...s, String(note.id)]));
                    else setMindmapModeNotes((s) => { const n = new Set(s); n.delete(String(note.id)); return n; });
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

        channel.bind("navigate-to", (data: { url: string }) => {
            if (data?.url) window.location.href = data.url;
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

    // Auto-clean mermaid frontmatter when a mermaid note opens
    useEffect(() => {
        if (!editingNote?.id) return;
        if (editingNote.type !== "mermaid" && !detectMermaid(editingNote.content || "")) return;
        const raw = editingNote.content || "";
        if (!/---/.test(raw)) return;
        const cleaned = cleanMermaidContent(raw);
        if (cleaned === raw) return;
        setContent(cleaned);
        showToast("Cleaned ✦", "#06b6d4", true);
        // Save directly with the cleaned value (avoids stale closure on saveNote)
        void notesApi.update(String(editingNote.id), { content: cleaned });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingNote?.id]);

    useEffect(() => {
        if (!pendingRestoreNoteId || !isDataLoaded) return;
        const note = dbData.find((n) => !n.is_folder && String(n.id) === String(pendingRestoreNoteId));
        if (note) {
            setActiveFolder(note.folder_name || null);
            setEditingNote(note);
            setTitle(note.title || "");
            setContent((note.type === "mermaid" || detectMermaid(note.content || "")) ? cleanMermaidContent(note.content || "") : (note.content || ""));
            setImages((note as any).images ?? []);
            setTargetFolder(note.folder_name || "General");
            setNoteColor(note.folder_color || palette12[0]);
            setActiveLine(0);
            setEditorScrollTop(0);
            if (note.id && (note.list_mode || note.type === "checklist")) {
                setListModeNotes((prev) => new Set([...prev, String(note.id)]));
            }
            if (note.id && note.mindmap_mode) {
                setMindmapModeNotes((prev) => new Set([...prev, String(note.id)]));
            }
            setEditorOpen(true);
        }
        setPendingRestoreNoteId(null);
        setIsUrlChecking(false);
    }, [pendingRestoreNoteId, dbData, isDataLoaded]);

    // Auto-select the most-recently-updated note when entering edit mode
    useEffect(() => {
        if (!editMode || !isDataLoaded) return;
        if (editorOpen && editingNote) return; // already viewing a note
        const topNote = dbData.filter((n) => !n.is_folder).sort((a, b) =>
            String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
        )[0];
        if (!topNote) return;
        setEditingNote(topNote);
        setTitle(topNote.title || "");
        setContent(topNote.content || "");
        setImages((topNote as any).images ?? []);
        setTargetFolder(topNote.folder_name || "General");
        setNoteColor(topNote.folder_color || palette12[0]);
        setActiveLine(0);
        setEditorScrollTop(0);
        if (topNote.id && (topNote.list_mode || topNote.type === "checklist")) {
            setListModeNotes((prev) => new Set([...prev, String(topNote.id)]));
        }
        setEditorOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode, isDataLoaded]);

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
            setImages((matchedNote as any).images ?? []);
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

        // UUID-keyed — allows same folder_name in different parent directories
        const folderRowsById = new Map<string, any>();
        dbData
            .filter((item) => item.is_folder)
            .forEach((row) => {
                folderRowsById.set(String(row.id), row);
            });

        // Note count per folder_id (UUID-based for accuracy)
        const noteCountByFolderId = new Map<string, number>();
        dbData.filter((item) => !item.is_folder && item.folder_id).forEach((item) => {
            const fid = String(item.folder_id);
            noteCountByFolderId.set(fid, (noteCountByFolderId.get(fid) || 0) + 1);
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
                    latestUpdatedAt: latestUpdatedByFolderId.get(rowId) || String(row.updated_at || ""),
                    name: folderName,
                    color: folderColors[folderName] || row.folder_color || palette12[0],
                    count: noteCountByFolderId.get(rowId) || noteCountByFolder.get(folderName) || 0,
                    subfolderCount: subfolderCountByFolder.get(folderName) || 0,
                    icon: folderIcons[folderName] || "",
                    parent_folder_name: row.parent_folder_name || null,
                };
            })
            .sort((a, b) => a.order - b.order);
        // Deduplicate by name — keep the first (lowest order) entry per folder name
        const seenFolderNames = new Set<string>();
        const foldersFromRows = foldersFromRowsRaw.filter((f) => {
            if (seenFolderNames.has(f.name)) return false;
            seenFolderNames.add(f.name);
            return true;
        });

        const knownFolderNames = new Set(foldersFromRows.map((f) => f.name));
        const missingFolders = Array.from(noteCountByFolder.keys())
            .filter((folderName) => !knownFolderNames.has(folderName))
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
        const SYSTEM_BOTTOM = ["CLAUDE"];
        if (pendingFolderOrder) {
            const idx = new Map(pendingFolderOrder.map((name, i) => [name, i]));
            const sorted = [...all].sort((a, b) => (idx.has(a.name) ? idx.get(a.name)! : all.length) - (idx.has(b.name) ? idx.get(b.name)! : all.length));
            return [...sorted.filter(f => !SYSTEM_BOTTOM.includes(f.name)), ...sorted.filter(f => SYSTEM_BOTTOM.includes(f.name))];
        }
        return [...all.filter(f => !SYSTEM_BOTTOM.includes(f.name)), ...all.filter(f => SYSTEM_BOTTOM.includes(f.name))];
    }, [dbData, folderColors, folderIcons, pendingFolderOrder]);

    // Folders visible at the current navigation level (root or sub-folder)
    const currentLevelFolders = useMemo(() => {
        return folders
            .filter((f) => {
                const row = dbData.find((r) => r.is_folder && String(r.id) === String(f.id));
                if (folderStack.length === 0) {
                    return (row?.parent_folder_name ?? null) === null;
                }
                return (row?.parent_folder_name ?? null) === activeFolder;
            })
            .map((f) => ({ ...f, is_folder: true as const }));
    }, [folders, folderStack, activeFolder, dbData]);

    const displayItems = useMemo(() => {
        const byUpdated = (a: any, b: any) =>
            String(b.updated_at || "").localeCompare(String(a.updated_at || "")) ||
            String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
        if (search.trim()) {
            const q = search.toLowerCase();
            const score = (n: any): number => {
                const t = (n.title || "").toLowerCase();
                const f = (n.folder_name || "").toLowerCase();
                const c = (n.content || "").toLowerCase();
                const pinned = pinnedIds.has(String(n.id));
                // priority: folder match > title match > pinned/bookmark > content
                if (f === q)           return 0;
                if (f.startsWith(q))   return 1;
                if (f.includes(q))     return 2;
                if (t === q)           return 3;
                if (t.startsWith(q))   return 4;
                if (t.includes(q))     return pinned ? 5 : 6;
                if (pinned && c.includes(q)) return 7;
                if (c.includes(q))     return 8;
                return 9;
            };
            return dbData
                .filter((n) => !n.is_folder && score(n) < 9)
                .sort((a, b) => { const sd = score(a) - score(b); return sd !== 0 ? sd : byUpdated(a, b); });
        }
        if (editMode) {
            // Edit mode: all notes, no folders (hide BOOKMARKS)
            return dbData.filter((n) => !n.is_folder).sort(byUpdated);
        }
        if (activeFolder) {
            // Inside a folder: subfolders first, then notes
            const activeFolderId = folderStack.at(-1)?.id ?? null;
            const useUuid = activeFolderId && !activeFolderId.startsWith("virtual-");
            const notes = dbData.filter((n) => !n.is_folder && (
                (useUuid && String(n.folder_id) === activeFolderId) ||
                n.folder_name === activeFolder
            )).sort(byUpdated);
            return [...currentLevelFolders, ...notes];
        }
        // Root: files-only mode → all notes sorted by newest first, then alpha by folder/title
        if (navMode === "files-only") {
            return dbData
                .filter((n) => !n.is_folder)
                .sort((a, b) =>
                    String(b.created_at || "").localeCompare(String(a.created_at || "")) ||
                    String(a.folder_name || "").localeCompare(String(b.folder_name || "")) ||
                    String(a.title || "").localeCompare(String(b.title || ""))
                );
        }
        // Root: show folders
        return currentLevelFolders;
    }, [dbData, editMode, activeFolder, folderStack, search, currentLevelFolders, pendingNoteOrder, pinnedIds, navMode]);

    // Available type chips for the filter row (only types present in current view, notes only)
    const availableTypeChips = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of displayItems) {
            if (item.is_folder || item._header) continue;
            const t = (item as any).type;
            if (t && t !== "text") counts[t] = (counts[t] ?? 0) + 1;
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [displayItems]);

    // Filtered display items (type filter applied)
    const filteredDisplayItems = useMemo(() => {
        if (!typeFilter) return displayItems;
        return displayItems.filter((item: any) => item.is_folder || item._header || item.type === typeFilter);
    }, [displayItems, typeFilter]);

    const cmdKResults = useMemo(() => {
        const notes = dbData.filter((n: any) => !n.is_folder);
        const byDate = (a: any, b: any) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        if (!cmdKQuery.trim()) {
            return notes.sort(byDate).slice(0, 5);
        }
        const q = cmdKQuery.toLowerCase();
        const matchingFolders = folders
            .filter(f => f.name.toLowerCase().includes(q))
            .map(f => ({ ...f, _isFolder: true }))
            .slice(0, 3);
        const score = (n: any): number => {
            const t = (n.title || "").toLowerCase();
            const f = (n.folder_name || "").toLowerCase();
            const c = (n.content || "").toLowerCase();
            const pinned = pinnedIds.has(String(n.id));
            // priority: folder > file name > bookmark > content
            if (f === q)           return 0;
            if (f.startsWith(q))   return 1;
            if (f.includes(q))     return 2;
            if (t === q)           return 3;
            if (t.startsWith(q))   return 4;
            if (t.includes(q))     return pinned ? 5 : 6;
            if (pinned && c.includes(q)) return 7;
            if (c.includes(q))     return 8;
            return 9;
        };
        const matchedNotes = notes
            .filter((n: any) => score(n) < 9)
            .sort((a: any, b: any) => {
                const sd = score(a) - score(b);
                if (sd !== 0) return sd;
                return byDate(a, b);
            });
        return [...matchingFolders, ...matchedNotes];
    }, [dbData, cmdKQuery, pinnedIds, folders]);

    const cmdBResults = useMemo(() => {
        if (!cmdBQuery.trim()) return bookmarksData.slice(0, 12);
        const q = cmdBQuery.toLowerCase();
        return bookmarksData.filter(b =>
            (b.title || "").toLowerCase().includes(q) ||
            (b.folder || "").toLowerCase().includes(q) ||
            (b.url || "").toLowerCase().includes(q)
        ).slice(0, 20);
    }, [bookmarksData, cmdBQuery]);

    const dbStats = useMemo(() => {
        const folderCount = dbData.filter(r => r.is_folder).length;
        const noteCount   = dbData.filter(r => !r.is_folder).length;
        const enc         = new TextEncoder();
        const bytes       = dbData.reduce((acc, r) => acc + enc.encode(r.title || "").byteLength + enc.encode(r.content || "").byteLength, 0);
        const size        = bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
        return { folderCount, noteCount, size };
    }, [dbData]);

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

            // Auto-clean mermaid junk (trailing fences, --- blocks) on every save
            let saveContent = content;
            const isMermaidNote = (editingNote as any)?.type === "mermaid" || detectMermaid(content);
            if (isMermaidNote) {
                const cleaned = cleanMermaidContent(content);
                if (cleaned !== content) {
                    saveContent = cleaned;
                    setContent(cleaned);
                    showToast("Cleaned ✦", "#06b6d4", true);
                }
            }

            const folderName = targetFolder || activeFolder || editingNote?.folder_name || "General";
            const activeFolderRow = folderStack.at(-1);
            const folderId = activeFolderRow && !activeFolderRow.id.startsWith("virtual-") ? activeFolderRow.id : null;
            const payload: any = {
                title: title.trim() || "Untitled",
                content: saveContent,
                folder_name: folderName,
                folder_color: noteColor || folders.find((f) => f.name === folderName)?.color || editingNote?.folder_color || palette12[0],
                is_folder: false,
                type: pendingNoteType ?? (editingNote as any)?.type ?? detectNoteType(saveContent),
                updated_at: new Date().toISOString(),
                ...(folderId ? { folder_id: folderId } : {}),
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
                        setPendingNoteType(null);
                        setEditingNote(data);
                        setDbData((prev) => { const seen = new Set<string>(); return prev.map((n) => String(n.id) === optimisticId ? data : n).filter((n) => { const id = String(n.id); if (seen.has(id)) return false; seen.add(id); return true; }); });
                    }
                }
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                if (!silent) { const t = (payload.title || "Untitled").slice(0, 10) + ((payload.title || "").length > 10 ? "…" : ""); const isFirst = !existingNoteIdStr && dbData.filter(n => !n.is_folder && !n._optimistic).length <= 1; showToast(existingNoteIdStr ? `"${t}" updated` : `+ "${t}"`, payload.folder_color || "#34C759", isFirst); }
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
        [isDraftDirty, targetFolder, noteColor, activeFolder, folderStack, editingNote, title, content, folders, dbData, pendingNoteType],
    );

    const closeEditorTools = useCallback(() => {
        setShowColorPicker(false);
        setShowSwitcher(false);
        setShowMerger(false);
        setMergeQuery("");
    }, []);

    const moveToFolder = useCallback(
        async (name: string) => {
            const color = folders.find((f) => f.name === name)?.color || palette12[0];
            setTargetFolder(name);
            setNoteColor(color);
            setShowSwitcher(false);
            setFolderSearchQuery("");
            playSound("move");
            showToast(`→ "${name}"`, color);
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

    const mergeWithNote = useCallback(
        async (sourceNote: { id: string; title: string; content: string; folder_color?: string }) => {
            const sourceId = String(sourceNote.id);
            const currentId = editingNote?.id ? String(editingNote.id) : null;
            if (!currentId || sourceId === currentId) return;

            // Append source content to current
            const sep = content.trim() ? "\n" : "";
            const merged = content + sep + (sourceNote.content || "");
            setContent(merged);

            // Persist merged content to current note
            try {
                await notesApi.update(currentId, { content: merged });
                setDbData((prev) => prev.map((r) => String(r.id) === currentId ? { ...r, content: merged } : r));
            } catch (err) {
                console.error("Merge update failed:", err);
            }

            // Delete source note
            try {
                await notesApi.delete(sourceId);
                setDbData((prev) => prev.filter((r) => String(r.id) !== sourceId));
            } catch (err) {
                console.error("Merge delete failed:", err);
            }

            const currentLabel = (title.trim() || editingNote?.title || "Untitled").slice(0, 10);
            const sourceLabel = (sourceNote.title || "Untitled").slice(0, 10);
            const currentColor = noteColor || "#FFCC00";
            const sourceColor = sourceNote.folder_color || "#FF3B30";

            setShowMerger(false);
            setMergeQuery("");
            showToast(`"${currentLabel}" merged`, currentColor);
            setTimeout(() => showToast(`"${sourceLabel}" deleted`, sourceColor), 800);
        },
        [editingNote, content, title, noteColor],
    );

    const closeNoteModal = useCallback(() => {
        const wasChanged = isDraftDirty;
        void saveNote({ silent: true });
        if (wasChanged && title.trim()) {
            const t = title.slice(0, 10) + (title.length > 10 ? "…" : "");
            showToast(`"${t}" saved`, noteColor || "#34C759");
        }
        closeEditorTools();
        setEditorOpen(false);
        setImages([]);
    }, [saveNote, closeEditorTools, isDraftDirty, title, noteColor]);

    const backToRootFromEditor = useCallback(() => {
        const wasChanged = isDraftDirty;
        void saveNote({ silent: true });
        if (wasChanged && title.trim()) {
            const t = title.slice(0, 10) + (title.length > 10 ? "…" : "");
            showToast(`"${t}" saved`, noteColor || "#34C759");
        }
        closeEditorTools();
        setEditorOpen(false);
        setImages([]);
        // Stay in the note's folder; only go to root if no folder
        setActiveFolder(targetFolder || null);
        setSearch("");
    }, [saveNote, closeEditorTools, isDraftDirty, targetFolder, title, noteColor]);

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

    // Cmd+S → save + toast
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                void saveNote({ silent: true }).then(() => {
                    if (title.trim()) {
                        const t = title.slice(0, 10) + (title.length > 10 ? "…" : "");
                        showToast(`"${t}" saved`, noteColor || "#34C759");
                    }
                });
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [saveNote, title, noteColor]);

    const openNewNote = useCallback((type?: string) => {
        const isStandup = (activeFolder || "").toLowerCase() === "standup";
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;
        setEditingNote(null);
        setTitle(isStandup ? dateStr : "");
        setContent("");
        setImages([]);
        setPendingNoteType(type ?? null);
        setTargetFolder(activeFolder || (editMode ? "Work" : "General"));
        setNoteColor(pickUniqueColor());
        shouldFocusTitleOnOpenRef.current = !isStandup;
        closeEditorTools();
        setActiveLine(0);
        setEditorScrollTop(0);
        setEditorOpen(true);
        playSound("create");
    }, [activeFolder, editMode, closeEditorTools, pickUniqueColor]);

    const showToast = (msg: string, color = "#34C759", confetti = false) => {
        setToastColor(color);
        setToast(msg);
        setToastConfetti(confetti);
        setTimeout(() => { setToast(""); setToastConfetti(false); }, 3000);
        playSound(color === "#FF3B30" ? "toast-error" : "toast");
    };

    async function uploadImage(file: File): Promise<{ url: string; name: string; type: string }> {
        const fd = new FormData();
        fd.append("file", file);
        const noteId = editingNote?.id;
        if (noteId) fd.append("noteId", String(noteId));
        const res = await fetch("/api/stickies/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${await getAuthToken()}` },
            body: fd,
        });
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
    }

    async function addImages(files: FileList | File[]) {
        setUploadingImages(true);
        try {
            const uploads = await Promise.all(Array.from(files).map(uploadImage));
            setImages((prev) => {
                const updated = [...prev, ...uploads];
                const noteId = editingNote?.id;
                if (noteId) notesApi.update(String(noteId), { images: updated }).catch(console.error);
                return updated;
            });
        } catch {
            showToast("Upload failed", "#FF3B30");
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
        const htmlData = e.clipboardData.getData("text/html");

        // Rich HTML paste (Notion, Google Docs, etc.)
        // Always convert if HTML contains images (images can't be plain text).
        // Skip for non-image rich text if note is explicitly in plain text mode.
        const nid = editingNote?.id ? String(editingNote.id) : null;
        const isPlainTextMode = nid ? markdownModeNotes.has(nid) : false;
        const htmlHasImages = htmlData.includes("<img");
        if (htmlData && htmlData.includes("<") && (htmlHasImages || htmlData.includes("<h") || htmlData.includes("<strong") || htmlData.includes("<li") || htmlData.includes("<p")) && (!isPlainTextMode || htmlHasImages)) {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart ?? content.length;
            const end = textarea.selectionEnd ?? content.length;
            showToast("Converting rich text…", "#32ADE6");
            try {
                const { htmlToMarkdown } = await import("@/lib/htmlToMarkdown");
                const token = await getAuthToken();
                const md = await htmlToMarkdown(htmlData, nid ?? "paste", token);
                const newContent = content.slice(0, start) + md + content.slice(end);
                setContent(newContent);
                if (nid) setMarkdownModeNotes(prev => { const next = new Set(prev); next.delete(nid); return next; });
                showToast("Rich text pasted ✓", "#34C759");
            } catch (err) {
                console.error("Rich paste failed:", err);
                showToast("Paste failed", "#FF3B30");
            }
            return;
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
                const token = await getAuthToken();
                const urls = await Promise.all(files.map(async (file, i) => {
                    const fd = new FormData();
                    fd.append("file", file, `image-${i + 1}.${file.type.split("/")[1] ?? "png"}`);
                    if (nid) fd.append("noteId", nid);
                    // Try Google Drive first
                    const gdriveRes = await fetch("/api/stickies/gdrive", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: fd,
                    });
                    if (gdriveRes.ok) {
                        const gdata = await gdriveRes.json();
                        if (gdata.url) return gdata.url as string;
                    }
                    // Fallback: Supabase
                    const res = await fetch("/api/stickies/upload", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                        body: fd,
                    });
                    if (!res.ok) throw new Error("Upload failed");
                    const data = await res.json();
                    return data.url as string;
                }));
                const md = urls.map((src, i) => `![image-${i + 1}](${src})`).join("\n");
                const newContent = content.slice(0, start) + md + content.slice(end);
                setContent(newContent);
                if (nid) setMarkdownModeNotes(prev => { const next = new Set(prev); next.delete(nid); return next; });
                showToast("Image pasted ✓", "#34C759");
            } catch {
                showToast("Image paste failed", "#FF3B30");
            }
        }
    }

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

    const openNoteLinkQr = useCallback(() => {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const folder = targetFolder || activeFolder || editingNote?.folder_name || "General";
        const noteTitle = title.trim() || editingNote?.title || "Untitled";
        const noteId = editingNote?.id ? String(editingNote.id) : "";
        const url = `${base}/?folder=${encodeURIComponent(folder.toLowerCase())}&note=${encodeURIComponent(noteTitle.toLowerCase())}${noteId ? `&noteId=${noteId}` : ""}`;
        setQrData(url);
        setQrIsBurn(false);
        setQrType("link");
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, targetFolder, activeFolder]);

    const openNoteDataQr = useCallback(() => {
        const noteTitle = title.trim() || editingNote?.title || "";
        const noteContent = content || editingNote?.content || "";
        const text = [noteTitle, noteContent].filter(Boolean).join("\n\n").slice(0, 1500);
        const base64 = btoa(unescape(encodeURIComponent(text)));
        const base = typeof window !== "undefined" ? window.location.origin : "https://bheng.vercel.app";
        setQrData(`${base}/stickies-share?clip=${base64}`);
        setQrIsBurn(false);
        setQrType("data");
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, content]);

    const openLocalMobileQr = useCallback(async () => {
        setSharePickerOpen(false);
        const folder = targetFolder || activeFolder || editingNote?.folder_name || "General";
        const noteTitle = title.trim() || editingNote?.title || "Untitled";
        const noteId = editingNote?.id ? String(editingNote.id) : "";
        const path = `/?folder=${encodeURIComponent(folder.toLowerCase())}&note=${encodeURIComponent(noteTitle.toLowerCase())}${noteId ? `&noteId=${noteId}` : ""}`;
        let origin = window.location.origin;
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
            try {
                const res = await fetch("/api/local-ip");
                const data = await res.json();
                if (data.ip) origin = `http://${data.ip}:${window.location.port || data.port || 3000}`;
            } catch { /* fallback to current origin */ }
        }
        setQrData(`${origin}${path}`);
        setQrType("link");
        setQrIsBurn(false);
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, targetFolder, activeFolder]);

    const sendToMobile = useCallback(async () => {
        setSharePickerOpen(false);
        const folder = targetFolder || activeFolder || editingNote?.folder_name || "General";
        const noteTitle = title.trim() || editingNote?.title || "Untitled";
        const noteId = editingNote?.id ? String(editingNote.id) : "";
        const path = `/?folder=${encodeURIComponent(folder.toLowerCase())}&note=${encodeURIComponent(noteTitle.toLowerCase())}${noteId ? `&noteId=${noteId}` : ""}`;
        const url = `${window.location.origin}${path}`;
        const senderSocketId = (localWriteRef.current.get("__socket_id__") as any) ?? undefined;
        try {
            await fetch("/api/stickies/push-nav", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
                body: JSON.stringify({ url, title: noteTitle, senderSocketId, senderEndpoint: pushEndpointRef.current }),
            });
            showToast("Sent to mobile ✓", "#34C759");
        } catch {
            showToast("Send failed", "#FF3B30");
        }
    }, [editingNote, title, targetFolder, activeFolder]);

    const confirmCalendar = useCallback(() => {
        if (!calDate) return;
        const noteTitle = title.trim() || editingNote?.title || "Untitled";
        const noteContent = (content || editingNote?.content || "").slice(0, 800);
        const dt = new Date(`${calDate}T${calTime}:00`);
        const end = new Date(dt.getTime() + 60 * 60 * 1000); // default 1 hour
        const pad = (n: number) => String(n).padStart(2, "0");
        const fmtLocal = (d: Date) =>
            `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
        const rruleFreq: Record<string, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };

        if (calTarget === "google") {
            const params = new URLSearchParams({
                action: "TEMPLATE",
                text: noteTitle,
                dates: `${fmtLocal(dt)}/${fmtLocal(end)}`,
                details: noteContent,
            });
            if (calRepeat !== "none") params.set("recur", `RRULE:FREQ=${rruleFreq[calRepeat]}`);
            window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank");
        } else {
            const uid = `stickies-${Date.now()}@bheng`;
            const lines = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Stickies//EN",
                "BEGIN:VEVENT",
                `UID:${uid}`,
                `DTSTART:${fmtLocal(dt)}`,
                `DTEND:${fmtLocal(end)}`,
                `SUMMARY:${noteTitle}`,
                `DESCRIPTION:${noteContent.replace(/\n/g, "\\n")}`,
                ...(calRepeat !== "none" ? [`RRULE:FREQ=${rruleFreq[calRepeat]}`] : []),
                "END:VEVENT",
                "END:VCALENDAR",
            ];
            const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${noteTitle.replace(/[^a-z0-9]/gi, "-").slice(0, 40)}.ics`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }
        setCalModalOpen(false);
    }, [calDate, calTime, calRepeat, calTarget, editingNote, title, content]);

    const captureMindmapCanvas = useCallback((): Promise<HTMLCanvasElement | null> => {
        const svgEl = document.querySelector(".mindmap-svg") as SVGSVGElement | null;
        if (!svgEl) return Promise.resolve(null);
        const svgW = svgEl.width.baseVal.value || 800;
        const svgH = svgEl.height.baseVal.value || 600;
        const svgStr = new XMLSerializer().serializeToString(svgEl);
        const url = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" }));
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const dpr = window.devicePixelRatio || 1;
                const canvas = document.createElement("canvas");
                canvas.width = svgW * dpr; canvas.height = svgH * dpr;
                const ctx = canvas.getContext("2d")!;
                ctx.scale(dpr, dpr);
                ctx.fillStyle = "#050507";
                ctx.fillRect(0, 0, svgW, svgH);
                ctx.drawImage(img, 0, 0, svgW, svgH);
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }, []);

    const downloadMindmapPng = useCallback(async () => {
        const canvas = await captureMindmapCanvas();
        if (!canvas) return;
        const filename = `${title.trim() || "mindmap"}.png`;
        canvas.toBlob((blob) => {
            if (!blob) return;
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        }, "image/png");
    }, [captureMindmapCanvas, title]);

    const downloadMindmapPdf = useCallback(async () => {
        const canvas = await captureMindmapCanvas();
        if (!canvas) return;
        const dataUrl = canvas.toDataURL("image/png");
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(`<html><head><title>${title.trim() || "Mindmap"}</title><style>*{margin:0;padding:0;}body{background:#050507;}img{width:100%;height:auto;display:block;}</style></head><body><img src="${dataUrl}" onload="window.print()"/></body></html>`);
        w.document.close();
    }, [captureMindmapCanvas, title]);

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
            setQrType("burn");
            setQrLinkCopied(false);
            setQrModalOpen(true);
        } catch {
            showToast("Failed to create link");
        }
    }, [editingNote, title, content, noteColor, targetFolder, activeFolder]);

    const deleteCurrentNote = useCallback(
        async (noteId: string | null, noteName: string) => {
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
                setActiveLine(0);
                setEditorScrollTop(0);
                setEditorOpen(false);
                showToast(`"${label}" deleted`, resolvedColor);
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
                playSound("delete");
                showToast(`"${label}" deleted`, resolvedColor);
            } catch (err) {
                console.error("Delete note failed:", err);
                showToast("Delete Failed", "#FF3B30");
            }
        },
        [closeEditorTools],
    );

    const deleteFolderByName = useCallback(
        async (folderName: string) => {
            if (!folderName) return;
            try {
                const folderColor = folderColors[folderName] || palette12[0];
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
                goBack();
                setSearch("");
                playSound("delete");
                showToast(`folder "${folderName}", deleted!`, folderColor);
            } catch (err) {
                console.error("Delete folder failed:", err);
                showToast("Delete Failed", "#FF3B30");
            }
        },
        [closeEditorTools, goBack],
    );

    const mergeFolders = useCallback(
        async () => {
            if (selectedFolderNames.length < 2) return;
            const [primary, ...others] = selectedFolderNames;
            const primaryColor = folderColors[primary] || palette12[0];
            try {
                // Move all notes from secondary folders into primary
                for (const name of others) {
                    await notesApi.updateByFolder({ folder_name: name }, { folder_name: primary });
                }
                // Delete the folder rows for the secondary folders
                setDbData((prev) => {
                    const folderRowIds = prev
                        .filter((r) => r.is_folder && others.includes(String(r.folder_name || r.name || "")))
                        .map((r) => String(r.id));
                    Promise.all(folderRowIds.map((id) => notesApi.delete(id))).catch(() => {});
                    return prev
                        .map((r) => !r.is_folder && others.includes(String(r.folder_name || "")) ? { ...r, folder_name: primary } : r)
                        .filter((r) => !(r.is_folder && others.includes(String(r.folder_name || r.name || ""))));
                });
                setFolderColors((prev) => {
                    const next = { ...prev };
                    others.forEach((n) => delete next[n]);
                    return next;
                });
                setIsFolderSelectMode(false);
                setSelectedFolderNames([]);
                playSound("move");
                showToast(`Merged into "${primary}"`, primaryColor);
            } catch (err) {
                console.error("Merge folders failed:", err);
                showToast("Merge Failed", "#FF3B30");
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedFolderNames, folderColors],
    );

    const bulkDeleteSelected = useCallback(
        async () => {
            const ids = [...selectedIds];
            if (ids.length === 0) return;
            try {
                setDbData((prev) => prev.filter((n) => !ids.includes(String(n.id))));
                await Promise.all(ids.map((id) => notesApi.delete(id)));
                setIsSelectMode(false);
                setSelectedIds(new Set());
                showToast(`Deleted ${ids.length} note${ids.length !== 1 ? "s" : ""}`);
            } catch (err) {
                console.error("Bulk delete failed:", err);
                showToast("Delete Failed", "#FF3B30");
            }
        },
        [selectedIds],
    );

    const togglePin = useCallback((id: string) => {
        setPinnedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            try { localStorage.setItem(PINNED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
            return next;
        });
    }, []);

    const openNoteFromCmdK = useCallback((note: any, cmdClick = false) => {
        setShowCmdK(false);
        setCmdKQuery("");
        if (note.folder_name) {
            const fr = dbData.find((r: any) => r.is_folder && r.folder_name === note.folder_name);
            if (fr) enterFolder({ id: String(fr.id), name: note.folder_name, color: fr.color || fr.folder_color || palette12[0] });
        }
        setEditingNote(note);
        setTitle(note.title);
        setContent((note.type === "mermaid" || detectMermaid(note.content || "")) ? cleanMermaidContent(note.content || "") : (note.content || ""));
        setImages((note as any).images ?? []);
        setTargetFolder(note.folder_name || activeFolder || "General");
        setNoteColor(note.folder_color || folders.find((f: any) => f.name === (note.folder_name || activeFolder))?.color || palette12[0]);
        setShowColorPicker(false);
        setShowSwitcher(false);
        setActiveLine(0);
        setEditorScrollTop(0);
        if (note.id && (note.list_mode || note.type === "checklist")) setListModeNotes((p: Set<string>) => new Set([...p, String(note.id)]));
        if (note.id && note.mindmap_mode) setMindmapModeNotes((p: Set<string>) => new Set([...p, String(note.id)]));
        setEditorOpen(true);
    }, [dbData, enterFolder, activeFolder, folders]);

    const stripBulletSpacing = () => {
        const cleaned = content.replace(/^\s*([0-9]+\.|[-*•+_])\s+/gm, "$1");
        setContent(cleaned);
        showToast("Bullet Spacing Cleaned");
    };

    const currentNoteId = editingNote?.id ? String(editingNote.id) : null;
    const listMode = currentNoteId ? listModeNotes.has(currentNoteId) : false;
    const graphMode = currentNoteId ? graphModeNotes.has(currentNoteId) : false;
    const mindmapMode = currentNoteId ? mindmapModeNotes.has(currentNoteId) : false;
    const stackMode = currentNoteId ? stackModeNotes.has(currentNoteId) : false;

    // ── Type resolution: DB `type` is source of truth; fall back to client detection ──
    const dbType: string | null = (editingNote as any)?.type ?? null;
    const noteType: string = dbType ?? pendingNoteType ?? detectNoteType(content);

    // Derived booleans — clean, no detection chains
    const baseMode = !listMode && !graphMode && !mindmapMode && !stackMode;
    const mermaidMode  = process.env.NODE_ENV === "development" && baseMode && noteType === "mermaid";
    const markdownMode = baseMode && noteType === "markdown";
    const htmlMode     = baseMode && (noteType === "html" || (!!currentNoteId && htmlModeNotes.has(currentNoteId)));
    const jsonMode     = baseMode && noteType === "json" && !mermaidMode;
    const codeMode     = baseMode && ["javascript","typescript","python","css","sql","bash"].includes(noteType);
    type VoiceEntry = { _type: "voice"; audioUrl: string; transcript: string; summary: string; duration: number; recordedAt: string };
    const voiceNote = baseMode && noteType === "voice"
        ? (() => { try { const p = JSON.parse(content); return (Array.isArray(p) ? p : [p]) as VoiceEntry[]; } catch { return null; } })()
        : null;
    // jsonDetect kept for JSON syntax highlight fallback
    const jsonDetect = jsonMode ? detectJson(content) : { ok: false, parsed: null };

    // Checklist toggle: text always ok; markdown only if it's a simple list (no headers/code/tables)
    const canToggleChecklist = noteType === "text" ||
        (noteType === "markdown" && !/^#{1,6}\s|^```|^\|/m.test(content));

    // Unified active mode label
    const noteViewMode = stackMode ? "Stack" : mindmapMode ? "Mindmap" : graphMode ? "Graph" : listMode ? "Checklist" : mermaidMode ? "Mermaid" : voiceNote ? "Voice" : codeMode ? noteType : markdownMode ? "Markdown" : htmlMode ? "HTML" : noteType === "rich" ? "Rich" : "Text";
    // Rich note = TipTap JSON format
    const isRichNote = !listMode && !graphMode && !mindmapMode && !stackMode && noteType === "rich";

    const saveFolderIconToDb = useCallback(async (folderName: string, icon: string) => {
        try {
            const res = await fetch("/api/stickies/folder-icon", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${await getAuthToken()}`,
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
            if (newVal) {
                next.add(currentNoteId);
                // Convert rich content (TipTap JSON or HTML) to plain lines
                setContent(c => {
                    try {
                        const p = JSON.parse(c);
                        if (p?.type === "doc" && Array.isArray(p.content)) {
                            const lines: string[] = [];
                            const extract = (nodes: any[]) => nodes.forEach(n => {
                                if (n.type === "text") lines[lines.length - 1] = (lines[lines.length - 1] || "") + (n.text || "");
                                else if (["paragraph","heading","listItem","bulletList","orderedList"].includes(n.type)) { if (lines.length) lines.push(""); else lines.push(""); if (n.content) extract(n.content); }
                                else if (n.content) extract(n.content);
                            });
                            lines.push("");
                            extract(p.content);
                            return lines.map(l => l.trim()).filter(l => l).join("\n") || "";
                        }
                    } catch {}
                    return /<[a-z][^>]*>/i.test(c) ? htmlToPlainLines(c) : c;
                });
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
            const enabling = !next.has(currentNoteId);
            if (enabling) next.add(currentNoteId);
            else next.delete(currentNoteId);
            void notesApi.update(currentNoteId, { type: enabling ? "html" : null });
            return next;
        });
    }, [currentNoteId]);

    const toggleMindmapMode = useCallback(() => {
        if (!currentNoteId) return;
        setMindmapModeNotes((prev) => {
            const next = new Set(prev);
            const enabling = !next.has(currentNoteId);
            if (!enabling) next.delete(currentNoteId);
            else {
                next.add(currentNoteId);
                // Turn off mutually exclusive modes
                setListModeNotes(p => { const n = new Set(p); n.delete(currentNoteId); return n; });
                setGraphModeNotes(p => { const n = new Set(p); n.delete(currentNoteId); return n; });
            }
            localWriteRef.current.set(currentNoteId, Date.now());
            void notesApi.update(currentNoteId, { mindmap_mode: enabling });
            return next;
        });
    }, [currentNoteId]);

    const toggleStackMode = useCallback(() => {
        if (!currentNoteId) return;
        setStackModeNotes((prev) => { const next = new Set(prev); if (next.has(currentNoteId)) next.delete(currentNoteId); else next.add(currentNoteId); return next; });
    }, [currentNoteId]);

    // Cycle through note modes: Text → Checklist → Graph → Mindmap → Stack → Text
    const cycleNoteMode = useCallback(() => {
        const modes = ["Text", "Checklist", "Graph", "Mindmap", "Stack"] as const;
        const cur = stackMode ? "Stack" : mindmapMode ? "Mindmap" : graphMode ? "Graph" : listMode ? "Checklist" : "Text";
        const next = modes[(modes.indexOf(cur) + 1) % modes.length];
        if (listMode) toggleListMode();
        if (graphMode) toggleGraphMode();
        if (mindmapMode) toggleMindmapMode();
        if (stackMode) toggleStackMode();
        if (next === "Checklist") toggleListMode();
        else if (next === "Graph") toggleGraphMode();
        else if (next === "Mindmap") toggleMindmapMode();
        else if (next === "Stack") toggleStackMode();
    }, [stackMode, mindmapMode, graphMode, listMode, toggleListMode, toggleGraphMode, toggleMindmapMode, toggleStackMode]);

    // Toggle [x] done prefix on the nth non-empty line (0-based nodeIdx from mindmap)
    const toggleMindmapNode = useCallback((nodeIdx: number) => {
        const lines = content.split("\n");
        let count = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim()) {
                count++;
                if (count === nodeIdx) {
                    const leading = lines[i].match(/^(\s*)/)?.[1] ?? "";
                    const body = lines[i].trimStart();
                    if (/^\[x\]\s*/i.test(body)) {
                        lines[i] = leading + body.replace(/^\[x\]\s*/i, "");
                    } else {
                        lines[i] = leading + "[x] " + body;
                    }
                    break;
                }
            }
        }
        setContent(lines.join("\n"));
    }, [content]);

    const contentLineCount = useMemo(() => content.split("\n").filter((l) => l.trim().length > 0).length, [content]);
    const isListEligible = contentLineCount >= 2;
    const isGraphEligible = contentLineCount >= 2;

    const parsedTasks = useMemo(() => {
        if (!listMode && !graphMode && !stackMode) return [];
        const isSeparator = (s: string) => /^[-–—=*#~_.]{2,}$/.test(s) || /^[-–—]{2,}.*[-–—]{2,}$/.test(s);
        const result: { done: boolean; text: string; lineIdx: number }[] = [];
        content.split("\n").forEach((line, lineIdx) => {
            const trimmed = line.trim();
            if (trimmed.length === 0 || isSeparator(trimmed)) return;
            const noBullet = trimmed.replace(/^\s*[-*•+_]\s*/, "").replace(/^\s*\d+\.\s*/, "").trim();
            const done = /^\[x\]/i.test(noBullet) || /^\[x\]/i.test(trimmed);
            const text = noBullet.replace(/^\[x\]\s*/i, "").replace(/^\[\s*\]\s*/, "").trim();
            if (text.length === 0) return;
            result.push({ done, text, lineIdx });
        });
        return result;
    }, [content, listMode, graphMode, stackMode]);

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
        pushTaskHistory(content);
        lines[lineIdx] = wasDone ? line.replace(/^\s*\[x\]\s*/i, "") : `[x] ${line}`;
        playSound(wasDone ? "uncheck" : "check");
        setContent(lines.join("\n"));
        if (!wasDone) {
            const label = noBullet.replace(/^\[.\]\s*/i, "").trim();
            showToast(`✓ ${label.length > 18 ? label.slice(0, 18) + "…" : label}`, "#34C759");
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
        setConfirmDeleteTask(null);
        playSound("delete");
        if (deletedText !== undefined) setUndoDeleteTask({ text: deletedText, lineIdx });
        if (label) showToast(`"${label.length > 10 ? label.slice(0, 10) + "…" : label}" deleted`, color || "#FF3B30");
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
        if (!showAddTask) return;
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
            const folderR = Math.min(26, Math.max(12, Math.min(W, H) / (folderList.length * 2 + 4)));
            const noteR = Math.max(6, folderR * 0.38);
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
                        const minD = (n.r + o.r) * 2.0;
                        if (dist < minD) { const f = (minD - dist) / dist * 0.35; n.vx += dx * f; n.vy += dy * f; o.vx -= dx * f; o.vy -= dy * f; }
                    }
                    if (n.type === "note" && n.folderName) {
                        const fi = ns.findIndex((f) => f.id === `f:${n.folderName}`);
                        if (fi >= 0) {
                            const f = ns[fi];
                            const dx = f.x - n.x, dy = f.y - n.y;
                            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                            const ideal = f.r * 1.8;
                            const force = (dist - ideal) / dist * 0.07;
                            n.vx += dx * force; n.vy += dy * force;
                            f.vx -= dx * force * 0.08; f.vy -= dy * force * 0.08;
                        }
                    }
                }
                let totalV = 0;
                for (const n of ns) {
                    n.vx *= 0.78; n.vy *= 0.78;
                    n.x += n.vx; n.y += n.vy;
                    const pad = n.r + 6;
                    if (n.x < pad) { n.x = pad; n.vx *= -0.3; }
                    if (n.x > W - pad) { n.x = W - pad; n.vx *= -0.3; }
                    if (n.y < pad) { n.y = pad; n.vy *= -0.3; }
                    if (n.y > H - pad) { n.y = H - pad; n.vy *= -0.3; }
                    totalV += Math.abs(n.vx) + Math.abs(n.vy);
                }
                setGlobalGraphTick((t) => t + 1);
                if (totalV > 0.25 && settled < 250) { settled++; globalGraphAnimRef.current = requestAnimationFrame(step); }
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
            showToast(`${activeFolder} updated`, color);
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
        enterFolder({ id: optimisticId, name: folderName, color });
        try {
            const { note: data } = await notesApi.insert(payload);
            if (data) {
                setDbData((prev) => { const seen = new Set<string>(); return prev.map((row) => String(row.id) === optimisticId ? data : row).filter((row) => { const id = String(row.id); if (seen.has(id)) return false; seen.add(id); return true; }); });
                setFolderStack((prev) => prev.map((f) => f.id === optimisticId ? { ...f, id: String(data.id) } : f));
            }
            playSound("create");
            const isFirstFolder = dbData.filter(n => n.is_folder).length <= 1;
            showToast(`+ "${folderName}"`, color, isFirstFolder);
        } catch (err) {
            console.error("Create folder failed:", err);
            setDbData((prev) => prev.filter((row) => String(row.id) !== optimisticId));
            goBack();
            showToast("Create Failed");
        }
    }, [newFolderName, folderNames, pickRandomPaletteColor, enterFolder, goBack]);

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

    const isFolderGridView = !search.trim() && ((!activeFolder) || (kanbanMode && dbData.some(r => r.is_folder && r.parent_folder_name === activeFolder)));
    const isListMode = editMode || mainListMode; // edit mode always forces list layout

    // Compute exact square cell size via ResizeObserver → set as CSS var on grid container
    useEffect(() => {
        const el = mainScrollRef.current;
        if (!el) return;
        const update = () => {
            if (isListMode) { el.style.removeProperty('--cell-size'); return; }
            const gap = 6;
            const cs = getComputedStyle(el);
            const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            const cellSize = Math.floor((el.clientWidth - px - (gridCols - 1) * gap) / gridCols);
            el.style.setProperty('--cell-size', cellSize + 'px');
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isListMode, gridCols]);
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

    // Block pinch zoom on the entire stickies page
    useEffect(() => {
        const block = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
        document.addEventListener("touchmove", block, { passive: false });
        document.addEventListener("touchstart", block, { passive: false });
        return () => { document.removeEventListener("touchmove", block); document.removeEventListener("touchstart", block); };
    }, []);

    // Register service worker + Web Push subscription (silent — no permission prompt yet)
    const pushEndpointRef = useRef<string | null>(null);
    useEffect(() => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (reg) => {
            // Request permission only if not yet granted
            let perm = Notification.permission;
            if (perm === "default") perm = await Notification.requestPermission();
            if (perm !== "granted") return;
            const existing = await reg.pushManager.getSubscription();
            const sub = existing ?? await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidKey,
            });
            pushEndpointRef.current = sub.endpoint;
            // Register with server
            fetch("/api/stickies/push-subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAuthToken()}` },
                body: JSON.stringify({ subscription: sub.toJSON() }),
            }).catch(() => { /* silent */ });
        }).catch(() => { /* silent */ });
    }, []);

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
            if (!showColorPicker && !showSwitcher && !showMerger) return;
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
                if (!editorOpen) goBack();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "z" && taskContentHistory.current.length > 0) {
                const prev = taskContentHistory.current.pop();
                if (prev !== undefined) { setContent(prev); showToast("Undone", "#32ADE6"); event.preventDefault(); }
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
    }, [editorOpen, showColorPicker, showSwitcher, showMerger, closeEditorTools, goBack]);

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
    const noteBadgeInitial = meaningfulInitial(title.trim() || editingNote?.title || "", "U");
    const noteBadgeLabel = noteBadgeInitial;
    const noteBadgeFontSize = noteBadgeInitial.length <= 1 ? "0.75rem" : noteBadgeInitial.length <= 2 ? "9px" : "7px";
    const isBreadcrumbChecklist = listMode;
    const breadcrumbChecklistLines = isBreadcrumbChecklist ? (content || "").split("\n").filter((l: string) => l.trim()) : [];
    const breadcrumbChecked = breadcrumbChecklistLines.filter((l: string) => /^\[x\]/i.test(l.trim())).length;
    const breadcrumbTotal = breadcrumbChecklistLines.length;
    const breadcrumbFillPct = breadcrumbTotal > 0 ? Math.round((breadcrumbChecked / breadcrumbTotal) * 100) : 0;
    const activeFolderColor = (activeFolder
        ? (folderColors[activeFolder]
            || folderStack.at(-1)?.color
            || dbData.find((r) => r.is_folder && r.folder_name === activeFolder)?.folder_color)
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
                @keyframes spin { to { transform: rotate(360deg); } }
                .rich-editor { display: flex; flex-direction: column; }
                .rich-editor .tiptap { flex: 1; min-height: 100%; outline: none; padding: 1rem 2rem; color: #e4e4e7; line-height: 1.7; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; }
                .rich-editor .tiptap p { margin: 0.5em 0; }
                .rich-editor .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #52525b; pointer-events: none; float: left; height: 0; }
                .rich-editor .tiptap h1,.rich-editor .tiptap h2,.rich-editor .tiptap h3 { font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; color: #fff; margin: 1em 0 0.4em; }
                .rich-editor .tiptap h1 { font-size: 1.4rem; border-bottom: 2px solid rgba(255,255,255,0.12); padding-bottom: 0.3em; }
                .rich-editor .tiptap h2 { font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.2em; }
                .rich-editor .tiptap h3 { font-size: 0.95rem; }
                .rich-editor .tiptap ul,.rich-editor .tiptap ol { padding-left: 1.5em; margin: 0.5em 0; }
                .rich-editor .tiptap li { margin: 0.2em 0; }
                .rich-editor .tiptap ul li { list-style-type: disc; }
                .rich-editor .tiptap ol li { list-style-type: decimal; }
                .rich-editor .tiptap li::marker { color: #71717a; }
                .rich-editor .tiptap strong { font-weight: 900; color: #fff; }
                .rich-editor .tiptap em { font-style: italic; color: #d4d4d8; }
                .rich-editor .tiptap code { font-family: ui-monospace, monospace; font-size: 0.85em; background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 3px; color: #67e8f9; }
                .rich-editor .tiptap pre { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); padding: 1em; margin: 0.75em 0; overflow-x: auto; border-radius: 4px; }
                .rich-editor .tiptap pre code { background: none; padding: 0; color: #a5f3fc; }
                .rich-editor .tiptap blockquote { border-left: 3px solid rgba(255,255,255,0.2); padding-left: 1em; margin: 0.75em 0; color: #71717a; font-style: italic; }
                .rich-editor .tiptap a { color: #38bdf8; text-decoration: underline; cursor: pointer; }
                .rich-editor .tiptap img { max-width: 100%; height: auto; border-radius: 6px; margin: 0.75em 0; display: block; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
                .rich-editor .tiptap hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5em 0; }
                .rich-editor .tiptap ul[data-type="taskList"] { list-style: none; padding-left: 0.5em; }
                .rich-editor .tiptap ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
                .rich-editor .tiptap ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.2em; }
                .rich-editor .tiptap ul[data-type="taskList"] li input[type="checkbox"] { accent-color: #38bdf8; cursor: pointer; }
                .rich-editor .tiptap table { border-collapse: collapse; width: 100%; margin: 0.75em 0; table-layout: fixed; }
                .rich-editor .tiptap th, .rich-editor .tiptap td { border: 1px solid rgba(255,255,255,0.15); padding: 0.5em 0.75em; text-align: left; vertical-align: top; min-width: 60px; position: relative; }
                .rich-editor .tiptap th { background: rgba(255,255,255,0.06); font-weight: 900; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; }
                .rich-editor .tiptap td { background: transparent; }
                .rich-editor .tiptap td p, .rich-editor .tiptap th p { margin: 0; }
                .rich-editor .tiptap td img, .rich-editor .tiptap th img { margin: 0; border-radius: 3px; }
                .rich-editor .tiptap .selectedCell:after { background: rgba(255,255,255,0.1); content: ""; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; position: absolute; z-index: 2; }
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
                .md-preview pre { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); padding: 1em; margin: 0; overflow-x: auto; border-radius: 0 0 4px 4px; }
                .md-preview pre code { background: none; padding: 0; color: #a5f3fc; font-size: 0.85em; }
                .code-block-wrapper { position: relative; margin: 0.75em 0; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
                .code-lang-badge { display: block; background: rgba(255,255,255,0.06); color: #71717a; font-family: ui-monospace, monospace; font-size: 0.65em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3em 0.8em; border-bottom: 1px solid rgba(255,255,255,0.08); }
                .code-block-wrapper pre { border: none; border-radius: 0; margin: 0; }
                .copy-code-btn { position: absolute; top: 6px; right: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #a1a1aa; font-size: 0.62em; font-family: ui-monospace, monospace; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s; z-index: 1; }
                .copy-code-btn:hover { background: rgba(255,255,255,0.18); color: #fff; border-color: rgba(255,255,255,0.3); }
                .copy-code-btn.copied { background: rgba(34,197,94,0.15); color: #4ade80; border-color: rgba(34,197,94,0.3); }
                .md-preview blockquote { border-left: 3px solid rgba(255,255,255,0.2); padding-left: 1em; margin: 0.75em 0; color: #71717a; font-style: italic; }
                .md-preview a { color: #38bdf8; text-decoration: underline; }
                .md-preview img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.6em 0; display: block; border: 1px solid rgba(255,255,255,0.08); }
                .md-preview input[type="checkbox"] { margin-right: 0.4em; accent-color: #38bdf8; }
                .md-preview del, .md-preview s { color: #71717a; }
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
                @keyframes taskRowEnter {
                    from { opacity: 0; transform: translateX(-20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                .task-row-enter {
                    animation: taskRowEnter 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                @keyframes mindmapRootIn {
                    from { opacity: 0; transform: scale(0.6); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes mindmapNodeIn {
                    from { opacity: 0; transform: translateX(-18px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @keyframes mindmapEdgeIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
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
                @keyframes fabIn {
                    from { opacity: 0; transform: scale(0.5) rotate(-90deg); }
                    to   { opacity: 1; transform: scale(1)   rotate(0deg);   }
                }
                @keyframes fabMenuIn {
                    from { opacity: 0; transform: translateY(8px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
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
                .md-preview { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
            `}</style>

            <div className="fixed inset-0 pointer-events-none z-[9999]">
                {ripples.map((r) => (
                    <div key={r.id} className="ripple-ring" style={{ left: r.x, top: r.y, "--c": r.color } as any} />
                ))}
            </div>

            {toast && (() => {
                const isError = toastColor === "#ef4444" || toastColor === "#FF3B30";
                const cx = typeof window !== "undefined" ? window.innerWidth / 2 : 200;
                const cy = 28;
                return (
                    <>
                        {/* Confetti — mini on every toast, bigger when explicitly requested */}
                        {Array.from({ length: toastConfetti ? 18 : 10 }).map((_, i) => {
                            const count = toastConfetti ? 18 : 10;
                            const angle = (i / count) * 360;
                            const dist = toastConfetti ? 44 + (i % 5) * 14 : 24 + (i % 4) * 7;
                            const size = toastConfetti ? 4 + (i % 4) : 2 + (i % 3);
                            const tx = Math.round(cx + Math.cos(angle * Math.PI / 180) * dist);
                            const ty = Math.round(cy + Math.sin(angle * Math.PI / 180) * dist);
                            const cols = [toastColor, "#ffffff", "#FFD700", "#a78bfa", "#34d399", "#f472b6"];
                            return (
                                <div key={i} className="fixed z-[100003] pointer-events-none rounded-sm"
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
                        {/* Toast pill */}
                        <div className="fixed left-1/2 -translate-x-1/2 z-[100002] pointer-events-none"
                            style={{ top: "calc(env(safe-area-inset-top, 0px) + 6px)", animation: "islandToastInOut 3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white" style={{
                                background: toastColor,
                                border: `1px solid ${toastColor}99`,
                                boxShadow: `0 8px 26px ${toastColor}66`,
                            }}>
                                <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", display: "inline-block", flexShrink: 0, animation: "toastSpin 0.7s linear infinite" }} />
                                <span className="font-black uppercase tracking-wide text-[7px] sm:text-[8px] leading-snug max-w-[220px] break-words text-center">{toast}</span>
                            </div>
                        </div>
                    </>
                );
            })()}
            {undoDeleteTask && (
                <div className="fixed left-1/2 -translate-x-1/2 z-[100003] flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-white/20 shadow-xl"
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
            <div className={`flex-1 min-h-0 overflow-hidden flex ${editMode ? "flex-row" : "flex-col"}`}>

                {/* RIGHT PANEL: editor — only shown in edit mode or when a note is open (mobile nav) */}
                <div className={`flex-1 flex flex-col overflow-hidden ${editMode ? "order-last flex" : editorOpen ? "flex" : "hidden"}`}>
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
                    <div className="safe-top-bar shrink-0 bg-black" />
                    <div className="relative h-auto min-h-[3.5rem] sm:min-h-[4rem] px-2 sm:px-4 bg-zinc-900 border-b border-white/10 flex items-center gap-1 sm:gap-2 shrink-0">
                        {/* Back button — hidden on desktop or in edit mode (left panel always visible) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); void backToRootFromEditor(); }}
                            className={`${editMode ? "hidden" : "flex"} p-2 text-blue-500 hover:bg-white/10 transition flex-shrink-0`}
                            title={`Back to ${targetFolder || "folders"}`}
                            aria-label={`Back to ${targetFolder || "folders"}`}>
                            <ArrowLeftIcon className="w-[38px] h-[38px]" />
                        </button>

                        {/* Desktop: folder breadcrumbs + note title inline */}
                        <div className="hidden sm:flex items-center gap-0.5 min-w-0 overflow-hidden flex-1">
                            {folderStack.map((frame, i) => (
                                <React.Fragment key={frame.id + i}>
                                    {i > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                                    <button type="button"
                                        onClick={() => { goToIndex(i); void backToRootFromEditor(); }}
                                        className="flex items-center gap-1 font-black tracking-tight text-zinc-400 hover:text-white transition flex-shrink-0 text-xs px-0.5">
                                        <span className="w-6 h-6 flex-shrink-0 relative flex items-center justify-center text-sm font-black leading-none overflow-hidden" style={{ backgroundColor: "#fff", borderRadius: 0 }}>
                                            {frame.name === "CLAUDE"
                                                ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                : <>
                                                    <FolderIcon className="absolute inset-0 m-auto" style={{ width: "90%", height: "90%", color: folderColors[frame.name] || frame.color, opacity: 0.9 }} />
                                                    <span className="relative z-10 text-white text-[10px]">{folderIcons[frame.name] || (frame.name || "F").charAt(0).toUpperCase()}</span>
                                                </>}
                                        </span>
                                        {frame.name}
                                    </button>
                                </React.Fragment>
                            ))}
                            {folderStack.length > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                            {isBreadcrumbChecklist ? (
                                <div className="w-7 h-7 flex-shrink-0 relative overflow-hidden font-black" style={{ backgroundColor: activeAccentColor, borderRadius: "2px 2px 2px 10px" }}>
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${breadcrumbFillPct}%`, background: "rgba(0,0,0,0.25)", transition: "height 0.4s ease" }} />
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: breadcrumbTotal >= 10 ? 9 : 11, color: "#fff" }}>{breadcrumbTotal}</div>
                                </div>
                            ) : (
                                <span className="w-7 h-7 flex-shrink-0 flex items-center justify-center font-black leading-none tracking-tight" style={{ backgroundColor: activeAccentColor, color: "#fff", borderRadius: "2px 2px 2px 10px", fontSize: noteBadgeFontSize }}>
                                    {noteBadgeLabel}
                                </span>
                            )}
                            <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-1 min-w-0 flex-1 font-black tracking-tight text-xs text-white placeholder:text-zinc-500" style={{ caretColor: activeAccentColor }} placeholder="NOTE TITLE" />
                        </div>

                        {/* Mobile: badge + title */}
                        {isBreadcrumbChecklist ? (
                            <div className="sm:hidden w-[30px] h-[30px] flex-shrink-0 relative overflow-hidden font-black" style={{ backgroundColor: activeAccentColor }}>
                                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${breadcrumbFillPct}%`, background: "rgba(0,0,0,0.25)", transition: "height 0.4s ease" }} />
                                <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: breadcrumbTotal >= 10 ? 9 : 11, color: "#fff" }}>{breadcrumbTotal}</div>
                            </div>
                        ) : (
                            <span className="sm:hidden w-[30px] h-[30px] inline-flex items-center justify-center font-black leading-none tracking-tight flex-shrink-0" style={{ backgroundColor: activeAccentColor, color: "#fff", borderRadius: "2px 2px 2px 10px", fontSize: noteBadgeFontSize }}>
                                {noteBadgeLabel}
                            </span>
                        )}
                        <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="sm:hidden bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-2 flex-grow min-w-0 text-sm text-white placeholder:text-zinc-500" style={{ caretColor: activeAccentColor, border: "none" }} placeholder="NOTE TITLE" />

                        {mermaidMode && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)" }}>
                                    {mermaidSubType(content)}
                                </span>
                                <button type="button"
                                    onClick={() => {
                                        const encoded = LZString.compressToEncodedURIComponent(extractMermaid(content));
                                        const h = window.location.hostname;
                                        const localHost = (h === "localhost" || h.startsWith("10.") || h.startsWith("192.168.")) ? h : "localhost";
                                        window.open(`http://${localHost}:3002/?data=${encoded}`, "_blank");
                                    }}
                                    className="p-2 sm:p-3 text-zinc-400 hover:text-cyan-400 active:text-cyan-400 transition flex-shrink-0"
                                    title="Open in local Mermaid editor">
                                    <ComputerDesktopIcon className="w-[29px] h-[29px] sm:w-7 sm:h-7" />
                                </button>
                                <button type="button"
                                    onClick={() => {
                                        const encoded = LZString.compressToEncodedURIComponent(extractMermaid(content));
                                        window.open(`https://mermaid-bheng.vercel.app/?data=${encoded}`, "_blank");
                                    }}
                                    className="p-2 sm:p-3 text-zinc-400 hover:text-purple-400 active:text-purple-400 transition flex-shrink-0"
                                    title="Open in prod Mermaid editor">
                                    <SparklesIcon className="w-[29px] h-[29px] sm:w-7 sm:h-7" />
                                </button>
                            </div>
                        )}
                        {TYPE_BADGE[noteType] && (
                            <span className="inline-flex text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: `${TYPE_BADGE[noteType].color}20`, color: TYPE_BADGE[noteType].color, border: `1px solid ${TYPE_BADGE[noteType].color}40` }}>
                                {TYPE_BADGE[noteType].label}
                            </span>
                        )}
                        <button type="button"
                            onClick={() => toggleListMode()}
                            className="p-2 sm:p-3 transition flex-shrink-0"
                            style={{ color: listMode ? activeAccentColor : "rgba(255,255,255,0.4)" }}
                            title="Toggle checklist">
                            <ClipboardDocumentListIcon className="w-[26px] h-[26px] sm:w-6 sm:h-6" />
                        </button>
                        <button type="button"
                            onClick={() => { setShowNoteActions(true); closeEditorTools(); }}
                            className="p-2 sm:p-3 text-zinc-300 hover:text-white active:text-white transition flex-shrink-0">
                            <Cog6ToothIcon className="w-[29px] h-[29px] sm:w-7 sm:h-7" />
                        </button>
                    </div>
                    <div className="relative flex-1 flex overflow-hidden bg-black font-mono">
                        {/* ── Unified pill bar — always visible top-right ── */}
                        {!showNoteActions && content.trim() && !listMode && !graphMode && !mindmapMode && !stackMode && !voiceNote && noteType !== "rich" && (
                        <div className="absolute top-3 right-3 z-[2147483647] pointer-events-auto">
                            <button type="button"
                                onClick={() => {
                                    let toCopy = content;
                                    if (jsonMode) toCopy = JSON.stringify(jsonDetect.parsed, null, 2);
                                    else toCopy = content.replace(/<[^>]+>/g, "");
                                    void secureCopy(toCopy).then(() => showToast("Copied!"));
                                }}
                                className="h-7 w-7 flex items-center justify-center bg-zinc-800/90 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-700/90 transition backdrop-blur-sm">
                                <ClipboardIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        )}
                        {mindmapMode ? (
                            <MindmapView title={title} content={content} onToggle={toggleMindmapNode} />
                        ) : graphMode ? (
                            <div ref={graphContainerRef} className="relative flex-1 overflow-hidden" onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) cycleNoteMode(); }}>
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
                                    const c = taskColor(i, parsedTasks.length);
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
                                        <input ref={addTaskInputRef} type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmAddTask(); if (e.key === "Escape") setShowAddTask(false); }} className="flex-1 bg-transparent text-white text-[12px] sm:text-sm font-bold outline-none border-none shadow-none placeholder:text-zinc-400" placeholder="Type a task..." autoComplete="off" />
                                        <button type="button" onClick={confirmAddTask} className="text-emerald-400 text-[11px] font-black">ADD</button>
                                        <button type="button" onClick={() => setShowAddTask(false)} className="text-zinc-500 text-[11px] font-black">ESC</button>
                                    </div>
                                )}
                            </div>
                        ) : stackMode ? (
                            <div
                                className="relative flex-1 flex flex-col items-center justify-center select-none"
                                style={{ overflow: "visible", cursor: "grab" }}
                                onMouseDown={(e) => { tower3dDrag.current.active = true; tower3dDrag.current.startX = e.clientX; tower3dDrag.current.startY = e.clientY; e.preventDefault(); }}
                                onMouseMove={(e) => {
                                    if (!tower3dDrag.current.active) return;
                                    tower3dDrag.current.rotY += (e.clientX - tower3dDrag.current.startX) * 0.55;
                                    tower3dDrag.current.rotX -= (e.clientY - tower3dDrag.current.startY) * 0.3;
                                    tower3dDrag.current.rotX = Math.max(-70, Math.min(70, tower3dDrag.current.rotX));
                                    tower3dDrag.current.startX = e.clientX; tower3dDrag.current.startY = e.clientY;
                                    if (tower3dRef.current) tower3dRef.current.style.transform = `rotateX(${tower3dDrag.current.rotX}deg) rotateY(${tower3dDrag.current.rotY}deg)`;
                                }}
                                onMouseUp={() => { tower3dDrag.current.active = false; }}
                                onMouseLeave={() => { tower3dDrag.current.active = false; }}
                                onTouchStart={(e) => { tower3dDrag.current.active = true; tower3dDrag.current.startX = e.touches[0].clientX; tower3dDrag.current.startY = e.touches[0].clientY; }}
                                onTouchMove={(e) => {
                                    if (!tower3dDrag.current.active) return;
                                    tower3dDrag.current.rotY += (e.touches[0].clientX - tower3dDrag.current.startX) * 0.55;
                                    tower3dDrag.current.rotX -= (e.touches[0].clientY - tower3dDrag.current.startY) * 0.3;
                                    tower3dDrag.current.rotX = Math.max(-70, Math.min(70, tower3dDrag.current.rotX));
                                    tower3dDrag.current.startX = e.touches[0].clientX; tower3dDrag.current.startY = e.touches[0].clientY;
                                    if (tower3dRef.current) tower3dRef.current.style.transform = `rotateX(${tower3dDrag.current.rotX}deg) rotateY(${tower3dDrag.current.rotY}deg)`;
                                }}
                                onTouchEnd={() => { tower3dDrag.current.active = false; }}
                            >
                                {parsedTasks.length === 0 ? (
                                    <div className="text-zinc-500 text-center text-sm font-bold uppercase tracking-wider">No tasks — switch to Checklist to add</div>
                                ) : (
                                    <div style={{ perspective: 1000, perspectiveOrigin: "50% 50%" }}>
                                        <div ref={tower3dRef} style={{ transformStyle: "preserve-3d", position: "relative", transform: `rotateX(${tower3dDrag.current.rotX}deg) rotateY(${tower3dDrag.current.rotY}deg)` }}>
                                            {parsedTasks.map((task, i) => {
                                                const c = taskColor(i, parsedTasks.length);
                                                const isDone = task.done;
                                                const num = String(i + 1).padStart(2, "0");
                                                const darken = (hex: string, amt: number) => {
                                                    const n = parseInt(hex.slice(1), 16);
                                                    const r = Math.max(0, (n >> 16) - amt);
                                                    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
                                                    const b = Math.max(0, (n & 0xff) - amt);
                                                    return `rgb(${r},${g},${b})`;
                                                };
                                                return (
                                                    <div key={i} onClick={() => toggleTask(i)} style={{ position: "relative", width: 200, height: 48, transformStyle: "preserve-3d", marginBottom: 3, cursor: "pointer", opacity: isDone ? 0.4 : 1, transition: "opacity 0.3s" }}>
                                                        {/* Front */}
                                                        <div style={{ position: "absolute", width: 200, height: 48, transform: "translateZ(40px)", background: `linear-gradient(160deg, color-mix(in srgb, ${c} 60%, white 60%) 0%, ${c} 40%, ${darken(c, 40)} 100%)`, display: "flex", alignItems: "center", padding: "0 14px", gap: 10, overflow: "hidden" }}>
                                                            <span style={{ position: "absolute", top: 0, left: 0, width: "55%", height: "100%", background: "linear-gradient(105deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 50%, transparent 100%)", pointerEvents: "none" }} />
                                                            <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(to top, rgba(255,255,255,0.12), transparent)", pointerEvents: "none" }} />
                                                            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.95)", minWidth: 22, textShadow: "0 1px 4px rgba(0,0,0,0.4)", position: "relative", zIndex: 1 }}>{num}</span>
                                                            <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.35)", flexShrink: 0, position: "relative", zIndex: 1 }} />
                                                            <span style={{ display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textDecoration: isDone ? "line-through" : "none", textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>{task.text}</span>
                                                            </span>
                                                        </div>
                                                        {/* Back */}
                                                        <div style={{ position: "absolute", width: 200, height: 48, transform: "rotateY(180deg) translateZ(40px)", background: `linear-gradient(20deg, color-mix(in srgb, ${c} 60%, white 60%) 0%, ${c} 40%, ${darken(c, 40)} 100%)`, display: "flex", alignItems: "center", padding: "0 14px", gap: 10, overflow: "hidden", scale: "-1 1" }}>
                                                            <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.95)", minWidth: 22, scale: "-1 1" }}>{num}</span>
                                                            <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.35)", flexShrink: 0, scale: "-1 1" }} />
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", scale: "-1 1" }}>{task.text}</span>
                                                        </div>
                                                        {/* Left */}
                                                        <div style={{ position: "absolute", width: 80, height: 48, transformOrigin: "left center", transform: "rotateY(-90deg)", background: `linear-gradient(to right, ${darken(c, 60)}, ${darken(c, 45)})`, overflow: "hidden" }}>
                                                            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
                                                        </div>
                                                        {/* Right */}
                                                        <div style={{ position: "absolute", width: 80, height: 48, left: 200, transformOrigin: "left center", transform: "rotateY(90deg)", background: `linear-gradient(to right, ${darken(c, 45)}, ${darken(c, 60)})`, overflow: "hidden" }}>
                                                            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, transparent 60%)" }} />
                                                        </div>
                                                        {/* Top */}
                                                        <div style={{ position: "absolute", width: 200, height: 80, transformOrigin: "top center", transform: "rotateX(90deg)", background: `linear-gradient(135deg, color-mix(in srgb, ${c} 30%, white 80%) 0%, color-mix(in srgb, ${c} 55%, white 50%) 60%, color-mix(in srgb, ${c} 65%, white 30%) 100%)`, overflow: "hidden" }}>
                                                            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.5) 0%, transparent 55%)" }} />
                                                        </div>
                                                        {/* Bottom */}
                                                        <div style={{ position: "absolute", width: 200, height: 80, top: 48, transformOrigin: "top center", transform: "rotateX(-90deg)", background: darken(c, 80) }} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div style={{ marginTop: 24, fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase" }}>⟳ drag to rotate</div>
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
                                    if (dy > 64 && e.currentTarget.scrollTop === 0) { listPullTriggered.current = true; setSwipeLeftGlow(false); openAddTask(); return; }
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
                                    const isConfirming = confirmDeleteTask === origIdx;
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
                                        onClick={() => setActiveTaskIdx(i => i === origIdx ? null : origIdx)}
                                        onDoubleClick={(e) => { e.stopPropagation(); toggleTask(task.lineIdx); }}
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
                                        <div className="flex items-center gap-3 px-4 py-3 min-h-[78px] sm:min-h-[70px] relative overflow-hidden"
                                            style={{
                                                background: task.done ? "rgba(255,255,255,0.04)" : `${c}50`,
                                                transform: `translateX(-${rowOffset}px)`,
                                                transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.25,1,0.5,1)",
                                            }}>
                                            <span className="task-card-pattern absolute inset-0 pointer-events-none" />
                                            {!task.done && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[52px] font-black leading-none pointer-events-none select-none" style={{ color: "rgba(255,255,255,0.07)", fontFamily: "monospace" }}>{String(sortedIdx + 1).padStart(2, "0")}</span>}
                                            <button type="button" onClick={() => toggleTask(task.lineIdx)} className="relative flex-shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all" style={{ borderColor: task.done ? "rgba(255,255,255,0.25)" : c, backgroundColor: task.done ? "rgba(255,255,255,0.15)" : "transparent" }}>
                                                {task.done && (
                                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                )}
                                            </button>
                                            {editingTaskIdx === origIdx ? (
                                                <input
                                                    ref={editTaskInputRef}
                                                    type="text"
                                                    value={editingTaskText}
                                                    onChange={(e) => setEditingTaskText(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") renameTask(task.lineIdx, editingTaskText); if (e.key === "Escape") setEditingTaskIdx(null); }}
                                                    onBlur={() => renameTask(task.lineIdx, editingTaskText || task.text)}
                                                    className="relative flex-1 bg-transparent text-[12px] sm:text-sm font-bold outline-none border-b border-white/40 pb-0.5"
                                                    style={{ color: "#ffffff" }}
                                                    autoComplete="off"
                                                />
                                            ) : (
                                                <span className={`relative flex-1 text-left text-[12px] sm:text-sm font-bold truncate ${task.done ? "line-through text-zinc-600" : "text-white"}`}>{task.text}</span>
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
                        ) : mermaidMode ? (
                            <CodeViewer
                                code={content}
                                language="mermaid"
                                editing={codeEditMode}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); void saveNote({ silent: true }); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : markdownMode ? (
                            <MarkdownWithMermaid content={content} theme={appTheme === "light" ? "light" : appTheme === "monokai" ? "monokai" : "dark"} />
                        ) : htmlMode ? (
                            <div className="flex-1 flex flex-col">
                                <iframe
                                    srcDoc={(() => {
                                        const scrollbarCss = appTheme === "light"
                                            ? `::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.18);border-radius:6px}::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,0.32)}*{scrollbar-width:thin;scrollbar-color:rgba(0,0,0,0.18) transparent}`
                                            : appTheme === "monokai"
                                            ? `::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(253,151,31,0.25);border-radius:6px}::-webkit-scrollbar-thumb:hover{background:rgba(253,151,31,0.45)}*{scrollbar-width:thin;scrollbar-color:rgba(253,151,31,0.25) transparent}`
                                            : `::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:6px}::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.22)}*{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent}`;
                                        if (/^\s*<!DOCTYPE\s+html/i.test(content) || /^\s*<html[\s>]/i.test(content)) {
                                            return content.replace(/(<head[^>]*>)/i, `$1<style>${scrollbarCss}</style>`);
                                        }
                                        // Extract bare CSS blocks (outside <style> tags) and bare <script> blocks
                                        // so CSS renders correctly when content lacks full HTML structure
                                        let bodyContent = content;
                                        let extractedCss = '';
                                        let extractedScripts = '';
                                        // Move bare <script> tags to end (they may appear before body content)
                                        extractedScripts = (content.match(/<script[\s\S]*?<\/script>/gi) ?? []).join('\n');
                                        bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, '');
                                        // Detect bare CSS: lines that look like CSS rules not wrapped in <style>
                                        // Heuristic: line starts with a CSS selector (*,#,.,[a-z element],@) and ends with }
                                        // Exclude JS-like lines (new, const, let, var, function, //, =)
                                        const styleWrapped = bodyContent.includes('<style');
                                        if (!styleWrapped) {
                                            const cssLineRegex = /^[ \t]*(?:\*|#[\w-]|\.[\w-]|@[\w]|(?!(?:new|const|let|var|function|if|for|while|return|import|export)\b)[a-z][\w-]*(?:\s*[{,:.>+~]|\s+[.#*[\w]))[^;{}(]*\{[^{}]*\}[ \t]*$/gm;
                                            const matches = [...bodyContent.matchAll(cssLineRegex)];
                                            if (matches.length >= 3) { // Only extract if clearly CSS (3+ rules)
                                                extractedCss = matches.map(m => m[0]).join('\n');
                                                bodyContent = bodyContent.replace(cssLineRegex, '');
                                            }
                                        }
                                        const baseCss = `*{box-sizing:border-box}body{background:#000;color:#d1d5db;font-family:system-ui,-apple-system,sans-serif;padding:1.5rem 2rem;margin:0;line-height:1.7;font-size:14px}p{margin:0 0 1em}em,i{color:#a78bfa}strong,b{color:#fff}h1,h2,h3{color:#fff;margin:1em 0 0.5em}a{color:#60a5fa}`;
                                        return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}${extractedCss}${scrollbarCss}</style></head><body>${bodyContent}${extractedScripts}</body></html>`;
                                    })()}
                                    className="flex-1 w-full border-0"
                                    sandbox="allow-scripts"
                                    title="HTML Preview"
                                />
                            </div>
                        ) : voiceNote ? (
                            <div className="flex-1 overflow-y-auto flex flex-col">
                                {voiceNote.map((entry, idx) => (
                                    <VoiceNotePlayer
                                        key={entry.audioUrl}
                                        index={idx}
                                        data={entry}
                                        onTranscriptChange={(t) => {
                                            const updated = voiceNote.map((e, i) => i === idx ? { ...e, transcript: t } : e);
                                            setContent(JSON.stringify(updated.length === 1 ? updated[0] : updated));
                                            void saveNote({ silent: true });
                                        }}
                                        onDelete={() => {
                                            const updated = voiceNote.filter((_, i) => i !== idx);
                                            showToast(`Recording #${idx + 1} deleted`, "#ef4444");
                                            if (updated.length === 0) {
                                                setContent("");
                                                setShowNoteTypePicker(true);
                                            } else {
                                                setContent(JSON.stringify(updated.length === 1 ? updated[0] : updated));
                                                void saveNote({ silent: true });
                                            }
                                        }}
                                        onConvertToText={() => {}} />
                                ))}
                            </div>
                        ) : codeMode ? (
                            <CodeViewer
                                code={content}
                                language={noteType}
                                editing={codeEditMode}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); void saveNote({ silent: true }); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : jsonMode ? (
                            <CodeViewer
                                code={codeEditMode ? content : (jsonDetect.ok ? JSON.stringify(jsonDetect.parsed, null, 2) : content)}
                                language="json"
                                editing={codeEditMode}
                                wordWrap={!codeEditMode}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); void saveNote({ silent: true }); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : noteType === "rich" ? (
                            <div className="relative flex-1 min-h-0 flex flex-col" style={{ background: "#000000" }}>
                                <RichTextEditor
                                    key={currentNoteId ?? "new"}
                                    noteId={currentNoteId}
                                    content={content}
                                    onChange={(html) => setContent(html)}
                                    onBlur={() => void saveNote({ silent: true })}
                                    onUploadImage={async (file) => {
                                        const token = await getAuthToken();
                                        const fd = new FormData();
                                        fd.append("file", file, `image.${file.type.split("/")[1] ?? "png"}`);
                                        if (currentNoteId) fd.append("noteId", currentNoteId);
                                        const r1 = await fetch("/api/stickies/gdrive", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
                                        if (r1.ok) { const d = await r1.json(); if (d.url) return d.url as string; }
                                        const r2 = await fetch("/api/stickies/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
                                        const d2 = await r2.json();
                                        return (d2.url as string) ?? "";
                                    }}
                                    accentColor={activeAccentColor}
                                    editMode={true}
                                    onDelete={() => void deleteCurrentNote(editingNote, title)}
                                />
                            </div>
                        ) : (
                            <div className="relative flex-1">
                                <textarea
                                    ref={editorTextRef}
                                    value={content}
                                    onChange={(e) => { setContent(e.target.value); handleCursorUpdate(e); }}
                                    onKeyUp={handleCursorUpdate}
                                    onClick={(e) => { closeEditorTools(); handleCursorUpdate(e); }}
                                    onScroll={handleEditorScroll}
                                    onFocus={(e) => { closeEditorTools(); handleCursorUpdate(e); }}
                                    onBlur={() => void saveNote({ silent: true })}
                                    onPaste={handleEditorPaste}
                                    className="note-textarea ios-editor-scroll relative z-10 w-full h-full bg-black pt-2 px-3 pb-3 outline-none resize-none font-mono leading-5 overflow-x-hidden overscroll-none touch-pan-y"
                                    style={{ paddingRight: "80px" }}
                                    placeholder="START TYPING..."
                                />
                            </div>
                        )}
                    </div>

                    {/* Image attachment strip */}
                    {(images.length > 0 || uploadingImages) && (
                        <div className="flex items-center gap-2 px-3 py-2 flex-wrap border-t border-white/[0.06] shrink-0 bg-black">
                            {images.map((img, i) => (
                                <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden shrink-0 cursor-pointer"
                                     onClick={() => setLightboxUrl(img.url)}>
                                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
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
                    )}
                </section>
                ) : (
                    /* Desktop empty state — select a note */
                    <div className="flex-1 flex flex-col items-center justify-center select-none text-center gap-2">
                        <PencilSquareIcon className="w-14 h-14 text-zinc-800" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-700">Select a note</p>
                        <button
                            onClick={() => openNewNote()}
                            className="mt-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-white/10 text-zinc-600 hover:text-white hover:border-white/30 transition">
                            + New note
                        </button>
                    </div>
                )}
                </div>{/* ── end right panel ── */}

                {/* LEFT PANEL: slim notes list */}
                <div className={`bg-black flex flex-col overflow-hidden ${editMode ? "order-first w-[240px] min-w-[180px] max-w-[300px] flex-shrink-0 border-r border-white/10" : editorOpen ? "hidden" : "flex-1"}`}>
                <>
                    <div className="safe-top-bar shrink-0 bg-black sticky top-0 z-40" />
                    <header className="ios-mobile-header relative h-auto min-h-[4rem] px-4 flex items-center gap-2 sticky top-0 bg-black z-40 shrink-0">
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
                                                className={`flex items-center gap-1.5 font-black tracking-tight truncate max-w-[150px] flex-shrink-0 px-1 transition text-xs ${i === folderStack.length - 1 ? "text-white" : "text-zinc-400 hover:text-white"}`}
                                                title={frame.name}>
                                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm font-black text-white leading-none overflow-hidden" style={{ backgroundColor: frame.name === "CLAUDE" ? "#fff" : (folderColors[frame.name] || frame.color), borderRadius: 0, border: frame.name === "CLAUDE" ? undefined : "2px solid rgba(255,255,255,1)" }}>
                                                    {frame.name === "CLAUDE" ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" /> : (folderIcons[frame.name] || (frame.name || "F").charAt(0).toUpperCase())}
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
                                <button type="button" onClick={() => { setShowCmdK(true); setCmdKQuery(""); setCmdKCursor(0); }}
                                    className={`relative flex items-center transition-all duration-200 text-left ${searchFocused || search.trim() ? "flex-1" : "w-[220px]"} bg-transparent`}>
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 w-6 h-6 pointer-events-none" />
                                    <span className="w-full pl-12 pr-3 py-3 text-sm font-black tracking-tight text-white/30">SEARCH</span>
                                </button>
                                <div className="ml-auto flex items-center gap-1">
                                    <HeaderIconBtn icon={mainListMode ? Bars3Icon : Squares2X2Icon} label={mainListMode ? "List" : "Thumb"} onClick={() => { setMainListMode(v => !v); setKanbanMode(false); }} />
                                    <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { const hueInt = integrationsRef.current.find(ig => ig.type === "hue"); setLightMode((hueInt?.config?.mode as any) ?? "flash"); setShowFolderActions(true); }} />
                                </div>
                            </>
                        ) : (
                            <div className="ml-auto flex items-center gap-1">
                                {isSelectMode ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-blue-400 select-none">{selectedIds.size} selected</span>
                                        <button
                                            onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                                            className="px-3 py-1.5 text-xs font-black text-white bg-white/10 hover:bg-white/20 transition">
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <HeaderIconBtn icon={mainListMode ? Bars3Icon : Squares2X2Icon} label={mainListMode ? "List" : "Thumb"} onClick={() => { setMainListMode(v => !v); setKanbanMode(false); }} />
                                        <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { const hueInt = integrationsRef.current.find(ig => ig.type === "hue"); setLightMode((hueInt?.config?.mode as any) ?? "flash"); setShowFolderActions(true); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }} />
                                    </>
                                )}
                            </div>
                        )}
                    </header>

                    <main ref={mainScrollRef}
                        onDoubleClick={(e) => { if ((e.target as HTMLElement) === e.currentTarget) openNewNote(); }}
                        onDragOver={(e) => { if (Array.from(e.dataTransfer.items).some(i => i.kind === "file")) e.preventDefault(); }}
                        onDrop={(e) => {
                            const file = Array.from(e.dataTransfer.files).find(f => f.name.endsWith(".mermaid") || f.name.endsWith(".mmd"));
                            if (!file) return;
                            e.preventDefault();
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                const text = (ev.target?.result as string) ?? "";
                                setEditingNote(null);
                                setTitle(file.name.replace(/\.(mermaid|mmd)$/i, ""));
                                setContent(text);
                                setTargetFolder(activeFolder || "General");
                                setNoteColor(palette12[0]);
                                setMermaidShowCode(true);
                                shouldFocusTitleOnOpenRef.current = false;
                                setEditorOpen(true);
                            };
                            reader.readAsText(file);
                        }}
                        className={`ios-mobile-main relative flex-1 ${kanbanMode && isFolderGridView ? "overflow-x-auto overflow-y-hidden touch-pan-x" : "overflow-x-hidden overflow-y-auto touch-pan-y"} overscroll-none bg-black ${(!showGlobalGraph) && !(kanbanMode && isFolderGridView) ? "pb-24 sm:pb-32" : ""} ${!isListMode && !(kanbanMode && isFolderGridView) ? "p-1.5 sm:p-2" : ""}`}
                        style={kanbanMode && isFolderGridView
                            ? { display: "flex", flexDirection: "column", height: "100%", overflowX: "auto", overflowY: "hidden" }
                            : isListMode
                                ? { display: "block" }
                                : { display: "grid", gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: "6px", alignContent: "start", alignItems: "start" }}
                    >
                        {kanbanMode && isFolderGridView && (
                            <div className="flex gap-0 h-full" style={{ minWidth: `${currentLevelFolders.length * 220}px` }}>
                                {currentLevelFolders.map((folder, fi) => {
                                    const subFolders = dbData.filter((n) => n.is_folder && n.parent_folder_name === folder.name);
                                    const folderNotes = dbData.filter((n) => !n.is_folder && (String(n.folder_id) === String(folder.id) || (!n.folder_id && n.folder_name === folder.name)));
                                    const totalCount = subFolders.length + folderNotes.length;
                                    const isOver = colDragOver === folder.name;
                                    const accent = folder.color || "#a855f7";
                                    return (
                                        <div key={folder.id || folder.name}
                                            className="flex flex-col flex-shrink-0 h-full"
                                            style={{ width: 220, borderRight: fi < currentLevelFolders.length - 1 ? `1px solid ${accent}20` : "none", background: isOver ? `${accent}1F` : `${accent}14`, transition: "background 0.15s" }}
                                            onDragOver={(e) => { e.preventDefault(); setColDragOver(folder.name); }}
                                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setColDragOver(null); }}
                                            onDrop={async (e) => {
                                                e.preventDefault(); setColDragOver(null);
                                                const noteId = colDragNoteRef.current; if (!noteId) return;
                                                colDragNoteRef.current = null;
                                                const note = dbData.find((n) => String(n.id) === noteId);
                                                if (!note || note.folder_name === folder.name) return;
                                                await notesApi.update(noteId, { folder_name: folder.name });
                                                showToast(`Moved to ${folder.name}`, accent);
                                            }}>
                                            {/* header */}
                                            {(() => {
                                                const headerId = `kanban-hdr-${folder.id || folder.name}`;
                                                const hex = accent.replace("#", "").padEnd(6, "0");
                                                const hr = parseInt(hex.substring(0, 2), 16);
                                                const hg = parseInt(hex.substring(2, 4), 16);
                                                const hb = parseInt(hex.substring(4, 6), 16);
                                                return (
                                                    <div className="relative flex items-center gap-2 px-3 py-2.5 flex-shrink-0 overflow-hidden cursor-pointer select-none"
                                                        style={{ background: folder.name === "CLAUDE" ? "#ffffff" : accent, isolation: "isolate" }}
                                                        onClick={() => enterFolder({ id: String(folder.id), name: folder.name, color: accent })}
                                                        onMouseEnter={(e) => { playSound("hover"); const rect = e.currentTarget.getBoundingClientRect(); setGlowCard({ id: headerId, x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 }); }}
                                                        onMouseMove={(e) => { if (glowCard?.id !== headerId) return; const rect = e.currentTarget.getBoundingClientRect(); setGlowCard(g => g ? { ...g, x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 } : g); }}
                                                        onMouseLeave={() => setGlowCard(null)}>
                                                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
                                                        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
                                                        {glowCard?.id === headerId && (<>
                                                            <div className="absolute inset-0 pointer-events-none z-[-1]" style={{ background: `radial-gradient(circle at ${glowCard.x}% ${glowCard.y}%, rgba(${hr},${hg},${hb},0.6) 0%, rgba(${hr},${hg},${hb},0.3) 50%, rgba(${hr},${hg},${hb},0.05) 100%)`, transition: "background 0.05s" }} />
                                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
                                                                <rect className="list-snake-path" x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="6" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" pathLength="100" style={{ animationIterationCount: 1, animationTimingFunction: "ease-out", animationFillMode: "forwards" }} />
                                                            </svg>
                                                        </>)}
                                                        {folder.name === "CLAUDE" && <img src="/claude-icon.png" alt="Claude" className="relative w-5 h-5 object-contain flex-shrink-0" />}
                                                        <span className={`relative text-[11px] font-bold tracking-widest uppercase truncate flex-1 drop-shadow-sm ${folder.name === "CLAUDE" ? "text-black" : "text-white"}`}>{folder.name}</span>
                                                        <span className={`relative text-[10px] font-bold tabular-nums flex-shrink-0 ${folder.name === "CLAUDE" ? "text-black/60" : "text-white/70"}`}>{totalCount}</span>
                                                    </div>
                                                );
                                            })()}
                                            {/* items */}
                                            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-2 py-2" style={{ scrollbarWidth: "none" }}>
                                                {subFolders.map((sub) => {
                                                    const subColor = folders.find(f => f.name === sub.folder_name)?.color || sub.folder_color || "#a855f7";
                                                    return (
                                                        <div key={sub.id}
                                                            onClick={() => enterFolder({ id: String(sub.id), name: sub.folder_name, color: subColor })}
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-all hover:brightness-125 active:scale-[0.98]"
                                                            style={{ background: `${subColor}15`, border: `1px solid ${subColor}30` }}>
                                                            <div className="text-[12px] font-semibold truncate flex-1" style={{ color: subColor }}>{sub.folder_name}</div>
                                                            <ChevronRightIcon className="w-3 h-3 flex-shrink-0" style={{ color: subColor, opacity: 0.5 }} />
                                                        </div>
                                                    );
                                                })}
                                                {folderNotes.map((note) => {
                                                    const noteCardId = `kanban-note-${note.id}`;
                                                    const nhex = accent.replace("#", "").padEnd(6, "0");
                                                    const nr = parseInt(nhex.substring(0, 2), 16);
                                                    const ng = parseInt(nhex.substring(2, 4), 16);
                                                    const nb = parseInt(nhex.substring(4, 6), 16);
                                                    return (
                                                        <div key={note.id} draggable
                                                            onDragStart={() => { colDragNoteRef.current = String(note.id); }}
                                                            onDragEnd={() => { colDragNoteRef.current = null; setColDragOver(null); }}
                                                            onClick={() => {
                                                                setEditingNote(note);
                                                                setTitle(note.title || "");
                                                                setContent((note.type === "mermaid" || detectMermaid(note.content || "")) ? cleanMermaidContent(note.content || "") : (note.content || ""));
                                                                setImages((note as any).images ?? []);
                                                                setTargetFolder(note.folder_name || "General");
                                                                setNoteColor(note.folder_color || palette12[0]);
                                                                setActiveLine(0);
                                                                setEditorScrollTop(0);
                                                                setEditorOpen(true);
                                                            }}
                                                            onMouseEnter={(e) => { playSound("hover"); const rect = e.currentTarget.getBoundingClientRect(); setGlowCard({ id: noteCardId, x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 }); }}
                                                            onMouseMove={(e) => { if (glowCard?.id !== noteCardId) return; const rect = e.currentTarget.getBoundingClientRect(); setGlowCard(g => g ? { ...g, x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 } : g); }}
                                                            onMouseLeave={() => setGlowCard(null)}
                                                            className="relative cursor-pointer rounded-md transition-all active:scale-[0.98] overflow-hidden"
                                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", isolation: "isolate", height: 52, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, padding: "0 12px" }}>
                                                            {glowCard?.id === noteCardId && (<>
                                                                <div className="absolute inset-0 pointer-events-none z-[-1]" style={{ background: `radial-gradient(circle at ${glowCard.x}% ${glowCard.y}%, rgba(${nr},${ng},${nb},0.4) 0%, rgba(${nr},${ng},${nb},0.2) 50%, rgba(${nr},${ng},${nb},0.03) 100%)`, transition: "background 0.05s" }} />
                                                                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
                                                                    <rect className="list-snake-path" x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="6" fill="none" stroke={accent} strokeWidth="2" pathLength="100" style={{ animationIterationCount: 1, animationTimingFunction: "ease-out", animationFillMode: "forwards" }} />
                                                                </svg>
                                                            </>)}
                                                            <div className="relative text-[12px] font-semibold text-white/85 leading-none" style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{(note.title || "Untitled").slice(0, 28)}</div>
                                                            <div className="relative text-[11px] text-white/35 leading-none" style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{(note.content ? previewText(note.content) : "—").slice(0, 32)}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {!(kanbanMode && isFolderGridView) && filteredDisplayItems.map((item, idx) => {
                            // Section header sentinel
                            if (item._header) {
                                return (
                                    <div key={item.id || `hdr-${idx}`}
                                        className="px-4 pt-4 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase select-none"
                                        style={!isListMode ? { gridColumn: "1 / -1" } : undefined}>
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
                                    draggable={canDrag}
                                    onDragStart={(e) => handleTileDragStart(e, item)}
                                    onDragOver={(e) => handleTileDragOver(e, item)}
                                    onDragLeave={handleTileDragLeave}
                                    onDrop={(e) => { void handleTileDrop(e, item); }}
                                    onDragEnd={handleTileDragEnd}
                                    onMouseEnter={(e) => {
                                        playSound("hover");
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setGlowCard({ id: tileId, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
                                    }}
                                    onMouseMove={(e) => {
                                        if (glowCard?.id !== tileId) return;
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setGlowCard(g => g ? { ...g, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 } : g);
                                    }}
                                    onMouseLeave={() => setGlowCard(null)}
                                    onTouchStart={() => {
                                        if (!isListMode) return;
                                        longPressTimer.current = setTimeout(() => {
                                            longPressTimer.current = null;
                                            suppressOpenRef.current = true;
                                            if (item.is_folder) {
                                                setIsFolderSelectMode(true);
                                                setSelectedFolderNames([item.name || ""]);
                                            } else {
                                                setIsSelectMode(true);
                                                setSelectedIds(new Set([String(item.id)]));
                                            }
                                        }, 500);
                                    }}
                                    onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                                    onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                                    onClick={(e) => {
                                        if (suppressOpenRef.current) { suppressOpenRef.current = false; return; }
                                        e.stopPropagation();
                                        if (isFolderSelectMode && item.is_folder) {
                                            const name = item.name || "";
                                            setSelectedFolderNames((prev) => {
                                                if (prev[0] === name) return prev; // can't deselect primary
                                                return prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
                                            });
                                            return;
                                        }
                                        if (isSelectMode && !item.is_folder) {
                                            const id = String(item.id);
                                            setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
                                            return;
                                        }
                                        createRipple(e, item.color || item.folder_color || "#FFFFFF");
                                        if (item.is_folder) {
                                            playSound("navigate");
                                            enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                        } else {
                                            playSound("click");
                                            setEditingNote(item);
                                            setTitle(item.title);
                                            setContent(item.content);
                                            setImages((item as any).images ?? []);
                                            setTargetFolder(item.folder_name || activeFolder || "General");
                                            setNoteColor(item.folder_color || folders.find((f) => f.name === (item.folder_name || activeFolder))?.color || palette12[0]);
                                            setShowColorPicker(false);
                                            setShowSwitcher(false);
                                            setActiveLine(0);
                                            setEditorScrollTop(0);
                                            if (item.id && looksLikeMarkdown(item.content || "")) {
                                                setMarkdownModeNotes((prev) => new Set([...prev, String(item.id)]));
                                            }
                                            if (item.id && (item.list_mode || item.type === "checklist")) {
                                                setListModeNotes((prev) => new Set([...prev, String(item.id)]));
                                            }
                                            if (item.id && item.mindmap_mode) {
                                                setMindmapModeNotes((prev) => new Set([...prev, String(item.id)]));
                                            }
                                            setEditorOpen(true);
                                        }
                                    }}
                                    style={(() => {
                                        const c = item.color || item.folder_color || "#888888";
                                        if (isListMode) {
                                            return { position: "relative", isolation: "isolate", "--row-color": c } as React.CSSProperties;
                                        }
                                        return item.is_folder
                                            ? { isolation: "isolate", backgroundColor: "#ffffff", ...(activeFolder ? { outline: "2px solid rgba(255,255,255,1)", outlineOffset: "-2px" } : {}) }
                                            : { isolation: "isolate", backgroundColor: c, borderRadius: "3px 3px 3px 14px" };
                                    })()}
                                    className={`${isListMode
                                        ? `group list-row-hover flex items-center gap-3 px-4 py-3 border-b border-white/5 cursor-pointer select-none transition-colors active:bg-white/10 overflow-hidden ${isDragging ? "opacity-30" : dt?.mode === "into" ? "bg-cyan-950/60 ring-1 ring-inset ring-cyan-400" : ""} ${isSelectMode && !item.is_folder && selectedIds.has(String(item.id)) ? "bg-blue-950/50" : ""} ${isFolderSelectMode && item.is_folder && selectedFolderNames.includes(item.name || "") ? "bg-emerald-950/50" : ""}`
                                        : `grid-square-tile min-w-0 cursor-pointer transition-all group ${isDragging ? "opacity-30 scale-95" : dt?.mode === "into" ? "ring-4 ring-cyan-400 ring-inset z-10" : ""}`}`}>
                                    {/* Cursor spotlight glow */}
                                    {isListMode && glowCard?.id === tileId && (() => {
                                        const c = item.color || item.folder_color || "#888888";
                                        const hex = c.replace("#", "").padEnd(6, "0");
                                        const r = parseInt(hex.substring(0, 2), 16);
                                        const g = parseInt(hex.substring(2, 4), 16);
                                        const b = parseInt(hex.substring(4, 6), 16);
                                        return <div className="absolute inset-0 pointer-events-none z-[-1]" style={{ background: `radial-gradient(circle at ${glowCard.x}% ${glowCard.y}%, rgba(${r},${g},${b},0.4) 0%, rgba(${r},${g},${b},0.2) 50%, rgba(${r},${g},${b},0.03) 100%)`, transition: "background 0.05s" }} />;
                                    })()}
                                    {/* Insertion line indicator — before */}
                                    {dt?.mode === "before" && (
                                        <div className={`absolute z-20 bg-cyan-400 pointer-events-none ${isListMode ? "left-0 right-0 top-0 h-0.5" : "top-0 left-0 bottom-0 w-1"}`} />
                                    )}
                                    {/* Insertion line indicator — after */}
                                    {dt?.mode === "after" && (
                                        <div className={`absolute z-20 bg-cyan-400 pointer-events-none ${isListMode ? "left-0 right-0 bottom-0 h-0.5" : "top-0 right-0 bottom-0 w-1"}`} />
                                    )}
                                    {isListMode ? (
                                        <>
                                            {isFolderSelectMode && item.is_folder && (
                                                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${selectedFolderNames.includes(item.name || "") ? selectedFolderNames[0] === item.name ? "bg-emerald-400 border-emerald-400" : "bg-emerald-600 border-emerald-600" : "border-zinc-600"}`}>
                                                    {selectedFolderNames[0] === item.name && <span className="text-[8px] leading-none">★</span>}
                                                    {selectedFolderNames.includes(item.name || "") && selectedFolderNames[0] !== item.name && <CheckIcon className="w-3 h-3 text-white" />}
                                                </div>
                                            )}
                                            {isSelectMode && !item.is_folder && (
                                                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${selectedIds.has(String(item.id)) ? "bg-blue-500 border-blue-500" : "border-zinc-600"}`}>
                                                    {selectedIds.has(String(item.id)) && <CheckIcon className="w-3 h-3 text-white" />}
                                                </div>
                                            )}
                                            {item.is_folder && (() => {
                                                const c = item.color || item.folder_color || palette12[0];
                                                return (
                                                    <div className="flex-shrink-0 w-[54px] h-[54px] sm:w-[46px] sm:h-[46px] relative flex items-center justify-center font-black overflow-hidden"
                                                        style={{ fontSize: 22, backgroundColor: "#fff", ...(activeFolder ? { border: "2px solid rgba(255,255,255,1)" } : {}), boxShadow: `2px 3px 8px ${c}55` }}>
                                                        {item.name === "CLAUDE"
                                                            ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-1" />
                                                            : <>
                                                                <FolderIcon className="absolute inset-0 m-auto" style={{ width: "90%", height: "90%", color: c, opacity: 0.9 }} />
                                                                <span className="relative z-10 text-white">{item.icon || meaningfulInitial(item.name, "F")}</span>
                                                            </>}
                                                    </div>
                                                );
                                            })()}
                                            {!item.is_folder && (() => {
                                                const isChecklistItem = (item as any).type === "checklist" || listModeNotes.has(String(item.id));
                                                const nc = (item as any).color || (item as any).folder_color || "#71717a";
                                                const initial = meaningfulInitial(item.title || "", "N");
                                                return (
                                                    <div className="flex-shrink-0 w-[54px] h-[54px] sm:w-[46px] sm:h-[46px] flex items-center justify-center font-black overflow-hidden relative"
                                                        style={{
                                                            fontSize: 22,
                                                            backgroundColor: nc,
                                                            color: "#fff",
                                                            borderRadius: "3px 3px 3px 14px",
                                                            boxShadow: `2px 3px 8px ${nc}55`,
                                                        }}>
                                                        {initial}
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-semibold tracking-tight text-white truncate">
                                                    {item.is_folder ? <>{item.name}<span className="text-white/30 font-light ml-0.5">/</span></> : item.title}
                                                </div>
                                                {item.is_folder ? (
                                                    <div className="text-[13px] sm:text-[13px] text-zinc-500 font-medium">
                                                        {item.subfolderCount > 0 && <span>{item.subfolderCount} folder{item.subfolderCount !== 1 ? "s" : ""}{item.count > 0 ? " · " : ""}</span>}
                                                        {item.count > 0 && <span>{item.count} note{item.count !== 1 ? "s" : ""}</span>}
                                                    </div>
                                                ) : (
                                                    (() => {
                                                        const c = item.content || "";
                                                        const isListModeNote = listModeNotes.has(String(item.id));
                                                        const isChecklist = isListModeNote || (item as any).type === "checklist" || /^\[[ x]\]/im.test(c);
                                                        const lines = c.split("\n").filter((l: string) => l.trim());
                                                        const checked = lines.filter((l: string) => /^\[x\]/i.test(l.trim())).length;
                                                        if (isChecklist && lines.length > 0) {
                                                            const nc = (item as any).color || (item as any).folder_color || null;
                                                            const undone = lines.filter((l: string) => !/^\[x\]/i.test(l.trim()));
                                                            const remaining = lines.length - checked;
                                                            return <div className="hidden sm:flex items-center gap-1.5 mt-0.5 overflow-hidden">
                                                                {undone.slice(0, 3).map((l: string, i: number) => {
                                                                    const text = l.trim().replace(/^\[ \]\s*/i, "").replace(/^[-*]\s*/, "").trim();
                                                                    const isLight = appTheme === "light";
                                                                    return <span key={i} className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                                                        style={{ background: nc ? `${nc}${isLight ? "30" : "20"}` : (isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)"), color: nc || (isLight ? "#3a3a3c" : "#d4d4d8"), border: isLight ? `1px solid ${nc ? `${nc}60` : "rgba(0,0,0,0.12)"}` : "none" }}
                                                                    >{text}</span>;
                                                                })}
                                                                {remaining > 3 && <span className="text-[10px] text-zinc-600 flex-shrink-0">+{remaining - 3}</span>}
                                                            </div>;
                                                        }
                                                        return null;
                                                    })()
                                                )}
                                            </div>
                                            {item.is_folder && item.latestUpdatedAt && (
                                                <span className="text-[13px] sm:text-[13px] text-zinc-500 flex-shrink-0 font-medium">{timeAgo(item.latestUpdatedAt)}</span>
                                            )}
                                            {!item.is_folder && item.updated_at && (() => {
                                                const c = item.content || "";
                                                const isListModeNote = listModeNotes.has(String(item.id));
                                                const isChecklist = isListModeNote || (item as any).type === "checklist" || /^\[[ x]\]/im.test(c);
                                                const lines = c.split("\n").filter((l: string) => l.trim());
                                                const checked = lines.filter((l: string) => /^\[x\]/i.test(l.trim())).length;
                                                const effectiveType = (isListModeNote || (item as any).list_mode) ? "checklist" : (item as any).type;
                                                const typeBadge = TYPE_BADGE[effectiveType];
                                                return <div className="flex flex-col items-end flex-shrink-0 gap-1">
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        {typeBadge && (
                                                            <span className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                                                                style={{ background: `${typeBadge.color}20`, color: typeBadge.color, border: `1px solid ${typeBadge.color}40` }}>
                                                                {typeBadge.label}
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap">{timeAgo(item.updated_at)}</span>
                                                    </div>
                                                </div>;
                                            })()}
                                            {!item.is_folder && looksLikeUrl(item.content || "") && !isSelectMode && (item.folder_name || activeFolder) !== "TEAM" && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingNote(item);
                                                        setTitle(item.title);
                                                        setContent(item.content);
                                                        setImages((item as any).images ?? []);
                                                        setTargetFolder(item.folder_name || activeFolder || "General");
                                                        setNoteColor(item.folder_color || folders.find((f) => f.name === (item.folder_name || activeFolder))?.color || palette12[0]);
                                                        setShowColorPicker(false);
                                                        setShowSwitcher(false);
                                                        setActiveLine(0);
                                                        setEditorScrollTop(0);
                                                        setEditorOpen(true);
                                                    }}
                                                    className="p-1 opacity-0 group-hover:opacity-100 transition text-zinc-400 hover:text-white flex-shrink-0"
                                                    title="Edit bookmark"
                                                >
                                                    <PencilSquareIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {!item.is_folder && (item as any).flag && (
                                                <span className="flex-shrink-0 text-base leading-none" title={(item as any).flag}>{(item as any).flag}</span>
                                            )}
                                            {!item.is_folder && pinnedIds.has(String(item.id)) && !isSelectMode && (
                                                <HeartSolidIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                            )}
                                            {item.is_folder && <ArrowRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
                                        </>
                                    ) : (
                                        <>
                                            {!item.is_folder && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); togglePin(String(item.id)); }}
                                                        className={`absolute bottom-1 right-1 z-10 p-1 transition ${pinnedIds.has(String(item.id)) ? "text-white" : "opacity-0 group-hover:opacity-100 text-white/50 hover:text-white"}`}
                                                        title={pinnedIds.has(String(item.id)) ? "Unpin" : "Pin"}
                                                    >
                                                        {pinnedIds.has(String(item.id)) ? <HeartSolidIcon className="w-3.5 h-3.5" /> : <HeartIcon className="w-3.5 h-3.5" />}
                                                    </button>
                                                    {looksLikeUrl(item.content || "") && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingNote(item);
                                                                setTitle(item.title);
                                                                setContent(item.content);
                                                                setImages((item as any).images ?? []);
                                                                setTargetFolder(item.folder_name || activeFolder || "General");
                                                                setNoteColor(item.folder_color || folders.find((f) => f.name === (item.folder_name || activeFolder))?.color || palette12[0]);
                                                                setShowColorPicker(false);
                                                                setShowSwitcher(false);
                                                                setActiveLine(0);
                                                                setEditorScrollTop(0);
                                                                setEditorOpen(true);
                                                            }}
                                                            className="absolute top-1 right-1 z-10 p-1 opacity-0 group-hover:opacity-100 transition text-white/60 hover:text-white"
                                                            title="Edit bookmark"
                                                        >
                                                            <PencilSquareIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1.5 overflow-hidden">
                                                {item.is_folder ? (
                                                    <>
                                                        {/* Large folder icon colored by folder color */}
                                                        {item.name !== "CLAUDE" && (
                                                            <FolderIcon className="absolute inset-0 m-auto pointer-events-none" style={{ width: "85%", height: "85%", color: item.color || item.folder_color || palette12[0], opacity: 0.9 }} />
                                                        )}
                                                        {item.name === "CLAUDE"
                                                            ? <img src="/claude-icon.png" alt="Claude" className="w-16 h-16 object-contain relative z-10" />
                                                            : item.icon
                                                                ? <div style={{ fontSize: "2.8rem", lineHeight: 1 }} className="relative z-10">{item.icon}</div>
                                                                : <div style={{ fontSize: "3rem", lineHeight: 1 }} className="font-black text-white relative z-10">{meaningfulInitial(item.name, "F")}</div>
                                                        }
                                                        <div className="mt-0.5 text-[9px] font-medium tracking-tight line-clamp-1 w-full text-center relative z-10" style={{ color: "#fff" }}>
                                                            {item.name}<span className="opacity-30 font-light">/</span> <span className="opacity-70">({(item.subfolderCount || 0) + (item.count || 0)})</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {(item as any).flag && (
                                                            <span className="absolute top-1 left-1 text-sm leading-none">{(item as any).flag}</span>
                                                        )}
                                                        <div style={{ fontSize: "3rem", lineHeight: 1 }} className="font-black text-white relative z-10">{meaningfulInitial(item.title || "", "N")}</div>
                                                        <div className="text-[8px] font-semibold text-white leading-tight mt-0.5 line-clamp-2 w-full">{item.title}</div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
{isEmptyView && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center px-6 sm:px-10">
                                <div key={quoteIndex} className="empty-quote-anim max-w-[760px] text-center">
                                    <p className="text-white/85 text-base sm:text-xl font-semibold leading-relaxed tracking-tight">{EMPTY_QUOTES[quoteIndex]}</p>
                                </div>
                            </div>
                        )}
                        {/* Stats footer — desktop list mode only */}
                        {isListMode && !isEmptyView && (() => {
                            const realItems = filteredDisplayItems.filter((i: any) => !i._header);
                            const fCount = realItems.filter((i: any) => i.is_folder).length;
                            const nCount = realItems.filter((i: any) => !i.is_folder).length;
                            const totalChars = realItems.filter((i: any) => !i.is_folder).reduce((acc: number, i: any) => acc + (i.content || "").length, 0);
                            const sizeStr = totalChars >= 1_000_000 ? `${(totalChars / 1_000_000).toFixed(1)}M chars` : totalChars >= 1000 ? `${(totalChars / 1000).toFixed(1)}k chars` : `${totalChars} chars`;
                            const parts = [fCount > 0 && `${fCount} folder${fCount !== 1 ? "s" : ""}`, nCount > 0 && `${nCount} note${nCount !== 1 ? "s" : ""}`, sizeStr].filter(Boolean);
                            return (
                                <div className="hidden sm:block text-right px-4 py-2 text-[10px] text-zinc-700 font-medium select-none pointer-events-none">
                                    {parts.join(" · ")}
                                </div>
                            );
                        })()}
                    </main>

                    {/* FAB — floating + button bottom right */}
                    {!isSelectMode && !isFolderSelectMode && (
                        <div className="absolute bottom-5 right-4 z-[130]" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeFolder) {
                                        setShowNoteTypePicker(true);
                                    } else {
                                        openCreateFolder();
                                    }
                                }}
                                className="w-12 h-12 rounded-full flex items-center justify-center text-black active:scale-90"
                                style={{
                                    background: activeFolder ? (activeFolderColor || "#ffffff") : "#ffffff",
                                    boxShadow: `0 0 0 2px rgba(0,0,0,0.3), 0 6px 20px ${activeFolder ? (activeFolderColor || "#ffffff") : "#ffffff"}66`,
                                    animation: "fabIn 0.35s cubic-bezier(0.16,1,0.3,1) both",
                                    transition: "transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s",
                                }}>
                                <PlusIcon className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    {/* STATS BOTTOM RIGHT */}
                    {!activeFolder && !search.trim() && (
                        <div className="fixed bottom-4 right-4 z-[120] hidden sm:flex items-center gap-1.5 select-none pointer-events-none tabular-nums" style={{ fontSize: 9, opacity: 0.55 }}>
                            <span style={{ color: "#38bdf8" }}>{dbStats.folderCount} folders</span>
                            <span className="text-zinc-600">·</span>
                            <span style={{ color: "#fb923c" }}>{dbStats.noteCount} notes</span>
                            <span className="text-zinc-600">·</span>
                            <span style={{ color: "#34d399" }}>{dbStats.size}</span>
                            <span className="text-zinc-600">·</span>
                            <span className="text-white/50 font-bold">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            <span className="text-zinc-700">/</span>
                            <span className="text-zinc-600 uppercase tracking-wide">{now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
                        </div>
                    )}

                    {/* FOLDER MERGE ACTION BAR */}
                    {isFolderSelectMode && (
                        <div className="fixed bottom-0 left-0 right-0 z-[150] bg-zinc-900/97 border-t border-emerald-500/30 px-4 py-3 flex items-center gap-3">
                            <span className="text-xs text-zinc-400 flex-1 font-bold">
                                {selectedFolderNames.length === 0
                                    ? "Long-press a folder to start"
                                    : selectedFolderNames.length === 1
                                        ? `"${selectedFolderNames[0]}" — tap more folders`
                                        : `★ "${selectedFolderNames[0]}" + ${selectedFolderNames.length - 1} more`}
                            </span>
                            {selectedFolderNames.length >= 2 && (
                                <button
                                    onClick={() => void mergeFolders()}
                                    className="px-4 py-2 bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/30 hover:bg-emerald-500/30 transition">
                                    Merge {selectedFolderNames.length}
                                </button>
                            )}
                            <button
                                onClick={() => { setIsFolderSelectMode(false); setSelectedFolderNames([]); }}
                                className="px-4 py-2 bg-white/10 text-white text-xs font-black hover:bg-white/15 transition">
                                Cancel
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

                </>
                </div>{/* ── end left panel ── */}

            </div>{/* ── end two-panel wrapper ── */}

            {/* NOTE TYPE PICKER — Type vs Voice */}
            {showNoteTypePicker && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowNoteTypePicker(false)}>
                    <div className="flex flex-col items-center gap-6 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">New Note</div>
                        <div className="flex items-center gap-8">
                            {/* TYPE ball → rich editor */}
                            <button
                                type="button"
                                onClick={() => { setShowNoteTypePicker(false); openNewNote("rich"); }}
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

                            {/* VOICE ball */}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNoteTypePicker(false);
                                    setEditingNote(null);
                                    setTitle("Voice Note");
                                    setContent("");
                                    setImages([]);
                                    setTargetFolder(activeFolder || "General");
                                    setNoteColor(pickUniqueColor());
                                                    setVoiceAutoStart(true);
                                        setShowVoiceRecorder(true);
                                }}
                                className="flex flex-col items-center gap-3 group"
                            >
                                <div className="w-28 h-28 rounded-full flex items-center justify-center transition-transform active:scale-95 group-hover:scale-105"
                                    style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", boxShadow: "0 0 40px rgba(239,68,68,0.5), 0 8px 32px rgba(0,0,0,0.5)", animation: "pulse 2s infinite" }}>
                                    <MicrophoneIcon className="w-12 h-12 text-white" />
                                </div>
                                <span className="text-xs font-black uppercase tracking-widest text-red-400">Voice</span>
                            </button>
                        </div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-widest">or tap outside to cancel</div>
                    </div>
                </div>
            )}

            {/* Fixed mic FAB — always bottom-right when note type is voice */}
            {noteType === "voice" && editorOpen && !showVoiceRecorder && (
                <button
                    type="button"
                    onClick={() => { setVoiceAutoStart(true); setShowVoiceRecorder(true); }}
                    className="fixed bottom-6 right-6 z-[500] w-12 h-12 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-400 transition"
                    style={{ boxShadow: "0 0 24px rgba(239,68,68,0.55)" }}
                    title="Add Recording">
                    <MicrophoneIcon className="w-5 h-5 text-white" />
                </button>
            )}

            {showVoiceRecorder && (
                <VoiceRecorder
                    noteId={currentNoteId}
                    getToken={getAuthToken}
                    onComplete={(voiceData) => {
                        if (!title.trim()) setTitle("Voice Note");
                        // Append to existing voice entries if note is already a voice note
                        setContent(prev => {
                            try {
                                const existing = JSON.parse(prev);
                                const entries = Array.isArray(existing) ? existing : [existing];
                                if (entries[0]?._type === "voice") {
                                    return JSON.stringify([...entries, voiceData]);
                                }
                            } catch {}
                            return JSON.stringify(voiceData);
                        });
                        setShowVoiceRecorder(false);
                        setVoiceAutoStart(false);
                        setEditorOpen(true);
                    }}
                    autoStart={voiceAutoStart}
                    onCancel={() => { setShowVoiceRecorder(false); setVoiceAutoStart(false); }}
                />
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
                            {/* SEND */}
                            <button
                                type="button"
                                className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                onClick={() => { setSharePickerOpen(true); setShowNoteActions(false); closeEditorTools(); }}
                            >
                                <PaperAirplaneIcon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-xs font-black tracking-wide flex-1">Send</span>
                            </button>
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
                                                className="w-7 h-7 transition-all"
                                                style={{
                                                    background: c,
                                                    border: noteColor === c ? `2.5px solid rgba(255,255,255,0.9)` : `1.5px solid rgba(255,255,255,0.15)`,
                                                    boxShadow: noteColor === c ? `0 0 0 1px ${c}60` : "none",
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

                            {/* MERGE */}
                            <div>
                                <button
                                    type="button"
                                    className={`w-full flex items-center gap-4 px-6 py-4 text-left transition ${showMerger ? "bg-white/8 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10"}`}
                                    onClick={() => { const next = !showMerger; setShowMerger(next); setShowSwitcher(false); setShowColorPicker(false); if (next) { setMergeQuery(""); setTimeout(() => mergerSearchRef.current?.focus(), 50); } }}
                                >
                                    <DocumentDuplicateIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide flex-1">Merge</span>
                                    <span className="text-[10px] text-zinc-600 font-bold">append + delete</span>
                                </button>
                                {showMerger && (() => {
                                    const currentId = editingNote?.id ? String(editingNote.id) : null;
                                    const q = mergeQuery.trim().toLowerCase();
                                    const allNotes = dbData.filter((r) => !r.is_folder && String(r.id) !== currentId);
                                    const inFolder = allNotes.filter((r) => r.folder_name === targetFolder);
                                    const others = allNotes.filter((r) => r.folder_name !== targetFolder);
                                    // No query: top 3 from current folder only
                                    // Typing: filter all notes by query (replaces the 3)
                                    const results = q === ""
                                        ? inFolder.slice(0, 3)
                                        : [...inFolder, ...others].filter((r) => String(r.title || "").toLowerCase().includes(q)).slice(0, 6);
                                    return (
                                        <div className="px-4 pb-4 flex flex-col gap-1.5">
                                            <input
                                                ref={mergerSearchRef}
                                                type="text"
                                                value={mergeQuery}
                                                onChange={(e) => setMergeQuery(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === "Escape") { setShowMerger(false); setMergeQuery(""); } }}
                                                placeholder="search notes to merge..."
                                                className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono mb-1"
                                            />
                                            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
                                                {results.map((note) => {
                                                    const nc = note.folder_color || palette12[0];
                                                    const isCurrentFolder = note.folder_name === targetFolder;
                                                    return (
                                                        <button
                                                            key={note.id}
                                                            type="button"
                                                            onClick={() => mergeWithNote({ id: String(note.id), title: String(note.title || ""), content: String(note.content || ""), folder_color: nc })}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left border border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5 transition"
                                                        >
                                                            <span className="w-[14px] h-[14px] flex-shrink-0 border border-white/25" style={{ backgroundColor: nc }} />
                                                            <span className="text-[12px] font-bold truncate flex-1">{note.title || "Untitled"}</span>
                                                            {isCurrentFolder && <span className="text-[9px] text-zinc-600 font-bold flex-shrink-0">here</span>}
                                                        </button>
                                                    );
                                                })}
                                                {results.length === 0 && <p className="text-[10px] text-zinc-600 px-1 py-2">No notes found</p>}
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
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(["Text", "Checklist", "Graph", "Mindmap", "Stack"] as const).map((mode) => {
                                        const active = noteViewMode === mode;
                                        const icon = mode === "Text" ? (
                                            <Bars3Icon className="w-4 h-4" />
                                        ) : mode === "Checklist" ? (
                                            <ListBulletIcon className="w-4 h-4" />
                                        ) : mode === "Graph" ? (
                                            <CubeTransparentIcon className="w-4 h-4" />
                                        ) : mode === "Mindmap" ? (
                                            <ShareIcon className="w-4 h-4" />
                                        ) : (
                                            <RectangleStackIcon className="w-4 h-4" />
                                        );
                                        const autoLocked = (markdownMode || htmlMode) && mode !== "Text"
                                            || (mode === "Checklist" && !canToggleChecklist);
                                        return (
                                            <button key={mode} type="button"
                                                disabled={autoLocked}
                                                onClick={() => {
                                                    if (autoLocked) return;
                                                    if (listMode) toggleListMode();
                                                    if (graphMode) toggleGraphMode();
                                                    if (mindmapMode) toggleMindmapMode();
                                                    if (stackMode) toggleStackMode();
                                                    if (mode === "Checklist") toggleListMode();
                                                    else if (mode === "Graph") toggleGraphMode();
                                                    else if (mode === "Mindmap") toggleMindmapMode();
                                                    else if (mode === "Stack") toggleStackMode();
                                                    else if (mode === "Text") {
                                                        if (markdownMode) toggleMarkdownMode();
                                                        if (htmlMode) toggleHtmlMode();
                                                    }
                                                    if (window.innerWidth < 1024) setShowNoteActions(false);
                                                }}
                                                className="flex flex-col items-center gap-1.5 py-3 px-1 transition-all text-[10px] font-black"
                                                style={{
                                                    background: active ? `${noteColor}25` : "rgba(255,255,255,0.04)",
                                                    color: autoLocked ? "#27272a" : active ? noteColor : "#71717a",
                                                    border: `1.5px solid ${active ? noteColor + "60" : "transparent"}`,
                                                    cursor: autoLocked ? "not-allowed" : "pointer",
                                                    opacity: autoLocked ? 0.35 : 1,
                                                }}
                                            >
                                                {icon}
                                                <span>{mode}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {(markdownMode || htmlMode) && (
                                    <div className="mt-2 text-[10px] font-bold" style={{ color: noteColor + "80" }}>
                                        ↳ {markdownMode ? "Markdown" : "HTML"} auto-detected — switch to Text to change
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Delete / Discard */}
                        <div className="border-t border-white/10 px-4 py-3 flex justify-end">
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
                <div className="fixed inset-0 z-[510] flex items-center justify-center p-4 lg:items-stretch lg:justify-end lg:p-0" onClick={() => { setShowFolderActions(false); setShowIntegrationsPanel(false); setConfiguringIntegration(null); setShowAutomationsPanel(false); setSelectedAutomation(null); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); setShowDefaultFolderPicker(false); }}>
                    <div className="note-actions-panel bg-zinc-900 border border-white/15 w-full max-w-sm flex flex-col overflow-hidden lg:max-w-[300px] lg:w-[300px] lg:h-full lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:rounded-none relative" onClick={(e) => e.stopPropagation()}>

                        {/* Depth level watermark */}
                        <div className="absolute inset-0 flex items-end justify-end pointer-events-none z-0 overflow-hidden pb-16 pr-4">
                            <span className="text-[160px] font-black text-white/[0.04] select-none leading-none tracking-tighter">
                                L{Math.min(folderStack.length + 1, 3)}
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
                                    const triggers = integrationsSnapshot.filter(ig => TRIGGER_TYPES.includes(ig.type));
                                    const actions  = integrationsSnapshot.filter(ig => !TRIGGER_TYPES.includes(ig.type));

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
                                                        fetch("/api/hue/groups", { headers: { Authorization: `Bearer ${await getAuthToken()}` } })
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
                                            {/* Automations entry */}
                                            <div className="mt-4 border-t border-white/[0.06]">
                                                <div className="px-5 pt-4 pb-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">Automations</div>
                                                <button type="button"
                                                    className="w-full px-5 py-3.5 flex items-center gap-4 text-left hover:bg-white/5 active:bg-white/10 transition"
                                                    onClick={async () => {
                                                        setShowAutomationsPanel(true);
                                                        fetch("/api/stickies/automations", { headers: { Authorization: `Bearer ${await getAuthToken()}` } })
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
                                                                                    "Authorization": `Bearer ${await getAuthToken()}`,
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
                                    {automationsList.length === 0 ? (
                                        <div className="px-6 py-10 text-center">
                                            <BoltIcon className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                            <p className="text-xs font-black text-zinc-500 uppercase tracking-wide">No automations yet</p>
                                            <p className="text-[10px] text-zinc-700 mt-1">Run the SQL migration in Supabase to get started</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-white/[0.06]">
                                            {automationsList.map((auto) => (
                                                <div key={auto.id} className="w-full px-5 py-3.5 flex items-center gap-3">
                                                    {/* Active toggle */}
                                                    <button type="button"
                                                        className="flex-shrink-0"
                                                        onClick={async () => {
                                                            const next = !auto.active;
                                                            setAutomationsList(prev => prev.map(a => a.id === auto.id ? { ...a, active: next } : a));
                                                            await fetch(`/api/stickies/automations/${auto.id}`, {
                                                                method: "PATCH",
                                                                headers: { Authorization: `Bearer ${await getAuthToken()}`, "Content-Type": "application/json" },
                                                                body: JSON.stringify({ active: next }),
                                                            }).catch(() => {});
                                                        }}>
                                                        <div className={`w-9 h-5 rounded-full transition-colors relative ${auto.active ? "bg-emerald-500" : "bg-zinc-700"}`}>
                                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-transform ${auto.active ? "translate-x-5" : "translate-x-1"}`} />
                                                        </div>
                                                    </button>
                                                    {/* Info — tap to open logs */}
                                                    <button type="button" className="flex-1 min-w-0 text-left"
                                                        onClick={async () => {
                                                            setSelectedAutomation(auto);
                                                            setAutomationLogsLoading(true);
                                                            fetch(`/api/stickies/automation-logs?automation_id=${auto.id}&limit=20`, { headers: { Authorization: `Bearer ${await getAuthToken()}` } })
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
                                    )}
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
                            {activeFolder ? (
                                <>
                                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-black text-white leading-none overflow-hidden"
                                        style={{ backgroundColor: activeFolder === "CLAUDE" ? "#fff" : activeFolderColor, boxShadow: activeFolder === "CLAUDE" ? "inset 0 0 0 1px rgba(255,255,255,0.85)" : undefined }}>
                                        {activeFolder === "CLAUDE" ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-1" /> : (folderIcons[activeFolder] || [...(activeFolder || "F")][0].toUpperCase())}
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
                                                    className="w-7 h-7 transition-all"
                                                    style={{
                                                        background: c,
                                                        border: activeFolderColor === c ? `2.5px solid rgba(255,255,255,0.9)` : `1.5px solid rgba(255,255,255,0.15)`,
                                                        boxShadow: activeFolderColor === c ? `0 0 0 1px ${c}60` : "none",
                                                    }}
                                                />
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
                                                    onChange={(e) => setFolderMoveQuery(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === "Enter" && moveTargets.length > 0) { e.preventDefault(); void moveFolderToParent(moveTargets[0]); } if (e.key === "Escape") { setShowFolderMovePicker(false); setFolderMoveQuery(""); } }}
                                                    placeholder="search folders..."
                                                    className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-2 text-xs text-white placeholder:text-zinc-600 font-mono mb-1"
                                                />
                                                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
                                                    <button type="button"
                                                        onClick={() => void moveFolderToParent(null)}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left border border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5 transition">
                                                        <span className="text-[12px] font-bold truncate flex-1">Root</span>
                                                    </button>
                                                    {moveTargets.map((name) => {
                                                        const color = folders.find((f) => f.name === name)?.color || palette12[0];
                                                        const icon = folderIcons[name] || name.trim().charAt(0).toUpperCase() || "F";
                                                        return (
                                                            <button key={name} type="button"
                                                                onClick={() => void moveFolderToParent(name)}
                                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left border border-white/10 bg-black/30 text-zinc-300 hover:bg-white/5 transition">
                                                                <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black text-white leading-none border border-white/25" style={{ backgroundColor: color }}>
                                                                    {icon}
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
                            {/* DELETE FOLDER */}
                            {activeFolder && canDeleteActiveFolder && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition"
                                    onClick={() => { setShowFolderActions(false); setConfirmDelete({ type: "folder", folderName: activeFolder }); }}>
                                    <TrashIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide">Delete</span>
                                </button>
                            )}
                            {/* L1 only: App Settings, Graph, Integrations, Sign Out */}
                            {folderStack.length === 0 && (<>
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
                                                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[11px] font-black text-white leading-none overflow-hidden" style={{ backgroundColor: defaultFolder === "CLAUDE" ? "#fff" : dfColor, fontSize: 13 }}>
                                                        {defaultFolder === "CLAUDE"
                                                            ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                            : (folderIcons[defaultFolder] || defaultFolder?.charAt(0).toUpperCase())}
                                                    </span>
                                                ) : <span className="w-5 h-5 flex-shrink-0" />}
                                                <span className="text-xs font-bold flex-1 truncate text-white">{defaultFolder || "None"}</span>
                                                <ChevronDownIcon className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                                            </button>
                                            {showDefaultFolderPicker && (
                                                <div className="mt-1 flex flex-col gap-0.5">
                                                    {folders.filter(f => f.name && !f.parent_folder_name && f.name !== defaultFolder).map(f => (
                                                        <button key={f.name} type="button"
                                                            onClick={(e) => { e.stopPropagation(); setDefaultFolder(f.name); localStorage.setItem(DEFAULT_FOLDER_KEY, f.name); setShowDefaultFolderPicker(false); setShowFolderActions(false); }}
                                                            className="flex items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-white/5 rounded">
                                                            <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[11px] font-black text-white leading-none overflow-hidden" style={{ backgroundColor: f.name === "CLAUDE" ? "#fff" : f.color, fontSize: 13 }}>
                                                                {f.name === "CLAUDE"
                                                                    ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                                    : (folderIcons[f.name] || f.name?.charAt(0).toUpperCase())}
                                                            </span>
                                                            <span className="text-xs font-bold flex-1 truncate text-zinc-400">{f.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                                {/* NAV MODE */}
                                <div className="px-6 py-2 border-b border-white/[0.06]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Navigation</p>
                                    <div className="flex gap-1.5">
                                        {(["folders-and-files", "files-only"] as const).map((mode) => (
                                            <button key={mode} type="button"
                                                onClick={() => setNavMode(mode)}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase tracking-wide transition ${navMode === mode ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                                {mode === "folders-and-files" ? "Folders" : "Files"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* VIEW MODE */}
                                <div className="px-6 py-2 border-b border-white/[0.06]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">View Mode</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                        <button type="button" onClick={() => { setMainListMode(true); setKanbanMode(false); }}
                                            className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition ${mainListMode && !kanbanMode ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                            <ListBulletIcon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">List</span>
                                        </button>
                                        <button type="button" onClick={() => { setMainListMode(false); setKanbanMode(false); }}
                                            className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition ${!mainListMode && !kanbanMode ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                            <Squares2X2Icon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">Thumb</span>
                                        </button>
                                        <button type="button" onClick={() => { setKanbanMode(true); setMainListMode(false); }}
                                            className={`hidden sm:flex py-1.5 rounded flex-col items-center gap-0.5 transition ${kanbanMode ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                            <ViewColumnsIcon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">Kanban</span>
                                        </button>
                                        <button type="button" onClick={() => { setShowFolderActions(false); setShowGlobalGraph(true); }}
                                            className="hidden sm:flex py-1.5 rounded flex-col items-center gap-0.5 transition bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200">
                                            <CubeTransparentIcon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">Graph</span>
                                        </button>
                                    </div>
                                </div>
                                {/* THEME */}
                                <div className="px-6 py-2 border-b border-white/[0.06]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Theme</p>
                                    <div className="flex gap-1.5">
                                        {(["dark", "monokai", "light"] as const).map((t) => (
                                            <button key={t} type="button"
                                                onClick={() => setAppTheme(t)}
                                                className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase tracking-wide transition ${appTheme === t ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                                {t === "dark" ? "Dark" : t === "light" ? "Light" : "Monokai"}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {isAdmin && (
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
                                )}
                            </>)}
                        </div>
                        <div className="border-t border-white/10 p-4 flex gap-3">
                            <button type="button" onClick={() => { setShowFolderActions(false); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }} className="flex-1 py-3 bg-white text-black font-black uppercase text-xs tracking-wide hover:bg-zinc-100 transition">Close</button>
                            {folderStack.length === 0 && (
                                <button type="button"
                                    onClick={async () => { setShowFolderActions(false); await fetch("/api/stickies/logout", { method: "POST" }); window.location.href = "/sign-in"; }}
                                    className="flex items-center gap-2 px-5 py-3 bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition font-black uppercase text-xs tracking-wide">
                                    <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
                                    Sign Out
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CMD+K SEARCH PALETTE */}
            {showCmdK && (
                <div className="fixed inset-0 z-[99990] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowCmdK(false)}>
                    <div className="w-full max-w-lg bg-zinc-900 border border-white/15 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") { setShowCmdK(false); return; }
                            if (e.key === "ArrowDown") { e.preventDefault(); setCmdKCursor(v => Math.min(v + 1, cmdKResults.length - 1)); }
                            if (e.key === "ArrowUp") { e.preventDefault(); setCmdKCursor(v => Math.max(v - 1, 0)); }
                            if (e.key === "Enter" && cmdKResults[cmdKCursor]) openNoteFromCmdK(cmdKResults[cmdKCursor], e.metaKey);
                        }}>
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                            <MagnifyingGlassIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <input
                                ref={cmdKInputRef}
                                autoFocus
                                value={cmdKQuery}
                                onChange={(e) => { setCmdKQuery(e.target.value); setCmdKCursor(0); }}
                                placeholder="SEARCH NOTES…"
                                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600 font-medium"
                            />
                            <kbd className="text-[10px] text-zinc-600 border border-zinc-700 px-1.5 py-0.5 font-mono">esc</kbd>
                        </div>
                        {/* Results */}
                        <div className="max-h-[360px] overflow-y-auto">
                            {(() => {
                                const folderItems = cmdKResults.filter((r: any) => r._isFolder);
                                const noteItems = cmdKResults.filter((r: any) => !r._isFolder);
                                return (
                                    <>
                                        {folderItems.length > 0 && (
                                            <>
                                                <div className="px-4 pt-3 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase">Notebooks</div>
                                                {folderItems.map((folder: any, i: number) => {
                                                    const dbRow = dbData.find((r: any) => r.is_folder && String(r.id) === String(folder.id));
                                                    const parentName = dbRow?.parent_folder_name || null;
                                                    return (
                                                    <button key={`f-${folder.id}`} type="button"
                                                        onMouseEnter={() => setCmdKCursor(i)}
                                                        onClick={() => {
                                                            setShowCmdK(false); setCmdKQuery("");
                                                            const fr = dbData.find((r: any) => r.is_folder && (r.folder_name === folder.name || r.name === folder.name));
                                                            enterFolder({ id: fr ? String(fr.id) : `virtual-${folder.name}`, name: folder.name, color: folder.color || palette12[0] });
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === cmdKCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                                        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black overflow-hidden"
                                                            style={{ backgroundColor: folder.name === "CLAUDE" ? "#fff" : (folder.color || "#3f3f46"), color: "#fff" }}>
                                                            {folder.name === "CLAUDE"
                                                                ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                                : (folder.icon || [...(folder.name || "F")][0]?.toUpperCase())}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            {parentName && (
                                                                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wide truncate">
                                                                    <span>{parentName}</span>
                                                                    <span className="text-zinc-700">/</span>
                                                                </div>
                                                            )}
                                                            <div className="text-sm font-semibold text-white truncate">{folder.name}</div>
                                                            <div className="text-[10px] text-zinc-500">{folder.count ?? 0} note{(folder.count ?? 0) !== 1 ? "s" : ""}</div>
                                                        </div>
                                                        <ChevronRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                                    </button>
                                                    );
                                                })}
                                            </>
                                        )}
                                        {noteItems.length > 0 && (
                                            <div className="px-4 pt-3 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase">Notes</div>
                                        )}
                                        {noteItems.map((note: any, ni: number) => {
                                            const i = folderItems.length + ni;
                                            const isPinned = pinnedIds.has(String(note.id));
                                            return (
                                                <button key={note.id} type="button"
                                                    onClick={(e) => openNoteFromCmdK(note, e.metaKey)}
                                                    onMouseEnter={() => setCmdKCursor(i)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === cmdKCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                                    <div className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black text-white"
                                                        style={{ backgroundColor: note.color || note.folder_color || "#3f3f46" }}>
                                                        {[...(note.title || "N")][0]?.toUpperCase()}
                                                        {looksLikeUrl(note.content || "") && (
                                                            <BookmarkIcon className="absolute -top-1 -right-1 w-3 h-3 text-white drop-shadow-sm" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.8))" }} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        {note.folder_name && (
                                                            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide truncate">{note.folder_name}</div>
                                                        )}
                                                        <div className="text-sm font-semibold text-white truncate">{note.title || "Untitled"}</div>
                                                    </div>
                                                    {isPinned && <HeartSolidIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />}
                                                    {looksLikeUrl(note.content || "") && i === cmdKCursor && <span className="text-[9px] text-zinc-500 flex-shrink-0">⌘ open</span>}
                                                    <span className="text-[10px] text-zinc-600 flex-shrink-0">{timeAgo(note.updated_at)}</span>
                                                    {i === cmdKCursor && <kbd className="text-[9px] text-zinc-600 border border-zinc-700 px-1 py-0.5 font-mono flex-shrink-0">↵</kbd>}
                                                </button>
                                            );
                                        })}
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
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">esc</kbd> close</span>
                        </div>
                    </div>
                </div>
            )}

            {/* CMD+B BOOKMARK LAUNCHER */}
            {showCmdB && (
                <div className="fixed inset-0 z-[99990] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowCmdB(false)}>
                    <div className="w-full max-w-lg bg-zinc-900 border border-white/15 shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") { setShowCmdB(false); return; }
                            if (e.key === "ArrowDown") { e.preventDefault(); setCmdBCursor(v => Math.min(v + 1, cmdBResults.length - 1)); }
                            if (e.key === "ArrowUp") { e.preventDefault(); setCmdBCursor(v => Math.max(v - 1, 0)); }
                            if (e.key === "Enter" && cmdBResults[cmdBCursor]) {
                                window.open(cmdBResults[cmdBCursor].url, "_blank", "noopener,noreferrer");
                                setShowCmdB(false);
                            }
                        }}>
                        {/* Input */}
                        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
                            <BookmarkIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                            <input
                                ref={cmdBInputRef}
                                autoFocus
                                value={cmdBQuery}
                                onChange={(e) => { setCmdBQuery(e.target.value); setCmdBCursor(0); }}
                                placeholder="SEARCH BOOKMARKS…"
                                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600 font-medium"
                            />
                            <kbd className="text-[10px] text-zinc-600 border border-zinc-700 px-1.5 py-0.5 font-mono">esc</kbd>
                        </div>
                        {/* Results */}
                        <div className="max-h-[360px] overflow-y-auto">
                            {cmdBResults.length === 0 ? (
                                <div className="px-4 py-10 text-center text-zinc-600 text-sm">
                                    {bookmarksData.length === 0 ? "Loading…" : "No bookmarks found"}
                                </div>
                            ) : (
                                <>
                                    <div className="px-4 pt-3 pb-1 text-[9px] font-black tracking-[0.2em] text-zinc-600 uppercase">Bookmarks</div>
                                    {cmdBResults.map((bm: any, i: number) => (
                                        <button key={bm.id} type="button"
                                            onMouseEnter={() => setCmdBCursor(i)}
                                            onClick={() => { window.open(bm.url, "_blank", "noopener,noreferrer"); setShowCmdB(false); }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === cmdBCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                            <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black text-white bg-blue-600">
                                                {[...(bm.title || "B")][0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {bm.folder && <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide truncate">{bm.folder}</div>}
                                                <div className="text-sm font-semibold text-white truncate">{bm.title || "Untitled"}</div>
                                                <div className="text-[10px] text-zinc-600 truncate">{bm.url}</div>
                                            </div>
                                            {i === cmdBCursor && <kbd className="text-[9px] text-zinc-600 border border-zinc-700 px-1 py-0.5 font-mono flex-shrink-0">↵</kbd>}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="border-t border-white/10 px-4 py-2 flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">↑↓</kbd> navigate</span>
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">↵</kbd> open</span>
                            <span className="flex items-center gap-1.5 text-[10px] text-zinc-600"><kbd className="border border-zinc-700 px-1 font-mono">esc</kbd> close</span>
                            <span className="ml-auto text-[10px] text-zinc-700">{bookmarksData.length} bookmarks</span>
                            <button type="button"
                                onClick={async () => {
                                    const token = await getAuthToken();
                                    const r = await fetch("/api/stickies/bookmarks/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                                    const d = await r.json();
                                    if (d.ok) {
                                        setBookmarksData([]);
                                        showToast(`Synced ${d.synced} bookmarks`);
                                    } else {
                                        showToast(d.error || "Sync failed");
                                    }
                                }}
                                className="text-[10px] font-black uppercase tracking-wide text-zinc-500 hover:text-white transition px-2 py-1 border border-zinc-700 hover:border-zinc-500">
                                ↻ Sync
                            </button>
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
                                {qrIsBurn ? "Burn Link — 1× Only" : qrType === "link" ? "QR — Link" : "QR — Data"}
                            </h2>
                        </div>
                        {qrType === "data" && (
                            <p className="text-[10px] text-zinc-500 text-center -mt-2">Scan to copy note content</p>
                        )}
                        {qrType === "link" && (
                            <p className="text-[10px] text-zinc-500 text-center -mt-2 font-mono break-all">{qrData.replace(window.location.origin, "")}</p>
                        )}

                        {/* QR code */}
                        <div className="p-3 bg-white" style={{ border: `4px solid ${qrIsBurn ? "#FF6B00" : activeAccentColor}` }}>
                            <QRCodeSVG value={qrData || " "} size={220} level={qrType === "data" ? "L" : "M"} />
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
                                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> {qrType === "data" ? "Copy Content" : "Copy Link"}</>
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

            {calModalOpen && (
                <div className="fixed inset-0 z-[530] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setCalModalOpen(false)}>
                    <div className="bg-zinc-900 w-full max-w-sm flex flex-col overflow-hidden"
                        style={{ border: `2px solid ${calTarget === "google" ? "#4285F4" : activeAccentColor}` }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                            <CalendarDaysIcon className="w-5 h-5 flex-shrink-0" style={{ color: calTarget === "google" ? "#4285F4" : activeAccentColor }} />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{calTarget === "google" ? "Google Calendar" : "Apple Calendar"}</p>
                                <p className="text-xs font-black text-white truncate mt-0.5">{title.trim() || editingNote?.title || "Untitled"}</p>
                            </div>
                        </div>
                        <div className="px-5 py-5 flex flex-col gap-4">
                            {/* Date */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Date</label>
                                <input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)}
                                    className="bg-zinc-800 border border-white/10 text-white text-sm font-bold px-3 py-2.5 outline-none focus:border-white/30 w-full"
                                    style={{ colorScheme: "dark" }} />
                            </div>
                            {/* Time */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Time</label>
                                <input type="time" value={calTime} onChange={(e) => setCalTime(e.target.value)}
                                    className="bg-zinc-800 border border-white/10 text-white text-sm font-bold px-3 py-2.5 outline-none focus:border-white/30 w-full"
                                    style={{ colorScheme: "dark" }} />
                            </div>
                            {/* Repeat */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Repeat</label>
                                <div className="grid grid-cols-4 gap-1">
                                    {(["none", "daily", "weekly", "monthly"] as const).map((r) => (
                                        <button key={r} type="button" onClick={() => setCalRepeat(r)}
                                            className="py-2 text-[10px] font-black uppercase tracking-wide transition border"
                                            style={{
                                                background: calRepeat === r ? (calTarget === "google" ? "#4285F4" : activeAccentColor) : "transparent",
                                                color: calRepeat === r ? "#000" : "#71717a",
                                                borderColor: calRepeat === r ? (calTarget === "google" ? "#4285F4" : activeAccentColor) : "rgba(255,255,255,0.1)",
                                            }}>
                                            {r === "none" ? "Once" : r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-5 pb-5 flex flex-col gap-2">
                            <button type="button" onClick={confirmCalendar} disabled={!calDate}
                                className="w-full py-3 font-black uppercase text-xs tracking-wide transition disabled:opacity-40"
                                style={{ background: calTarget === "google" ? "#4285F4" : activeAccentColor, color: "#000" }}>
                                {calTarget === "google" ? "Open Google Calendar" : "Download .ics"}
                            </button>
                            <button type="button" onClick={() => setCalModalOpen(false)}
                                className="w-full py-2.5 border border-white/15 text-zinc-400 font-black uppercase text-xs tracking-wide hover:border-white/30 hover:text-white transition">
                                Cancel
                            </button>
                        </div>
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

                        {/* Link row — Copy · QR · Data · Burn */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Link</p>
                            <button type="button" onClick={() => { setSharePickerOpen(false); openNoteLinkQr(); }} className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-emerald-400/50 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition" title="QR link">
                                <QrCodeIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">QR</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); openNoteDataQr(); }} className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-pink-400/50 bg-pink-400/10 text-pink-400 hover:bg-pink-400/20 transition" title="QR data">
                                <QrCodeIcon className="w-4 h-4 text-pink-400" />
                                <span className="text-[8px] font-black uppercase text-pink-400">Data</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); shareBurnLink(); }} className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-orange-400/50 bg-orange-400/10 text-orange-400 hover:bg-orange-400/20 transition" title="Burn link (1×)">
                                <QrCodeIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Burn</span>
                            </button>
                        </div>

                        {/* Email row — Gmail · Mail */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Email</p>
                            <button type="button"
                                onClick={() => { const t = encodeURIComponent(title.trim() || editingNote?.title || "Note"); const b = encodeURIComponent((content || editingNote?.content || "").slice(0, 2000)); window.open(`https://mail.google.com/mail/?view=cm&su=${t}&body=${b}`, "_blank"); setSharePickerOpen(false); }}
                                className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-[#EA4335]/50 bg-[#EA4335]/10 hover:bg-[#EA4335]/20 transition" title="Gmail"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="#EA4335" opacity="0.3"/>
                                    <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                <span className="text-[8px] font-black uppercase text-[#EA4335]">Gmail</span>
                            </button>
                            <button type="button"
                                onClick={() => { const t = encodeURIComponent(title.trim() || editingNote?.title || "Note"); const b = encodeURIComponent((content || editingNote?.content || "").slice(0, 2000)); window.location.href = `mailto:?subject=${t}&body=${b}`; setSharePickerOpen(false); }}
                                className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-[#007AFF]/50 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 transition" title="Mail App"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.5">
                                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span className="text-[8px] font-black uppercase text-[#007AFF]">Mail</span>
                            </button>
                        </div>

                        {/* Mobile — Pusher push-nav to all other sessions */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Mobile</p>
                            <button type="button" onClick={() => { void sendToMobile(); }}
                                className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-sky-400/50 bg-sky-400/10 text-sky-400 hover:bg-sky-400/20 transition" title="Send to all other connected sessions">
                                <DevicePhoneMobileIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Send</span>
                            </button>
                        </div>

                        {/* Calendar — Apple .ics / Google Calendar */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Calendar</p>
                            <button type="button"
                                onClick={() => { const today = new Date(); setCalTarget("apple"); setCalDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`); setCalTime("09:00"); setCalRepeat("none"); setSharePickerOpen(false); setCalModalOpen(true); }}
                                className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-zinc-400/50 bg-zinc-400/10 text-zinc-300 hover:bg-zinc-400/20 transition" title="Add to Apple Calendar (.ics)">
                                <CalendarDaysIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Apple</span>
                            </button>
                            <button type="button"
                                onClick={() => { const today = new Date(); setCalTarget("google"); setCalDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`); setCalTime("09:00"); setCalRepeat("none"); setSharePickerOpen(false); setCalModalOpen(true); }}
                                className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-[#4285F4]/50 bg-[#4285F4]/10 text-[#4285F4] hover:bg-[#4285F4]/20 transition" title="Add to Google Calendar">
                                <CalendarDaysIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Google</span>
                            </button>
                        </div>

                        {/* Download (mindmap only) — bottom */}
                        {mindmapMode && (
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Download</p>
                            <button type="button" onClick={() => { setSharePickerOpen(false); void downloadMindmapPng(); }} className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-green-400/50 bg-green-400/10 text-green-400 hover:bg-green-400/20 transition" title="Download PNG">
                                <ArrowDownTrayIcon className="w-4 h-4 text-green-400" />
                                <span className="text-[8px] font-black uppercase text-green-400">PNG</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); void downloadMindmapPdf(); }} className="w-11 h-11 flex flex-col items-center justify-center gap-0.5 border-2 border-purple-500/50 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition" title="Download PDF">
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">PDF</span>
                            </button>
                        </div>
                        )}

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
                        <p className="text-base font-black text-white mb-1 truncate">&ldquo;{confirmDelete.type === "folder" ? confirmDelete.folderName : confirmDelete.noteName || "Untitled"}&rdquo;</p>
                        <p className="text-[11px] text-white/70 uppercase tracking-wide mb-5">{confirmDelete.type === "folder" ? (() => { const n = dbData.filter((r) => !r.is_folder && String(r.folder_name || "") === confirmDelete.folderName).length; return n > 0 ? `This will delete the folder and all ${n} note${n !== 1 ? "s" : ""} inside.` : "This action cannot be undone."; })() : "This action cannot be undone."}</p>
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

const HeaderIconBtn = ({ icon: Icon, label, onClick, style }: any) => (
    <button type="button" onClick={onClick} className="p-3 text-zinc-500 hover:text-white hover:bg-white/10 transition" title={label} aria-label={label} style={style}>
        <Icon className="w-[26px] h-[26px]" />
    </button>
);
