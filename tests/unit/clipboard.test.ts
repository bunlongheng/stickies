// @vitest-environment jsdom
/**
 * Unit: lib/clipboard - secureCopy (async Clipboard API + legacy fallback).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { secureCopy } from "@/lib/clipboard";

const origClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

beforeEach(() => {
    (window as any).isSecureContext = true;
});
afterEach(() => {
    if (origClipboard) Object.defineProperty(navigator, "clipboard", origClipboard);
    vi.restoreAllMocks();
});

describe("secureCopy", () => {
    it("uses the async Clipboard API in a secure context", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        await secureCopy("hello");
        expect(writeText).toHaveBeenCalledWith("hello");
    });

    it("falls back to a hidden textarea + execCommand when Clipboard API is unavailable", async () => {
        Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        (window as any).isSecureContext = false;
        const exec = vi.fn().mockReturnValue(true);
        (document as any).execCommand = exec;
        const appendSpy = vi.spyOn(document.body, "appendChild");
        const removeSpy = vi.spyOn(document.body, "removeChild");
        await secureCopy("fallback text");
        expect(exec).toHaveBeenCalledWith("copy");
        expect(appendSpy).toHaveBeenCalled();
        expect(removeSpy).toHaveBeenCalled(); // textarea cleaned up
    });

    it("does not throw if execCommand fails", async () => {
        Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        (window as any).isSecureContext = false;
        (document as any).execCommand = vi.fn(() => { throw new Error("denied"); });
        await expect(secureCopy("x")).resolves.toBeUndefined();
    });
});
