// Full-length note -> PNG capture (the share sheet's "Download" row).
// Captures the ENTIRE note height (like a browser full-page screenshot), not just
// the visible viewport:
//  - html notes render in an offscreen same-origin iframe (same sandbox pattern as
//    the split-view preview - scripts do NOT run, so script-drawn canvases are
//    omitted) sized to the document's full scrollHeight.
//  - rich notes capture their live preview node, temporarily expanded.
//  - text/code/json notes render a styled offscreen replica of the raw content.

const CAPTURE_WIDTH = 900;
// A 2x-pixelRatio canvas past this height risks hanging or OOM-ing the tab on a very
// long note. Clamp the output canvas and notify the caller rather than freezing.
const MAX_CAPTURE_HEIGHT = 20000;

/** screencapture-<slug>-YYYY-MM-DD-HH_MM_SS.png (GoFullPage-style naming). */
export function captureFilename(title: string, d: Date = new Date()): string {
    const slug = (title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "note";
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}`;
    return `screencapture-${slug}-${stamp}.png`;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// 1x1 transparent png - keeps cross-origin <img> failures (CDN badges etc.) from
// aborting the whole capture.
const PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// toPng with a fallback: cross-origin stylesheets without CORS make html-to-image
// throw SecurityError while embedding web fonts (reading cssRules). Retry with
// font embedding skipped rather than failing the whole capture.
async function toPngSafe(node: HTMLElement, opts: Record<string, unknown>): Promise<string> {
    const { toPng } = await import("html-to-image");
    try {
        return await toPng(node, opts);
    } catch {
        return await toPng(node, { ...opts, skipFonts: true, fontEmbedCSS: "" });
    }
}

async function toPngExpanded(node: HTMLElement, bg: string, onClamp?: () => void): Promise<string> {
    const h = Math.min(node.scrollHeight, MAX_CAPTURE_HEIGHT);
    if (node.scrollHeight > MAX_CAPTURE_HEIGHT) onClamp?.();
    return toPngSafe(node, {
        width: node.scrollWidth,
        height: h,
        style: { height: "auto", maxHeight: "none", overflow: "visible" },
        backgroundColor: bg,
        pixelRatio: 2,
        imagePlaceholder: PLACEHOLDER,
    });
}

// Add crossorigin="anonymous" to stylesheet <link>s using a real HTML parser - a regex
// over user/attacker-influenceable markup is fragile and can corrupt the document. The
// attribute must be present BEFORE the browser fetches the sheet, so we mutate the source
// string here (not the live doc after load) and hand the result to srcdoc.
export function withStylesheetCors(html: string): string {
    try {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        parsed.querySelectorAll('link[rel~="stylesheet"]').forEach((l) => {
            if (!l.hasAttribute("crossorigin")) l.setAttribute("crossorigin", "anonymous");
        });
        return `<!DOCTYPE html>${parsed.documentElement.outerHTML}`;
    } catch {
        return html; // parser unavailable/failed - fall back to the original markup
    }
}

// Resolve once the document's images have actually finished (load or error), capped so a
// hung CDN asset can't stall the capture forever. Replaces the old blind fixed timeout.
async function waitForImages(doc: Document, timeoutMs: number): Promise<void> {
    const pending = Array.from(doc.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
        }));
    if (!pending.length) return;
    await Promise.race([
        Promise.all(pending).then(() => undefined),
        new Promise<void>((res) => setTimeout(res, timeoutMs)),
    ]);
}

async function captureHtml(html: string, bg: string, onClamp?: () => void): Promise<string> {
    const iframe = document.createElement("iframe");
    // Same-origin so we can read the document; NO scripts (matches the split-view
    // preview's sandbox) - never widen this to allow-scripts + allow-same-origin.
    iframe.setAttribute("sandbox", "allow-same-origin");
    iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;height:100px;border:0;visibility:hidden`;
    document.body.appendChild(iframe);
    try {
        // CORS-enable stylesheet links so their cssRules are readable (CDNs like
        // cdnjs/Google Fonts serve ACAO:*) - without this html-to-image throws
        // SecurityError while embedding web fonts.
        const corsHtml = withStylesheetCors(html);
        await new Promise<void>((res) => { iframe.onload = () => res(); iframe.srcdoc = corsHtml; });
        const doc = iframe.contentDocument;
        if (!doc?.body) throw new Error("iframe document unavailable");
        // Wait on real readiness signals (webfonts, then images, capped) instead of a
        // blind fixed delay that captured half-loaded assets on slow CDNs.
        await (doc as any).fonts?.ready?.catch?.(() => {});
        await waitForImages(doc, 3000);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const rawH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 100);
        const h = Math.min(rawH, MAX_CAPTURE_HEIGHT);
        if (rawH > MAX_CAPTURE_HEIGHT) onClamp?.();
        iframe.style.height = `${h}px`;
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        return await toPngSafe(doc.body, {
            width: CAPTURE_WIDTH, height: h,
            backgroundColor: bg, pixelRatio: 2, imagePlaceholder: PLACEHOLDER,
        });
    } finally {
        iframe.remove();
    }
}

async function captureTextReplica(text: string, bg: string, fg: string, onClamp?: () => void): Promise<string> {
    const div = document.createElement("div");
    div.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;background:${bg};color:${fg};` +
        "font-family:ui-monospace,'Fira Code','Cascadia Code',monospace;font-size:14px;line-height:1.6;" +
        "padding:24px;white-space:pre-wrap;word-break:break-word;box-sizing:border-box";
    div.textContent = text;
    document.body.appendChild(div);
    try {
        return await toPngExpanded(div, bg, onClamp);
    } finally {
        div.remove();
    }
}

export interface CaptureOpts {
    title: string;
    noteType: string;          // "html" | "rich" | "text" | code types...
    isDark: boolean;
    html: string | null;       // themed full document for html notes, else null
    text: string;              // raw note content (fallback + text/code path)
    onNotice?: (msg: string) => void; // surfaced when the capture is height-clamped
}

/** Capture the full note and trigger the PNG download. */
export async function captureNotePng(opts: CaptureOpts): Promise<void> {
    const bg = opts.isDark ? "#1a1a1a" : "#ffffff";
    const fg = opts.isDark ? "#f8f8f2" : "#1a1a1a";
    const onClamp = () => opts.onNotice?.(`Note is very long - captured the top ${MAX_CAPTURE_HEIGHT.toLocaleString()}px`);
    let dataUrl: string;
    if (opts.noteType === "html" && opts.html) {
        dataUrl = await captureHtml(opts.html, bg, onClamp);
    } else {
        // Prefer the live rendered preview when one exists (rich)...
        const live = document.querySelector<HTMLElement>(".ProseMirror");
        if (live && live.getBoundingClientRect().width > 0) {
            dataUrl = await toPngExpanded(live, opts.noteType === "rich" ? "#ffffff" : bg, onClamp);
        } else {
            // ...else render the raw content as a styled replica (text/code/json).
            dataUrl = await captureTextReplica(opts.text, bg, fg, onClamp);
        }
    }
    downloadDataUrl(dataUrl, captureFilename(opts.title));
}
