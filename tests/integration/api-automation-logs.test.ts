/**
 * Integration: GET /api/stickies/automation-logs
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockAuth } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: vi.fn(),
    execute: vi.fn(),
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));

beforeEach(() => {
    mockQuery.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (qs: string) => new Request(`https://stickies.example.com/api/stickies/automation-logs${qs}`);

describe("GET /api/stickies/automation-logs", () => {
    it("returns logs (no filter, default limit=20)", async () => {
        mockQuery.mockResolvedValue([{ id: "1", automation_id: "a1", result: "ok" }]);
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(200);
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toMatch(/FROM automation_logs/);
        expect(sql).not.toMatch(/WHERE automation_id/);
        // limit param at position 1
        expect(mockQuery.mock.calls[0][1]).toEqual([20]);
    });

    it("filters by automation_id when provided", async () => {
        mockQuery.mockResolvedValue([]);
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        await GET(REQ("?automation_id=auto-123&limit=5"));
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toMatch(/WHERE automation_id = \$1/);
        expect(mockQuery.mock.calls[0][1]).toEqual(["auto-123", 5]);
    });

    it("caps limit at 100 even if user passes more", async () => {
        mockQuery.mockResolvedValue([]);
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        await GET(REQ("?limit=10000"));
        expect(mockQuery.mock.calls[0][1]).toEqual([100]);
    });

    it("defaults limit to 20 when limit param is malformed", async () => {
        mockQuery.mockResolvedValue([]);
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        await GET(REQ("?limit=banana"));
        expect(mockQuery.mock.calls[0][1]).toEqual([20]);
    });

    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(401);
    });

    it("returns 500 when the DB throws", async () => {
        mockQuery.mockRejectedValueOnce(new Error("table_missing"));
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe("table_missing");
    });

    it("returns [] when DB returns nullish", async () => {
        mockQuery.mockResolvedValue(null);
        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });
});
