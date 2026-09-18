/**
 * Unit: lib/live-payload.ts - Pusher 413 guard (rows over 10KB never arrived live).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { livePayload, hydrateLive } from "@/lib/live-payload";

describe("livePayload", () => {
    it("passes a small row through untouched", () => {
        const row = { id: "1", title: "t", content: "short", folder_name: "F" };
        expect(livePayload(row)).toBe(row);
    });

    it("drops content and doc from an oversized row and flags it", () => {
        const row = { id: "1", title: "big", content: "x".repeat(20_000), doc: { type: "doc" }, folder_name: "F" };
        const out = livePayload(row) as any;
        expect(out.content).toBeUndefined();
        expect(out.doc).toBeUndefined();
        expect(out.content_omitted).toBe(true);
        expect(out.title).toBe("big");
        expect(out.folder_name).toBe("F");
        expect(JSON.stringify(out).length).toBeLessThan(10 * 1024);
    });
});

describe("hydrateLive", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns the note as-is when nothing was omitted", async () => {
        const f = vi.fn(); vi.stubGlobal("fetch", f);
        const n = { id: "1", content: "c" };
        expect(await hydrateLive(n)).toBe(n);
        expect(f).not.toHaveBeenCalled();
    });

    it("fetches the full row by id when flagged", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ note: { id: "1", content: "full body" } }), { status: 200 })));
        const out = await hydrateLive({ id: "1", content_omitted: true } as { id: string; content_omitted: boolean; content?: string });
        expect(out.content).toBe("full body");
        expect((globalThis.fetch as any).mock.calls[0][0]).toBe("/api/stickies?id=1");
    });

    it("keeps the slim row when the fetch fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
        const slim = { id: "1", content_omitted: true };
        expect(await hydrateLive(slim)).toBe(slim);
    });
});
