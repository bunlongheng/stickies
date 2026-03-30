"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { usePageMeta } from "@/lib/usePageMeta";
import dynamic from "next/dynamic";
import LZString from "lz-string";
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor").then(m => m.RichTextEditor), { ssr: false });
const MermaidRenderer = dynamic(() => import("@/components/MermaidRenderer").then(m => m.MermaidRenderer), { ssr: false });
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
import EllipsisVerticalIcon from "@heroicons/react/24/outline/EllipsisVerticalIcon";
import ArrowUturnLeftIcon from "@heroicons/react/24/outline/ArrowUturnLeftIcon";
import ArrowUturnRightIcon from "@heroicons/react/24/outline/ArrowUturnRightIcon";
import ArrowsPointingOutIcon from "@heroicons/react/24/outline/ArrowsPointingOutIcon";
import ArrowsPointingInIcon from "@heroicons/react/24/outline/ArrowsPointingInIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import ChevronDownIcon from "@heroicons/react/24/outline/ChevronDownIcon";
import ChevronUpIcon from "@heroicons/react/24/outline/ChevronUpIcon";
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
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";
import ArrowTopRightOnSquareIcon from "@heroicons/react/24/outline/ArrowTopRightOnSquareIcon";
import ComputerDesktopIcon from "@heroicons/react/24/outline/ComputerDesktopIcon";
import SparklesIcon from "@heroicons/react/24/outline/SparklesIcon";
import CpuChipIcon from "@heroicons/react/24/outline/CpuChipIcon";
import PencilSquareIcon from "@heroicons/react/24/outline/PencilSquareIcon";
import StarIcon from "@heroicons/react/24/outline/StarIcon";
import BriefcaseIcon from "@heroicons/react/24/outline/BriefcaseIcon";
import GlobeAltIcon from "@heroicons/react/24/outline/GlobeAltIcon";
import MusicalNoteIcon from "@heroicons/react/24/outline/MusicalNoteIcon";
import CameraIcon from "@heroicons/react/24/outline/CameraIcon";
import ChatBubbleLeftRightIcon from "@heroicons/react/24/outline/ChatBubbleLeftRightIcon";
import BellIcon from "@heroicons/react/24/outline/BellIcon";
import MapPinIcon from "@heroicons/react/24/outline/MapPinIcon";
import TagIcon from "@heroicons/react/24/outline/TagIcon";
import UserGroupIcon from "@heroicons/react/24/outline/UserGroupIcon";
import HomeIcon from "@heroicons/react/24/outline/HomeIcon";
import SunIcon from "@heroicons/react/24/outline/SunIcon";
import MoonIcon from "@heroicons/react/24/outline/MoonIcon";
import CloudIcon from "@heroicons/react/24/outline/CloudIcon";
import FireIcon from "@heroicons/react/24/outline/FireIcon";
import FlagIcon from "@heroicons/react/24/outline/FlagIcon";
import TrophyIcon from "@heroicons/react/24/outline/TrophyIcon";
import RocketLaunchIcon from "@heroicons/react/24/outline/RocketLaunchIcon";
import KeyIcon from "@heroicons/react/24/outline/KeyIcon";
import FilmIcon from "@heroicons/react/24/outline/FilmIcon";
import WrenchIcon from "@heroicons/react/24/outline/WrenchIcon";
import BookOpenIcon from "@heroicons/react/24/outline/BookOpenIcon";
import ChartBarIcon from "@heroicons/react/24/outline/ChartBarIcon";
import BuildingOfficeIcon from "@heroicons/react/24/outline/BuildingOfficeIcon";
import BanknotesIcon from "@heroicons/react/24/outline/BanknotesIcon";
import UserIcon from "@heroicons/react/24/outline/UserIcon";
import GlobeAmericasIcon from "@heroicons/react/24/outline/GlobeAmericasIcon";
import ArchiveBoxIcon from "@heroicons/react/24/outline/ArchiveBoxIcon";
import ChartPieIcon from "@heroicons/react/24/outline/ChartPieIcon";
import TableCellsIcon from "@heroicons/react/24/outline/TableCellsIcon";
import PhotoIcon from "@heroicons/react/24/outline/PhotoIcon";
import LinkIcon from "@heroicons/react/24/outline/LinkIcon";
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

// Cache the JWT in memory so getSession() isn't called on every fetch.
// Cleared automatically when the token is about to expire.
let _tokenCache: { value: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string> {
    // Return cached token if it's still valid for >60 seconds
    if (_tokenCache && Date.now() < _tokenCache.expiresAt) return _tokenCache.value;

    // Always use the Supabase session JWT — never send the static API key from the browser.
    // The static key is for external callers (CLI, Claude) only; sending it from the browser
    // would grant every visitor owner-level access to all notes.
    // Use the SSR-aware browser client — reads session from cookies (set by @supabase/ssr)
    const sb = createBrowserClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { _tokenCache = null; return ""; }
    // Proactively refresh if the token expires within 60 seconds
    const expiresAt = (session as any).expires_at as number | undefined;
    let token = session.access_token;
    if (expiresAt !== undefined && expiresAt - Math.floor(Date.now() / 1000) < 60) {
        const { data } = await sb.auth.refreshSession();
        token = data.session?.access_token ?? "";
    }
    // Cache for 50 seconds (well within the typical 3600s JWT lifetime)
    _tokenCache = { value: token, expiresAt: Date.now() + 50_000 };
    return token;
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
        const q = getSupabase().from("stickies").select("id");
        if (filter.folder_name !== undefined) void (q as any).eq("folder_name", filter.folder_name);
        if (filter.parent_folder_name !== undefined) void (q as any).eq("parent_folder_name", filter.parent_folder_name);
        const { data } = await (filter.folder_name !== undefined
            ? getSupabase().from("stickies").select("id").eq("folder_name", filter.folder_name!)
            : getSupabase().from("stickies").select("id").eq("parent_folder_name", filter.parent_folder_name!));
        if (!data || data.length === 0) return;
        await notesApi.bulkUpdate(data.map((r: any) => ({ id: String(r.id), ...fields })));
    },
};

const palette12 = ["#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00", "#D4E157", "#34C759", "#00C7BE", "#32ADE6", "#007AFF", "#5856D6", "#AF52DE", "#FF2D55"];
const colorPickerPalette = [...palette12, "#8E8E93", "#FFFFFF"];

function isLightColor(hex: string): boolean {
    const h = hex.replace("#", "");
    if (h.length < 6) return false;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

/** True on phones (no physical keyboard expected) — skip attaching keydown shortcuts */
const IS_PHONE = typeof navigator !== "undefined" && navigator.maxTouchPoints > 1 && typeof screen !== "undefined" && Math.min(screen.width, screen.height) < 768;

/** Module-level hex→RGB cache — avoids re-parsing the same 12 colors on every mouse event */
const _hexRgbCache: Record<string, [number, number, number]> = {};
function hexToRgb(hex: string): [number, number, number] {
    if (_hexRgbCache[hex]) return _hexRgbCache[hex];
    const h = hex.replace("#", "").padEnd(6, "0");
    return _hexRgbCache[hex] = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

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

const MERMAID_KEYWORDS = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|c4container|c4component|c4dynamic|c4deployment)\b/im;

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    text:       { label: "TXT",         color: "#71717a" },
    rich:       { label: "RTF",         color: "#9ca3af" },
    javascript: { label: "Javascript",  color: "#f97316" },
    typescript: { label: "Typescript",  color: "#3b82f6" },
    python:     { label: "Python",      color: "#eab308" },
    css:        { label: "CSS",         color: "#8b5cf6" },
    sql:        { label: "SQL",         color: "#14b8a6" },
    bash:       { label: "Bash",        color: "#22c55e" },
    markdown:   { label: "Markdown",    color: "#a78bfa" },
    html:       { label: "HTML",        color: "#f43f5e" },
    json:       { label: "JSON",        color: "#fbbf24" },
    mermaid:    { label: "Diagram",     color: "#06b6d4" },
    checklist:  { label: "Checklist",   color: "#22c55e" },
};

/** Convert TipTap JSON doc to plain text — used when entering plain mode */
function tiptapToPlainText(node: any): string {
    if (!node) return "";
    if (node.type === "text") return node.text ?? "";
    const children: any[] = node.content ?? [];
    const inner = children.map(tiptapToPlainText).join("");
    const block = ["paragraph","heading","blockquote","listItem","codeBlock","bulletList","orderedList"];
    return block.includes(node.type) ? inner + "\n" : inner;
}

/** Extract plain text from TipTap/ProseMirror JSON — returns first meaningful text */
function extractRichTextTitle(json: string): string {
    try {
        const doc = JSON.parse(json);
        // Only use the first non-empty top-level block's text
        const blocks: any[] = doc.content ?? [];
        for (const block of blocks) {
            const texts: string[] = [];
            const walk = (node: any) => {
                if (node.type === "text" && node.text) texts.push(node.text);
                if (Array.isArray(node.content)) node.content.forEach(walk);
            };
            walk(block);
            const line = texts.join("").trim().replace(/^#+\s*/, "").slice(0, 60);
            if (line) return line;
        }
        return "";
    } catch { return ""; }
}

/** Client-side fallback type detection — used only when DB type is null (legacy notes) */
function detectNoteType(content: string): string {
    const t = content.trim();
    if (!t) return "text";
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
    // Strip ```mermaid ... ``` or plain ``` ... ``` fences
    const fenced = t.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)```\s*$/im);
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

/** Strip ```mermaid or plain ``` fences + YAML frontmatter */
function cleanMermaidContent(text: string): string {
    let t = text.trim();
    // Strip ```mermaid ... ``` or plain ``` ... ``` fences
    const fenced = t.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)```\s*$/im);
    if (fenced) t = fenced[1].trim();
    return t;
}

function mermaidSubType(text: string): string {
    const t = extractMermaid(text);
    const m = t.match(/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|c4container|c4component|c4dynamic|c4deployment)\b/im);
    if (!m) return "Diagram";
    const map: Record<string, string> = {
        flowchart: "Flow", graph: "Flow", sequencediagram: "Sequence",
        classdiagram: "Class", statediagram: "State", "statediagram-v2": "State",
        erdiagram: "ER", gantt: "Gantt", pie: "Pie", gitgraph: "Git",
        mindmap: "Mindmap", timeline: "Timeline", xychart: "XY Chart",
        "xychart-beta": "XY Chart", quadrantchart: "Quadrant",
        requirementdiagram: "Requirement", zenuml: "ZenUML",
        sankey: "Sankey", "sankey-beta": "Sankey",
        block: "Block", "block-beta": "Block",
        packet: "Packet", "packet-beta": "Packet",
        kanban: "Kanban",
        architecture: "Architecture", "architecture-beta": "Architecture",
        c4container: "C4 Container", c4component: "C4 Component",
        c4dynamic: "C4 Dynamic", c4deployment: "C4 Deployment",
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
    // Anything older than today: show "Feb 9" or "Feb 9, 2023" if different year
    const sameYear = d.getFullYear() === now.getFullYear();
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(!sameYear && { year: "numeric" }) });
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
const PLAIN_MODE_KEY  = "stickies:plain-mode-notes:v1";
const DEFAULT_FOLDER_KEY = "stickies:default-folder:v1";
const LAST_FOLDER_KEY = "stickies:last-folder:v1"; // persists last active folder across sessions
const DB_CACHE_KEY = "stickies:db-cache:v1";
const COUNTS_CACHE_KEY = "stickies:counts-cache:v1";
const NOTES_CACHE_KEY = "stickies:notes-cache:v2";

// ── Notes cache helpers ───────────────────────────────────────────────────────
function getNotesCacheForFolder(folderName: string): unknown[] {
    try {
        const raw = localStorage.getItem(NOTES_CACHE_KEY);
        if (!raw) return [];
        const cache = JSON.parse(raw) as Record<string, unknown[]>;
        return Array.isArray(cache[folderName]) ? cache[folderName] : [];
    } catch { return []; }
}

function setNotesCacheForFolder(folderName: string, notes: unknown[]): void {
    try {
        const raw = localStorage.getItem(NOTES_CACHE_KEY);
        const cache = raw ? JSON.parse(raw) as Record<string, unknown[]> : {};
        cache[folderName] = notes.filter((n: any) => !n._external);
        localStorage.setItem(NOTES_CACHE_KEY, JSON.stringify(cache));
    } catch { /* quota exceeded */ }
}


/** Upsert a note into the cache for its folder (keeps cache fresh on save). */
function mergeIntoCachedNotes(folderName: string, changed: unknown[]): void {
    if (!changed.length) return;
    try {
        const existing = getNotesCacheForFolder(folderName);
        const byId = new Map(existing.map((n: any) => [String(n.id), n]));
        changed.filter((n: any) => !n._external).forEach((n: any) => byId.set(String(n.id), n));
        setNotesCacheForFolder(folderName, Array.from(byId.values()));
    } catch { /* ignore */ }
}

/** Remove a note from the cached array for a folder. */
function removeFromCachedNotes(folderName: string, noteId: string): void {
    try {
        const existing = getNotesCacheForFolder(folderName);
        setNotesCacheForFolder(folderName, existing.filter((n: any) => String(n.id) !== noteId));
    } catch { /* ignore */ }
}

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

    // Non-passive wheel & touch listeners — must be non-passive to call preventDefault on iOS
    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const ratio = e.deltaY < 0 ? 1.12 : 0.88;
            const elRect = el.getBoundingClientRect();
            const ox = e.clientX - elRect.left - elRect.width / 2;
            const oy = e.clientY - elRect.top - elRect.height / 2;
            setScale(s => {
                const next = clampScale(s * ratio);
                setPan(p => ({
                    x: ox - (ox - p.x) * (next / s),
                    y: oy - (oy - p.y) * (next / s),
                }));
                return next;
            });
        };
        const onTouchStart = (e: TouchEvent) => {
            // Don't intercept taps on buttons (e.g. header ⋮ button overlapping the canvas)
            if ((e.target as HTMLElement).closest("button, a, input")) return;
            if (e.touches.length === 1) {
                lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                dragging.current = true;
            }
            if (e.touches.length === 2) {
                dragging.current = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDist.current = Math.hypot(dx, dy);
            }
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!dragging.current && e.touches.length < 2) return;
            e.preventDefault();
            if (e.touches.length === 1 && dragging.current) {
                const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
                const dx = tx - lastMouse.current.x, dy = ty - lastMouse.current.y;
                setPan(p => ({ x: p.x + dx, y: p.y + dy }));
                lastMouse.current = { x: tx, y: ty };
            } else if (e.touches.length === 2) {
                const t0 = e.touches[0], t1 = e.touches[1];
                const dx = t0.clientX - t1.clientX, dy = t0.clientY - t1.clientY;
                const dist = Math.hypot(dx, dy);
                if (lastTouchDist.current !== null && dist > 0) {
                    const ratio = dist / lastTouchDist.current;
                    // Zoom toward pinch midpoint
                    const mx = (t0.clientX + t1.clientX) / 2;
                    const my = (t0.clientY + t1.clientY) / 2;
                    const elRect = el.getBoundingClientRect();
                    const ox = mx - elRect.left - elRect.width / 2;
                    const oy = my - elRect.top - elRect.height / 2;
                    setScale(s => {
                        const next = clampScale(s * ratio);
                        setPan(p => ({
                            x: ox - (ox - p.x) * (next / s),
                            y: oy - (oy - p.y) * (next / s),
                        }));
                        return next;
                    });
                }
                lastTouchDist.current = dist;
            }
        };
        const onTouchEnd = () => { dragging.current = false; lastTouchDist.current = null; };
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchstart", onTouchStart, { passive: false });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd);
        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
        };
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

    const ZOOM_PRESETS = [0.5, 0.75, 1, 1.5, 2];

    return (
        <div className="relative flex-1 overflow-hidden select-none" style={{ background: "#050507" }}>
            <div ref={containerRef}
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
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

// Hero icon entries for folder icon picker
// Stored as "__hero:StarIcon" in folderIcons map
const FOLDER_HERO_ICONS: { key: string; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
    { key: "StarIcon",                 label: "star",         Icon: StarIcon },
    { key: "HeartIcon",                label: "heart",        Icon: HeartIcon },
    { key: "BriefcaseIcon",            label: "briefcase",    Icon: BriefcaseIcon },
    { key: "HomeIcon",                 label: "home",         Icon: HomeIcon },
    { key: "BookOpenIcon",             label: "book",         Icon: BookOpenIcon },
    { key: "CodeBracketIcon",          label: "code",         Icon: CodeBracketIcon },
    { key: "ChartBarIcon",             label: "chart",        Icon: ChartBarIcon },
    { key: "ChartPieIcon",             label: "pie chart",    Icon: ChartPieIcon },
    { key: "RocketLaunchIcon",         label: "rocket",       Icon: RocketLaunchIcon },
    { key: "BoltIcon",                 label: "bolt",         Icon: BoltIcon },
    { key: "SparklesIcon",             label: "sparkles",     Icon: SparklesIcon },
    { key: "FireIcon",                 label: "fire",         Icon: FireIcon },
    { key: "LightBulbIcon",            label: "idea",         Icon: LightBulbIcon },
    { key: "MusicalNoteIcon",          label: "music",        Icon: MusicalNoteIcon },
    { key: "CameraIcon",               label: "camera",       Icon: CameraIcon },
    { key: "FilmIcon",                 label: "film",         Icon: FilmIcon },
    { key: "ChatBubbleLeftRightIcon",  label: "chat",         Icon: ChatBubbleLeftRightIcon },
    { key: "BellIcon",                 label: "bell",         Icon: BellIcon },
    { key: "MapPinIcon",               label: "location",     Icon: MapPinIcon },
    { key: "GlobeAltIcon",             label: "globe",        Icon: GlobeAltIcon },
    { key: "GlobeAmericasIcon",        label: "world",        Icon: GlobeAmericasIcon },
    { key: "TagIcon",                  label: "tag",          Icon: TagIcon },
    { key: "UserGroupIcon",            label: "team",         Icon: UserGroupIcon },
    { key: "UserIcon",                 label: "person",       Icon: UserIcon },
    { key: "FlagIcon",                 label: "flag",         Icon: FlagIcon },
    { key: "TrophyIcon",               label: "trophy",       Icon: TrophyIcon },
    { key: "KeyIcon",                  label: "key",          Icon: KeyIcon },
    { key: "WrenchIcon",               label: "tools",        Icon: WrenchIcon },
    { key: "BanknotesIcon",            label: "money",        Icon: BanknotesIcon },
    { key: "BuildingOfficeIcon",       label: "office",       Icon: BuildingOfficeIcon },
    { key: "ArchiveBoxIcon",           label: "archive",      Icon: ArchiveBoxIcon },
    { key: "CalendarDaysIcon",         label: "calendar",     Icon: CalendarDaysIcon },
    { key: "ClipboardDocumentListIcon",label: "clipboard",    Icon: ClipboardDocumentListIcon },
    { key: "PuzzlePieceIcon",          label: "puzzle",       Icon: PuzzlePieceIcon },
    { key: "ComputerDesktopIcon",      label: "desktop",      Icon: ComputerDesktopIcon },
    { key: "DevicePhoneMobileIcon",    label: "mobile",       Icon: DevicePhoneMobileIcon },
    { key: "CloudIcon",                label: "cloud",        Icon: CloudIcon },
    { key: "SunIcon",                  label: "sun",          Icon: SunIcon },
    { key: "MoonIcon",                 label: "moon",         Icon: MoonIcon },
    { key: "CubeTransparentIcon",      label: "cube",         Icon: CubeTransparentIcon },
    { key: "RectangleStackIcon",       label: "stack",        Icon: RectangleStackIcon },
    { key: "FolderIcon",               label: "folder",       Icon: FolderIcon },
    { key: "SwatchIcon",               label: "palette",      Icon: SwatchIcon },
    { key: "ShareIcon",                label: "share",        Icon: ShareIcon },
    { key: "CpuChipIcon",              label: "robot",        Icon: CpuChipIcon },
    { key: "FaceSmileIcon",            label: "smile",        Icon: FaceSmileIcon },
    { key: "EyeIcon",                  label: "eye",          Icon: EyeIcon },
    { key: "PhotoIcon",                label: "photo",        Icon: PhotoIcon },
    { key: "LinkIcon",                 label: "link",         Icon: LinkIcon },
    { key: "TableCellsIcon",           label: "table",        Icon: TableCellsIcon },
    { key: "QrCodeIcon",               label: "qr code",      Icon: QrCodeIcon },
];
const HERO_ICON_MAP = Object.fromEntries(FOLDER_HERO_ICONS.map(e => [e.key, e.Icon]));

// Render a folder icon value — hero icons stored as "__hero:IconName", images as base64/URL, emojis as-is
function FolderIconDisplay({ value, folderName, className = "w-4 h-4" }: { value: string; folderName: string; className?: string }) {
    if (value.startsWith("__hero:")) {
        const key = value.slice(7);
        const Ic = HERO_ICON_MAP[key];
        return Ic ? <Ic className={className} /> : <span>{folderName.charAt(0).toUpperCase()}</span>;
    }
    if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) {
        return <img src={value} alt={folderName} className={className} style={{ objectFit: "contain", borderRadius: 2, filter: "brightness(0) invert(1)" }} />;
    }
    if (value) return <span>{value}</span>;
    return <span>{folderName.charAt(0).toUpperCase()}</span>;
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
let _sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
    if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
        _sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_sharedAudioCtx.state === "suspended") _sharedAudioCtx.resume();
    return _sharedAudioCtx;
}
function playSound(type: SoundType) {
    try {
        if (type === "hover") {
            const now = Date.now();
            if (now - _lastHoverSoundAt < 80) return;
            _lastHoverSoundAt = now;
        }
        const ctx = getAudioCtx();
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
        // Cyberpunk / futuristic sound design — sawtooth & square oscillators, high-freq sweeps
        const sweep = (f0: number, f1: number, delay: number, vol: number, dur: number, oscType: OscillatorType = "sawtooth") => {
            const osc = ctx.createOscillator(); const g = ctx.createGain();
            osc.connect(g); g.connect(ctx.destination);
            osc.type = oscType;
            osc.frequency.setValueAtTime(f0, now + delay);
            osc.frequency.exponentialRampToValueAtTime(f1, now + delay + dur);
            g.gain.setValueAtTime(0, now + delay);
            g.gain.linearRampToValueAtTime(vol, now + delay + 0.008);
            g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.start(now + delay); osc.stop(now + delay + dur + 0.02);
        };
        if (type === "hover") {
            // ultra-short digital tick
            tone(2400, 0, 0.018, 0.030, "square");
        } else if (type === "click") {
            // laser "pew" — sine sweep 1600→140Hz + harmonic overtone
            sweep(1600, 140, 0,     0.18, 0.16, "sine");
            sweep(3200, 280, 0,     0.06, 0.12, "sine"); // octave harmonic, quieter
            sweep(1800, 160, 0.008, 0.05, 0.13, "triangle"); // slight body
        } else if (type === "navigate") {
            // system dive: two-step ascending sweep
            sweep(600, 1400, 0,    0.055, 0.09, "sawtooth");
            sweep(900, 2000, 0.07, 0.04,  0.09, "square");
        } else if (type === "toast") {
            // success sequence: rising tri-tone cyber chime
            tone(1047, 0,    0.065, 0.12, "square");  // C6
            tone(1319, 0.08, 0.055, 0.13, "square");  // E6
            tone(1568, 0.16, 0.045, 0.15, "sawtooth"); // G6
        } else if (type === "toast-error") {
            // system alert: descending sawtooth glitch
            sweep(1200, 220, 0,    0.07, 0.18, "sawtooth");
            sweep(900,  180, 0.06, 0.05, 0.15, "square");
        } else if (type === "create") {
            // spawn: ascending digital burst
            sweep(400, 1600, 0,    0.08, 0.12, "sawtooth");
            sweep(600, 2200, 0.05, 0.055, 0.10, "square");
        } else if (type === "add") {
            // quick blip
            sweep(1200, 1800, 0, 0.065, 0.07, "square");
        } else if (type === "check") {
            // confirm: two rising square tones
            tone(1319, 0,    0.07, 0.10, "square"); // E6
            tone(1760, 0.07, 0.06, 0.12, "square"); // A6
        } else if (type === "uncheck") {
            // undo: two descending square tones
            tone(1760, 0,    0.065, 0.10, "square"); // A6
            tone(1047, 0.07, 0.05,  0.12, "square"); // C6
        } else if (type === "delete") {
            // disintegrate: fast saw sweep crunch
            sweep(1800, 80, 0,    0.09, 0.20, "sawtooth");
            sweep(1200, 60, 0.04, 0.06, 0.18, "square");
        } else if (type === "move") {
            // warp: smooth rising saw whoosh
            sweep(300, 1800, 0, 0.055, 0.14, "sawtooth");
            tone(1400, 0.10, 0.03, 0.07, "square");
        }
    } catch { /* silently ignore — sound is non-critical */ }
}

