/**
 * Integration: GET + POST /api/stickies/integrations
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockQueryOne, mockAuth } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockQueryOne: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: mockQueryOne,
    execute: vi.fn(),
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));

beforeEach(() => {
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (init?: RequestInit) => new Request("https://stickies.example.com/api/stickies/integrations", init);

describe("GET /api/stickies/integrations", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { GET } = await import("@/app/api/stickies/integrations/route");
        const res = await GET(REQ());
        expect(res.status).toBe(401);
    });

    it("returns active rows", async () => {
        mockQuery.mockResolvedValue([
            { id: "1", type: "hue", name: "Philips Hue", trigger: "note_created", condition: {}, config: {} },
        ]);
        const { GET } = await import("@/app/api/stickies/integrations/route");
        const res = await GET(REQ());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(1);
        expect(body[0].type).toBe("hue");
        // Should only fetch active rows
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("active = true");
    });

    it("returns [] when DB returns nullish", async () => {
        mockQuery.mockResolvedValue(null);
        const { GET } = await import("@/app/api/stickies/integrations/route");
        const res = await GET(REQ());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
    });

    it("returns 500 when the DB throws", async () => {
        mockQuery.mockRejectedValueOnce(new Error("db down"));
        const { GET } = await import("@/app/api/stickies/integrations/route");
        const res = await GET(REQ());
        expect(res.status).toBe(500);
    });
});

describe("POST /api/stickies/integrations", () => {
    const postBody = (b: unknown) => REQ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
    });

    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/integrations/route");
        const res = await POST(postBody({ type: "hue" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when JSON body is malformed", async () => {
        const { POST } = await import("@/app/api/stickies/integrations/route");
        const res = await POST(REQ({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when type is missing", async () => {
        const { POST } = await import("@/app/api/stickies/integrations/route");
        const res = await POST(postBody({ name: "x" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when type is whitespace-only", async () => {
        const { POST } = await import("@/app/api/stickies/integrations/route");
        const res = await POST(postBody({ type: "   " }));
        expect(res.status).toBe(400);
    });

    it("happy path: inserts integration and returns the row", async () => {
        mockQueryOne.mockResolvedValue({
            id: "uuid-new", type: "hue", name: "Hue", trigger: "note_created", condition: {}, config: {},
        });
        const { POST } = await import("@/app/api/stickies/integrations/route");
        const res = await POST(postBody({
            type: "hue", name: "My Hue", trigger: "note_created", condition: { x: 1 }, config: { app_key: "k" },
        }));
        expect(res.status).toBe(201);
        const sql = mockQueryOne.mock.calls[0][0] as string;
        expect(sql).toMatch(/INSERT INTO integrations/);
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[0]).toBe("hue");                 // type
        expect(params[1]).toBe("My Hue");              // name
        expect(params[2]).toBe("note_created");        // trigger
        expect(params[3]).toBe(JSON.stringify({ x: 1 })); // condition stringified
        expect(params[4]).toBe(JSON.stringify({ app_key: "k" })); // config stringified
        expect(params[5]).toBe(true);                  // active
    });

    it("defaults name to type when name is missing", async () => {
        mockQueryOne.mockResolvedValue({ id: "x" });
        const { POST } = await import("@/app/api/stickies/integrations/route");
        await POST(postBody({ type: "hue" }));
        expect(mockQueryOne.mock.calls[0][1][1]).toBe("hue");
    });

    it("defaults condition and config to empty objects when omitted", async () => {
        mockQueryOne.mockResolvedValue({ id: "x" });
        const { POST } = await import("@/app/api/stickies/integrations/route");
        await POST(postBody({ type: "hue" }));
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[3]).toBe(JSON.stringify({}));
        expect(params[4]).toBe(JSON.stringify({}));
    });

    it("trims whitespace from type and name", async () => {
        mockQueryOne.mockResolvedValue({ id: "x" });
        const { POST } = await import("@/app/api/stickies/integrations/route");
        await POST(postBody({ type: "  hue  ", name: "  Philips Hue  " }));
        expect(mockQueryOne.mock.calls[0][1][0]).toBe("hue");
        expect(mockQueryOne.mock.calls[0][1][1]).toBe("Philips Hue");
    });

    it("returns 500 when insert throws", async () => {
        mockQueryOne.mockRejectedValueOnce(new Error("dup_key"));
        const { POST } = await import("@/app/api/stickies/integrations/route");
        const res = await POST(postBody({ type: "hue" }));
        expect(res.status).toBe(500);
    });
});
