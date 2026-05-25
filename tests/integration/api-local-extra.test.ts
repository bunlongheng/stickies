/**
 * Integration tests: POST /api/stickies/local — uncovered paths
 *
 * Targets gaps not covered by api-local.test.ts:
 * - the flash-queue side effect (Hue fetch + Pusher "note-created" broadcast)
 * - text/plain content-type (vs text/markdown) markdown parsing
 * - body.folder_name fallback (when body.folder is absent)
 * - default color when no ?color= param
 * - whitespace-only title/content rejection
 *
 * NOTE: the real authorize()/getPusher() helpers can't be exercised here because
 * the route gates on the mocked authorizeOwner() and the Pusher client is mocked;
 * those helpers are integration-tested via the live ext API. We still drive the
 * flash-queue branch (lines ~102-111) so the Pusher trigger + Hue fetch fire.
 *
 * Tags: integration, api, local, flash, pusher
 * Priority: high
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
});

const { mockQueryOne, mockAuth, mockPusherTrigger } = vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
    mockPusherTrigger: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn(),
    queryOne: mockQueryOne,
    execute: vi.fn(),
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function () {
        return { trigger: mockPusherTrigger };
    }),
}));

beforeEach(() => {
    mockQueryOne.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
    mockPusherTrigger.mockReset().mockResolvedValue(undefined);
    vi.restoreAllMocks();
});

const REQ = (init: RequestInit, qs = "") =>
    new Request(`https://stickies.example.com/api/stickies/local${qs}`, { method: "POST", ...init });

describe("POST /api/stickies/local — flash queue + broadcast", () => {
    it("fires the Hue fetch and Pusher 'note-created' broadcast on success", async () => {
        // Make timers fast so the 300ms flash delay resolves immediately
        vi.useFakeTimers();
        const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ via: "test" }), { status: 200 })
        );

        const inserted = { id: "flash-id", title: "T", content: "C", folder_name: "CLAUDE", order: 0 };
        mockQueryOne
            .mockResolvedValueOnce(null)        // max order
            .mockResolvedValueOnce(inserted);   // INSERT RETURNING

        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json", Authorization: "Bearer test-api-key" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        expect(res.status).toBe(201);

        // Drain the flash queue: Hue fetch fires first, then a 300ms wait, then Pusher trigger
        await vi.runAllTimersAsync();
        vi.useRealTimers();

        // Hue trigger was hit
        expect(fetchSpy).toHaveBeenCalledWith(
            "http://localhost:4444/api/hue/trigger",
            expect.objectContaining({ method: "POST" })
        );
        // Pusher broadcast was hit with the inserted row
        expect(mockPusherTrigger).toHaveBeenCalledWith("stickies", "note-created", inserted);
    });

    it("still returns 201 even if the Hue fetch rejects (flash is best-effort)", async () => {
        vi.useFakeTimers();
        vi.spyOn(global, "fetch").mockRejectedValue(new Error("no bridge"));
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "ok-id" });
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        expect(res.status).toBe(201);
        await vi.runAllTimersAsync();
        vi.useRealTimers();
    });
});

describe("POST /api/stickies/local — body + content-type variants", () => {
    it("text/plain body: first # H1 becomes title", async () => {
        mockQueryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "plain-id" });
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "text/plain" },
            body: "# Plain Title\nbody here",
        }));
        expect(res.status).toBe(201);
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[0]).toBe("Plain Title");
    });

    it("uses body.folder_name when body.folder is absent", async () => {
        mockQueryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "x" });
        const { POST } = await import("@/app/api/stickies/local/route");
        await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C", folder_name: "Archive" }),
        }));
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[2]).toBe("Archive");
    });

    it("defaults color to #B0B0B8 when no ?color= param", async () => {
        mockQueryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "x" });
        const { POST } = await import("@/app/api/stickies/local/route");
        await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[3]).toBe("#B0B0B8");
    });

    it("rejects whitespace-only title with 400", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "   ", content: "C" }),
        }));
        expect(res.status).toBe(400);
    });

    it("rejects whitespace-only content with 400", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "   " }),
        }));
        expect(res.status).toBe(400);
    });

    it("empty markdown body falls back to 'Untitled' title then 400 on empty content", async () => {
        // raw is whitespace → title "Untitled", content trims to "" → content required 400
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "text/markdown" },
            body: "   \n   ",
        }));
        expect(res.status).toBe(400);
    });
});
