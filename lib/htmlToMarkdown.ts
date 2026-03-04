/**
 * htmlToMarkdown.ts — browser-side utility
 *
 * Converts rich HTML (e.g. pasted from Notion) into Markdown.
 * Inline images are fetched and embedded as base64 data URIs —
 * no external storage required.
 */

import TurndownService from "turndown";

/** Fetch an image and return it as a base64 data URI. Returns original src on failure. */
async function toBase64(src: string): Promise<string> {
    if (src.startsWith("data:")) return src; // already base64

    try {
        const res = await fetch(src, { mode: "cors" });
        if (!res.ok) return src;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(src);
            reader.readAsDataURL(blob);
        });
    } catch {
        return src;
    }
}

/** Convert rich HTML to Markdown, embedding images as base64. */
export async function htmlToMarkdown(html: string, _noteTitle: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove Notion-specific junk elements
    doc.querySelectorAll("[data-token-index], .notion-selectable-halo, meta, style").forEach(el => el.remove());

    // Embed all images as base64
    const imgs = Array.from(doc.querySelectorAll("img"));
    if (imgs.length > 0) {
        const b64s = await Promise.all(imgs.map(img => toBase64(img.getAttribute("src") ?? "")));
        imgs.forEach((img, i) => {
            img.setAttribute("src", b64s[i]);
            if (!img.getAttribute("alt")) img.setAttribute("alt", `image-${i + 1}`);
        });
    }

    const td = new TurndownService({
        headingStyle: "atx",
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
        hr: "---",
    });

    // Preserve inline images
    td.addRule("images", {
        filter: "img",
        replacement: (_content, node) => {
            const img = node as HTMLImageElement;
            const src = img.getAttribute("src") ?? "";
            const alt = img.getAttribute("alt") ?? "";
            if (!src) return "";
            return `\n![${alt}](${src})\n`;
        },
    });

    // Notion checkboxes → GFM task list items
    td.addRule("notionCheckbox", {
        filter: (node) => node.nodeName === "INPUT" && (node as HTMLInputElement).type === "checkbox",
        replacement: (_content, node) => {
            const checked = (node as HTMLInputElement).checked;
            return checked ? "[x] " : "[ ] ";
        },
    });

    // Strikethrough
    td.addRule("strikethrough", {
        filter: ["del", "s"],
        replacement: (content) => `~~${content}~~`,
    });

    return td.turndown(doc.body.innerHTML).trim();
}
