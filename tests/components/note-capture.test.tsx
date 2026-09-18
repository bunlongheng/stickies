// @vitest-environment jsdom
/**
 * Unit: lib/note-capture pure/DOM helpers (captureFilename, downloadDataUrl,
 * withStylesheetCors). The canvas-heavy capture path itself needs a real
 * browser and is exercised via e2e, not here.
 */
import { describe, it, expect, vi } from "vitest";
import { captureFilename, downloadDataUrl, withStylesheetCors } from "@/lib/note-capture";

describe("captureFilename", () => {
    it("builds a GoFullPage-style name with a zero-padded timestamp", () => {
        const d = new Date(2026, 0, 5, 9, 3, 7); // 2026-01-05 09:03:07 (local)
        expect(captureFilename("My Note!", d)).toBe("screencapture-my-note-2026-01-05-09_03_07.png");
    });

    it("slugifies punctuation, trims dashes, and caps length", () => {
        const d = new Date(2026, 10, 20, 12, 0, 0);
        expect(captureFilename("  --Hello, World--  ", d)).toBe("screencapture-hello-world-2026-11-20-12_00_00.png");
    });

    it("falls back to 'note' for an empty/symbol-only title", () => {
        const d = new Date(2026, 5, 1, 0, 0, 0);
        expect(captureFilename("", d)).toBe("screencapture-note-2026-06-01-00_00_00.png");
        expect(captureFilename("***", d)).toBe("screencapture-note-2026-06-01-00_00_00.png");
    });
});

describe("downloadDataUrl", () => {
    it("creates a transient anchor, clicks it, and removes it", () => {
        const clicked = vi.fn();
        const realCreate = document.createElement.bind(document);
        const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
            const el = realCreate(tag) as HTMLAnchorElement;
            if (tag === "a") el.click = clicked;
            return el as any;
        });
        downloadDataUrl("data:image/png;base64,AAAA", "shot.png");
        expect(clicked).toHaveBeenCalledOnce();
        expect(document.querySelector("a")).toBeNull(); // removed after click
        spy.mockRestore();
    });
});

describe("withStylesheetCors", () => {
    it("adds crossorigin=anonymous to stylesheet links that lack it", () => {
        const out = withStylesheetCors('<html><head><link rel="stylesheet" href="https://cdn/x.css"></head><body>hi</body></html>');
        expect(out).toContain('crossorigin="anonymous"');
        expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    });

    it("leaves an existing crossorigin attribute untouched and ignores non-stylesheet links", () => {
        const out = withStylesheetCors('<html><head><link rel="stylesheet" crossorigin="use-credentials" href="a.css"><link rel="icon" href="f.ico"></head><body></body></html>');
        expect(out).toContain('crossorigin="use-credentials"');
        expect(out).not.toContain('rel="icon" crossorigin');
    });
});
