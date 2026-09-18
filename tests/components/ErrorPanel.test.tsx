// @vitest-environment jsdom
/**
 * Component: ErrorPanel - the white-screen last line of defence.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ErrorPanel, { isStaleChunkError } from "@/components/ErrorPanel";

describe("ErrorPanel", () => {
    beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });

    it("renders the message and retries once automatically", () => {
        const reset = vi.fn();
        vi.spyOn(console, "error").mockImplementation(() => {});
        render(<ErrorPanel error={new Error("Cannot read properties of undefined")} reset={reset} />);
        expect(screen.getByText("Stickies hit a snag")).toBeTruthy();
        expect(screen.getByText(/Cannot read properties/)).toBeTruthy();
        act(() => { vi.advanceTimersByTime(1600); });
        expect(reset).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem("stickies:auto-reset")).toBe("1");
    });

    it("does not auto-retry a second time; Try again still works", () => {
        sessionStorage.setItem("stickies:auto-reset", "1");
        const reset = vi.fn();
        vi.spyOn(console, "error").mockImplementation(() => {});
        render(<ErrorPanel error={new Error("again")} reset={reset} />);
        act(() => { vi.advanceTimersByTime(3000); });
        expect(reset).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Try again"));
        expect(reset).toHaveBeenCalledTimes(1);
    });
});

describe("stale chunk after a deploy", () => {
    beforeEach(() => { sessionStorage.clear(); vi.useRealTimers(); });

    it("recognises the chunk-load error shapes", () => {
        expect(isStaleChunkError(new Error("Loading chunk 4321 failed"))).toBe(true);
        expect(isStaleChunkError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
        expect(isStaleChunkError(new Error("Failed to fetch dynamically imported module: /_next/static/chunks/a.js"))).toBe(true);
        expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    });

    it("reloads once instead of retrying, and only once", () => {
        const reload = vi.fn();
        Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });
        vi.spyOn(console, "error").mockImplementation(() => {});
        const reset = vi.fn();
        render(<ErrorPanel error={new Error("Loading chunk 12 failed")} reset={reset} />);
        expect(reload).toHaveBeenCalledTimes(1);
        expect(reset).not.toHaveBeenCalled();
        expect(sessionStorage.getItem("stickies:chunk-reload")).toBe("1");
        render(<ErrorPanel error={new Error("Loading chunk 12 failed")} reset={reset} />);
        expect(reload).toHaveBeenCalledTimes(1); // guard held: second time shows the panel
    });
});
