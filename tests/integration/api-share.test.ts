/**
 * Integration tests: /api/stickies/share (GET + POST)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOne, mockExecute, mockAuth } = vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
    mockExecute: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn(),
    queryOne: mockQueryOne,
    execute: mockExecute,
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));

beforeEach(() => {
    mockQueryOne.mockReset();
    mockExecute.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (path: string, init?: RequestInit) => new Request(`https://stickies.example.com${path}`, init);

describe("GET /api/stickies/share", () => {
    it("returns 400 when no token provided", async () => {
        const { GET } = await import("@/app/api/stickies/share/route");
        const res = await GET(REQ("/api/stickies/share"));
        expect(res.status).toBe(400);
    });

    it("returns shared note when valid token", async () => {
        mockQueryOne.mockResolvedValueOnce({
            title: "Shared", content: "Hello", color: "#fff", folder_name: "Work",
        });
        const { GET } = await import("@/app/api/stickies/share/route");
        const res = await GET(REQ("/api/stickies/share?token=abc123"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ title: "Shared", content: "Hello", color: "#fff", folder_name: "Work" });
    });

    it("returns 410 gone when token doesn't resolve to a row", async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        const { GET } = await import("@/app/api/stickies/share/route");
        const res = await GET(REQ("/api/stickies/share?token=missing"));
        expect(res.status).toBe(410);
    });
});

describe("POST /api/stickies/share", () => {
    const postBody = (b: unknown) => REQ("/api/stickies/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
    });

    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/share/route");
        const res = await POST(postBody({ title: "x", content: "y" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when both title and content are empty", async () => {
        const { POST } = await import("@/app/api/stickies/share/route");
        const res = await POST(postBody({ title: "", content: "" }));
        expect(res.status).toBe(400);
    });

    it("happy path: inserts a row and returns a token", async () => {
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/share/route");
        const res = await POST(postBody({ title: "T", content: "C", color: "#ff0", folder_name: "Work" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toMatch(/^[0-9a-f-]{36}$/i);
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toMatch(/INSERT INTO shared_notes/);
        const params = mockExecute.mock.calls[0][1] as unknown[];
        expect(params[1]).toBe("T");
        expect(params[2]).toBe("C");
        expect(params[3]).toBe("#ff0");
        expect(params[4]).toBe("Work");
        // expires_at is 7d in the future
        const expiresAt = new Date(params[5] as string).getTime();
        const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
        expect(Math.abs(expiresAt - sevenDaysFromNow)).toBeLessThan(60_000); // within 1 min
    });

    it("inserts with defaults when optional fields are absent", async () => {
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/share/route");
        const res = await POST(postBody({ title: "T" }));
        expect(res.status).toBe(200);
        const params = mockExecute.mock.calls[0][1] as unknown[];
        expect(params[2]).toBe("");      // content
        expect(params[3]).toBe("");      // color
        expect(params[4]).toBe("");      // folder_name
    });

    it("returns 500 when the DB throws", async () => {
        mockExecute.mockRejectedValueOnce(new Error("db gone"));
        const { POST } = await import("@/app/api/stickies/share/route");
        const res = await POST(postBody({ title: "T", content: "C" }));
        expect(res.status).toBe(500);
    });
});
