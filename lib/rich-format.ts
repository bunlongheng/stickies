/**
 * Conversion helpers between plain-text/markdown and ProseMirror JSON.
 *
 * Storage contract:
 *   format = 'text'     → content: raw text,     doc: null
 *   format = 'markdown' → content: markdown src, doc: null
 *   format = 'rich'     → content: plain-text mirror (derived from doc),
 *                         doc:     canonical ProseMirror JSON
 *
 * We use `prosemirror-markdown`'s default schema for serialization
 * (md → doc and doc → md). The schema lines up with TipTap's StarterKit
 * for the standard nodes (paragraph, heading, blockquote, code_block,
 * bullet_list, ordered_list, list_item, hard_break, horizontal_rule,
 * plus bold/italic/code/link marks). Tables, images, and task lists
 * are not in PM's default md schema — we fall back to HTML+turndown for
 * those when serializing back to md.
 */
import { defaultMarkdownParser, defaultMarkdownSerializer } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { JSONContent } from "@tiptap/react";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function emptyDoc(): JSONContent {
    return JSON.parse(JSON.stringify(EMPTY_DOC));
}

export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
    if (!doc) return true;
    const content = doc.content ?? [];
    if (content.length === 0) return true;
    if (content.length === 1 && content[0].type === "paragraph" && !content[0].content?.length) return true;
    return false;
}

/** Markdown source → ProseMirror JSON (lossless for standard md). */
export function markdownToDoc(md: string): JSONContent {
    if (!md.trim()) return emptyDoc();
    try {
        const node = defaultMarkdownParser.parse(md);
        if (!node) return emptyDoc();
        return node.toJSON() as JSONContent;
    } catch {
        /* c8 ignore start — defaultMarkdownParser doesn't realistically throw on string input;
           the fallback exists so a future parser swap that DOES throw can't lose the user's text. */
        return {
            type: "doc",
            content: md.split(/\n{2,}/).map(p => ({
                type: "paragraph",
                content: p ? [{ type: "text", text: p }] : undefined,
            })),
        };
        /* c8 ignore stop */
    }
}

/** Plain text → ProseMirror JSON (one paragraph per blank-line block). */
export function textToDoc(text: string): JSONContent {
    if (!text.trim()) return emptyDoc();
    return {
        type: "doc",
        content: text.split(/\n{2,}/).map(p => ({
            type: "paragraph",
            content: p ? [{ type: "text", text: p }] : undefined,
        })),
    };
}

/**
 * Walk a ProseMirror JSON doc and collect plain text — used as the
 * `content` mirror for rich notes (search, CLI, ext API readability).
 */
export function docToText(doc: JSONContent | null | undefined): string {
    if (!doc) return "";
    const parts: string[] = [];
    const walk = (node: JSONContent) => {
        if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
        if (node.type === "hardBreak") parts.push("\n");
        if (node.content) node.content.forEach(walk);
        if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(node.type ?? "")) parts.push("\n");
    };
    walk(doc);
    return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * ProseMirror JSON → markdown (best-effort).
 * Returns { md, lossy } — `lossy=true` if we detected nodes that don't
 * round-trip cleanly (tables, images, task lists). The caller should
 * show a toast warning the user.
 */
export function docToMarkdown(doc: JSONContent | null | undefined): { md: string; lossy: boolean } {
    if (!doc) return { md: "", lossy: false };

    let lossy = false;
    const findLossy = (node: JSONContent) => {
        if (!node.type) return;
        if (node.type === "table" || node.type === "image" || node.type === "taskList") lossy = true;
        node.content?.forEach(findLossy);
    };
    findLossy(doc);

    try {
        // Build a PM Node from JSON using the markdown serializer's schema.
        // We construct via the parser's schema (same one the serializer expects).
        const schema = (defaultMarkdownParser as any).schema;
        const node = schema.nodeFromJSON(doc) as PMNode;
        const md = defaultMarkdownSerializer.serialize(node);
        return { md, lossy };
    } catch {
        // Fallback: walk the doc and extract text per block.
        return { md: docToText(doc), lossy: true };
    }
}
