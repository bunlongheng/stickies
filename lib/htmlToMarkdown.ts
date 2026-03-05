/**
 * htmlToMarkdown.ts — browser-side utility
 *
 * Converts rich HTML (e.g. pasted from Notion) into Markdown.
 * Images are uploaded to Google Drive and embedded as short public URLs.
 * Falls back to Supabase storage if Google Drive is not configured.
 */

import TurndownService from "turndown";

/** Upload an image src (remote URL or data URI) to storage, return public URL. */
async function uploadImageSrc(src: string, noteId: string, index: number, authToken: string): Promise<string> {
    let blob: Blob | null = null;

    if (src.startsWith("data:")) {
        try { blob = await (await fetch(src)).blob(); } catch { return src; }
    } else if (src.startsWith("http")) {
        try {
            const proxied = await fetch(`/api/stickies/img-proxy?url=${encodeURIComponent(src)}`);
            if (proxied.ok) {
                const dataUri = await proxied.text();
                if (dataUri.startsWith("data:")) {
                    blob = await (await fetch(dataUri)).blob();
                }
            }
        } catch { return src; }
    }

    if (!blob) return src;

    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const filename = `image-${index + 1}.${ext}`;
    const form = new FormData();
    form.append("file", blob, filename);
    form.append("noteId", noteId);

    try {
        // Try Google Drive first, fall back to Supabase
        const res = await fetch("/api/stickies/gdrive", {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: form,
        });
        if (res.ok) {
            const data = await res.json();
            if (data.url) return data.url as string;
        }
        // Fallback: Supabase storage
        const res2 = await fetch("/api/stickies/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
            body: form,
        });
        if (!res2.ok) return src;
        const data2 = await res2.json();
        return (data2.url as string) ?? src;
    } catch {
        return src;
    }
}

/** Convert rich HTML to Markdown, uploading images to storage. */
export async function htmlToMarkdown(html: string, noteId: string, authToken: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    doc.querySelectorAll("[data-token-index], .notion-selectable-halo, meta, style").forEach(el => el.remove());

    const imgs = Array.from(doc.querySelectorAll("img"));
    if (imgs.length > 0) {
        const urls = await Promise.all(imgs.map((img, i) =>
            uploadImageSrc(img.getAttribute("src") ?? "", noteId, i, authToken)
        ));
        imgs.forEach((img, i) => {
            img.setAttribute("src", urls[i]);
            if (!img.getAttribute("alt")) img.setAttribute("alt", `image-${i + 1}`);
        });
    }

    const td = new TurndownService({
        headingStyle: "atx",
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
        hr: "---",
    });

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

    td.addRule("notionCheckbox", {
        filter: (node) => node.nodeName === "INPUT" && (node as HTMLInputElement).type === "checkbox",
        replacement: (_content, node) => ((node as HTMLInputElement).checked ? "[x] " : "[ ] "),
    });

    td.addRule("strikethrough", {
        filter: ["del", "s"],
        replacement: (content) => `~~${content}~~`,
    });

    return td.turndown(doc.body.innerHTML).trim();
}