const _CODE_TYPES = new Set(["mermaid","javascript","typescript","python","css","sql","bash","html","json","markdown"]);

export default function NotesMaster() {
    const [mounted, setMounted] = useState(false);
    const [gridCols, setGridCols] = useState(3);
    const [isUrlChecking, setIsUrlChecking] = useState(true);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [dbData, setDbData] = useState<any[]>([]);
    const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
    const [folderCountsById, setFolderCountsById] = useState<Record<string, number>>({});
    const [folderNotesLoading, setFolderNotesLoading] = useState(false);
    const folderNotesLoadingRef = useRef(false);
    const syncHadTokenRef = useRef(false); // true after first sync() that got a valid auth token
    const folderPaginationRef = useRef<Map<string, { offset: number; total: number }>>(new Map());
    const notesEndRef = useRef<HTMLDivElement>(null);
    const [folderStack, setFolderStack] = useState<{ id: string; name: string; color: string }[]>([]);
    const activeFolder = folderStack.at(-1)?.name ?? null;
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    const [toastIsError, setToastIsError] = useState(false);
    const [toastRainbow, setToastRainbow] = useState(false);
    const [toastKey, setToastKey] = useState(0);
    const [showWelcomeBack, setShowWelcomeBack] = useState(false);
    const [undoDeleteTask, setUndoDeleteTask] = useState<{ text: string; lineIdx: number } | null>(null);
    const taskContentHistory = useRef<string[]>([]);
    const pendingDeleteRef = useRef<{ note: any; title: string; content: string; noteColor: string; targetFolder: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
    useEffect(() => { if (!undoDeleteTask) return; const t = setTimeout(() => setUndoDeleteTask(null), 5000); return () => clearTimeout(t); }, [undoDeleteTask]);
    const [flashColor, setFlashColor] = useState("#ffffff");
    const [flashNote, setFlashNote] = useState<any | null>(null);
    const [incomingNoteIds, setIncomingNoteIds] = useState<Set<string>>(new Set());
    const [removingNoteIds, setRemovingNoteIds] = useState<Set<string>>(new Set());

    const [, startContentTransition] = useTransition();
    const [editorOpen, setEditorOpen] = useState(false);
    const [noteContentLoading, setNoteContentLoading] = useState(false);
    const [editingNote, setEditingNote] = useState<any | null>(null);
    const [showFloatCopy, setShowFloatCopy] = useState(true);
    const [title, setTitle] = useState("");
    // Sync uncontrolled title inputs when title state changes (note load / external setTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        titleRaw.current = title;
        if (titleInputRef.current) titleInputRef.current.value = title;
        if (titleInputMobileRef.current) titleInputMobileRef.current.value = title;
    }, [title]);
    const [content, setContent] = useState("");
    // Always-current content ref — used in saveNote on blur where React state may lag debounce
    const latestContentRef = useRef("");
    const richEditorSetContentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [pendingRestoreNoteId, setPendingRestoreNoteId] = useState<string | null>(null);
    const [pendingFolderQuery, setPendingFolderQuery] = useState<string | null>(null);
    const [pendingNoteQuery, setPendingNoteQuery] = useState<string | null>(null);
    const [pendingNoteIdQuery, setPendingNoteIdQuery] = useState<string | null>(null);
    const [hydratedViewState, setHydratedViewState] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showSwitcher, setShowSwitcher] = useState(false);
    const [folderSearchQuery, setFolderSearchQuery] = useState("");
    const folderSearchCursorRef = useRef(0);
    const folderSearchListRef = useRef<HTMLDivElement | null>(null);
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
    const [qrType, setQrType] = useState<"link" | "data" | "burn">("link");
    const [qrLinkCopied, setQrLinkCopied] = useState(false);
    const [sharePickerOpen, setSharePickerOpen] = useState(false);
    const [publicLinkCopied, setPublicLinkCopied] = useState(false);
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
    const [apiLog, setApiLog] = useState<Array<{ method: string; path: string; ip: string; ua: string; auth: string; at: string; summary?: string }>>([]);
    const [showApiLog, setShowApiLog] = useState(false);
    const [automationsList, setAutomationsList] = useState<Array<{ id: string; name: string; trigger_type: string; condition: Record<string, string>; action_type: string; action_config: Record<string, string>; active: boolean; last_fired: string | null }>>([]);
    const [selectedAutomation, setSelectedAutomation] = useState<{ id: string; name: string } | null>(null);
    const [automationLogs, setAutomationLogs] = useState<Array<{ id: string; triggered_at: string; result: string; detail: string | null; via: string | null }>>([]);
    const [automationLogsLoading, setAutomationLogsLoading] = useState(false);
    useEffect(() => { if (!sharePickerOpen) (document.activeElement as HTMLElement)?.blur(); }, [sharePickerOpen]);
    const [showNoteActions, setShowNoteActions] = useState(false);
    const [sidebarTooltip, setSidebarTooltip] = useState<{ name: string; color: string; y: number } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ type: "note"; noteId: string | null; noteName: string; noteColor?: string } | { type: "folder"; folderName: string } | null>(null);
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
    const [plainModeNotes, setPlainModeNotes] = useState<Set<string>>(new Set());
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
    const noteEverDirtyRef = useRef(false);
    const prevContentForHashRef = useRef("");
    const lastCelebratedTagRef = useRef<string | null>(null);
    const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [hashSymbolFlash, setHashSymbolFlash] = useState(false);
    const graphContainerRef = useRef<HTMLDivElement | null>(null);
    const graphNodesRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);
    const graphAnimRef = useRef<number | null>(null);
    const [graphTick, setGraphTick] = useState(0);

    const [showFolderActions, setShowFolderActions] = useState(false);
    const [isGlobalSettings, setIsGlobalSettings] = useState(false);
    const [lightMode, setLightMode] = useState<"off" | "flash" | "ambient">("flash");
    const [isEditingFolderTitle, setIsEditingFolderTitle] = useState(false);
    const [editingFolderTitleValue, setEditingFolderTitleValue] = useState("");
    const [showFolderColorPicker, setShowFolderColorPicker] = useState(false);
    const [showFolderIconPicker, setShowFolderIconPicker] = useState(false);
    const [iconPickerTab, setIconPickerTab] = useState<"icons" | "emoji">("icons");
    const [iconPickerSearch, setIconPickerSearch] = useState("");
    const [showFolderMovePicker, setShowFolderMovePicker] = useState(false);
    const [folderMoveQuery, setFolderMoveQuery] = useState("");
    const folderMoveCursorRef = useRef(0);
    const folderMoveListRef = useRef<HTMLDivElement | null>(null);
    const folderMoveSearchRef = useRef<HTMLInputElement | null>(null);

    const [quoteIndex, setQuoteIndex] = useState(0);
    const [folderFabOffset, setFolderFabOffset] = useState({ x: 0, y: 0 });
    const [isFolderFabDragging, setIsFolderFabDragging] = useState(false);
    const [pusherFlash, setPusherFlash] = useState(false);
    const [aiMode, setAiMode] = useState<{ active: boolean; message: string }>({ active: false, message: "" });
    const [botColor, setBotColor] = useState({ primary: "#7c3aed", secondary: "#a78bfa", light: "#c4b5fd" });
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const isAdmin = userEmail === "bheng.code@gmail.com";
    const [mainListMode, setMainListMode] = useState<"thumb" | "list">("thumb");
    const [defaultFolder, setDefaultFolder] = useState<string>("CLAUDE");
    const [showDefaultFolderPicker, setShowDefaultFolderPicker] = useState(false);
    const [showNotebookPicker, setShowNotebookPicker] = useState(false);
    const [notebookPickerSearch, setNotebookPickerSearch] = useState("");
    const [notebookPickerCursor, setNotebookPickerCursor] = useState(-1);
    const [navMode, setNavMode] = useState<"folders-and-files" | "files-only">("folders-and-files");
    const [kanbanMode, setKanbanMode] = useState(false);
    const [appTheme, setAppTheme] = useState<"dark" | "light" | "monokai">("dark");
    const [mermaidShowCode, setMermaidShowCode] = useState(false);
    const [codeEditMode, setCodeEditMode] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [pendingNoteType, setPendingNoteType] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showNoteTypePicker, setShowNoteTypePicker] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const colDragNoteRef = useRef<string | null>(null);
    const [colDragOver, setColDragOver] = useState<string | null>(null);
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    // glowCard converted to DOM-only (no React state) to avoid re-renders on every mousemove
    const [imgPopover, setImgPopover] = useState<{ src: string; alt: string; x: number; y: number } | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [showCmdK, setShowCmdK] = useState(false);
    const [cmdKQuery, setCmdKQuery] = useState("");
    const [cmdKCursor, setCmdKCursor] = useState(0);
    const [cmdKGlobal, setCmdKGlobal] = useState(false);
    const [cmdKInFile, setCmdKInFile] = useState(false);
    const cmdKInputRef = useRef<HTMLInputElement | null>(null);
    const [showFindBar, setShowFindBar] = useState(false);
    const [findQuery, setFindQuery] = useState("");
    const [findCursor, setFindCursor] = useState(0);
    const [richSearchCount, setRichSearchCount] = useState(0);
    const findInputRef = useRef<HTMLInputElement | null>(null);
    const showFindBarRef = useRef(false);
    const findQueryRef = useRef("");
    const findMatchCountRef = useRef(0);
    const [showCmdB, setShowCmdB] = useState(false);
    const [cmdBQuery, setCmdBQuery] = useState("");
    const [cmdBCursor, setCmdBCursor] = useState(0);
    const cmdBInputRef = useRef<HTMLInputElement | null>(null);
    const [bookmarksData, setBookmarksData] = useState<any[]>([]);
    const [images, setImages] = useState<Array<{ url: string; name: string; type: string }>>([]);
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
    const openingNoteIdRef = useRef<string | null>(null); // tracks most-recent openNote call; stale fetches are discarded
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mainScrollRef = useRef<HTMLElement | null>(null);
    const editorTextRef = useRef<HTMLTextAreaElement | null>(null);
    const tower3dRef = useRef<HTMLDivElement | null>(null);
    const tower3dDrag = useRef({ active: false, startX: 0, startY: 0, rotX: 12, rotY: -28 });
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const titleInputMobileRef = useRef<HTMLInputElement | null>(null);
    const titleRaw = useRef(""); // tracks title input value without triggering re-renders
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

    // --- LOAD ALL NOTES (for "All Notes" view) ---
    const loadAllNotes = async () => {
        if (folderNotesLoadingRef.current) return;
        folderNotesLoadingRef.current = true;
        setFolderNotesLoading(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(`/api/stickies`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return;
            const { notes = [] } = await res.json();
            setDbData((prev) => {
                const folders = prev.filter((r: any) => r.is_folder);
                const noteMap = new Map(notes.map((n: any) => [String(n.id), n]));
                // Keep optimistic notes, merge fetched notes
                const kept = prev.filter((r: any) => !r.is_folder && (r._optimistic || !noteMap.has(String(r.id))));
                return [...folders, ...kept, ...notes];
            });
        } finally {
            folderNotesLoadingRef.current = false;
            setFolderNotesLoading(false);
        }
    };

    // --- PAGINATED FOLDER NOTES (with delta sync) ---
    const loadFolderNotes = async (folderName: string, append = false) => {
        if (folderNotesLoadingRef.current) return;
        const existing = folderPaginationRef.current.get(folderName);
        const MAX_NOTES = 100;
        if (append && existing && (existing.offset >= existing.total || existing.offset >= MAX_NOTES)) return;
        const offset = append ? (existing?.offset ?? 0) : 0;
        const limit = append ? 80 : 20;

        // Paint cached notes instantly so UI is never blank
        if (!append && offset === 0) {
            const cached = getNotesCacheForFolder(folderName);
            if (cached.length > 0) {
                setDbData((prev) => {
                    const without = prev.filter((r: any) => r.is_folder || r.folder_name !== folderName || r._optimistic);
                    return [...without, ...cached];
                });
            }
        }

        folderNotesLoadingRef.current = true;
        setFolderNotesLoading(true);
        try {
            const token = await getAuthToken();
            const res = await fetch(
                `/api/stickies?folder=${encodeURIComponent(folderName)}&limit=${limit}&offset=${offset}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) return;
            const { notes = [], total = 0 } = await res.json();
            folderPaginationRef.current.set(folderName, { offset: offset + notes.length, total });

            setDbData((prev) => {
                if (append) {
                    const seen = new Set(prev.map((r: any) => String(r.id)));
                    return [...prev, ...notes.filter((n: any) => !seen.has(String(n.id)))];
                }
                const without = prev.filter((r: any) => r.is_folder || r.folder_name !== folderName || r._optimistic);
                return [...without, ...notes];
            });

            // Update cache so next visit paints instantly
            if (!append && offset === 0) {
                setNotesCacheForFolder(folderName, notes);
            }
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
            let token = await getAuthToken();
            // If no session yet (OAuth redirect race), wait briefly and retry once
            if (!token) {
                await new Promise(r => setTimeout(r, 800));
                _tokenCache = null;
                token = await getAuthToken();
            }
            syncHadTokenRef.current = !!token;
            const [foldersRes, iconsResult, integrationsResult, countsResult] = await Promise.all([
                fetch("/api/stickies?folders=1", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : { folders: [] }).catch(() => ({ folders: [] })),
                fetch("/api/stickies/folder-icon", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : { icons: {} }).catch(() => ({ icons: {} })),
                fetch("/api/stickies/integrations", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : []).catch(() => []),
                fetch("/api/stickies?counts=1", {
                    headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.ok ? r.json() : { counts: {} }).catch(() => ({ counts: {} })),
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
            // Persist folders + counts cache for instant next load
            try {
                localStorage.setItem(DB_CACHE_KEY, JSON.stringify(folderItems));
                localStorage.setItem(COUNTS_CACHE_KEY, JSON.stringify({ counts: freshCounts, countsByFolderId: freshCountsById }));
            } catch { /* quota exceeded — skip */ }
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

    // Load first 15 notes when entering a folder; clear on exit
    useEffect(() => {
        if (activeFolder) {
            folderPaginationRef.current.delete(activeFolder);
            void loadFolderNotes(activeFolder, false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFolder]);

    // Infinite scroll — load 100 more when sentinel comes into view
    useEffect(() => {
        const el = notesEndRef.current;
        if (!el || !activeFolder) return;
        const obs = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting || folderNotesLoadingRef.current) return;
            const pagination = folderPaginationRef.current.get(activeFolder);
            if (pagination && pagination.offset < pagination.total && pagination.offset < 100) {
                void loadFolderNotes(activeFolder, true);
            }
        }, { rootMargin: "300px" });
        obs.observe(el);
        return () => obs.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFolder, folderNotesLoading]);

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
        const sb = createBrowserClient();
        sb.auth.getUser().then(({ data }) => {
            setUserEmail(data.user?.email ?? null);
        });
        // On fresh login: INITIAL_SESSION fires with null session (not yet logged in),
        // then SIGNED_IN fires when the session is established from the OAuth callback.
        // We track whether we've seen an INITIAL_SESSION first — if yes, the next
        // SIGNED_IN is a real login (not just a page-refresh with an existing session).
        let sawInitialSession = false;
        const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION") {
                // If there's no session on first load, mark that we're waiting for login
                if (!session) sawInitialSession = true;
            }
            if (event === "SIGNED_OUT") {
                // Session expired or logged out — redirect to login, preserve noteId if one is open
                const noteId = new URLSearchParams(window.location.search).get("noteId");
                const login = noteId ? `/login?next=${encodeURIComponent(`/?noteId=${noteId}`)}` : "/login";
                window.location.href = login;
                return;
            }
            if (event === "SIGNED_IN" && (sawInitialSession || !syncHadTokenRef.current)) {
                // Fresh login — sync() may have fired before session was ready, re-run it now
                sessionStorage.removeItem("stickies:session-started");
                setShowWelcomeBack(true);
                void sync().then(() => {
                    const lastFolder = localStorage.getItem(LAST_FOLDER_KEY);
                    if (lastFolder === "__all__") {
                        setActiveFolder(null);
                        void loadAllNotes();
                    } else {
                        const target = lastFolder || localStorage.getItem(DEFAULT_FOLDER_KEY) || "CLAUDE";
                        setActiveFolder(target);
                        void loadFolderNotes(target, false);
                    }
                    // auto-open effect handles opening the note once dbData is ready
                });
            }
        });
        return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);



    useEffect(() => {
        setMounted(true);
        void sync().then(() => {
            // Restore last active folder — LAST_FOLDER_KEY wins, fall back to default folder
            const lastFolder = localStorage.getItem(LAST_FOLDER_KEY);
            if (lastFolder === "__all__") {
                setActiveFolder(null);
                void loadAllNotes();
            } else {
                const target = lastFolder || localStorage.getItem(DEFAULT_FOLDER_KEY) || "CLAUDE";
                setActiveFolder(target);
                void loadFolderNotes(target, false);
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
                    setNoteColor(palette12[0]);
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
            } else if (folderParam || noteParam || noteIdParam) {
                restoredFromUrl = true;
                shouldWaitForInitialTarget = true;
                setIsUrlChecking(true);
                if (folderParam) setPendingFolderQuery(folderParam);
                if (noteParam) setPendingNoteQuery(noteParam);
                if (noteIdParam) setPendingNoteIdQuery(noteIdParam);
                // Strip URL params immediately so refresh doesn't re-apply them
                window.history.replaceState({}, "", window.location.pathname);
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
                setActiveFolder(null); // Always start at All Notes on login
                setMainListMode("list"); // list as default
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
            const rawPlain = localStorage.getItem(PLAIN_MODE_KEY);
            if (rawPlain) { const arr = JSON.parse(rawPlain); if (Array.isArray(arr)) setPlainModeNotes(new Set(arr)); }
        } catch { /* ignore */ }
        try {
            const rawMainList = localStorage.getItem(MAIN_LIST_MODE_KEY);
            if (rawMainList) {
                const v = rawMainList === "true" ? "list" : rawMainList === "false" ? "thumb" : rawMainList;
                if (v === "list" || v === "thumb") setMainListMode(v as any);
            }
        } catch { /* ignore */ }
        try {
            const rawNavMode = localStorage.getItem(NAV_MODE_KEY);
            if (rawNavMode === "files-only" || rawNavMode === "folders-and-files") setNavMode(rawNavMode);
        } catch { /* ignore */ }
        try {
            const rawKanban = localStorage.getItem(KANBAN_MODE_KEY);
            if (rawKanban) setKanbanMode(rawKanban === "true");
            const rawEdit = localStorage.getItem(EDIT_MODE_KEY);
            if (rawEdit !== null) {
                setEditMode(rawEdit === "true");
            } else if (window.matchMedia("(min-width: 1024px)").matches) {
                // First time on desktop (no saved preference): default to split view
                setEditMode(true);
            }
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
            if (viewParam === "list") { setMainListMode("list"); setKanbanMode(false); }
            else if (viewParam === "thumb") { setMainListMode("thumb"); setKanbanMode(false); }
            else if (viewParam === "kanban") { setMainListMode("thumb"); setKanbanMode(true); }
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

    // Sync folder colors from DB — derive from first note per folder, DB wins over localStorage
    useEffect(() => {
        if (!dbData || dbData.length === 0) return;
        const fromDb: Record<string, string> = {};
        dbData.forEach((row: any) => {
            if (!row.is_folder && row.folder_name && row.folder_color && !fromDb[row.folder_name]) {
                fromDb[row.folder_name] = row.folder_color;
            }
        });
        if (Object.keys(fromDb).length > 0) {
            setFolderColors((prev) => ({ ...fromDb, ...prev })); // localStorage overrides DB (user's explicit choice)
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
            localStorage.setItem(PLAIN_MODE_KEY, JSON.stringify([...plainModeNotes]));
        } catch { /* ignore */ }
    }, [plainModeNotes]);

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
        try { localStorage.setItem(LAST_FOLDER_KEY, activeFolder ?? "__all__"); } catch { /* ignore */ }
    }, [activeFolder]);

    useEffect(() => {
        try { localStorage.setItem(EDIT_MODE_KEY, String(editMode)); } catch { /* ignore */ }
    }, [editMode]);

    // Always open mermaid notes in code view first; reset code edit mode on note switch
    useEffect(() => {
        if (editorOpen && mermaidMode) setMermaidShowCode(true);
        setCodeEditMode(false);
    }, [editorOpen, editingNote?.id]);

    // Float copy: show on note open, hide after 10s of editing
    useEffect(() => {
        if (!editorOpen || !editingNote?.id) return;
        setShowFloatCopy(true);
        setShowFindBar(false);
        const t = setTimeout(() => setShowFloatCopy(false), 10000);
        return () => clearTimeout(t);
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
            // Escape → exit fullscreen
            if (e.key === "Escape") { setIsFullscreen(false); return; }
            // Cmd+Z → undo note deletion
            if (mod && e.key === "z" && pendingDeleteRef.current) {
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
            if (!mod) return;
            if (e.key === "k") {
                e.preventDefault();
                setCmdKGlobal(true); setCmdKInFile(false);
                setShowCmdK(v => { if (!v) { setCmdKQuery(""); setCmdKCursor(0); } return !v; });
            } else if (e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setCmdKGlobal(true); setCmdKInFile(false);
                setShowCmdK(v => { if (!v) { setCmdKQuery(""); setCmdKCursor(0); } return true; });
            } else if (!e.shiftKey && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setShowFindBar(true);
                setFindQuery("");
                setFindCursor(0);
                setTimeout(() => findInputRef.current?.focus(), 30);
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
            } else if (e.key === "b") {
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
            // Write-through: keep notes cache in sync with real-time creates
            if (note.folder_name) mergeIntoCachedNotes(note.folder_name, [note]);
            // Live-update folder tile count badge
            if (!note.is_folder && note.folder_name) {
                setFolderCounts((prev) => {
                    const next = { ...prev, [note.folder_name]: (prev[note.folder_name] || 0) + 1 };
                    try {
                        const cached = localStorage.getItem(COUNTS_CACHE_KEY);
                        const parsed = cached ? JSON.parse(cached) : {};
                        localStorage.setItem(COUNTS_CACHE_KEY, JSON.stringify({ ...parsed, counts: next }));
                    } catch { /* ignore */ }
                    return next;
                });
                if (note.folder_id) {
                    setFolderCountsById((prev) => ({ ...prev, [String(note.folder_id)]: (prev[String(note.folder_id)] || 0) + 1 }));
                }
            }
            const color = note.folder_color || "#34C759";
            showToast(`+ ${note.title || "New note"}`, color);
            flashQueueRef.current.push({ note, color });
            processFlashQueue();

            // 🔌 Integration engine — fire matching triggers
            fireIntegrations("note_created", note);
        });

        channel.bind("note-updated", (note: any) => {
            if (!note?.id) return;
            if (pendingDeleteRef.current && String(pendingDeleteRef.current.note.id) === String(note.id)) return;
            const lastWrite = localWriteRef.current.get(String(note.id));
            if (lastWrite && Date.now() - lastWrite < 3000) return;
            setDbData((prev) => prev.map((r) => String(r.id) === String(note.id) ? { ...r, ...note } : r));
            // Write-through: keep notes cache in sync with real-time updates
            if (note.folder_name) mergeIntoCachedNotes(note.folder_name, [note]);
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

        channel.bind("api-request", (data: any) => {
            if (!data?.at) return;
            // Only show for external callers (AI/scripts), not the owner's own browser
            if (data.auth !== "external" || data.method !== "POST") return;
            setApiLog((prev) => [data, ...prev].slice(0, 50));
        });

        return () => { channel.unbind_all(); pusher.unsubscribe("stickies"); pusher.disconnect(); };
    }, [mounted]);

    // Supabase Realtime — DB-level so every session sees every write
    // regardless of API path (batch, curl, external tools, etc.)
    useEffect(() => {
        if (!mounted) return;
        const client = getSupabase();
        const rt = client
            .channel("notes-realtime")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "stickies" }, (payload: any) => {
                const note = { ...payload.new, updated_at: payload.new?.updated_at || new Date().toISOString() };
                if (!note?.id) return;
                // Skip own inserts — we already have the optimistic note in the list
                const lastWrite = localWriteRef.current.get(String(note.id));
                if (lastWrite && Date.now() - lastWrite < 5000) return;
                setDbData((prev) => {
                    if (prev.some((r) => String(r.id) === String(note.id))) return prev;
                    // Skip if we have a pending optimistic note in the same folder —
                    // the API response will replace it and dedup. Avoids the duplicate flash.
                    if (note.folder_name && prev.some((r) => r._optimistic && r.folder_name === note.folder_name)) return prev;
                    return [...prev, note];
                });
                const color = note.folder_color || "#34C759";
                showToast(`+ ${note.title || "New note"}`, color);
                flashQueueRef.current.push({ note, color });
                // Blink the list item twice so user knows it just came in live
                const nid = String(note.id);
                setIncomingNoteIds((prev) => new Set([...prev, nid]));
                setTimeout(() => setIncomingNoteIds((prev) => { const s = new Set(prev); s.delete(nid); return s; }), 1400);
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "stickies" }, (payload: any) => {
                const note = payload.new;
                if (!note?.id) return;
                if (pendingDeleteRef.current && String(pendingDeleteRef.current.note.id) === String(note.id)) return;
                const lastWrite = localWriteRef.current.get(String(note.id));
                if (lastWrite && Date.now() - lastWrite < 3000) return;
                setDbData((prev) => prev.map((r) => String(r.id) === String(note.id) ? { ...r, ...note } : r));
                if (note.folder_name) mergeIntoCachedNotes(note.folder_name, [note]);
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "stickies" }, (payload: any) => {
                const id = payload.old?.id;
                const folderName = payload.old?.folder_name;
                if (id) {
                    const nid = String(id);
                    setRemovingNoteIds((prev) => new Set([...prev, nid]));
                    setTimeout(() => {
                        setDbData((prev) => prev.filter((r) => String(r.id) !== nid));
                        setRemovingNoteIds((prev) => { const s = new Set(prev); s.delete(nid); return s; });
                        if (folderName) removeFromCachedNotes(folderName, nid);
                    }, 360);
                }
            })
            .subscribe();
        return () => { client.removeChannel(rt); };
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


    // In split view, restore last active folder (including "all files") — only if no folder selected yet
    useEffect(() => {
        if (!editMode || activeFolder !== null) return;
        const lastFolder = localStorage.getItem(LAST_FOLDER_KEY);
        if (lastFolder === "__all__" || lastFolder === null) return; // stay in All Notes
        setActiveFolder(lastFolder);
        void loadFolderNotes(lastFolder, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode]);

    // In split view, seed notes for the active folder if none are loaded yet
    useEffect(() => {
        if (!editMode || !isDataLoaded || pendingRestoreNoteId) return;
        if (folderNotesLoading) return;
        const target = activeFolder || defaultFolder;
        const hasFolderNotes = dbData.some((n: any) => !n.is_folder &&
            (activeFolder ? n.folder_name === activeFolder : true));
        if (!hasFolderNotes) {
            void loadFolderNotes(target, false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode, isDataLoaded, activeFolder, pendingRestoreNoteId]);

    // Auto-open in split view: open most recent note (with full content fetch)
    useEffect(() => {
        if (!editMode || !isDataLoaded || pendingRestoreNoteId) return;
        if (editorOpen) return; // already open
        const topNote = dbData
            .filter((n: any) => !n.is_folder && n.folder_name !== "TRASH" && !n.trashed_at && !removingNoteIds.has(String(n.id))
                && (!activeFolder || n.folder_name === activeFolder))
            .sort((a: any, b: any) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
        if (topNote) {
            // Use openNote so content is fetched if missing (list API omits the content column)
            void openNote(topNote);
        }
        // If no notes yet — wait for loadFolderNotes to complete (effect re-runs when dbData updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode, isDataLoaded, dbData, folderNotesLoading, pendingRestoreNoteId, editorOpen, activeFolder]);

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
            setEditorOpen(true);
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

            // Folder is stored in localStorage, not the URL — keep URL clean
            next.searchParams.delete("folder");

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
        // Notes without folder_id fall back to name-match, but only counted once
        // (avoid double-counting when two folders share the same name)
        const noteCountByFolderId = new Map<string, number>();
        const notesWithoutFolderId = dbData.filter((item) => !item.is_folder && !item.folder_id);
        dbData.filter((item) => !item.is_folder && item.folder_id).forEach((item) => {
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
                    latestUpdatedAt: latestUpdatedByFolderId.get(rowId) || String(row.updated_at || ""),
                    name: folderName,
                    color: folderName === "TRASH" ? "#3a3a3a" : (folderColors[folderName] || row.folder_color || palette12[0]),
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
            .filter((folderName) => !knownFolderNames.has(folderName))
            .sort((a, b) => a.localeCompare(b))
            .map((folderName) => ({
                id: `virtual-${folderName}`,
                order: Number.MAX_SAFE_INTEGER,
                name: folderName,
                color: folderName === "TRASH" ? "#3a3a3a" : (folderColors[folderName] || firstNoteColorByFolder.get(folderName) || palette12[0]),
                count: noteCountByFolder.get(folderName) || 0,
                subfolderCount: subfolderCountByFolder.get(folderName) || 0,
                icon: folderIcons[folderName] || "",
                parent_folder_name: null as string | null,
            }));

        const all = [...foldersFromRows, ...missingFolders];
        // These three always pin to the bottom in order: INTEGRATIONS, CLAUDE, TRASH
        const SYSTEM_BOTTOM = ["INTEGRATIONS", "CLAUDE", "TRASH"];
        const bottomOrder = (name: string) => SYSTEM_BOTTOM.indexOf(name); // -1 = not pinned
        if (pendingFolderOrder) {
            const idx = new Map(pendingFolderOrder.map((name, i) => [name, i]));
            const sorted = [...all].sort((a, b) => (idx.has(a.name) ? idx.get(a.name)! : all.length) - (idx.has(b.name) ? idx.get(b.name)! : all.length));
            const regular = sorted.filter(f => bottomOrder(f.name) === -1);
            const pinned = SYSTEM_BOTTOM.map(n => sorted.find(f => f.name === n)).filter(Boolean) as typeof all;
            return [...regular, ...pinned];
        }
        const regular = all.filter(f => bottomOrder(f.name) === -1);
        const pinned = SYSTEM_BOTTOM.map(n => all.find(f => f.name === n)).filter(Boolean) as typeof all;
        return [...regular, ...pinned];
    }, [dbData, folderColors, folderIcons, pendingFolderOrder, folderCounts]);

    // Folders visible at the current navigation level (root or sub-folder)
    const currentLevelFolders = useMemo(() => {
        return folders
            .filter((f) => {
                // f.parent_folder_name is already set in the folders useMemo — no dbData.find() needed
                const parentName = f.parent_folder_name ?? null;
                if (folderStack.length === 0) return parentName === null;
                return parentName === activeFolder;
            })
            .map((f) => ({ ...f, is_folder: true as const }));
    }, [folders, folderStack, activeFolder]);

    const displayItems = useMemo(() => {
        const byUpdated = (a: any, b: any) => {
            // New optimistic notes pin to top until server confirms them
            if (a._pinnedToTop && !b._pinnedToTop) return -1;
            if (b._pinnedToTop && !a._pinnedToTop) return 1;
            return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")) ||
                String(a.title || a.name || "").localeCompare(String(b.title || b.name || ""));
        };
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
                .filter((n) => !n.is_folder && !n.trashed_at && score(n) < 9)
                .sort((a, b) => { const sd = score(a) - score(b); return sd !== 0 ? sd : byUpdated(a, b); });
        }
        if (activeFolder) {
            // Inside a folder: subfolders first, then notes
            const activeFolderId = folderStack.at(-1)?.id ?? null;
            const useUuid = activeFolderId && !activeFolderId.startsWith("virtual-");
            const notes = dbData.filter((n) => !n.is_folder && (
                (useUuid && String(n.folder_id) === activeFolderId) ||
                n.folder_name === activeFolder
            ) && (activeFolder === "TRASH" || (n.folder_name !== "TRASH" && !n.trashed_at))).sort(byUpdated);
            return [...currentLevelFolders, ...notes];
        }
        // Split view (editMode) with no active folder: show all notes sorted by updated
        if (editMode) {
            return dbData.filter((n) => !n.is_folder && n.folder_name !== "TRASH" && !n.trashed_at).sort(byUpdated);
        }
        // Root: files-only mode → all notes sorted by newest first, then alpha by folder/title
        if (navMode === "files-only") {
            return dbData
                .filter((n) => !n.is_folder && n.folder_name !== "TRASH" && !n.trashed_at)
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
    // Debounced content — heavy computations (JSON parse, tree walk, line split) only run 400ms after typing stops
    const [deferredContent, setDeferredContent] = useState(content);
    useEffect(() => {
        const t = setTimeout(() => setDeferredContent(content), 400);
        return () => clearTimeout(t);
    }, [content]);
    const richStatsChips = useMemo(() => {
        if (!deferredContent.trimStart().startsWith("{")) return [];
        let tiptap: any = null;
        try { tiptap = JSON.parse(deferredContent); } catch { return []; }
        const topNodes: any[] = tiptap?.content ?? [];
        let words = 0, images = 0, codeBlocks = 0, tables = 0;
        const walk = (nodes: any[]) => {
            for (const n of nodes) {
                if (n.type === "text" && n.text) words += n.text.trim().split(/\s+/).filter(Boolean).length;
                else if (n.type === "image") images++;
                else if (n.type === "codeBlock") codeBlocks++;
                else if (n.type === "table") tables++;
                if (n.content) walk(n.content);
            }
        };
        walk(topNodes);
        const bytes = deferredContent.length;
        const sizeStr = bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
        return [`${topNodes.length} blocks`, `${words} words`, sizeStr, images > 0 ? `${images} img` : null, codeBlocks > 0 ? `${codeBlocks} code` : null, tables > 0 ? `${tables} tbl` : null].filter(Boolean) as string[];
    }, [deferredContent]);

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

    // Split-mode pagination — show 25 at a time, load more on scroll
    const SPLIT_PAGE_SIZE = 25;
    const [splitListPage, setSplitListPage] = useState(1);
    useEffect(() => { setSplitListPage(1); }, [editMode, activeFolder]);
    const pagedDisplayItems = useMemo(() =>
        editMode ? filteredDisplayItems.slice(0, splitListPage * SPLIT_PAGE_SIZE) : filteredDisplayItems,
        [editMode, filteredDisplayItems, splitListPage]);
    const hasMoreSplitItems = editMode && filteredDisplayItems.length > splitListPage * SPLIT_PAGE_SIZE;


    // Search index — rebuilt only when data changes, not on every keystroke
    // Pre-sorted by date descending so the empty-query case is O(1) slice
    const cmdKIndex = useMemo(() =>
        dbData
            .filter((n: any) => !n.is_folder)
            .map((n: any) => ({
                _orig: n,
                t: (n.title || "").toLowerCase(),
                f: (n.folder_name || "").toLowerCase(),
                // Only index first 400 chars of content — enough for a match signal
                c: (n.content || "").slice(0, 400).toLowerCase(),
                date: String(n.updated_at || ""),
            }))
            .sort((a, b) => b.date.localeCompare(a.date)),
    [dbData]);

    // Debounced: wait 120ms after user stops typing before running search
    const [deferredCmdKQuery, setDeferredCmdKQuery] = useState(cmdKQuery);
    useEffect(() => {
        const t = setTimeout(() => setDeferredCmdKQuery(cmdKQuery), 120);
        return () => clearTimeout(t);
    }, [cmdKQuery]);

    // Pre-built folder name → db row map — avoids O(n×m) dbData.find() inside cmdKResults
    const folderLookup = useMemo(() => {
        const map = new Map<string, any>();
        dbData.forEach((r: any) => { if (r.is_folder) map.set(r.folder_name || r.name, r); });
        return map;
    }, [dbData]);

    const cmdKResults = useMemo(() => {
        // In-file mode: search lines of the current note
        if (cmdKInFile) {
            if (!deferredCmdKQuery.trim()) return [];
            const q = deferredCmdKQuery.toLowerCase();
            return (deferredContent || "").split("\n")
                .map((line, i) => ({ _isLine: true, id: `line_${i}`, lineNum: i + 1, text: line }))
                .filter(item => item.text.toLowerCase().includes(q))
                .slice(0, 100);
        }
        if (!deferredCmdKQuery.trim()) {
            // Index is pre-sorted by date — no sort needed
            return cmdKIndex.slice(0, 30).map(x => x._orig);
        }
        const q = deferredCmdKQuery.toLowerCase();
        const matchingFolders = folders
            .filter(f => {
                if (f.name.toUpperCase() === "BOOKMARKS") return false;
                const dbRow = folderLookup.get(f.name);
                if (dbRow?.parent_folder_name?.toUpperCase() === "BOOKMARKS") return false;
                return f.name.toLowerCase().includes(q);
            })
            .map(f => {
                const fn = f.name.toLowerCase();
                const score = fn === q ? 0 : fn.startsWith(q) ? 1 : 2;
                return { ...f, _isFolder: true, _score: score };
            })
            .sort((a, b) => a._score - b._score)
            .slice(0, 5);
        const scoreEntry = (e: typeof cmdKIndex[0]): number => {
            const pinned = pinnedIds.has(String(e._orig.id));
            if (e.t === q)              return 0;
            if (e.t.startsWith(q))      return 1;
            if (e.t.includes(q))        return pinned ? 2 : 3;
            if (pinned && e.c.includes(q)) return 4;
            if (e.c.includes(q))        return 5;
            return 9;
        };
        const scored = cmdKIndex
            .map(e => ({ e, s: scoreEntry(e) }))
            .filter(x => x.s < 9)
            .sort((a, b) => a.s !== b.s ? a.s - b.s : b.e.date.localeCompare(a.e.date))
            .slice(0, 30);
        return [...matchingFolders, ...scored.map(x => x.e._orig)];
    }, [cmdKIndex, deferredCmdKQuery, pinnedIds, folders, cmdKInFile, deferredContent, folderLookup]);

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
        // Use server-side counts (from ?counts=1) for accuracy — dbData only has lazily-loaded notes
        const totalFromCounts = Object.values(folderCounts).reduce((s, c) => s + c, 0);
        const noteCount = totalFromCounts > 0 ? totalFromCounts : dbData.filter(r => !r.is_folder).length;
        const bytes = dbData.reduce((acc, r) => acc + (r.title || "").length + (r.content || "").length, 0);
        const size  = bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
        return { folderCount, noteCount, size };
    }, [dbData, folderCounts]);


    const activeFolderNoteCount = useMemo(() => {
        if (!activeFolder) return 0;
        const folderMeta = folders.find((folder) => folder.name === activeFolder);
        if (folderMeta && folderMeta.count > 0) return Number(folderMeta.count);
        // Fall back to server counts before all notes are loaded
        if (folderMeta && folderMeta.count > 0) return Number(folderMeta.count);
        return folderCounts[activeFolder] ?? dbData.filter((row) => !row.is_folder && String(row.folder_name || "") === activeFolder).length;
    }, [activeFolder, folders, dbData, folderCounts, folderCountsById]);
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

    // Keep a ref so timers can check isDraftDirty without stale closures
    const isDraftDirtyRef = useRef(isDraftDirty);
    useEffect(() => { isDraftDirtyRef.current = isDraftDirty; }, [isDraftDirty]);

    // Track if the current note was ever dirty (survives auto-save clearing isDraftDirty)
    useEffect(() => { if (isDraftDirty) noteEverDirtyRef.current = true; }, [isDraftDirty]);
    // Reset dirty tracker whenever we switch to a different note (or open a new one)
    useEffect(() => { noteEverDirtyRef.current = false; prevContentForHashRef.current = content; }, [editingNote?.id]);

    // Hashtag easter egg — deferred so regex never blocks typing
    useEffect(() => {
        if (!editorOpen) { prevContentForHashRef.current = deferredContent; return; }
        const prev = prevContentForHashRef.current;
        prevContentForHashRef.current = deferredContent;
        const content = deferredContent;
        if (!prev && !content) return;
        // Note just opened — content jumped from empty/old to full note body, not a user keystroke
        if (content.length > prev.length + 10) return;

        // Detect newly typed `#`
        if (content.length === prev.length + 1) {
            let idx = -1;
            for (let i = 0; i < content.length; i++) {
                if (content[i] !== prev[i]) { idx = i; break; }
            }
            if (idx === -1) idx = content.length - 1;
            if (content[idx] === "#") {
                setHashSymbolFlash(true);
                setTimeout(() => setHashSymbolFlash(false), 1200);
            }
        }

        // Detect completed hashtag: only fires when tag is followed by a space (truly finished)
        const completedMatch = content.match(/(#[a-zA-Z0-9_-]+)(?=\s)/g);
        const prevCompleted = prev.match(/(#[a-zA-Z0-9_-]+)(?=\s)/g);
        const prevSet = new Set(prevCompleted ?? []);
        const newTag = completedMatch?.find(t => !prevSet.has(t) && t !== lastCelebratedTagRef.current);
        if (newTag) {
            lastCelebratedTagRef.current = newTag;
            if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
            showRainbowToast(newTag);
            celebrateTimerRef.current = setTimeout(() => {
                lastCelebratedTagRef.current = null;
            }, 3000);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deferredContent, editorOpen]);


    // Debounced auto-save while typing — broadcasts to other devices via Pusher
    useEffect(() => {
        if (!editorOpen || !isDraftDirty) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => { if (isDraftDirtyRef.current) void saveNote({ silent: true }); }, 2000);
        return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, title, editorOpen]);

    const saveNote = useCallback(
        async ({ silent = false, deriveTitle = false }: { silent?: boolean; deriveTitle?: boolean } = {}) => {
            // Never save a brand-new note with no meaningful content
            const isNewNoteDraft = !(editingNote?.id);
            const rawContent = latestContentRef.current || content;
            const hasNoTitle = !titleRaw.current.trim();
            const isContentEmpty = (() => {
                if (!rawContent.trim()) return true;
                // Empty TipTap doc (rich text editor opened but nothing typed)
                try {
                    const p = JSON.parse(rawContent);
                    if (p?.type === "doc") {
                        const nodes = p.content ?? [];
                        if (nodes.length === 0) return true;
                        if (nodes.length === 1 && nodes[0].type === "paragraph" && (!nodes[0].content || nodes[0].content.length === 0)) return true;
                    }
                } catch {}
                return false;
            })();
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
                const isRich = saveContent.trimStart().startsWith("{");
                if (isRich) return extractRichTextTitle(saveContent) || "Untitled";
                const firstLine = saveContent.trim().split("\n").find(l => l.trim()) || "";
                return firstLine.replace(/^#+\s*/, "").slice(0, 60).trim() || "Untitled";
            })() : (titleRaw.current.trim() || "Untitled");
            if (shouldDerive && !hasRealTitle) setTitle(resolvedTitle);

            const folderName = targetFolder || activeFolder || editingNote?.folder_name || "General";
            const activeFolderRow = folderStack.at(-1);
            const folderId = activeFolderRow && !activeFolderRow.id.startsWith("virtual-") ? activeFolderRow.id : null;
            const extractedTags = Array.from(new Set(
                (saveContent.match(/#[a-zA-Z][a-zA-Z0-9_-]+/g) ?? [])
                    .map(t => t.toLowerCase())
                    .filter(t => {
                        const val = t.slice(1); // strip #
                        // Exclude hex colors (#fff, #ffffff, #ffcc00)
                        if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(val)) return false;
                        // Exclude things that look like they're inside a URL or code (preceded by / or .)
                        return true;
                    })
            ));
            const payload: any = {
                title: resolvedTitle,
                content: saveContent,
                folder_name: folderName,
                folder_color: noteColor || folders.find((f) => f.name === folderName)?.color || editingNote?.folder_color || palette12[0],
                is_folder: false,
                type: (() => {
                    if (pendingNoteType) return pendingNoteType;
                    const saved = (editingNote as any)?.type ?? null;
                    // Never overwrite a code/mermaid type with a weaker detection
                    if (saved && CODE_TYPES.has(saved)) return saved;
                    return saved ?? detectNoteType(saveContent);
                })(),
                ...(extractedTags.length > 0 ? { tags: extractedTags } : {}),
                updated_at: new Date().toISOString(),
                ...(folderId ? { folder_id: folderId } : {}),
            };
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
            // Write-through cache immediately on optimistic update
            mergeIntoCachedNotes(payload.folder_name, [{ ...optimisticNote, ...payload }]);

            try {
                if (existingNoteId !== null) {
                    localWriteRef.current.set(String(existingNoteId), Date.now());
                    await notesApi.update(String(existingNoteId), payload);
                    // Only patch editingNote if still on the same note (user may have switched mid-save)
                    setEditingNote((prev: any) => (prev && String(prev.id) === String(existingNoteId)) ? { ...prev, ...payload } : prev);
                    mergeIntoCachedNotes(payload.folder_name, [{ id: existingNoteId, ...payload }]);
                } else {
                    // Duplicate guard: if a note with the same title already exists in the same folder,
                    // UPDATE it instead of INSERT to prevent accidental duplicates
                    const titleNorm = (payload.title || "").trim().toLowerCase();
                    const existingDup = dbData.find((n: any) =>
                        !n.is_folder && !n._optimistic &&
                        String(n.id) !== optimisticId &&
                        (n.title || "").trim().toLowerCase() === titleNorm &&
                        (n.folder_name || "") === (payload.folder_name || "")
                    );
                    if (existingDup) {
                        // Overwrite the duplicate instead of creating a new row
                        localWriteRef.current.set(String(existingDup.id), Date.now());
                        await notesApi.update(String(existingDup.id), payload);
                        const merged = { ...existingDup, ...payload, id: existingDup.id };
                        setEditingNote((prev: any) => (prev === null || String(prev.id) === optimisticId) ? merged : prev);
                        setDbData((prev) => prev
                            .filter((n: any) => String(n.id) !== optimisticId)
                            .map((n: any) => String(n.id) === String(existingDup.id) ? merged : n));
                        removeFromCachedNotes(payload.folder_name, optimisticId);
                        mergeIntoCachedNotes(payload.folder_name, [merged]);
                    } else {
                        const { note: data } = await notesApi.insert(payload);
                        if (data) {
                            // Mark as own-insert so Realtime INSERT handler skips it
                            localWriteRef.current.set(String(data.id), Date.now());
                            setPendingNoteType(null);
                            // Only take editingNote if user hasn't already switched to a different note
                            setEditingNote((prev: any) => (prev === null || String(prev.id) === optimisticId) ? data : prev);
                            setDbData((prev) => { const seen = new Set<string>(); return prev.map((n) => String(n.id) === optimisticId ? data : n).filter((n) => { const id = String(n.id); if (seen.has(id)) return false; seen.add(id); return true; }); });
                            // Replace optimistic entry in cache with confirmed server data
                            removeFromCachedNotes(payload.folder_name, optimisticId);
                            mergeIntoCachedNotes(payload.folder_name, [data]);
                        }
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
        [isDraftDirty, targetFolder, noteColor, activeFolder, folderStack, editingNote, content, folders, dbData, pendingNoteType],
    );
    // Always-current ref so other callbacks can call saveNote without stale closures
    useEffect(() => { saveNoteRef.current = saveNote; }, [saveNote]);

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
            playSound("move");
            showToast(`→ "${name}"`, color);
            if (editingNote?.id) {
                // Optimistic update — happen immediately, before the API call
                const noteId = String(editingNote.id);
                setDbData((prev) =>
                    prev.map((r) =>
                        String(r.id) === noteId ? { ...r, folder_name: name, folder_color: color } : r,
                    ),
                );
                setEditingNote((prev: any) => (prev ? { ...prev, folder_name: name, folder_color: color } : prev));
                const folderRow = folders.find((f) => f.name === name);
                const folderId = folderRow?.id ?? `virtual-${name}`;
                setActiveFolder(name);
                setFolderStack([{ id: folderId, name, color }]);
                setShowNoteActions(false);
                setEditorOpen(false);
                try {
                    await notesApi.update(noteId, { folder_name: name, folder_color: color });
                } catch (err) {
                    console.error("Move failed:", err);
                    showToast("Move Failed");
                }
            }
        },
        [folders, editingNote],
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
        // Only navigate to the note's folder if we're not already there (preserves parent folder stack)
        if (targetFolder && targetFolder !== activeFolder) {
            setActiveFolder(targetFolder);
        } else if (!targetFolder) {
            setActiveFolder(null);
        }
        setSearch("");
    }, [saveNote, closeEditorTools, editingNote?.id, targetFolder, activeFolder, noteColor]);

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
        if (IS_PHONE) return;
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                void saveNote({ silent: true, deriveTitle: true }).then(() => {
                    const rawT = titleRaw.current || title;
                    const t = rawT.trim() ? rawT.slice(0, 12) + (rawT.length > 12 ? "…" : "") : "Saved";
                    showToast(`"${t}" saved`, noteColor || "#34C759");
                });
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [saveNote, noteColor]);


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


    const openNewNote = useCallback((type?: string) => {
        noteEverDirtyRef.current = false;
        // Cancel any pending autosave and clear stale content ref — prevents ghost "Untitled" saves
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
        latestContentRef.current = "";
        const isStandup = (activeFolder || "").toLowerCase() === "standup";
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;
        setEditingNote(null);
        setTitle(isStandup ? dateStr : "");
        setContent("");
        setImages([]);
        setPendingNoteType(type ?? "text");
        setTargetFolder(activeFolder || (editMode ? "Work" : "CLAUDE"));
        setNoteColor(pickUniqueColor());
        shouldFocusTitleOnOpenRef.current = !isStandup;
        closeEditorTools();
        setEditorOpen(true);
        playSound("create");
    }, [activeFolder, editMode, closeEditorTools, pickUniqueColor]);

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
    const showRainbowToast = (msg: string) => {
        setToastKey(k => k + 1);
        setToast(msg);
        setToastConfetti(true);
        setToastIsError(false);
        setToastRainbow(true);
        setTimeout(() => { setToast(""); setToastConfetti(false); setToastRainbow(false); }, 3000);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showWelcomeBack]);

    useEffect(() => {
        const handler = (e: Event) => {
            const { msg, color, confetti } = (e as CustomEvent).detail ?? {};
            showToast(msg ?? "Done", color ?? "#34C759", confetti ?? false);
        };
        window.addEventListener("stickies-toast", handler);
        return () => window.removeEventListener("stickies-toast", handler);
    }, []);

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
                showError("Paste failed");
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
                showError("Image paste failed");
            }
        }
    }

    function handlePlainModePaste(e: React.ClipboardEvent) {
        const text = e.clipboardData.getData("text/plain");
        if (!text) return;
        // Auto-format JSON
        try {
            const parsed = JSON.parse(text);
            e.preventDefault();
            const formatted = JSON.stringify(parsed, null, 2);
            setContent(formatted);
            setPendingNoteType("json");
            showToast("JSON formatted ✦", "#34C759", true);
            return;
        } catch {}
        // Auto-detect and tag language
        const detected = detectNoteType(text);
        if (detected && detected !== "text" && detected !== "rich") {
            setPendingNoteType(detected);
        }
    }

    // handleCursorUpdate removed — activeLine/editorLineHeight/editorPaddingTop were never read
    // getComputedStyle + 3 setState calls per keystroke was the main typing lag cause

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
        setQrData(`${base}/share?data=${encoded}`);
        setQrIsBurn(false);
        setQrLinkCopied(false);
        setQrModalOpen(true);
    }, [editingNote, title, content, targetFolder, activeFolder, noteColor]);

    const openNoteLinkQr = useCallback(() => {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const noteId = editingNote?.id ? String(editingNote.id) : "";
        const url = noteId ? `${base}/?noteId=${noteId}` : base;
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
        setQrData(`${base}/share?clip=${base64}`);
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
            showError("Send failed");
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
            const burnUrl = `${base}/share?token=${token}`;
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
            const alreadyInTrash = existingNote?.folder_name === "TRASH";
            try {
                const trashedAt = new Date().toISOString();
                // Remove from list immediately, fire API in background
                if (permanent || alreadyInTrash) {
                    setDbData((prev) => prev.filter((row) => String(row.id) !== noteId));
                    if (existingNote?.folder_name) removeFromCachedNotes(String(existingNote.folder_name), noteId);
                    showToast(`"${label}" deleted`, "#FF3B30");
                    void notesApi.delete(noteId);
                } else {
                    setDbData((prev) => prev.map((r) => String(r.id) === noteId ? { ...r, folder_name: "TRASH", trashed_at: trashedAt } : r));
                    if (existingNote?.folder_name) removeFromCachedNotes(String(existingNote.folder_name), noteId);
                    showToast(`"${label}" → Trash`, resolvedColor);
                    void notesApi.update(noteId, { folder_name: "TRASH", trashed_at: trashedAt });
                }
                localStorage.removeItem(ACTIVE_DRAFT_KEY);
                setPendingShare(null);
                closeEditorTools();
                setEditingNote(null);
                setTitle("");
                setContent("");
                setEditorOpen(false);
                playSound("delete");
            } catch (err) {
                console.error("Delete note failed:", err);
                showError("Delete Failed");
            }
        },
        [closeEditorTools, dbData, noteColor],
    );

    // Fast delete from toolbar — soft deletes to TRASH (recoverable), permanent if already in TRASH
    const fastDeleteNote = useCallback(() => {
        if (!editingNote?.id) return;
        const noteId = String(editingNote.id);
        const label = title.trim().slice(0, 10) + (title.trim().length > 10 ? "…" : "") || "Untitled";
        const alreadyInTrash = editingNote.folder_name === "TRASH";
        const origColor = noteColor || "#FF3B30";
        // Cancel any previous pending delete
        if (pendingDeleteRef.current) {
            clearTimeout(pendingDeleteRef.current.timeoutId);
            void notesApi.update(String(pendingDeleteRef.current.note.id), { folder_name: "TRASH", trashed_at: new Date().toISOString() });
            pendingDeleteRef.current = null;
        }
        // Remove from list immediately — don't wait for animation or API
        const trashedAt = new Date().toISOString();
        setDbData((prev) => alreadyInTrash
            ? prev.filter((r) => String(r.id) !== noteId)
            : prev.map((r) => String(r.id) === noteId ? { ...r, folder_name: "TRASH", trashed_at: trashedAt } : r)
        );
        localStorage.removeItem(ACTIVE_DRAFT_KEY);
        setPendingShare(null);
        closeEditorTools();
        setEditingNote(null);
        setTitle("");
        setContent("");
        setEditorOpen(false);
        playSound("delete");
        if (alreadyInTrash) {
            showToast(`"${label}" deleted`, "#FF3B30");
            void notesApi.delete(noteId);
        } else {
            showToast(`"${label}" → Trash  ⌘Z`, origColor);
            const snap = { note: editingNote, title, content, noteColor: origColor, targetFolder: targetFolder || "" };
            // Delay actual DB write 8s so ⌘Z can cancel it
            const timeoutId = setTimeout(async () => {
                pendingDeleteRef.current = null;
                try { await notesApi.update(noteId, { folder_name: "TRASH", trashed_at: new Date().toISOString() }); } catch { /* ignore */ }
            }, 8000);
            pendingDeleteRef.current = { ...snap, timeoutId };
        }
    }, [editingNote, title, content, noteColor, targetFolder, closeEditorTools]);


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
                showError("Delete Failed");
            }
        },
        [closeEditorTools, goBack],
    );


    const bulkDeleteSelected = useCallback(
        async () => {
            const ids = [...selectedIds];
            if (ids.length === 0) return;
            try {
                const toDelete = dbData.filter((n) => ids.includes(String(n.id)));
                const inTrash = activeFolder === "TRASH";
                const trashedAt = new Date().toISOString();
                if (inTrash) {
                    setDbData((prev) => prev.filter((n) => !ids.includes(String(n.id))));
                    await Promise.all(ids.map((id) => notesApi.delete(id)));
                } else {
                    setDbData((prev) => prev.map((n) => ids.includes(String(n.id)) ? { ...n, folder_name: "TRASH", trashed_at: trashedAt } : n));
                    await Promise.all(ids.map((id) => notesApi.update(id, { folder_name: "TRASH", trashed_at: trashedAt })));
                }
                toDelete.forEach((n: any) => { if (n.folder_name) removeFromCachedNotes(String(n.folder_name), String(n.id)); });
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
        // Cancel pending rich-editor content timer — prevents old note's content overwriting the new one
        if (richEditorSetContentTimer.current) { clearTimeout(richEditorSetContentTimer.current); richEditorSetContentTimer.current = null; }

        // Stamp this open so concurrent stale fetches don't overwrite the latest result
        const noteId = String(note.id);
        openingNoteIdRef.current = noteId;

        // Open immediately with available metadata so the editor switches at once
        setPendingNoteType(null); // reset so noteType comes from note.type, not prior mode
        setEditingNote(note);
        const rawTitle = note.title || "";
        const loadedTitle = rawTitle.trimStart().startsWith("{") ? extractRichTextTitle(rawTitle) : rawTitle;
        // Treat "Untitled" as no title so first-line auto-derive runs on next save
        setTitle(loadedTitle.toLowerCase() === "untitled" ? "" : loadedTitle);
        setContent(note.content != null ? (note.type === "mermaid" || detectMermaid(note.content || "") ? cleanMermaidContent(note.content) : (note.type !== "rich" ? (() => { try { const p = JSON.parse(note.content); if (p?.type === "doc") return tiptapToPlainText(p).replace(/\n{3,}/g, "\n\n").trim(); } catch {} return note.content; })() : note.content)) : "");
        setImages((note as any).images ?? []);
        setTargetFolder(note.folder_name || activeFolder || "General");
        setNoteColor(note.folder_color || folders.find((f: any) => f.name === (note.folder_name || activeFolder))?.color || palette12[0]);
        setShowColorPicker(false);
        setShowSwitcher(false);
        setEditorOpen(true);

        // Always fetch full content — list API omits the content column
        if (note.content == null) {
            setNoteContentLoading(true);
            try {
                const token = await getAuthToken();
                const res = await fetch(`/api/stickies?id=${encodeURIComponent(note.id)}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const { note: fetched } = await res.json();
                    if (fetched) {
                        // Discard if user switched to a different note while this fetch was in flight
                        if (openingNoteIdRef.current !== noteId) return;
                        setDbData((prev: any[]) => prev.map((r) => String(r.id) === noteId ? { ...r, ...fetched } : r));
                        setEditingNote(fetched);
                        const body = (fetched.type === "mermaid" || detectMermaid(fetched.content || "")) ? cleanMermaidContent(fetched.content || "") : (fetched.type !== "rich" ? (() => { try { const p = JSON.parse(fetched.content || ""); if (p?.type === "doc") return tiptapToPlainText(p).replace(/\n{3,}/g, "\n\n").trim(); } catch {} return fetched.content || ""; })() : (fetched.content || ""));
                        setContent(body);
                        if (fetched.id && looksLikeMarkdown(fetched.content || "")) setMarkdownModeNotes((p: Set<string>) => new Set([...p, String(fetched.id)]));
                        if (fetched.id && (fetched.list_mode || fetched.type === "checklist")) setListModeNotes((p: Set<string>) => new Set([...p, String(fetched.id)]));
                        if (fetched.id && fetched.mindmap_mode) setMindmapModeNotes((p: Set<string>) => new Set([...p, String(fetched.id)]));
                    }
                }
            } catch { /* use note as-is */ }
            finally { setNoteContentLoading(false); }
        } else {
            if (note.id && looksLikeMarkdown(note.content || "")) setMarkdownModeNotes((p: Set<string>) => new Set([...p, String(note.id)]));
            if (note.id && (note.list_mode || note.type === "checklist")) setListModeNotes((p: Set<string>) => new Set([...p, String(note.id)]));
            if (note.id && note.mindmap_mode) setMindmapModeNotes((p: Set<string>) => new Set([...p, String(note.id)]));
        }
    }, [activeFolder, folders]);

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

    const openNoteFromCmdK = useCallback((note: any, cmdClick = false) => {
        setShowCmdK(false);
        setCmdKQuery("");
        // Folder selected — navigate into it (don't open as a note)
        if (note._isFolder) {
            const fr = dbData.find((r: any) => r.is_folder && (r.folder_name === note.name || String(r.id) === String(note.id)));
            enterFolder({ id: fr ? String(fr.id) : `virtual-${note.name}`, name: note.name, color: note.color || palette12[0] });
            loadFolderNotes(note.name, false).then(() => {
                const first = (getNotesCacheForFolder(note.name) as any[])
                    .filter((n: any) => !n.is_folder)
                    .sort((a: any, b: any) => (b.updated_at || "").localeCompare(a.updated_at || ""))[0];
                if (first) void openNote(first);
            });
            if (editMode) localStorage.setItem("stickies-split-notebook", note.name);
            return;
        }
        if (note.folder_name) {
            const fr = dbData.find((r: any) => r.is_folder && r.folder_name === note.folder_name);
            if (fr) enterFolder({ id: String(fr.id), name: note.folder_name, color: fr.color || fr.folder_color || palette12[0] });
        }
        void openNote(note);
    }, [dbData, enterFolder, openNote, loadFolderNotes, editMode]);

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
    const detectedType = useMemo(() => detectNoteType(content), [content]);
    // If DB type is null but content is clearly a code/mermaid type, trust the detection
    // so the toggle never shows and the correct renderer is used. Never downgrade a code type.
    const CODE_TYPES = _CODE_TYPES;
    const effectiveDbType = dbType ?? (CODE_TYPES.has(detectedType) ? detectedType : null);
    const noteType: string = pendingNoteType ?? effectiveDbType ?? detectedType;

    // Derived booleans — clean, no detection chains
    const baseMode = !listMode && !graphMode && !mindmapMode && !stackMode;
    const mermaidMode  = baseMode && noteType === "mermaid";
    const markdownMode = baseMode && noteType === "markdown";
    const htmlMode     = baseMode && (noteType === "html" || (!!currentNoteId && htmlModeNotes.has(currentNoteId)));
    const jsonMode     = baseMode && noteType === "json" && !mermaidMode;
    const codeMode     = baseMode && ["javascript","typescript","python","css","sql","bash"].includes(noteType);
    const plainMode    = baseMode && !!currentNoteId && plainModeNotes.has(currentNoteId) && noteType === "rich";
    // jsonDetect kept for JSON syntax highlight fallback
    const jsonDetect = useMemo(() => jsonMode ? detectJson(content) : { ok: false, parsed: null }, [jsonMode, content]);

    // Checklist toggle: plain-text only, bullet/numbered list ≤12 lines, no blank lines between items
    const canToggleChecklist = useMemo(() => {
        if (noteType !== "text" || listMode) return false;
        const rawLines = content.split("\n");
        const lines = rawLines.filter(l => l.trim());
        if (lines.length === 0 || lines.length > 12) return false;
        const hasBlankBetween = rawLines.some((l, i) => i > 0 && i < rawLines.length - 1 && !l.trim() && rawLines[i - 1].trim());
        return !hasBlankBetween;
    }, [noteType, listMode, content]);

    // Unified active mode label
    const noteViewMode = stackMode ? "Stack" : mindmapMode ? "Mindmap" : graphMode ? "Graph" : listMode ? "Checklist" : mermaidMode ? "Diagram" : codeMode ? noteType : markdownMode ? "Markdown" : htmlMode ? "HTML" : noteType === "rich" ? "Rich" : "Text";
    // Rich note = TipTap JSON format
    const isRichNote = !listMode && !graphMode && !mindmapMode && !stackMode && noteType === "rich";

    // Folder stats for bottom status bar (active folder view, no note open)
    const folderStats = useMemo(() => {
        if (!activeFolder || editorOpen) return null;
        const activeFolderObj = folders.find(f => f.name === activeFolder);
        const folderNotes = dbData.filter(r => !r.is_folder && (
            r.folder_name === activeFolder ||
            (r.folder_id && activeFolderObj?.id && String(r.folder_id) === String(activeFolderObj.id))
        ));
        if (folderNotes.length === 0) return null;
        // Approximate UTF-8 byte size using char length (avoids encoding every note on every render)
        const bytes = folderNotes.reduce((acc, r) => acc + (r.content || "").length, 0);
        const sizeStr = bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB`
            : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
        return [`${folderNotes.length} files`, sizeStr];
    }, [activeFolder, editorOpen, dbData, folders]);

    // Note stats for bottom status bar
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Uses deferredContent (400ms debounce) — avoids JSON tree-walk on every keystroke
    const noteStats = useMemo(() => {
        if (!editorOpen) return null;
        const bytes = deferredContent.length;
        const sizeStr = bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB`
            : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
        const editedStr = editingNote?.updated_at
            ? `Edited ${new Date(editingNote.updated_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : null;
        if (noteType !== "rich") return [editedStr, sizeStr].filter(Boolean) as string[];
        let tiptap: any = null;
        try { tiptap = JSON.parse(deferredContent); } catch {}
        const topNodes: any[] = tiptap?.content ?? [];
        let paragraphs = 0, images = 0, codeBlocks = 0, tables = 0;
        const walk = (nodes: any[]) => { for (const n of nodes) { if (n.type === "paragraph") paragraphs++; else if (n.type === "image") images++; else if (n.type === "codeBlock") codeBlocks++; else if (n.type === "table") tables++; if (n.content) walk(n.content); } };
        walk(topNodes);
        return [editedStr, sizeStr, `${topNodes.length} lines`,
            images > 0 ? `${images} img` : null, codeBlocks > 0 ? `${codeBlocks} code` : null,
            tables > 0 ? `${tables} tbl` : null, paragraphs > 0 ? `${paragraphs} ¶` : null,
        ].filter(Boolean) as string[];
    }, [editorOpen, noteType, deferredContent, editingNote?.updated_at]);

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

    const togglePlainMode = useCallback(() => {
        if (!currentNoteId) return;
        // Cancel any pending autosave to prevent stale-closure saves during mode switch
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
        const turningOn = !plainModeNotes.has(currentNoteId);
        if (turningOn) {
            // Convert TipTap JSON → plain text so the user sees clean content
            try {
                const parsed = JSON.parse(content);
                if (parsed?.type === "doc" && Array.isArray(parsed.content)) {
                    const plain = tiptapToPlainText(parsed).replace(/\n{3,}/g, "\n\n").trim();
                    setContent(plain);
                }
            } catch {}
            setPlainModeNotes((prev) => new Set([...prev, currentNoteId]));
        } else {
            setPlainModeNotes((prev) => { const next = new Set(prev); next.delete(currentNoteId); return next; });
        }
    }, [currentNoteId, content, plainModeNotes]);

    const switchToPlain = useCallback(() => {
        const plainContent = (() => {
            try {
                const parsed = JSON.parse(content);
                if (parsed?.type === "doc") return tiptapToPlainText(parsed).replace(/\n{3,}/g, "\n\n").trim();
            } catch {}
            return content;
        })();
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
        setContent(plainContent);
        setPendingNoteType("text");
        setPlainModeNotes((prev) => { const next = new Set(prev); if (currentNoteId) next.delete(currentNoteId); return next; });
        if (currentNoteId) {
            void notesApi.update(currentNoteId, { type: "text", content: plainContent });
            setDbData((prev) => prev.map((n) => String(n.id) === currentNoteId ? { ...n, type: "text", content: plainContent } : n));
            setEditingNote((prev: any) => prev ? { ...prev, type: "text", content: plainContent } : prev);
        }
    }, [currentNoteId, content]);

    const switchToRich = useCallback(() => {
        // Convert plain text → TipTap JSON paragraphs
        const richContent = JSON.stringify({
            type: "doc",
            content: content.trim()
                ? content.split("\n").map(line => ({
                    type: "paragraph",
                    content: line.trim() ? [{ type: "text", text: line }] : [],
                }))
                : [{ type: "paragraph" }],
        });
        if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
        setContent(richContent);
        setPendingNoteType("rich");
        if (currentNoteId) {
            void notesApi.update(currentNoteId, { type: "rich", content: richContent });
            setDbData((prev) => prev.map((n) => String(n.id) === currentNoteId ? { ...n, type: "rich", content: richContent } : n));
            setEditingNote((prev: any) => prev ? { ...prev, type: "rich", content: richContent } : prev);
        }
    }, [currentNoteId, content]);

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

    const contentLineCount = useMemo(() => deferredContent.split("\n").filter((l) => l.trim().length > 0).length, [deferredContent]);
    const isListEligible = contentLineCount >= 2;
    const isGraphEligible = contentLineCount >= 2;

    const parsedTasks = useMemo(() => {
        if (!listMode && !graphMode && !stackMode) return [];
        const isSeparator = (s: string) => /^[-–—=*#~_.]{2,}$/.test(s) || /^[-–—]{2,}.*[-–—]{2,}$/.test(s);
        const result: { done: boolean; text: string; lineIdx: number }[] = [];
        deferredContent.split("\n").forEach((line, lineIdx) => {
            const trimmed = line.trim();
            if (trimmed.length === 0 || isSeparator(trimmed)) return;
            const noBullet = trimmed.replace(/^\s*[-*•+_]\s*/, "").replace(/^\s*\d+\.\s*/, "").trim();
            const done = /^\[x\]/i.test(noBullet) || /^\[x\]/i.test(trimmed);
            const text = noBullet.replace(/^\[x\]\s*/i, "").replace(/^\[\s*\]\s*/, "").trim();
            if (text.length === 0) return;
            result.push({ done, text, lineIdx });
        });
        return result;
    }, [deferredContent, listMode, graphMode, stackMode]);

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
        setEditingTaskIdx(null);
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


    const pickRandomPaletteColor = useCallback(() => palette12[Math.floor(Math.random() * palette12.length)], []);

    const applySingleFolderColor = useCallback(
        (color: string) => {
            if (!activeFolder) return;
            setFolderColors((prev) => ({ ...prev, [activeFolder]: color }));
            setFolderStack((prev) => prev.map((f) => f.name === activeFolder ? { ...f, color } : f));
            // Persist to DB — only update the folder row itself (is_folder=true), not the notes inside
            setDbData((prev) => prev.map((r) => r.folder_name === activeFolder && r.is_folder ? { ...r, folder_color: color } : r));
            void getSupabase().from("stickies").update({ folder_color: color }).eq("folder_name", activeFolder).eq("is_folder", true);
            showToast(`${activeFolder} updated`, color);
        },
        [activeFolder, dbData],
    );

    const randomizeFolderColors = useCallback(async () => {
        if (!activeFolder) return;
        const folderNotes = dbData.filter(r => !r.is_folder && r.folder_name === activeFolder);
        if (folderNotes.length === 0) return;
        const picks: Record<string, string> = {};
        folderNotes.forEach(n => { picks[String(n.id)] = palette12[Math.floor(Math.random() * palette12.length)]; });
        // Optimistic update
        setDbData(prev => prev.map(r => picks[String(r.id)] ? { ...r, folder_color: picks[String(r.id)] } : r));
        showToast(`🎲 ${folderNotes.length} colors randomized`, "#AF52DE");
        // Persist — direct Supabase update so updated_at is NOT touched
        const sb = createBrowserClient();
        await Promise.all(folderNotes.map(n =>
            sb.from("stickies").update({ folder_color: picks[String(n.id)] }).eq("id", n.id)
        ));
    }, [activeFolder, dbData]);

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
    const isListMode = editMode || mainListMode === "list";

    // Compute exact square cell size via ResizeObserver → set as CSS var on grid container
    useEffect(() => {
        const el = mainScrollRef.current;
        if (!el) return;
        const update = () => {
            if (isListMode) { el.style.removeProperty('--cell-size'); return; }
            const cols = gridCols;
            const gap = 6;
            const cs = getComputedStyle(el);
            const px = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
            const cellSize = Math.floor((el.clientWidth - px - (cols - 1) * gap) / cols);
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
            if (isListMode) {
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
        [isListMode],
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
                        enterFolder({ id: String(targetItem.id), name: destFolder, color: destColor });
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

    const splitSentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!editMode || !hasMoreSplitItems) return;
        const el = splitSentinelRef.current;
        if (!el) return;
        let fired = false;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !fired) {
                    fired = true;
                    observer.disconnect();
                    setSplitListPage((p) => p + 1);
                }
            },
            { threshold: 0.1 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [editMode, hasMoreSplitItems, splitListPage]);

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
        <div className="safe-shell box-border h-[100dvh] bg-black text-white font-sans select-none overflow-hidden overscroll-none flex flex-col">

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

            {/* Live API request log */}
            {showApiLog && apiLog.length > 0 && (
                <div style={{
                    position: "fixed", bottom: 24, right: 24, zIndex: 99999,
                    width: 420, maxHeight: 320,
                    background: "#0d0d0d", border: "1px solid #222",
                    borderRadius: 10, overflow: "hidden",
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: 11, boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "#161616", borderBottom: "1px solid #222" }}>
                        <span style={{ color: "#666", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10 }}>AI ADDED NOTES</span>
                        <div style={{ display: "flex", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34C759", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
                            <button onClick={() => setShowApiLog(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>✕</button>
                        </div>
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 280 }}>
                        {apiLog.map((entry, i) => {
                            const methodColor: Record<string, string> = { POST: "#34C759", DELETE: "#FF3B30", PATCH: "#FF9500", GET: "#32ADE6" };
                            const color = methodColor[entry.method] ?? "#aaa";
                            const time = new Date(entry.at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
                            return (
                                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 10px", borderBottom: "1px solid #111", background: i === 0 ? "rgba(52,199,89,0.05)" : "transparent" }}>
                                    <span style={{ color, fontWeight: 700, minWidth: 44, fontSize: 10 }}>{entry.method}</span>
                                    <span style={{ color: "#ccc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.path}{entry.summary ? ` · ${entry.summary}` : ""}</span>
                                    <span style={{ color: "#444", whiteSpace: "nowrap", fontSize: 10 }}>{time}</span>
                                </div>
                            );
                        })}
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
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.2; }
                }
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
                .rich-editor .tiptap { flex: 1; min-height: 100%; outline: none; padding: 1rem 2rem; color: #d1d1d1; line-height: 1.65; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 17px; background: #252525; }
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
                            <div className="fixed z-[2147483647] pointer-events-auto"
                                style={{
                                    left: 0, right: 0,
                                    top: "calc(env(safe-area-inset-top, 0px) + 14px)",
                                    display: "flex",
                                    justifyContent: "center",
                                    animation: "islandToastInOut 3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                                }}
                                onClick={() => void secureCopy(toast).then(() => { if (!isError) showToast("Copied!"); })}>
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
                                            <span className="font-black uppercase tracking-wide text-[7px] sm:text-[8px] leading-snug max-w-[220px] break-words text-center">{toast}</span>
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
            <div className={`flex-1 min-h-0 overflow-hidden flex ${editMode ? "flex-row" : "flex-col"}`}>

                {/* RIGHT PANEL: editor — only shown in edit mode or when a note is open (mobile nav) */}
                <div className={`flex-1 flex flex-col overflow-hidden ${editMode ? "order-last flex" : editorOpen ? "flex" : "hidden"} ${isFullscreen ? "fixed inset-0 z-[9999]" : ""}`} style={{ background: "#222222" }}>
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
                    <div className="safe-top-bar shrink-0" style={{ background: "#2a2a2a" }} />
                    <div className="relative h-auto min-h-[3.5rem] sm:min-h-[4rem] px-2 sm:px-4 border-b border-white/10 flex items-center gap-1 sm:gap-2 shrink-0" style={{ background: "#2a2a2a" }}>
                        {/* Back button — hidden on desktop or in edit mode (left panel always visible) */}
                        <button
                            onClick={(e) => { e.stopPropagation(); void backToRootFromEditor(); }}
                            className={`${editMode ? "hidden" : "flex"} p-2 text-zinc-400 hover:bg-white/10 transition flex-shrink-0`}
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
                                        <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-sm font-black leading-none overflow-hidden" style={{ background: frame.name === "CLAUDE" ? "#fff" : (folderColors[frame.name] || frame.color || "#888"), color: frame.name === "CLAUDE" ? (folderColors[frame.name] || "#888") : (isLightColor(folderColors[frame.name] || frame.color || "#888") ? "#000" : "#fff"), borderRadius: 4 } as React.CSSProperties}>
                                            {frame.name === "CLAUDE"
                                                ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                : <FolderIconDisplay value={folderIcons[frame.name] || ""} folderName={frame.name} className="w-3.5 h-3.5" />}
                                        </span>
                                        <span className="uppercase">{frame.name}</span>
                                    </button>
                                </React.Fragment>
                            ))}
                            {folderStack.length > 0 && <span className="text-zinc-700 text-[10px] flex-shrink-0">/</span>}
                            {isBreadcrumbChecklist ? (
                                <div className="w-6 h-6 flex-shrink-0 relative overflow-hidden font-black" style={{ backgroundColor: activeAccentColor, borderRadius: "2px 2px 2px 10px" }}>
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${breadcrumbFillPct}%`, background: "rgba(0,0,0,0.25)", transition: "height 0.4s ease" }} />
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: breadcrumbTotal >= 10 ? 9 : 11, color: "#fff" }}>{breadcrumbTotal}</div>
                                </div>
                            ) : (
                                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center font-black leading-none tracking-tight" style={{ backgroundColor: activeAccentColor, color: "#fff", borderRadius: "2px 2px 2px 10px", fontSize: noteBadgeFontSize }}>
                                    {noteBadgeLabel}
                                </span>
                            )}
                            <input ref={titleInputRef} onChange={(e) => { titleRaw.current = e.target.value; }} onBlur={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-1 min-w-0 flex-1 font-black tracking-tight text-xs text-white placeholder:text-zinc-500" style={{ caretColor: activeAccentColor }} placeholder="NOTE TITLE" />
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
                        <input ref={titleInputMobileRef} onChange={(e) => { titleRaw.current = e.target.value; }} onBlur={(e) => setTitle(e.target.value)} onFocus={() => { closeEditorTools(); setShowNoteActions(false); }} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} className="sm:hidden bg-transparent border-0 appearance-none shadow-none ring-0 outline-none focus:outline-none focus:ring-0 px-2 flex-grow min-w-0 text-sm text-white placeholder:text-zinc-500" style={{ caretColor: activeAccentColor, border: "none" }} placeholder="NOTE TITLE" />

                        {mermaidMode && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button type="button"
                                    onClick={async () => {
                                        const mapUrl = (editingNote as any)?._mapUrl;
                                        if (mapUrl) {
                                            // External note — open its source app link (local or prod)
                                            window.open(mapUrl, "_blank");
                                        } else {
                                            const h = window.location.hostname;
                                            const isLocal = h === "localhost" || h === "127.0.0.1";
                                            const apiBase = isLocal ? "http://localhost:3002" : "https://diagram-bheng.vercel.app";
                                            const res = await fetch(`${apiBase}/api/share`, {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ code: extractMermaid(content) }),
                                            });
                                            const { url } = await res.json();
                                            window.open(url, "_blank");
                                        }
                                    }}
                                    className="p-2 sm:p-3 text-zinc-400 hover:text-purple-400 active:text-purple-400 transition flex-shrink-0"
                                    title={(editingNote as any)?._source === "stickies:diagrams" ? "Open in Sequence Diagram" : (editingNote as any)?._external ? "Open in Mind Map" : "Open in Diagram editor"}>
                                    <SparklesIcon className="w-[29px] h-[29px] sm:w-7 sm:h-7" />
                                </button>
                            </div>
                        )}
                        {TYPE_BADGE[noteType] && noteType !== "mermaid" && !editMode ? (
                            <span className="hidden sm:inline-flex text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: `${TYPE_BADGE[noteType].color}20`, color: TYPE_BADGE[noteType].color, border: `1px solid ${TYPE_BADGE[noteType].color}40` }}>
                                {TYPE_BADGE[noteType].label}
                            </span>
                        ) : null}
                        {/* Fullscreen */}
                        <button type="button"
                            onClick={() => setIsFullscreen(v => !v)}
                            className="hidden sm:flex p-2 sm:p-3 text-zinc-500 hover:text-zinc-200 active:text-white transition flex-shrink-0"
                            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}>
                            {isFullscreen
                                ? <ArrowsPointingInIcon className="w-[22px] h-[22px] sm:w-5 sm:h-5" />
                                : <ArrowsPointingOutIcon className="w-[22px] h-[22px] sm:w-5 sm:h-5" />}
                        </button>
                        {/* Checklist toggle — only when eligible or already on */}
                        {(canToggleChecklist || listMode) && (
                        <button type="button"
                            onClick={() => {
                                if (!listMode && noteType === "rich") switchToPlain();
                                toggleListMode();
                            }}
                            className="p-2 sm:p-3 transition flex-shrink-0"
                            style={{ color: listMode ? noteColor : "#71717a" }}
                            title={listMode ? "Exit checklist" : "Checklist"}>
                            <CheckCircleIcon className="w-[26px] h-[26px] sm:w-6 sm:h-6" />
                        </button>
                        )}
                        {/* Share — always visible */}
                        <button type="button"
                            onClick={() => { setSharePickerOpen(true); setShowNoteActions(false); closeEditorTools(); }}
                            className="p-2 sm:p-3 text-zinc-500 hover:text-white active:text-white transition flex-shrink-0"
                            title="Share">
                            <PaperAirplaneIcon className="w-[24px] h-[24px] sm:w-[22px] sm:h-[22px]" />
                        </button>
                        {/* Delete — quick access */}
                        {editingNote?.id && (
                        <button type="button"
                            onClick={() => { setShowNoteActions(false); closeEditorTools(); setConfirmDelete({ type: "note", noteId: String(editingNote.id), noteName: (title.trim() || editingNote.title || "Untitled").trim(), noteColor: noteColor || editingNote.folder_color || "#71717a" }); }}
                            className="p-2 sm:p-3 text-zinc-600 hover:text-red-400 active:text-red-400 transition flex-shrink-0"
                            title="Delete note">
                            <TrashIcon className="w-[24px] h-[24px] sm:w-[22px] sm:h-[22px]" />
                        </button>
                        )}
                        <button type="button"
                            onClick={() => { setShowNoteActions(v => !v); closeEditorTools(); }}
                            className="p-2 sm:p-3 text-zinc-300 hover:text-white active:text-white transition flex-shrink-0"
                            title="Note options">
                            <EllipsisVerticalIcon className="w-[29px] h-[29px] sm:w-7 sm:h-7" />
                        </button>
                    </div>
                    <div className="relative flex-1 flex overflow-hidden bg-black font-mono">
                        {/* ── Note loading spinner — scoped to editor panel only ── */}
                        {noteContentLoading && (
                            <div className="absolute inset-0 z-[50] flex items-center justify-center bg-black/60 pointer-events-none">
                                <div className="w-24 h-24 flex items-center justify-center font-black text-white text-4xl animate-pulse"
                                    style={{ backgroundColor: noteColor || "#71717a", borderRadius: "6px 6px 6px 28px", boxShadow: `0 0 48px ${noteColor || "#71717a"}bb` }}>
                                    {meaningfulInitial(title || editingNote?.title || "", "N")}
                                </div>
                            </div>
                        )}
                        {/* ── Float copy pill — fades after 10s of editing ── */}
                        {showFloatCopy && !isFullscreen && !showNoteActions && !showFindBar && content.trim() && !listMode && !graphMode && !mindmapMode && !stackMode && noteType !== "rich" && noteType !== "html" && (
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
                                            {editingTaskIdx === origIdx && !task.done ? (
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
                                                <span className={`relative flex-1 text-left text-[12px] sm:text-sm font-bold truncate ${task.done ? "text-zinc-600" : "text-white"}`}>{task.text}</span>
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
                                searchTerm={showFindBar ? findQuery : ""}
                                searchIndex={findCursor}
                                onSearchResults={setRichSearchCount}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); void saveNote({ silent: true, deriveTitle: true }); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : markdownMode ? (
                            <div className="flex-1 flex overflow-auto relative" style={{ background: "#000" }}>
                                <textarea
                                    ref={editorTextRef}
                                    value={content}
                                    onChange={(e) => { latestContentRef.current = e.target.value; startContentTransition(() => setContent(e.target.value)); }}
                                    onClick={() => closeEditorTools()}
                                    onFocus={() => closeEditorTools()}
                                    onBlur={() => void saveNote({ silent: true, deriveTitle: true })}
                                    onPaste={handleEditorPaste}
                                    className="ios-editor-scroll overscroll-none touch-pan-y"
                                    style={{
                                        flex: 1, background: "transparent", color: "#f8f8f2",
                                        fontFamily: "ui-monospace,'Fira Code','Cascadia Code',monospace",
                                        fontSize: 10, lineHeight: "16px",
                                        paddingTop: 8, paddingBottom: 24, paddingLeft: 16, paddingRight: 24,
                                        outline: "none", resize: "none", caretColor: "#f8f8f2",
                                        whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word",
                                    }}
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                />
                            </div>
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
                        ) : codeMode ? (
                            <CodeViewer
                                code={content}
                                language={noteType}
                                editing={codeEditMode}
                                searchTerm={showFindBar ? findQuery : ""}
                                searchIndex={findCursor}
                                onSearchResults={setRichSearchCount}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); void saveNote({ silent: true, deriveTitle: true }); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : jsonMode ? (
                            <CodeViewer
                                code={codeEditMode ? content : (jsonDetect.ok ? JSON.stringify(jsonDetect.parsed, null, 2) : content)}
                                language="json"
                                editing={codeEditMode}
                                wordWrap={!codeEditMode}
                                searchTerm={showFindBar ? findQuery : ""}
                                searchIndex={findCursor}
                                onSearchResults={setRichSearchCount}
                                onChange={setContent}
                                onBlur={() => { setCodeEditMode(false); void saveNote({ silent: true, deriveTitle: true }); }}
                                onClick={() => setCodeEditMode(true)}
                            />
                        ) : plainMode ? (
                            <div onPaste={handlePlainModePaste} className="flex-1 flex flex-col min-h-0">
                                {(() => {
                                    const rawDetected = detectedType;
                                    const detectedLang = (rawDetected !== "text" && rawDetected !== "rich") ? rawDetected : null;
                                    return (
                                        <>
                                        {detectedLang && TYPE_BADGE[detectedLang] && (
                                            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5" style={{ background: "#1a1a1a" }}>
                                                <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                                                    style={{ background: `${TYPE_BADGE[detectedLang].color}20`, color: TYPE_BADGE[detectedLang].color, border: `1px solid ${TYPE_BADGE[detectedLang].color}40` }}>
                                                    {TYPE_BADGE[detectedLang].label}
                                                </span>
                                                <span className="text-[9px] text-zinc-600 uppercase tracking-widest">detected — paste to replace or type freely</span>
                                            </div>
                                        )}
                                        <CodeViewer
                                            code={content}
                                            language={detectedLang ?? "javascript"}
                                            editing={true}
                                            searchTerm={showFindBar ? findQuery : ""}
                                            searchIndex={findCursor}
                                            onSearchResults={setRichSearchCount}
                                            onChange={(val) => setContent(val)}
                                            onBlur={() => { if (currentNoteId) void saveNote({ silent: true, deriveTitle: true }); }}
                                        />
                                        </>
                                    );
                                })()}
                            </div>
                        ) : noteType === "rich" ? (
                            <div className="relative flex-1 min-h-0 flex flex-col" style={{ background: "#222222" }}>
                                <RichTextEditor
                                    key={currentNoteId ?? "new"}
                                    noteId={currentNoteId}
                                    content={content}
                                    onChange={(html) => {
                                        latestContentRef.current = html;
                                        if (richEditorSetContentTimer.current) clearTimeout(richEditorSetContentTimer.current);
                                        richEditorSetContentTimer.current = setTimeout(() => setContent(html), 100);
                                    }}
                                    onBlur={() => void saveNote({ silent: true, deriveTitle: true })}
                                    searchTerm={showFindBar ? findQuery : ""}
                                    searchIndex={findCursor}
                                    onSearchResults={setRichSearchCount}
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
                                    onDelete={fastDeleteNote}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex overflow-auto relative" style={{ background: "#000" }}>
                                {/* Highlight backdrop for find-in-note */}
                                {showFindBar && findMatches.length > 0 && (
                                    <div aria-hidden="true" style={{
                                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                                        pointerEvents: "none",
                                        fontFamily: "ui-monospace,'Fira Code','Cascadia Code',monospace",
                                        fontSize: 10, lineHeight: "16px",
                                        paddingTop: 8, paddingBottom: 24, paddingLeft: 16, paddingRight: 24,
                                        whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word",
                                        color: "transparent", zIndex: 0,
                                    }}>
                                        {renderFindHighlights(content || "", findMatches, findCursor)}
                                    </div>
                                )}
                                {/* Native textarea — no cursor jump */}
                                <textarea
                                    ref={editorTextRef}
                                    value={content}
                                    onChange={(e) => { latestContentRef.current = e.target.value; startContentTransition(() => setContent(e.target.value)); }}
                                    onClick={() => closeEditorTools()}
                                    onFocus={() => closeEditorTools()}
                                    onBlur={() => void saveNote({ silent: true, deriveTitle: true })}
                                    onPaste={handleEditorPaste}
                                    className="ios-editor-scroll overscroll-none touch-pan-y"
                                    style={{
                                        flex: 1, background: "transparent", color: "#f8f8f2",
                                        fontFamily: "ui-monospace,'Fira Code','Cascadia Code',monospace",
                                        fontSize: 10, lineHeight: "16px",
                                        paddingTop: 8, paddingBottom: 24, paddingLeft: 16, paddingRight: 24,
                                        outline: "none", resize: "none", caretColor: "#f8f8f2",
                                        whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word",
                                        overflow: "auto",
                                        position: "relative", zIndex: 1,
                                    }}
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
                {/* ── Bottom status bar ── */}
                {editingNote && (() => {
                    const bytes = content.length;
                    const sizeStr = bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : bytes > 0 ? `${bytes} B` : null;
                    const extMap: Record<string, string> = {
                        text: ".txt", markdown: ".md", mermaid: ".mmd", json: ".json",
                        javascript: ".js", typescript: ".ts", python: ".py", css: ".css",
                        sql: ".sql", bash: ".sh", html: ".html", rich: ".rtf",
                    };
                    const ext = extMap[noteType] ?? ".txt";
                    const edited = editingNote.updated_at
                        ? new Date(editingNote.updated_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : null;
                    return (
                        <div className="shrink-0 flex items-center justify-between px-3 select-none border-t border-white/[0.06]"
                            style={{ height: 22, background: "#1e1e1e", fontSize: 10 }}>
                            {showFindBar && findQuery.trim() && (codeMode || mermaidMode || jsonMode || plainMode || noteType === "rich" ? richSearchCount > 0 : findMatches.length > 0) ? (
                                // Find mode — show match info in status bar
                                (() => {
                                    const usesCodeViewer = codeMode || mermaidMode || jsonMode || plainMode || noteType === "rich";
                                    const total = usesCodeViewer ? richSearchCount : findMatches.length;
                                    const match = !usesCodeViewer ? findMatches[findCursor] : null;
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
                                <div className="flex items-center gap-2 font-mono overflow-x-auto" style={{ fontSize: 9 }}>
                                    {richStatsChips.length > 0 ? (
                                        richStatsChips.map((c, i) => (
                                            <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
                                                {i > 0 && <span className="text-zinc-700">·</span>}
                                                <span className="text-zinc-500">{c}</span>
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-zinc-600 whitespace-nowrap">{edited ?? ""}</span>
                                    )}
                                    {richStatsChips.length > 0 && edited && (
                                        <><span className="text-zinc-700">·</span><span className="text-zinc-700 whitespace-nowrap">{edited}</span></>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                {editingNote?.is_public && (
                                    <GlobeAltIcon className="w-3 h-3 text-emerald-400 flex-shrink-0" title="Public note" />
                                )}
                                {(() => {
                                    const badge = TYPE_BADGE[noteType] ?? TYPE_BADGE["text"];
                                    if (!badge) return null;
                                    const label = noteType === "mermaid" ? mermaidSubType(content) : badge.label;
                                    const canToggle = noteType === "text" || noteType === "rich";
                                    const handleBadgeClick = canToggle ? (noteType === "text" ? switchToRich : switchToPlain) : undefined;
                                    return (
                                        <span
                                            onClick={handleBadgeClick}
                                            title={canToggle ? (noteType === "rich" ? "Switch to Plain text" : "Switch to Rich editor") : undefined}
                                            className="font-mono font-black uppercase tracking-wide whitespace-nowrap px-1.5 py-px rounded-full"
                                            style={{
                                                fontSize: 8,
                                                background: `${badge.color}22`,
                                                color: badge.color,
                                                border: `1px solid ${badge.color}44`,
                                                cursor: canToggle ? "pointer" : "default",
                                                transition: "background 0.15s, opacity 0.15s",
                                            }}
                                            onMouseEnter={canToggle ? (e) => { (e.target as HTMLElement).style.background = `${badge.color}44`; } : undefined}
                                            onMouseLeave={canToggle ? (e) => { (e.target as HTMLElement).style.background = `${badge.color}22`; } : undefined}
                                        >{label}</span>
                                    );
                                })()}
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

                {/* LEFT NOTE LIST PANEL — sidebar strip (editMode) + note list content */}
                {(() => {
                    const rootFolders = folders
                        .filter((f: any) => !f.parent_folder_name && f.name !== "TRASH")
                        .concat(folders.filter((f: any) => f.name === "TRASH" && !f.parent_folder_name));
                    const activeRoot = folderStack[0]?.name ?? null;
                    const navigateTo = (f: any) => {
                        const fn = f.name || f.folder_name;
                        enterFolder({ id: String(f.id), name: fn, color: folderColors[fn] || f.color || palette12[0] });
                        void loadFolderNotes(fn, false);
                    };
                    return (
                        <div className="flex flex-col flex-shrink-0 overflow-hidden relative"
                             style={{ background: editMode ? "#0f0f0f" : "black", width: editMode ? "calc(52px + 30%)" : undefined, minWidth: editMode ? "312px" : undefined, maxWidth: editMode ? "432px" : undefined }}>

                            {/* SIDEBAR STRIP — editMode only, absolutely positioned on left */}
                            {editMode && (
                                <div className="absolute top-0 left-0 bottom-0 w-[52px] flex flex-col" style={{ background: "#0f0f0f", zIndex: 10 }}>
                                    <div className="safe-top-bar shrink-0" style={{ background: "#0f0f0f" }} />
                                    <div className="shrink-0" style={{ height: "4rem", background: "#0f0f0f" }} />
                                    <div className="flex-1 overflow-y-auto py-2 flex flex-col items-center gap-2">
                                        {/* All Notes */}
                                        <button type="button"
                                            onMouseEnter={(e) => { playSound("hover"); const r = e.currentTarget.getBoundingClientRect(); setSidebarTooltip({ name: "All Notes", color: "#aaaaaa", y: r.top + r.height / 2 }); }}
                                            onMouseLeave={() => setSidebarTooltip(null)}
                                            onClick={() => { setFolderStack([]); void loadAllNotes(); }}
                                            className={`relative w-9 h-9 flex items-center justify-center transition-all ${!folderStack.length ? "scale-110" : "opacity-20 hover:opacity-90 hover:scale-105"}`}
                                            style={{ background: "#4a4a4a", borderRadius: 8, boxShadow: !folderStack.length ? "0 0 0 1.5px #aaa, 0 0 12px 4px #ffffff66, 0 0 28px 10px #4a4a4aaa, 0 0 48px 18px #4a4a4a44" : "none" }}>
                                            <Squares2X2Icon className="w-4 h-4 text-white" />
                                            <div className="absolute top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full pointer-events-none transition-all duration-300"
                                                style={{ right: -5, background: !folderStack.length ? "rgba(255,255,255,0.85)" : "transparent", zIndex: 200 }} />
                                        </button>
                                        {rootFolders.map((f: any) => {
                                            const fn = f.name;
                                            const fc = fn === "TRASH" ? "#3a3a3a" : (folderColors[fn] || f.color || "#888");
                                            const ftc = isLightColor(fc) ? "#000" : "#fff";
                                            const isActiveRoot = activeRoot === fn;
                                            return (
                                                <button key={f.id} type="button"
                                                    onMouseEnter={(e) => { playSound("hover"); const r = e.currentTarget.getBoundingClientRect(); setSidebarTooltip({ name: fn, color: fc, y: r.top + r.height / 2 }); }}
                                                    onMouseLeave={() => setSidebarTooltip(null)}
                                                    onClick={() => navigateTo(f)}
                                                    className={`relative w-9 h-9 flex items-center justify-center transition-all ${isActiveRoot ? "scale-110" : "opacity-20 hover:opacity-90 hover:scale-105"}`}
                                                    style={{ background: fc, color: ftc, borderRadius: 8, boxShadow: isActiveRoot ? `0 0 0 1.5px ${fc}, 0 0 12px 4px ${fc}bb, 0 0 28px 10px ${fc}88, 0 0 48px 18px ${fc}44` : "none" }}>
                                                    {fn === "CLAUDE"
                                                        ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-1" />
                                                        : fn === "TRASH"
                                                        ? <TrashIcon className="w-4 h-4" style={{ color: ftc }} />
                                                        : <FolderIconDisplay value={folderIcons[fn] || f.icon || ""} folderName={fn} className="w-4 h-4" />}
                                                    <div className="absolute top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full pointer-events-none transition-all duration-300"
                                                        style={{ right: -5, background: isActiveRoot ? "rgba(255,255,255,0.85)" : "transparent", zIndex: 200 }} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* TOP HEADER — search spans full width (editMode) or breadcrumbs+buttons (non-editMode) */}
                            {editMode ? (
                                <>
                                    <div className="safe-top-bar shrink-0" style={{ background: "#0f0f0f" }} />
                                    <div className="shrink-0 h-[4rem] flex items-center pr-3 relative" style={{ background: "#0f0f0f" }}>
                                        <div className="flex-shrink-0 w-[52px]" />
                                        <div className="flex-1 flex items-center relative px-3">
                                            <MagnifyingGlassIcon className="absolute left-3 w-4 h-4 text-zinc-600 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Search…"
                                                className="flex-1 bg-transparent text-white text-sm font-bold pl-8 pr-6 outline-none placeholder:text-zinc-600 h-full"
                                            />
                                            {search && (
                                                <button type="button" onClick={() => setSearch("")}
                                                    className="text-zinc-500 hover:text-white transition text-lg leading-none ml-1">×</button>
                                            )}
                                        </div>
                                        <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { const hueInt = integrationsRef.current.find(ig => ig.type === "hue"); setLightMode((hueInt?.config?.mode as any) ?? "flash"); setIsGlobalSettings(!activeFolder); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); setShowFolderActions(true); }} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="safe-top-bar shrink-0" style={{ background: "black" }} />
                                    <header className="shrink-0 flex items-center h-[4rem] px-4 border-b border-white/[0.06]">
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
                                                                className={`flex items-center gap-1.5 font-black tracking-tight truncate sm:max-w-[150px] flex-shrink-0 px-0.5 sm:px-1 transition text-xs ${i === folderStack.length - 1 ? "text-white hover:text-zinc-300" : "text-zinc-400 hover:text-white"}`}
                                                                title={i === folderStack.length - 1 ? `${frame.name} settings` : frame.name}>
                                                                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sm font-black leading-none overflow-hidden" style={{ background: frame.name === "CLAUDE" ? "#fff" : (folderColors[frame.name] || frame.color || "#888"), color: frame.name === "CLAUDE" ? (folderColors[frame.name] || "#888") : (isLightColor(folderColors[frame.name] || frame.color || "#888") ? "#000" : "#fff"), borderRadius: 4 } as React.CSSProperties}>
                                                                    {frame.name === "CLAUDE" ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" /> : <FolderIconDisplay value={folderIcons[frame.name] || ""} folderName={frame.name} className="w-3.5 h-3.5" />}
                                                                </span>
                                                                <span className={`uppercase ${i === folderStack.length - 1 && folderStack.length <= 2 ? "inline" : "hidden sm:inline"}`}>{frame.name}</span>
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
                                                <div className="ml-auto flex items-center gap-2">
                                                    <HeaderIconBtn icon={mainListMode === "list" ? Bars3Icon : Squares2X2Icon} label={mainListMode === "list" ? "List" : "Thumb"} active={!kanbanMode} onClick={() => { setMainListMode(v => v === "thumb" ? "list" : "thumb"); setKanbanMode(false); }} />
                                                    <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { const hueInt = integrationsRef.current.find(ig => ig.type === "hue"); setLightMode((hueInt?.config?.mode as any) ?? "flash"); setIsGlobalSettings(true); setShowFolderActions(true); }} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="ml-auto flex items-center gap-2 px-3">
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
                                                        <HeaderIconBtn icon={mainListMode === "list" ? Bars3Icon : Squares2X2Icon} label={mainListMode === "list" ? "List" : "Thumb"} active={!kanbanMode} onClick={() => { setMainListMode(v => v === "thumb" ? "list" : "thumb"); setKanbanMode(false); }} />
                                                        <HeaderIconBtn icon={Cog6ToothIcon} label="Settings" onClick={() => { const hueInt = integrationsRef.current.find(ig => ig.type === "hue"); setLightMode((hueInt?.config?.mode as any) ?? "flash"); setIsGlobalSettings(false); setShowFolderActions(true); }} />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </header>
                                </>
                            )}

                            {/* NOTE LIST CONTENT — offset right in editMode to clear the sidebar strip */}
                            <div className={`flex flex-col flex-1 min-h-0 overflow-hidden relative ${editMode ? "pl-[52px]" : ""}`} style={{ background: editMode ? "#191919" : "black" }}>

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
                        className={`ios-mobile-main relative flex-1 ${kanbanMode && isFolderGridView ? "overflow-x-auto overflow-y-hidden touch-pan-x" : "overflow-x-hidden overflow-y-auto touch-pan-y"} overscroll-none bg-black ${!(kanbanMode && isFolderGridView) ? "pb-24 sm:pb-32" : ""} ${!isListMode && !(kanbanMode && isFolderGridView) ? "p-1.5 sm:p-2" : ""}`}
                        style={kanbanMode && isFolderGridView
                            ? { display: "flex", flexDirection: "column", height: "100%", overflowX: "auto", overflowY: "hidden" }
                            : isListMode
                                ? { display: "block", paddingTop: "12px" }
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
                                                        onMouseEnter={(e) => { playSound("hover"); const rect = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(${hr},${hg},${hb},0.6) 0%, rgba(${hr},${hg},${hb},0.3) 50%, rgba(${hr},${hg},${hb},0.05) 100%)`; }}
                                                        onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(${hr},${hg},${hb},0.6) 0%, rgba(${hr},${hg},${hb},0.3) 50%, rgba(${hr},${hg},${hb},0.05) 100%)`; }}
                                                        onMouseLeave={(e) => { const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = ""; }}>
                                                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
                                                        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)" }} />
                                                        <div data-glow className="absolute inset-0 pointer-events-none z-[-1]" />
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
                                                                void openNote(note);
                                                            }}
                                                            onMouseEnter={(e) => { playSound("hover"); const rect = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(${nr},${ng},${nb},0.4) 0%, rgba(${nr},${ng},${nb},0.2) 50%, rgba(${nr},${ng},${nb},0.03) 100%)`; }}
                                                            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - rect.left) / rect.width) * 100; const y = ((e.clientY - rect.top) / rect.height) * 100; const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(${nr},${ng},${nb},0.4) 0%, rgba(${nr},${ng},${nb},0.2) 50%, rgba(${nr},${ng},${nb},0.03) 100%)`; }}
                                                            onMouseLeave={(e) => { const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = ""; }}
                                                            className="relative cursor-pointer rounded-md transition-all active:scale-[0.98] overflow-hidden"
                                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", isolation: "isolate", height: 52, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, padding: "0 12px" }}>
                                                            <div data-glow className="absolute inset-0 pointer-events-none z-[-1]" />
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
                        {!(kanbanMode && isFolderGridView) && pagedDisplayItems.map((item, idx) => {
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
                                        if (!isListMode) return;
                                        const [ri, gi, bi] = hexToRgb(item.color || item.folder_color || "#888888");
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = ((e.clientX - rect.left) / rect.width) * 100, y = ((e.clientY - rect.top) / rect.height) * 100;
                                        const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]");
                                        if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(${ri},${gi},${bi},0.22) 0%, rgba(${ri},${gi},${bi},0.1) 50%, rgba(${ri},${gi},${bi},0.01) 100%)`;
                                    }}
                                    onMouseMove={(e) => {
                                        if (!isListMode) return;
                                        const [ri, gi, bi] = hexToRgb(item.color || item.folder_color || "#888888");
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = ((e.clientX - rect.left) / rect.width) * 100, y = ((e.clientY - rect.top) / rect.height) * 100;
                                        const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]");
                                        if (glow) glow.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(${ri},${gi},${bi},0.22) 0%, rgba(${ri},${gi},${bi},0.1) 50%, rgba(${ri},${gi},${bi},0.01) 100%)`;
                                    }}
                                    onMouseLeave={(e) => { const glow = e.currentTarget.querySelector<HTMLElement>("[data-glow]"); if (glow) glow.style.background = ""; }}
                                    onTouchStart={() => {
                                        if (!isListMode) return;
                                        longPressTimer.current = setTimeout(() => {
                                            longPressTimer.current = null;
                                            suppressOpenRef.current = true;
                                            if (!item.is_folder) {
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
                                        if (isSelectMode && !item.is_folder) {
                                            const id = String(item.id);
                                            setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
                                            return;
                                        }
                                        if (item.is_folder) {
                                            playSound("navigate");
                                            enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] });
                                        } else {
                                            void openNote(item);
                                            setTimeout(() => playSound("click"), 0);
                                        }
                                    }}
                                    style={(() => {
                                        const c = item.color || item.folder_color || "#888888";
                                        const isActive = editMode && !item.is_folder && String(item.id) === String(editingNote?.id);
                                        if (isListMode) {
                                            return { position: "relative", isolation: "isolate", "--row-color": c, "--fc": c, ...(isActive && !item.is_folder ? { borderRightColor: c, background: `${c}35` } : isActive ? { borderRightColor: c } : {}), ...(item.is_folder ? { background: `${c}18` } : {}) } as unknown as React.CSSProperties;
                                        }
                                        return item.is_folder
                                            ? { isolation: "isolate", "--fc": c } as React.CSSProperties
                                            : { isolation: "isolate", backgroundColor: c, borderRadius: "3px 3px 3px 14px" };
                                    })()}
                                    className={`${isListMode
                                        ? `group list-row-hover flex items-center gap-3 pl-3 pr-3 min-h-[54px] border-b border-white/5 cursor-pointer select-none transition-colors active:bg-white/10 overflow-hidden ${!item.is_folder && incomingNoteIds.has(String(item.id)) ? "note-incoming" : ""} ${!item.is_folder && removingNoteIds.has(String(item.id)) ? "note-removing" : ""} ${isDragging ? "opacity-30" : dt?.mode === "into" ? "bg-cyan-950/60 ring-1 ring-inset ring-cyan-400" : ""} ${isSelectMode && !item.is_folder && selectedIds.has(String(item.id)) ? "bg-blue-950/50" : ""} ${editMode && !item.is_folder && String(item.id) === String(editingNote?.id) ? "border-r-[3px]" : "border-r-[3px] border-r-transparent"}`
                                        : `grid-square-tile min-w-0 cursor-pointer transition-all group ${item.is_folder ? `folder-grid-tile${item.name === "CLAUDE" ? " folder-grid-tile-claude" : ""}` : ""} ${isDragging ? "opacity-30 scale-95" : dt?.mode === "into" ? "ring-4 ring-cyan-400 ring-inset z-10" : ""} ${editMode && !item.is_folder && String(item.id) === String(editingNote?.id) ? "ring-2 ring-white/40 ring-inset" : ""}`}`}>
                                    {/* Cursor spotlight glow — DOM-only, no React state */}
                                    {isListMode && <div data-glow className="absolute inset-0 pointer-events-none z-[-1]" />}
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
                                            {isSelectMode && !item.is_folder && (
                                                <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all ${selectedIds.has(String(item.id)) ? "bg-blue-500 border-blue-500" : "border-zinc-600"}`}>
                                                    {selectedIds.has(String(item.id)) && <CheckIcon className="w-3 h-3 text-white" />}
                                                </div>
                                            )}
                                            {item.is_folder && (() => {
                                                const c = item.color || item.folder_color || palette12[0];
                                                return (
                                                    <button type="button"
                                                        onClick={(e) => { e.stopPropagation(); enterFolder({ id: String(item.id), name: item.name, color: item.color || palette12[0] }); setIsGlobalSettings(false); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); setShowFolderActions(true); }}
                                                        className={`folder-icon-badge${item.name === "CLAUDE" ? " folder-icon-badge-claude" : ""} flex-shrink-0 w-[54px] h-[54px] sm:w-[46px] sm:h-[46px] m-2 sm:m-0 flex items-center justify-center font-black overflow-hidden`}
                                                        style={{ fontSize: 22, "--fc": c, "--ic": isLightColor(c) ? "#000" : "#fff", boxShadow: `2px 3px 8px ${c}55` } as React.CSSProperties}>
                                                        {item.name === "CLAUDE"
                                                            ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-0.5" />
                                                            : item.name === "TRASH"
                                                            ? <TrashIcon className="w-6 h-6 text-white" />
                                                            : <FolderIconDisplay value={item.icon || ""} folderName={item.name || "F"} className="w-6 h-6" />}
                                                    </button>
                                                );
                                            })()}
                                            {!item.is_folder && (() => {
                                                const isChecklistItem = (item as any).type === "checklist" || listModeNotes.has(String(item.id));
                                                const nc = (item as any).color || (item as any).folder_color || "#71717a";
                                                const initial = meaningfulInitial(item.title || "", "N");
                                                return (
                                                    <button type="button"
                                                        onClick={(e) => { e.stopPropagation(); void openNote(item); closeEditorTools(); }}
                                                        className="flex-shrink-0 w-[54px] h-[54px] sm:w-[46px] sm:h-[46px] m-1 sm:m-0 flex items-center justify-center font-black overflow-hidden relative"
                                                        style={{
                                                            fontSize: 22,
                                                            backgroundColor: nc,
                                                            color: isLightColor(nc) ? "#000" : "#fff",
                                                            borderRadius: "6px 6px 6px 16px",
                                                            boxShadow: `2px 3px 8px ${nc}55`,
                                                        }}>
                                                        {initial}
                                                    </button>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-semibold tracking-tight text-white truncate">
                                                    {item.is_folder ? <><span className="uppercase folder-name-text">{item.name}</span><span className="text-white/30 font-light ml-0.5">/</span></> : (item.title?.length > 50 ? item.title.slice(0, 50) + "…" : item.title)}
                                                </div>
                                                {item.is_folder ? (
                                                    <div className="text-[13px] sm:text-[13px] text-zinc-500 font-medium folder-name-text">
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
                                                        return null;
                                                    })()
                                                )}
                                            </div>
                                            {!item.is_folder && looksLikeUrl(item.content || "") && !isSelectMode && (item.folder_name || activeFolder) !== "TEAM" && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        void openNote(item);
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
                                            {item.is_folder && !!activeFolder && <ArrowRightIcon className="w-4 h-4 text-zinc-600 flex-shrink-0" />}
                                            {/* Date only — badge moved to bottom status bar */}
                                            {!item.is_folder && (item as any).trashed_at && (
                                                <span className="text-[11px] text-red-500/70 font-medium whitespace-nowrap flex-shrink-0">
                                                    {(() => { const days = 7 - Math.floor((Date.now() - new Date((item as any).trashed_at).getTime()) / 86400000); return days > 0 ? `${days}d left` : "expiring"; })()}
                                                </span>
                                            )}
                                            {!item.is_folder && !(item as any).trashed_at && item.updated_at && (
                                                <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap flex-shrink-0">{timeAgo(item.updated_at)}</span>
                                            )}
                                            {item.is_folder && item.latestUpdatedAt && (
                                                <div className="flex items-center justify-end" style={{ width: "15%", flexShrink: 0 }}>
                                                    <span className="text-[11px] text-zinc-500 font-medium whitespace-nowrap">{timeAgo(item.latestUpdatedAt)}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {!item.is_folder && pinnedIds.has(String(item.id)) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); togglePin(String(item.id)); }}
                                                        className="absolute bottom-1 right-1 z-10 p-1 text-white transition"
                                                        title="Unpin"
                                                    >
                                                        <HeartSolidIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                    {looksLikeUrl(item.content || "") && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void openNote(item);
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
                                                        {item.name === "CLAUDE"
                                                            ? <img src="/claude-icon.png" alt="Claude" className="w-14 h-14 object-contain relative z-10" />
                                                            : item.icon
                                                                ? <div style={{ fontSize: item.icon.startsWith("__hero:") ? undefined : "2.8rem", lineHeight: 1 }} className="relative z-10 flex items-center justify-center">
                                                                    <FolderIconDisplay value={item.icon} folderName={item.name || "F"} className="w-12 h-12" />
                                                                  </div>
                                                                : <div style={{ fontSize: "3rem", lineHeight: 1, color: item.color || item.folder_color || palette12[0] }} className="folder-grid-initial font-black relative z-10">{meaningfulInitial(item.name, "F")}</div>
                                                        }
                                                        <div className="folder-grid-name mt-0.5 font-bold line-clamp-1 w-full text-center relative z-10 text-[11px]" style={{ color: item.name === "CLAUDE" ? "#000" : (item.color || item.folder_color || palette12[0]) }}>
                                                            <span className="uppercase">{item.name}</span> <span className="opacity-50 font-normal text-[10px]">({(item.subfolderCount || 0) + (item.count || 0)})</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {(item as any).flag && (
                                                            <span className="absolute top-1 left-1 text-sm leading-none">{(item as any).flag}</span>
                                                        )}
                                                        <div style={{ fontSize: "3rem", lineHeight: 1 }} className="font-black text-white relative z-10">{meaningfulInitial(item.title || "", "N")}</div>
                                                        <div className="font-semibold text-white leading-tight mt-0.5 line-clamp-2 w-full text-[8px]">{item.title}</div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        {/* Infinite scroll sentinel + loading indicator */}
                        {activeFolder && !kanbanMode && (
                            <div
                                ref={notesEndRef}
                                style={!isListMode ? { gridColumn: "1 / -1" } : undefined}
                                className="h-4 w-full"
                            />
                        )}
                        {activeFolder && folderNotesLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </div>
                        )}
{isEmptyView && !editMode && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center px-6 sm:px-10">
                                <div key={quoteIndex} className="empty-quote-anim max-w-[760px] text-center">
                                    <p className="text-white/85 text-base sm:text-xl font-semibold leading-relaxed tracking-tight">{EMPTY_QUOTES[quoteIndex]}</p>
                                </div>
                            </div>
                        )}
                        {isEmptyView && editMode && !folderNotesLoading && (
                            <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center px-4">
                                <p className="text-zinc-600 text-xs font-semibold text-center">No notes in this notebook</p>
                            </div>
                        )}
                        {/* Split-mode load-more sentinel */}
                        {hasMoreSplitItems && (
                            <div ref={splitSentinelRef} className="py-3 text-center text-[10px] text-zinc-600 font-medium select-none">
                                ↓ {filteredDisplayItems.length - splitListPage * SPLIT_PAGE_SIZE} more
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
                    {!isSelectMode && (() => {
                        const depth = folderStack.length; // 0=root, 1=L1, 2=L2, 3+=L3
                        const fabSize = 48;
                        const iconSize = 24;
                        return (
                            <div className="absolute bottom-5 right-4 z-[130]" style={{ filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.55))" }}>
                                <button
                                    key={`fab-${depth}`}
                                    type="button"
                                    onClick={() => {
                                        if (!editMode && depth === 0) { openCreateFolder(); } else { openNewNote(); }
                                    }}
                                    className="fab-alive rounded-full flex items-center justify-center text-black"
                                    style={{
                                        width: fabSize,
                                        height: fabSize,
                                        background: "#ffffff",
                                        boxShadow: "0 0 0 2px rgba(0,0,0,0.25), 0 8px 28px rgba(255,255,255,0.35)",
                                    }}>
                                    {(!editMode && depth === 0) ? <FolderIcon style={{ width: iconSize, height: iconSize }} /> : <PlusIcon style={{ width: iconSize, height: iconSize }} />}
                                </button>
                            </div>
                        );
                    })()}

                    {/* STATS BOTTOM BAR — shown outside split view only (in split view stats appear in right panel) */}
                    {!editMode && (
                    <div className="fixed bottom-4 left-0 right-0 z-[120] hidden sm:flex justify-center items-center gap-2 select-none pointer-events-none tabular-nums" style={{ fontSize: 9, opacity: 0.6 }}>
                        {/* Global stats — grey pill */}
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}>
                            <span style={{ color: "#38bdf8" }}>{dbStats.folderCount} folders</span>
                            <span className="text-zinc-600">·</span>
                            <span style={{ color: "#fb923c" }}>{dbStats.noteCount} notes</span>
                            <span className="text-zinc-600">·</span>
                            <span style={{ color: "#34d399" }}>{dbStats.size}</span>
                        </span>
                        {/* Clock / date */}
                        <span className="text-white/50 font-bold">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-zinc-700">/</span>
                        <span className="text-zinc-600 uppercase tracking-wide">{now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
                        {/* Dice — only in a folder */}
                        {activeFolder && (
                            <button
                                type="button"
                                onClick={() => void randomizeFolderColors()}
                                title="Randomize note colors in this folder"
                                className="pointer-events-auto opacity-35 hover:opacity-90 transition-opacity active:scale-125"
                                style={{ fontSize: 11, lineHeight: 1, cursor: "pointer", background: "none", border: "none", padding: "0 1px" }}
                            >🎲</button>
                        )}
                        {/* Folder or note stats */}
                        {(noteStats ?? folderStats)?.map((chip, i) => (
                            <span key={i} className="flex items-center gap-2">
                                <span className="text-zinc-600">·</span>
                                <span style={{ color: chip.startsWith("Edited") ? "#a78bfa" : "#94a3b8" }}>{chip}</span>
                            </span>
                        ))}
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

            {/* SIDEBAR FOLDER TOOLTIP */}
            {sidebarTooltip && (
                <div className="fixed z-[9999] pointer-events-none select-none"
                    style={{ left: 60, top: sidebarTooltip.y, transform: "translateY(-50%)" }}>
                    {/* Caret arrow pointing left toward icon */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0"
                        style={{ borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderRight: `6px solid ${sidebarTooltip.color}` }} />
                    <div className="px-3 py-1.5 rounded-lg"
                        style={{ background: sidebarTooltip.color, boxShadow: `0 4px 24px ${sidebarTooltip.color}88, 0 1px 6px rgba(0,0,0,0.5)` }}>
                        <span className="text-xs font-black uppercase tracking-widest"
                            style={{ color: isLightColor(sidebarTooltip.color) ? "#000" : "#fff" }}>{sidebarTooltip.name}</span>
                    </div>
                </div>
            )}

            {/* NOTE TYPE PICKER */}
            {showNoteTypePicker && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowNoteTypePicker(false)}>
                    <div className="flex flex-col items-center gap-6 px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">New Note</div>
                        <div className="flex items-center gap-8">
                            {/* TYPE ball → rich editor */}
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
                                                            <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black leading-none border border-white/25" style={{ backgroundColor: color, color: isLightColor(color) ? "#000" : "#fff", borderRadius: 4 }}>
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
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(["Text", "Checklist", "Graph", "Mindmap", "Stack"] as const).map((mode) => {
                                        const active = noteViewMode === mode;
                                        const icon = mode === "Text" ? (
                                            <Bars3Icon className="w-4 h-4" />
                                        ) : mode === "Checklist" ? (
                                            <CheckCircleIcon className="w-4 h-4" />
                                        ) : mode === "Graph" ? (
                                            <CubeTransparentIcon className="w-4 h-4" />
                                        ) : mode === "Mindmap" ? (
                                            <ShareIcon className="w-4 h-4" />
                                        ) : (
                                            <RectangleStackIcon className="w-4 h-4" />
                                        );
                                        const isLastOdd = mode === "Stack"; // 5th item — span full width
                                        return (
                                            <button key={mode} type="button"
                                                onClick={() => {
                                                    if (mode === "Checklist") {
                                                        if (graphMode) toggleGraphMode();
                                                        if (mindmapMode) toggleMindmapMode();
                                                        if (stackMode) toggleStackMode();
                                                        // Rich note → convert to plain first, then checklist
                                                        if (!listMode && noteType === "rich") switchToPlain();
                                                        toggleListMode();
                                                    } else {
                                                        if (listMode) toggleListMode();
                                                        if (graphMode) toggleGraphMode();
                                                        if (mindmapMode) toggleMindmapMode();
                                                        if (stackMode) toggleStackMode();
                                                        if (mode === "Graph") toggleGraphMode();
                                                        else if (mode === "Mindmap") toggleMindmapMode();
                                                        else if (mode === "Stack") toggleStackMode();
                                                        else if (mode === "Text") {
                                                            if (markdownMode) toggleMarkdownMode();
                                                            if (htmlMode) toggleHtmlMode();
                                                        }
                                                    }
                                                    if (window.innerWidth < 1024) setShowNoteActions(false);
                                                }}
                                                className={`flex flex-col items-center gap-1.5 py-3 px-1 transition-all text-[10px] font-black${isLastOdd ? " col-span-2" : ""}`}
                                                style={{
                                                    background: active ? `${noteColor}25` : "rgba(255,255,255,0.04)",
                                                    color: active ? noteColor : "#71717a",
                                                    border: `1.5px solid ${active ? noteColor + "60" : "transparent"}`,
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
                    <div className="note-actions-panel bg-zinc-900 border border-white/15 w-full max-w-sm flex flex-col overflow-hidden lg:max-w-[300px] lg:w-[300px] lg:h-full lg:border-l lg:border-r-0 lg:border-t-0 lg:border-b-0 lg:rounded-none relative" onClick={(e) => e.stopPropagation()}>

                        {/* Depth level watermark */}
                        <div className="absolute inset-0 flex items-end justify-end pointer-events-none z-0 overflow-hidden pb-16 pr-4">
                            <span className="text-[160px] font-black text-white/[0.04] select-none leading-none tracking-tighter">
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
                            {activeFolder && !isGlobalSettings ? (
                                <>
                                    <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-black leading-none overflow-hidden rounded-lg"
                                        style={{ backgroundColor: activeFolder === "CLAUDE" ? "#fff" : (activeFolderColor || "#888"), color: activeFolder === "CLAUDE" ? "#000" : "#fff" }}>
                                        {activeFolder === "CLAUDE" ? <img src="/claude-icon.png" alt="Claude" className="w-full h-full object-contain p-1" /> : <FolderIconDisplay value={folderIcons[activeFolder] || ""} folderName={activeFolder} className="w-4 h-4" />}
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
                            {activeFolder && !isGlobalSettings && (
                                <div>
                                    <button type="button"
                                        onClick={() => { setShowFolderColorPicker((v) => !v); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }}
                                        className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition">
                                        <SwatchIcon className="w-5 h-5 flex-shrink-0" />
                                        <span className="text-xs font-black tracking-wide flex-1">Color</span>
                                        <div className="w-7 h-7 flex-shrink-0 border border-white/40" style={{ backgroundColor: activeFolderColor, borderRadius: 4 }} />
                                    </button>
                                    {showFolderColorPicker && (
                                        <div className="grid grid-cols-7 gap-2 px-5 pb-5 pt-1">
                                            {colorPickerPalette.map((c) => (
                                                <button key={c} type="button"
                                                    onClick={() => { applySingleFolderColor(c); setShowFolderColorPicker(false); }}
                                                    className="aspect-square w-full transition-all"
                                                    style={{
                                                        background: c,
                                                        border: activeFolderColor === c ? `2.5px solid rgba(255,255,255,0.9)` : `1.5px solid rgba(255,255,255,0.15)`,
                                                        boxShadow: activeFolderColor === c ? `0 0 0 2px ${c}80` : "none",
                                                        borderRadius: 4,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
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
                                        const filteredEmoji = FOLDER_ICON_EMOJIS.filter(e => !q || e.includes(q));
                                        return (
                                            <div className="px-4 pb-4">
                                                {/* Tabs */}
                                                <div className="flex gap-1 mb-3 border-b border-white/10 pb-2">
                                                    {(["icons", "emoji"] as const).map(tab => (
                                                        <button key={tab} type="button"
                                                            onClick={() => { setIconPickerTab(tab); setIconPickerSearch(""); }}
                                                            className={`px-3 py-1 text-[11px] font-black tracking-wide transition-colors ${iconPickerTab === tab ? "text-white border-b-2 border-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                                                            {tab === "icons" ? "ICONS" : "EMOJI"}
                                                        </button>
                                                    ))}
                                                    <button type="button"
                                                        onClick={clearIcon}
                                                        className="ml-auto px-3 py-1 text-[11px] font-black tracking-wide text-zinc-600 hover:text-zinc-300 transition-colors">
                                                        NONE
                                                    </button>
                                                </div>
                                                {/* Search */}
                                                <input
                                                    type="text"
                                                    value={iconPickerSearch}
                                                    onChange={e => setIconPickerSearch(e.target.value)}
                                                    placeholder="Search..."
                                                    className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 font-mono mb-2"
                                                />
                                                {/* Icons grid */}
                                                {iconPickerTab === "icons" && (
                                                    <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto">
                                                        {filteredHero.map(({ key, label, Icon }) => {
                                                            const val = `__hero:${key}`;
                                                            return (
                                                                <button key={key} type="button" title={label}
                                                                    onClick={() => selectIcon(val)}
                                                                    className={`aspect-square flex items-center justify-center transition-all hover:bg-white/15 rounded ${curIcon === val ? "bg-white/20 ring-1 ring-white/60" : ""}`}>
                                                                    <Icon className="w-4 h-4 text-white" />
                                                                </button>
                                                            );
                                                        })}
                                                        {filteredHero.length === 0 && <p className="col-span-8 text-[10px] text-zinc-600 py-2 text-center">No icons match</p>}
                                                    </div>
                                                )}
                                                {iconPickerTab === "emoji" && (
                                                    <div className="grid grid-cols-8 gap-1 max-h-44 overflow-y-auto">
                                                        {filteredEmoji.map((emoji) => (
                                                            <button key={emoji} type="button"
                                                                onClick={() => selectIcon(emoji)}
                                                                className={`aspect-square flex items-center justify-center text-xl transition-all hover:bg-white/15 rounded ${curIcon === emoji ? "bg-white/20 ring-1 ring-white/60" : ""}`}>
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                        {filteredEmoji.length === 0 && <p className="col-span-8 text-[10px] text-zinc-600 py-2 text-center">No emoji match</p>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            {/* NEW SUBFOLDER */}
                            {activeFolder && !isGlobalSettings && (
                                <button type="button"
                                    className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={() => { setShowFolderActions(false); openCreateFolder(); }}>
                                    <span className="relative flex-shrink-0 w-5 h-5">
                                        <FolderIcon className="w-5 h-5" />
                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white text-black flex items-center justify-center" style={{ fontSize: 8, fontWeight: 900, lineHeight: 1 }}>+</span>
                                    </span>
                                    <span className="text-xs font-black tracking-wide">New Folder</span>
                                </button>
                            )}
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
                                                                <span className="w-[18px] h-[18px] flex-shrink-0 inline-flex items-center justify-center text-[10px] font-black leading-none border border-white/25" style={{ backgroundColor: color, color: isLightColor(color) ? "#000" : "#fff", borderRadius: 4 }}>
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
                            {/* COPY ALL NOTES TO CLIPBOARD */}
                            {activeFolder && !isGlobalSettings && (
                                <button type="button" className="w-full flex items-center gap-4 px-6 py-4 text-left text-zinc-300 hover:bg-white/5 hover:text-white active:bg-white/10 transition"
                                    onClick={async () => {
                                        const directNotes = dbData.filter((n: any) => !n.is_folder && n.folder_name === activeFolder && !n.trashed_at);
                                        if (directNotes.length === 0 || directNotes.length > 25) return;
                                        const token = await getAuthToken();
                                        const res = await fetch(`/api/stickies?folder=${encodeURIComponent(activeFolder)}&copy=1`, { headers: { Authorization: `Bearer ${token}` } });
                                        if (!res.ok) return;
                                        const { notes } = await res.json();
                                        const text = (notes as any[]).map((n: any) => {
                                            const t = (n.title || "Untitled").trim();
                                            const c = (n.content || "").trim();
                                            return c ? `# ${t}\n\n${c}` : `# ${t}`;
                                        }).join("\n\n---\n\n");
                                        try {
                                            await navigator.clipboard.writeText(text);
                                        } catch {
                                            const ta = document.createElement("textarea");
                                            ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
                                            document.body.appendChild(ta); ta.select();
                                            document.execCommand("copy");
                                            document.body.removeChild(ta);
                                        }
                                        setShowFolderActions(false);
                                        showToast(`Copied ${notes.length} note${notes.length === 1 ? "" : "s"} to clipboard`, activeFolderColor, true);
                                    }}>
                                    <ClipboardDocumentListIcon className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black tracking-wide">Copy all notes</span>
                                </button>
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
                                                    <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[11px] font-black leading-none overflow-hidden" style={{ backgroundColor: "#fff", color: defaultFolder === "CLAUDE" ? "#000" : dfColor, fontSize: 13 }}>
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
                                                            <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-[11px] font-black leading-none overflow-hidden" style={{ backgroundColor: "#fff", color: f.name === "CLAUDE" ? "#000" : f.color, fontSize: 13 }}>
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
                                {/* VIEW MODE — hidden in split mode (auto-list) */}
                                {!editMode && (
                                <div className="px-6 py-2 border-b border-white/[0.06]">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">View</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button type="button" onClick={() => { setMainListMode("list"); setKanbanMode(false); }}
                                            className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition ${mainListMode === "list" && !kanbanMode ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                            <Bars3Icon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">List</span>
                                        </button>
                                        <button type="button" onClick={() => { setMainListMode("thumb"); setKanbanMode(false); }}
                                            className={`py-1.5 rounded flex flex-col items-center gap-0.5 transition ${mainListMode === "thumb" && !kanbanMode ? "bg-white text-black" : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"}`}>
                                            <Squares2X2Icon className="w-4 h-4" />
                                            <span className="text-[9px] font-black uppercase tracking-wide">Thumb</span>
                                        </button>
                                    </div>
                                </div>
                                )}
                                {/* SPLIT LAYOUT TOGGLE */}
                                <div className="px-6 py-2 border-b border-white/[0.06]">
                                    <button type="button" onClick={() => { setEditMode(v => !v); setShowFolderActions(false); }}
                                        className="w-full flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ViewColumnsIcon className="w-4 h-4 text-zinc-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Split</span>
                                        </div>
                                        <div className={`w-9 h-5 rounded-full transition-colors relative ${editMode ? "bg-white" : "bg-white/10"}`}>
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${editMode ? "left-[18px] bg-black" : "left-0.5 bg-zinc-500"}`} />
                                        </div>
                                    </button>
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
                            <button type="button" onClick={() => { setShowFolderActions(false); setIsGlobalSettings(false); setShowFolderColorPicker(false); setShowFolderIconPicker(false); setShowFolderMovePicker(false); }} className="flex-1 py-3 bg-white text-black font-black uppercase text-xs tracking-wide hover:bg-zinc-100 transition">Close</button>
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
                <div className="fixed inset-0 z-[99990] flex items-start justify-center pt-[8vh] px-4 bg-black/60 backdrop-blur-sm"
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
                                placeholder={cmdKInFile ? "SEARCH IN FILE…" : "SEARCH NOTES…"}
                                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-zinc-600 font-medium"
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
                                                            loadFolderNotes(folder.name, false).then(() => {
                                                                const first = (getNotesCacheForFolder(folder.name) as any[])
                                                                    .filter((n: any) => !n.is_folder)
                                                                    .sort((a: any, b: any) => (b.updated_at || "").localeCompare(a.updated_at || ""))[0];
                                                                if (first) void openNote(first);
                                                            });
                                                            if (editMode) localStorage.setItem("stickies-split-notebook", folder.name);
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${i === cmdKCursor ? "bg-white/10" : "hover:bg-white/5"}`}>
                                                        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center text-sm font-black overflow-hidden"
                                                            style={{ backgroundColor: "#fff", color: folder.name === "CLAUDE" ? "#000" : (folder.color || "#3f3f46") }}>
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
                                        void notesApi.update(noteId, { is_public: newPublic });
                                        setEditingNote((prev: any) => prev ? { ...prev, is_public: newPublic } : prev);
                                        setDbData((prev: any[]) => prev.map((r: any) => String(r.id) === noteId ? { ...r, is_public: newPublic } : r));
                                        if (newPublic) {
                                            const url = `${window.location.origin}/?noteId=${noteId}`;
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
                                        background: isOn ? "#22c55e" : "rgba(255,255,255,0.12)",
                                        border: "none",
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

                        {/* Link row — QR · Data · Burn */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Link</p>
                            <button type="button" onClick={() => { setSharePickerOpen(false); openNoteLinkQr(); }} className={`${shareBtn} bg-emerald-500`} title="QR link">
                                <QrCodeIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">QR</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); openNoteDataQr(); }} className={`${shareBtn} bg-pink-500`} title="QR data">
                                <QrCodeIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Data</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); shareBurnLink(); }} className={`${shareBtn} bg-orange-500`} title="Burn link (1×)">
                                <QrCodeIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Burn</span>
                            </button>
                        </div>

                        {/* Email row — Gmail · Mail */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Email</p>
                            <button type="button"
                                onClick={() => { const t = encodeURIComponent(title.trim() || editingNote?.title || "Note"); const b = encodeURIComponent((content || editingNote?.content || "").slice(0, 2000)); window.open(`https://mail.google.com/mail/?view=cm&su=${t}&body=${b}`, "_blank"); setSharePickerOpen(false); }}
                                className={`${shareBtn} bg-[#EA4335]`} title="Gmail">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                                </svg>
                                <span className="text-[8px] font-black uppercase">Gmail</span>
                            </button>
                            <button type="button"
                                onClick={() => { const t = encodeURIComponent(title.trim() || editingNote?.title || "Note"); const b = encodeURIComponent((content || editingNote?.content || "").slice(0, 2000)); window.location.href = `mailto:?subject=${t}&body=${b}`; setSharePickerOpen(false); }}
                                className={`${shareBtn} bg-[#007AFF]`} title="Mail App">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span className="text-[8px] font-black uppercase">Mail</span>
                            </button>
                        </div>

                        {/* Mobile — push to other sessions */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Mobile</p>
                            <button type="button" onClick={() => { void sendToMobile(); }}
                                className={`${shareBtn} bg-sky-500`} title="Send to all other connected sessions">
                                <DevicePhoneMobileIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Send</span>
                            </button>
                        </div>

                        {/* Calendar — Apple .ics / Google Calendar */}
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Calendar</p>
                            <button type="button"
                                onClick={() => { const today = new Date(); setCalTarget("apple"); setCalDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`); setCalTime("09:00"); setCalRepeat("none"); setSharePickerOpen(false); setCalModalOpen(true); }}
                                className={`${shareBtn} bg-zinc-600`} title="Add to Apple Calendar (.ics)">
                                <CalendarDaysIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Apple</span>
                            </button>
                            <button type="button"
                                onClick={() => { const today = new Date(); setCalTarget("google"); setCalDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`); setCalTime("09:00"); setCalRepeat("none"); setSharePickerOpen(false); setCalModalOpen(true); }}
                                className={`${shareBtn} bg-[#4285F4]`} title="Add to Google Calendar">
                                <CalendarDaysIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">Google</span>
                            </button>
                        </div>

                        {/* Download (mindmap only) */}
                        {mindmapMode && (
                        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                            <p className="text-xs font-black text-white tracking-wide flex-1">Download</p>
                            <button type="button" onClick={() => { setSharePickerOpen(false); void downloadMindmapPng(); }} className={`${shareBtn} bg-green-600`} title="Download PNG">
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">PNG</span>
                            </button>
                            <button type="button" onClick={() => { setSharePickerOpen(false); void downloadMindmapPdf(); }} className={`${shareBtn} bg-purple-600`} title="Download PDF">
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                <span className="text-[8px] font-black uppercase">PDF</span>
                            </button>
                        </div>
                        )}

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

            {confirmDelete && (() => {
                const isFolder = confirmDelete.type === "folder";
                const isTrash = isFolder ? confirmDelete.folderName === "TRASH" : dbData.find(r => String(r.id) === (confirmDelete as any).noteId)?.folder_name === "TRASH";
                const label = isFolder ? confirmDelete.folderName : (confirmDelete as any).noteName || "Untitled";
                const folderColor = isFolder ? (folderColors[confirmDelete.folderName] || "#3a3a3a") : null;
                const nc = isFolder ? null : ((confirmDelete as any).noteColor || "#71717a");
                const initial = isFolder ? null : meaningfulInitial(label, "N");
                return (
                    <div className="fixed inset-0 z-[620] bg-black/90 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
                        <div className="bg-zinc-900 border-2 border-red-500 p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
                            {/* Icon */}
                            {isFolder ? (
                                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center" style={{ background: folderColor ?? "#3a3a3a", borderRadius: 8 }}>
                                    <FolderIcon className="w-7 h-7 text-white" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center font-black overflow-hidden"
                                    style={{ background: nc!, color: isLightColor(nc!) ? "#000" : "#fff", borderRadius: "6px 6px 6px 16px", fontSize: 26, boxShadow: `2px 3px 8px ${nc}55` }}>
                                    {initial}
                                </div>
                            )}
                            <p className="text-base font-black text-white mb-4 truncate px-2">{label}</p>
                            <div className="flex flex-col gap-2">
                                <button type="button"
                                    onClick={() => { const action = confirmDelete; setConfirmDelete(null); if (action.type === "folder") void deleteFolderByName(action.folderName); else void deleteCurrentNote(action.noteId, action.noteName); }}
                                    className="w-full py-3 bg-red-600 text-white font-black uppercase text-xs tracking-widest">
                                    {isTrash ? "Delete Forever" : isFolder ? "Delete Folder" : "Move to Trash"}
                                </button>
                                <button type="button" onClick={() => setConfirmDelete(null)} className="w-full py-3 bg-white text-black font-black uppercase text-xs tracking-widest">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {iconPickerFolder !== null && (() => {
                const q2 = iconPickerSearch.toLowerCase();
                const cur2 = folderIcons[iconPickerFolder] || "";
                const selectIcon2 = (val: string) => { setFolderIcons((prev) => ({ ...prev, [iconPickerFolder]: val })); void saveFolderIconToDb(iconPickerFolder, val); setIconPickerFolder(null); setIconPickerSearch(""); };
                const clearIcon2 = () => { setFolderIcons((prev) => { const next = { ...prev }; delete next[iconPickerFolder]; return next; }); void saveFolderIconToDb(iconPickerFolder, ""); setIconPickerFolder(null); setIconPickerSearch(""); };
                const filteredHero2 = FOLDER_HERO_ICONS.filter(e => !q2 || e.label.includes(q2) || e.key.toLowerCase().includes(q2));
                const filteredEmoji2 = FOLDER_ICON_EMOJIS.filter(e => !q2 || e.includes(q2));
                return (
                    <div className="fixed inset-0 z-[630] bg-black/90 flex items-center justify-center p-4" onClick={() => { setIconPickerFolder(null); setIconPickerSearch(""); }}>
                        <div className="bg-zinc-900 border border-white/15 p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-black uppercase tracking-wider text-white">Folder Icon</h2>
                                <span className="text-xs text-zinc-400 uppercase">{iconPickerFolder}</span>
                            </div>
                            {/* Tabs */}
                            <div className="flex gap-1 mb-3 border-b border-white/10 pb-2">
                                {(["icons", "emoji"] as const).map(tab => (
                                    <button key={tab} type="button"
                                        onClick={() => { setIconPickerTab(tab); setIconPickerSearch(""); }}
                                        className={`px-3 py-1 text-[11px] font-black tracking-wide transition-colors ${iconPickerTab === tab ? "text-white border-b-2 border-white" : "text-zinc-500 hover:text-zinc-300"}`}>
                                        {tab === "icons" ? "ICONS" : "EMOJI"}
                                    </button>
                                ))}
                                <button type="button" onClick={clearIcon2} className="ml-auto px-3 py-1 text-[11px] font-black tracking-wide text-zinc-600 hover:text-zinc-300 transition-colors">NONE</button>
                            </div>
                            {/* Search */}
                            <input type="text" value={iconPickerSearch} onChange={e => setIconPickerSearch(e.target.value)}
                                placeholder="Search..." autoFocus
                                className="w-full bg-black border border-white/15 outline-none focus:border-white/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 font-mono mb-3" />
                            {iconPickerTab === "icons" && (
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
                            {iconPickerTab === "emoji" && (
                                <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
                                    {filteredEmoji2.map((emoji) => (
                                        <button key={emoji} type="button" onClick={() => selectIcon2(emoji)}
                                            className={`aspect-square flex items-center justify-center text-2xl rounded transition-all hover:bg-white/15 ${cur2 === emoji ? "bg-white/20 ring-1 ring-cyan-400" : ""}`}>
                                            {emoji}
                                        </button>
                                    ))}
                                    {filteredEmoji2.length === 0 && <p className="col-span-8 text-[10px] text-zinc-600 py-2 text-center">No emoji match</p>}
                                </div>
                            )}
                            <button type="button" onClick={() => { setIconPickerFolder(null); setIconPickerSearch(""); }} className="w-full mt-4 py-2.5 bg-zinc-800 text-white font-black uppercase text-xs tracking-wide hover:bg-zinc-700 transition-colors">Cancel</button>
                        </div>
                    </div>
                );
            })()}

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

const HeaderIconBtn = ({ icon: Icon, label, onClick, style, active }: any) => (
    <button type="button" onClick={onClick} className={`p-3 transition ${active ? "text-white bg-white/15" : "text-zinc-500 hover:text-white hover:bg-white/10"}`} title={label} aria-label={label} style={style}>
        <Icon className="w-[26px] h-[26px]" />
    </button>
);
