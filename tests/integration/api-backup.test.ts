/**
 * Integration: GET + POST /api/stickies/backup
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
    OWNER_EMAIL: "owner@example.com",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
});

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

const fetchSpy = vi.spyOn(global, "fetch");

beforeEach(() => {
    mockQuery.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
    fetchSpy.mockReset();
});

const REQ = (path: string, init?: RequestInit) =>
    new Request(`http://localhost:4444${path}`, init);

describe("GET /api/stickies/backup", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { GET } = await import("@/app/api/stickies/backup/route");
        const res = await GET(REQ("/api/stickies/backup"));
        expect(res.status).toBe(401);
    });

    it("default returns SQL with INSERTs and proper escaping", async () => {
        mockQuery.mockResolvedValue([
            { id: "n1", title: "It's mine", content: "Line1\nLine2", num: 5, flag: true, none: null },
        ]);
        const { GET } = await import("@/app/api/stickies/backup/route");
        const res = await GET(REQ("/api/stickies/backup"));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/sql");
        expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="stickies-backup-\d{4}-\d{2}-\d{2}\.sql"/);
        const text = await res.text();
        expect(text).toContain("TRUNCATE TABLE stickies");
        expect(text).toMatch(/INSERT INTO stickies \(id, title, content, num, flag, none\)/);
        expect(text).toContain("'It''s mine'");  // single-quote escape
        expect(text).toContain("TRUE");           // boolean
        expect(text).toContain("NULL");           // null
        expect(text).toContain("5");              // number unquoted
    });

    it("?format=json returns JSON download", async () => {
        mockQuery.mockResolvedValue([{ id: "n1", title: "T", content: "C" }]);
        const { GET } = await import("@/app/api/stickies/backup/route");
        const res = await GET(REQ("/api/stickies/backup?format=json"));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/json");
        expect(res.headers.get("content-disposition")).toMatch(/\.json"$/);
        const json = JSON.parse(await res.text());
        expect(json).toHaveLength(1);
        expect(json[0].title).toBe("T");
    });

    it("scopes to OWNER_USER_ID", async () => {
        mockQuery.mockResolvedValue([]);
        const { GET } = await import("@/app/api/stickies/backup/route");
        await GET(REQ("/api/stickies/backup"));
        const params = mockQuery.mock.calls[0][1];
        expect(params).toEqual(["owner-uuid-1234"]);
    });
});

describe("POST /api/stickies/backup (GitHub Actions trigger)", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/backup/route");
        const res = await POST(REQ("/api/stickies/backup", { method: "POST" }));
        expect(res.status).toBe(401);
    });

    it("returns 500 when GITHUB_BACKUP_TOKEN is missing", async () => {
        const orig = process.env.GITHUB_BACKUP_TOKEN;
        delete process.env.GITHUB_BACKUP_TOKEN;
        const { POST } = await import("@/app/api/stickies/backup/route");
        const res = await POST(REQ("/api/stickies/backup", { method: "POST" }));
        expect(res.status).toBe(500);
        if (orig !== undefined) process.env.GITHUB_BACKUP_TOKEN = orig;
    });

    it("returns ok=true when GitHub returns 204", async () => {
        process.env.GITHUB_BACKUP_TOKEN = "ghp_test";
        fetchSpy.mockResolvedValueOnce({ status: 204 } as Response);
        const { POST } = await import("@/app/api/stickies/backup/route");
        const res = await POST(REQ("/api/stickies/backup", { method: "POST" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        // Verify request payload includes ref=main, prefix=manual
        const call = fetchSpy.mock.calls[0];
        expect(call[0]).toContain("workflows/backup.yml/dispatches");
        const sentBody = JSON.parse((call[1] as any).body as string);
        expect(sentBody.ref).toBe("main");
        expect(sentBody.inputs.prefix).toBe("manual");
    });

    it("returns 500 with detail when GitHub responds with non-204", async () => {
        process.env.GITHUB_BACKUP_TOKEN = "ghp_test";
        fetchSpy.mockResolvedValueOnce({
            status: 401,
            json: async () => ({ message: "Bad credentials" }),
        } as Response);
        const { POST } = await import("@/app/api/stickies/backup/route");
        const res = await POST(REQ("/api/stickies/backup", { method: "POST" }));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe("GitHub dispatch failed");
        expect(body.detail).toEqual({ message: "Bad credentials" });
    });
});
