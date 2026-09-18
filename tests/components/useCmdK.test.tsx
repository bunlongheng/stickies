// @vitest-environment jsdom
/**
 * Unit: lib/useCmdK - Cmd-K palette state hook lifted out of page.tsx.
 * Exercises initial state, the setters, the 120ms query debounce, and the
 * server-side search effect (fetch stubbed). Uses real timers so the debounce
 * and RTL's waitFor cooperate.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "./helpers";
import { useCmdK } from "@/lib/useCmdK";

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("useCmdK", () => {
    it("starts closed with empty query and default flags", () => {
        const { result } = renderHook(() => useCmdK());
        expect(result.current.showCmdK).toBe(false);
        expect(result.current.cmdKQuery).toBe("");
        expect(result.current.cmdKCursor).toBe(0);
        expect(result.current.cmdKGlobal).toBe(false);
        expect(result.current.cmdKInFile).toBe(false);
        expect(result.current.cmdKServerResults).toEqual([]);
    });

    it("setShowCmdK / setCmdKGlobal flip their state", () => {
        const { result } = renderHook(() => useCmdK());
        act(() => { result.current.setShowCmdK(true); result.current.setCmdKGlobal(true); });
        expect(result.current.showCmdK).toBe(true);
        expect(result.current.cmdKGlobal).toBe(true);
    });

    it("debounces the query into deferredCmdKQuery after ~120ms", async () => {
        const { result } = renderHook(() => useCmdK());
        act(() => result.current.setCmdKQuery("hello"));
        expect(result.current.deferredCmdKQuery).toBe("");
        await waitFor(() => expect(result.current.deferredCmdKQuery).toBe("hello"));
    });

    it("runs a server search for a non-empty query and stores the hits", async () => {
        const notes = [{ id: "z9", title: "deep note" }];
        const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ notes }) });
        vi.stubGlobal("fetch", fetchFn);

        const { result } = renderHook(() => useCmdK());
        act(() => result.current.setCmdKQuery("deep"));

        await waitFor(() => expect(fetchFn).toHaveBeenCalled());
        expect(fetchFn.mock.calls[0][0]).toBe("/api/stickies?q=deep");
        await waitFor(() => expect(result.current.cmdKServerResults).toEqual(notes));
    });

    it("clears server results and skips the fetch when in-file mode is on", async () => {
        const fetchFn = vi.fn();
        vi.stubGlobal("fetch", fetchFn);
        const { result } = renderHook(() => useCmdK());
        act(() => { result.current.setCmdKInFile(true); result.current.setCmdKQuery("x"); });
        // let the debounce + effect run
        await waitFor(() => expect(result.current.deferredCmdKQuery).toBe("x"));
        expect(result.current.cmdKServerResults).toEqual([]);
        expect(fetchFn).not.toHaveBeenCalled();
    });
});
