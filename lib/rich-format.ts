/**
 * Conversion helpers between plain text and ProseMirror JSON.
 *
 * Storage contract:
 *   format = 'text'  → content: raw text,     doc: null
 *   format = 'rich'  → content: plain-text mirror (derived from doc),
 *                      doc:     canonical ProseMirror JSON
 */
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
