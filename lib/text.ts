// Pure text/date formatting helpers for the notes UI. No React, no app state.

// First letter/number/emoji of a string, uppercased; fallback if none found.
export function meaningfulInitial(text: string, fallback = "N"): string {
    const first = [...(text || "")].find(c => /[\p{L}\p{N}\p{Emoji_Presentation}]/u.test(c));
    return (first ?? fallback).toUpperCase();
}

// Collapse a note body to a one-line preview: strip base64 images, HTML tags, whitespace.
export function previewText(raw: string): string {
    return raw
        .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "[image]")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Relative "time ago" label (just now / 5m / 3h / 2d / 4mo / 1y ago).
export function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
}

// True if the trimmed text is exactly an http(s) URL.
export function looksLikeUrl(text: string): boolean {
    return /^https?:\/\/\S+$/.test(text.trim());
}

// URL-safe slug: lowercase, non-alphanumerics collapsed to single hyphens, edges trimmed.
export function toUrlToken(value: string): string {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export interface InlineImage { index: number; alt: string; url: string; line: number }

// Parse markdown ![alt](url) patterns, returning each match's char index, alt,
// url, and 0-based line number so the editor can map images to their position.
export function parseInlineImages(text: string): InlineImage[] {
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const results: InlineImage[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        results.push({ index: m.index, alt: m[1], url: m[2], line: text.slice(0, m.index).split("\n").length - 1 });
    }
    return results;
}
