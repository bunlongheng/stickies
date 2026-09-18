/**
 * Integration: POST /api/stickies/local
 * The "fast local note" endpoint — text/md OR JSON, owner-only.
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

const { mockQueryOne, mockAuth } = vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
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
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

beforeEach(() => {
    mockQueryOne.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (init: RequestInit) =>
    new Request("https://stickies.example.com/api/stickies/local", { method: "POST", ...init });

describe("POST /api/stickies/local", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when title is missing (JSON body)", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "no title" }),
        }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when content is missing (JSON body)", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T" }),
        }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when JSON body is malformed", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: "not json",
        }));
        expect(res.status).toBe(400);
    });

    it("happy path: JSON body inserts and returns 201", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "new-id", title: "T", content: "C", folder_name: "CLAUDE", order: 0 });
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json", Authorization: "Bearer test-api-key" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.note.id).toBe("new-id");
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[params.length - 1]).toBe("owner-uuid-1234");
    });

    it("increments order when prior notes exist", async () => {
        mockQueryOne
            .mockResolvedValueOnce({ order: 7 })
            .mockResolvedValueOnce({ id: "x", order: 8 });
        const { POST } = await import("@/app/api/stickies/local/route");
        await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        const insertParams = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(insertParams[4]).toBe(8);
    });

    it("text/markdown body: first `# H1` becomes title, rest becomes content", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "md-id" });
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "text/markdown" },
            body: "Some intro\n# My Title\nBody line 1\nBody line 2",
        }));
        expect(res.status).toBe(201);
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[0]).toBe("My Title");
        expect(params[1]).toContain("Body line 1");
    });

    it("text/markdown body without # uses first non-empty line as title", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "no-h1" });
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "text/markdown" },
            body: "\n\nFirst real line\nSecond line",
        }));
        expect(res.status).toBe(201);
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[0]).toBe("First real line");
    });

    it("uses ?folder= query param when present", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "x" });
        const req = new Request("https://stickies.example.com/api/stickies/local?folder=Work", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        });
        const { POST } = await import("@/app/api/stickies/local/route");
        await POST(req);
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[2]).toBe("Work");
    });

    it("uses body.folder over query param when both present", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "x" });
        const req = new Request("https://stickies.example.com/api/stickies/local?folder=Query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C", folder: "Body" }),
        });
        const { POST } = await import("@/app/api/stickies/local/route");
        await POST(req);
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[2]).toBe("Body");
    });

    it("returns 500 when the INSERT returns null", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        const { POST } = await import("@/app/api/stickies/local/route");
        const res = await POST(REQ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        expect(res.status).toBe(500);
    });

    it("uses ?color= query param for the new note color", async () => {
        mockQueryOne
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "x" });
        const req = new Request("https://stickies.example.com/api/stickies/local?color=%23FF0000", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        });
        const { POST } = await import("@/app/api/stickies/local/route");
        await POST(req);
        const params = mockQueryOne.mock.calls[1][1] as unknown[];
        expect(params[3]).toBe("#FF0000");
    });
});
