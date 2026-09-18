// @vitest-environment jsdom
/**
 * Unit: lib/note-capture - full-length note -> PNG download.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const toPng = vi.hoisted(() => vi.fn());
vi.mock("html-to-image", () => ({ toPng }));

import { captureFilename, downloadDataUrl, captureNotePng, withStylesheetCors } from "@/lib/note-capture";

beforeEach(() => { toPng.mockReset().mockResolvedValue("data:image/png;base64,AAAA"); });

describe("captureFilename", () => {
    it("builds a screencapture-style name with slug + timestamp", () => {
        const d = new Date(2026, 6, 17, 15, 5, 40); // 2026-07-17 15:05:40
        expect(captureFilename("Repo Audit - stickies!", d))
            .toBe("screencapture-repo-audit-stickies-2026-07-17-15_05_40.png");
    });
    it("falls back to 'note' for empty/degenerate titles", () => {
        const d = new Date(2026, 0, 2, 3, 4, 5);
        expect(captureFilename("!!!", d)).toBe("screencapture-note-2026-01-02-03_04_05.png");
    });
});

describe("downloadDataUrl", () => {
    it("clicks a temporary anchor with the download attrs", () => {
        const clicks: string[] = [];
        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { clicks.push(`${this.download}|${this.href}`); };
        try {
            downloadDataUrl("data:image/png;base64,xyz", "shot.png");
        } finally { HTMLAnchorElement.prototype.click = origClick; }
        expect(clicks).toEqual(["shot.png|data:image/png;base64,xyz"]);
        expect(document.querySelector("a[download]")).toBeNull(); // cleaned up
    });
});

describe("withStylesheetCors", () => {
    it("adds crossorigin=anonymous to stylesheet links that lack it", () => {
        const out = withStylesheetCors('<html><head><link rel="stylesheet" href="https://cdn/x.css"></head><body>hi</body></html>');
        const doc = new DOMParser().parseFromString(out, "text/html");
        const link = doc.querySelector('link[rel="stylesheet"]');
        expect(link?.getAttribute("crossorigin")).toBe("anonymous");
    });
    it("leaves an existing crossorigin value untouched", () => {
        const out = withStylesheetCors('<html><head><link rel="stylesheet" crossorigin="use-credentials" href="x.css"></head></html>');
        const link = new DOMParser().parseFromString(out, "text/html").querySelector("link");
        expect(link?.getAttribute("crossorigin")).toBe("use-credentials");
    });
    it("does not touch non-stylesheet links (preload, icon)", () => {
        const out = withStylesheetCors('<html><head><link rel="icon" href="/f.ico"><link rel="preload" as="font" href="/f.woff2"></head></html>');
        const doc = new DOMParser().parseFromString(out, "text/html");
        expect(doc.querySelector('link[rel="icon"]')?.hasAttribute("crossorigin")).toBe(false);
        expect(doc.querySelector('link[rel="preload"]')?.hasAttribute("crossorigin")).toBe(false);
    });
    it("handles messy markup (uppercase REL, no quotes) without corrupting the doc", () => {
        const out = withStylesheetCors('<html><head><link REL=stylesheet href=y.css></head><body><p>kept</p></body></html>');
        const doc = new DOMParser().parseFromString(out, "text/html");
        expect(doc.querySelector('link[rel~="stylesheet" i]')?.getAttribute("crossorigin")).toBe("anonymous");
        expect(doc.querySelector("p")?.textContent).toBe("kept");
    });
});

describe("SecurityError fallback", () => {
    it("retries with skipFonts when font embedding throws (cross-origin CSS)", async () => {
        toPng.mockReset()
            .mockRejectedValueOnce(new Error("SecurityError: cannot access cssRules"))
            .mockResolvedValueOnce("data:image/png;base64,BBBB");
        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {};
        try {
            await captureNotePng({ title: "x", noteType: "text", isDark: false, html: null, text: "t" });
        } finally { HTMLAnchorElement.prototype.click = origClick; }
        expect(toPng).toHaveBeenCalledTimes(2);
        expect(toPng.mock.calls[1][1]).toMatchObject({ skipFonts: true, fontEmbedCSS: "" });
    });
});

describe("captureNotePng (text replica path)", () => {
    it("renders an offscreen replica, captures it expanded, downloads, and cleans up", async () => {
        const clicks: string[] = [];
        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () { clicks.push(this.download); };
        try {
            await captureNotePng({ title: "My Note", noteType: "text", isDark: true, html: null, text: "hello\nworld" });
        } finally { HTMLAnchorElement.prototype.click = origClick; }
        // captured the replica div with expansion options
        expect(toPng).toHaveBeenCalledTimes(1);
        const [node, opts] = toPng.mock.calls[0];
        expect((node as HTMLElement).textContent).toBe("hello\nworld");
        expect(opts.style).toMatchObject({ height: "auto", maxHeight: "none", overflow: "visible" });
        expect(opts.pixelRatio).toBe(2);
        // downloaded with the screencapture name and cleaned the replica out of the DOM
        expect(clicks[0]).toMatch(/^screencapture-my-note-\d{4}-\d{2}-\d{2}-\d{2}_\d{2}_\d{2}\.png$/);
        expect(document.body.querySelector("div[style*='-10000px']")).toBeNull();
    });
});
