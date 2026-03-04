/**
 * htmlToMarkdown.ts — browser-side utility
 *
 * Converts rich HTML (e.g. pasted from Notion) into Markdown.
 * Inline images are uploaded to Supabase storage (or Google Drive when
 * NEXT_PUBLIC_USE_GDRIVE=1 and credentials are configured server-side).
 *
 * Folder structure mirrors Google Drive intent:
 *   stickies-files/{noteTitle}/{timestamp}-image-{n}.png
 */

import TurndownService from "turndown";

const API_KEY = process.env.NEXT_PUBLIC_STICKIES_API_KEY ?? "";

/** Upload a single image (base64 data URI or remote URL) and return the new public URL. */
async function uploadImage(src: string, noteTitle: string, index: number): Promise<string> {
    let blob: Blob | null = null;

    if (src.startsWith("data:")) {
        // Base64 data URI → convert to blob
        try {
            const res = await fetch(src);
            blob = await res.blob();
        } catch {
            return src;
        }
    } else if (src.startsWith("http")) {
        // Remote URL (Notion CDN, etc.) — re-upload so links don't expire
        try {
            const res = await fetch(src, { mode: "cors" });
            if (res.ok) blob = await res.blob();
        } catch {
            // CORS blocked or network error — keep original URL
            return src;
        }
    }

    if (!blob) return src;

    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const filename = `image-${index + 1}.${ext}`;
    // Use note title as the "folder" — mirrors the Google Drive folder structure
    const folder = noteTitle.replace(/[^a-zA-Z0-9\-_]/g, "_").slice(0, 60) || "paste";

    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("noteId", folder);

    try {
        const res = await fetch("/api/stickies/upload", {
            method: "POST",
            headers: { Authorization: `Bearer ${API_KEY}` },
            body: formData,
        });
        if (!res.ok) return src;
        const data = await res.json();
        return (data.url as string) ?? src;
    } catch {
        return src;
    }
}

/** Convert rich HTML to Markdown, uploading any embedded images inline. */
export async function htmlToMarkdown(html: string, noteTitle: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove Notion-specific junk elements
    doc.querySelectorAll("[data-token-index], .notion-selectable-halo, meta, style").forEach(el => el.remove());

    // Collect all img tags and upload in parallel
    const imgs = Array.from(doc.querySelectorAll("img"));
    if (imgs.length > 0) {
        const newUrls = await Promise.all(
            imgs.map((img, i) => uploadImage(img.getAttribute("src") ?? "", noteTitle, i))
        );
        imgs.forEach((img, i) => {
            img.setAttribute("src", newUrls[i]);
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
