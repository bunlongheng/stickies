/**
 * Integration: GET /api/stickies/public/raw
 * Like GitHub Gist raw - plain text only, public notes only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOne } = vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn(),
    queryOne: mockQueryOne,
    execute: vi.fn(),
}));

beforeEach(() => mockQueryOne.mockReset());

const REQ = (qs: string) => new Request(`https://stickies.example.com/api/stickies/public/raw${qs}`);

describe("GET /api/stickies/public/raw", () => {
    it("returns 404 when noteId param is missing", async () => {
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe("Not found");
        expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    });

    it("returns 404 when the note doesn't exist", async () => {
        mockQueryOne.mockResolvedValue(null);
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=missing"));
        expect(res.status).toBe(404);
    });

    it("returns 404 when the note exists but is NOT public (don't leak)", async () => {
        mockQueryOne.mockResolvedValue({ title: "secret", content: "shh", is_public: false });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=private-uuid"));
        expect(res.status).toBe(404);
    });

    it("returns 200 with the raw content when note is public", async () => {
        mockQueryOne.mockResolvedValue({ title: "Hello World", content: "Body text\nLine 2", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("Body text\nLine 2");
    });

    it("encodes the title in X-Note-Title (so unicode + spaces survive)", async () => {
        mockQueryOne.mockResolvedValue({ title: "Hello / World 🌍", content: "x", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        const header = res.headers.get("x-note-title");
        expect(header).toBe(encodeURIComponent("Hello / World 🌍"));
    });

    it("scopes by trashed_at IS NULL (does not leak trashed notes)", async () => {
        mockQueryOne.mockResolvedValue({ title: "x", content: "y", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        await GET(REQ("?noteId=note-uuid"));
        const sql = mockQueryOne.mock.calls[0][0] as string;
        expect(sql).toContain("trashed_at IS NULL");
    });

    it("sets a short browser cache header", async () => {
        mockQueryOne.mockResolvedValue({ title: "t", content: "x", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        expect(res.headers.get("cache-control")).toBe("public, max-age=60");
    });
});
