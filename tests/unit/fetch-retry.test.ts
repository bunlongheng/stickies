/**
 * Unit: lib/fetch-retry.ts - boot fetches must survive a transient failure.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchRetry } from "@/lib/fetch-retry";

const ok = () => new Response("{}", { status: 200 });
const five = () => new Response("boom", { status: 500 });

describe("fetchRetry", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("retries a 5xx and returns the later success", async () => {
        const f = vi.fn().mockResolvedValueOnce(five()).mockResolvedValueOnce(ok());
        vi.stubGlobal("fetch", f);
        const res = await fetchRetry("/api/x", undefined, 3, 1);
        expect(res.status).toBe(200);
        expect(f).toHaveBeenCalledTimes(2);
    });

    it("retries a thrown network error", async () => {
        const f = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(ok());
        vi.stubGlobal("fetch", f);
        expect((await fetchRetry("/api/x", undefined, 3, 1)).status).toBe(200);
        expect(f).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry a 4xx (an auth failure must surface at once)", async () => {
        const f = vi.fn().mockResolvedValue(new Response("", { status: 401 }));
        vi.stubGlobal("fetch", f);
        expect((await fetchRetry("/api/x", undefined, 3, 1)).status).toBe(401);
        expect(f).toHaveBeenCalledTimes(1);
    });

    it("gives up after the attempt budget: last 5xx is returned, last throw rethrown", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(five()));
        expect((await fetchRetry("/api/x", undefined, 2, 1)).status).toBe(500);
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
        await expect(fetchRetry("/api/x", undefined, 2, 1)).rejects.toThrow("down");
    });
});
