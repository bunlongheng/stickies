// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// One fake channel per render; tests reach into `bound` to deliver events.
const bound = new Map<string, (p: any) => void>();
const close = vi.fn();
const socketId = vi.fn(() => "sock-1");
let onConnect: () => void = () => {};
let channelIsNull = false;

vi.mock("@/lib/realtime-channel", () => ({
    openRealtimeChannel: (cb: () => void) => {
        onConnect = cb;
        if (channelIsNull) return null;
        return { bind: (e: string, h: (p: any) => void) => bound.set(e, h), close, socketId };
    },
}));
vi.mock("@/lib/live-payload", () => ({ hydrateLive: async (raw: any) => raw }));
const fetchRetry = vi.fn(async () => new Response(JSON.stringify({ notes: [] }), { status: 200 }));
vi.mock("@/lib/fetch-retry", () => ({ fetchRetry: (...a: unknown[]) => fetchRetry(...a) }));
const apiFetch = vi.fn(async () => new Response("{}", { status: 200 }));
vi.mock("@/lib/api-client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { useRealtimeSync, type UseRealtimeSyncParams } from "@/lib/hooks/useRealtimeSync";

function params(over: Partial<UseRealtimeSyncParams> = {}): UseRealtimeSyncParams {
    const noop = vi.fn();
    return {
        mounted: true,
        // Runs the updater it is handed: the created-note path decides whether a
        // note is new INSIDE that reducer, so a mock that ignores it sees nothing.
        setDbData: vi.fn((u: any) => { if (typeof u === "function") u([]); }), setFolderCounts: vi.fn(), setFolderCountsById: vi.fn(),
        setFlashColor: vi.fn(), setFlashNote: vi.fn(), setPusherFlash: vi.fn(),
        setIncomingNoteIds: vi.fn(), setRemovingNoteIds: vi.fn(), setEditingNote: vi.fn(),
        setContent: vi.fn(), setTitle: vi.fn(), setRichDoc: vi.fn(), setListModeNotes: vi.fn(),
        showToast: vi.fn(),
        localWriteRef: { current: new Map() },
        integrationsRef: { current: [] },
        isFlashingRef: { current: false },
        flashQueueRef: { current: [] },
        mainListModeRef: { current: "list" },
        openNoteRef: { current: noop },
        latestRichDocRef: { current: null },
        pendingDeleteRef: { current: null },
        ...over,
    } as UseRealtimeSyncParams;
}

beforeEach(() => {
    bound.clear(); close.mockClear(); fetchRetry.mockClear(); apiFetch.mockClear();
    channelIsNull = false;
    vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("useRealtimeSync", () => {
    it("binds the note events and closes the channel on unmount", () => {
        const { unmount } = renderHook(() => useRealtimeSync(params()));
        expect([...bound.keys()].sort()).toEqual(["navigate-to", "note-created", "note-deleted", "note-updated"]);
        unmount();
        expect(close).toHaveBeenCalledOnce();
    });

    it("binds nothing when no transport is available", () => {
        channelIsNull = true;
        renderHook(() => useRealtimeSync(params()));
        expect(bound.size).toBe(0);
    });

    it("catches up on (re)connect, and merges the notes it finds", async () => {
        fetchRetry.mockResolvedValueOnce(new Response(JSON.stringify({ notes: [{ id: "n9" }] }), { status: 200 }));
        const setDbData = vi.fn();
        renderHook(() => useRealtimeSync(params({ setDbData })));
        await act(async () => { onConnect(); });
        expect(fetchRetry).toHaveBeenCalledWith("/api/stickies?recent=today");
        expect(setDbData).toHaveBeenCalled();
    });

    it("skips the merge when the catch-up comes back empty", async () => {
        const setDbData = vi.fn();
        renderHook(() => useRealtimeSync(params({ setDbData })));
        await act(async () => { onConnect(); });
        expect(setDbData).not.toHaveBeenCalled();
    });

    describe("note-created", () => {
        it("appends a new note, counts it, toasts, and pulses the tile", async () => {
            const p = params();
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-created")!({ id: "n1", title: "Hi", folder_name: "Quick", folder_color: "#FFB84D" }); });
            expect(p.showToast).toHaveBeenCalledWith("+ Hi", "#FFB84D");
            expect(p.setDbData).toHaveBeenCalled();
            expect(p.setFolderCounts).toHaveBeenCalled();
            expect(p.setIncomingNoteIds).toHaveBeenCalled();
            expect(p.setPusherFlash).toHaveBeenCalledWith(true);
            // the upsert reducer: unknown id is appended
            const reducer = (p.setDbData as any).mock.calls[0][0];
            expect(reducer([])).toHaveLength(1);
        });

        it("ignores an event with no id, and one for a note being deleted locally", async () => {
            const p = params({ pendingDeleteRef: { current: { note: { id: "n2" } } } as any });
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-created")!({ title: "no id" }); });
            await act(async () => { await bound.get("note-created")!({ id: "n2", title: "doomed" }); });
            expect(p.setDbData).not.toHaveBeenCalled();
        });

        it("keeps the local row when the owner wrote to it in the last 3s", async () => {
            const p = params({ localWriteRef: { current: new Map([["n3", Date.now()]]) } });
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-created")!({ id: "n3", title: "echo" }); });
            const reducer = (p.setDbData as any).mock.calls[0][0];
            const prev = [{ id: "n3", title: "mine" }];
            expect(reducer(prev)).toBe(prev);
        });

        it("fires a matching hue integration", async () => {
            const p = params({ integrationsRef: { current: [
                { trigger: "note_created", condition: { color: "#FFB84D" }, type: "hue", config: { group_id: "3" } },
                { trigger: "note_created", condition: { color: "#000000" }, type: "hue", config: { group_id: "9" } },
            ] } });
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-created")!({ id: "n4", folder_color: "#FFB84D" }); });
            expect(apiFetch).toHaveBeenCalledOnce();
            expect(String((apiFetch.mock.calls[0] as any)[1].body)).toContain('"group_id":"3"');
        });

        it("opens the note in tabs mode unless the owner is typing", async () => {
            const openNote = vi.fn();
            const p = params({ mainListModeRef: { current: "tabs" }, openNoteRef: { current: openNote } });
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-created")!({ id: "n5" }); });
            expect(openNote).toHaveBeenCalledOnce();
        });
    });

    describe("note-updated", () => {
        it("merges the row and mirrors the open editor", async () => {
            const p = params();
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-updated")!({ id: "n6", title: "T", content: "C", doc: null, list_mode: true }); });
            const mapper = (p.setDbData as any).mock.calls[0][0];
            expect(mapper([{ id: "n6", title: "old" }])[0].title).toBe("T");
            const editor = (p.setEditingNote as any).mock.calls[0][0];
            expect(editor(null)).toBeNull();                        // nothing open
            expect(editor({ id: "n6" })).toMatchObject({ title: "T" });
            expect(p.setContent).toHaveBeenCalledWith("C");
            expect(p.setTitle).toHaveBeenCalledWith("T");
            expect(p.setListModeNotes).toHaveBeenCalled();
        });

        it("ignores an echo of the owner's own write", async () => {
            const p = params({ localWriteRef: { current: new Map([["n7", Date.now()]]) } });
            renderHook(() => useRealtimeSync(p));
            await act(async () => { await bound.get("note-updated")!({ id: "n7", title: "echo" }); });
            expect(p.setDbData).not.toHaveBeenCalled();
        });
    });

    describe("note-deleted", () => {
        it("fades the row out, then drops it", async () => {
            const p = params();
            renderHook(() => useRealtimeSync(p));
            act(() => { bound.get("note-deleted")!({ id: "n8" }); });
            expect(p.setRemovingNoteIds).toHaveBeenCalled();
            expect(p.setDbData).not.toHaveBeenCalled();
            act(() => { vi.advanceTimersByTime(700); });
            const filter = (p.setDbData as any).mock.calls[0][0];
            expect(filter([{ id: "n8" }, { id: "n9" }])).toEqual([{ id: "n9" }]);
        });

        it("drops a deleted folder from the counts, and ignores an empty payload", () => {
            const p = params();
            renderHook(() => useRealtimeSync(p));
            act(() => { bound.get("note-deleted")!({}); });
            expect(p.setFolderCounts).not.toHaveBeenCalled();
            act(() => { bound.get("note-deleted")!({ folder_name: "Quick" }); });
            const reducer = (p.setFolderCounts as any).mock.calls[0][0];
            expect(reducer({ Quick: 2, AI: 1 })).toEqual({ AI: 1 });
        });
    });

    it("navigate-to sends the browser to the url, and ignores an empty one", () => {
        const href = vi.fn();
        // jsdom refuses a real navigation, so watch the assignment instead.
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { get href() { return "about:blank"; }, set href(v: string) { href(v); } },
        });
        renderHook(() => useRealtimeSync(params()));
        act(() => { bound.get("navigate-to")!({}); });
        expect(href).not.toHaveBeenCalled();
        act(() => { bound.get("navigate-to")!({ url: "https://example.com/x" }); });
        expect(href).toHaveBeenCalledWith("https://example.com/x");
    });

    it("polls as a backstop while the tab is visible, and stops on unmount", async () => {
        const { unmount } = renderHook(() => useRealtimeSync(params()));
        await act(async () => { vi.advanceTimersByTime(15000); });
        expect(fetchRetry).toHaveBeenCalled();
        const calls = fetchRetry.mock.calls.length;
        unmount();
        await act(async () => { vi.advanceTimersByTime(45000); });
        expect(fetchRetry.mock.calls.length).toBe(calls);
    });
});
