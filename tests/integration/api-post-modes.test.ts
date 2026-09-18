/**
 * Integration: POST /api/stickies — body-shape branches not covered by api-stickies.test.ts.
 *
 * Focused on:
 *  - raw=1 column whitelist (security)
 *  - ?type=folder edge cases (duplicate / parent_folder / icon)
 *
 * (Markdown POST is exercised via api-local; api-stickies covers JSON +
 *  batch + folder happy paths.)
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

const { mockQuery, mockQueryOne, mockExecute } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockQueryOne: vi.fn(),
    mockExecute: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: mockQueryOne,
    execute: mockExecute,
}));
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function () {
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

beforeEach(() => {
    mockQuery.mockReset().mockResolvedValue([]);
    mockQueryOne.mockReset();
    mockExecute.mockReset();
});

const apiReq = (path: string, init: RequestInit) =>
    new Request(`https://stickies.example.com${path}`, {
        method: "POST",
        ...init,
        headers: { Authorization: "Bearer test-api-key", ...(init.headers as Record<string, string> ?? {}) },
    });

// ─── Raw insert whitelist ────────────────────────────────────────────────────
describe("POST /api/stickies?raw=1 — column whitelist", () => {
    it("strips disallowed columns (security)", async () => {
        mockQueryOne.mockResolvedValue({ id: "x" });
        const { POST } = await import("@/app/api/stickies/ext/route");
        await POST(apiReq("/api/stickies/ext?raw=1", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "T",
                content: "C",
                // dangerous columns that must be filtered
                password: "haha",
                evil_field: "x",
            }),
        }));
        const sql = mockQueryOne.mock.calls[0][0] as string;
        expect(sql).not.toContain('"password"');
        expect(sql).not.toContain('"evil_field"');
    });

    it("returns 400 on malformed JSON", async () => {
        const { POST } = await import("@/app/api/stickies/ext/route");
        const res = await POST(apiReq("/api/stickies/ext?raw=1", {
            headers: { "Content-Type": "application/json" },
            body: "not json",
        }));
        expect(res.status).toBe(400);
    });

    it("returns 500 when DB returns no row", async () => {
        mockQueryOne.mockResolvedValue(null);
        const { POST } = await import("@/app/api/stickies/ext/route");
        const res = await POST(apiReq("/api/stickies/ext?raw=1", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "T", content: "C" }),
        }));
        expect(res.status).toBe(500);
    });
});

// ─── Folder creation edge cases ──────────────────────────────────────────────
describe("POST /api/stickies?type=folder", () => {
    it("returns 409 when folder with same name + parent already exists", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "existing-folder" });
        const { POST } = await import("@/app/api/stickies/ext/route");
        const res = await POST(apiReq("/api/stickies/ext?type=folder&name=Work", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        }));
        expect(res.status).toBe(409);
    });

    it("returns 400 when name is missing", async () => {
        const { POST } = await import("@/app/api/stickies/ext/route");
        const res = await POST(apiReq("/api/stickies/ext?type=folder", {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        }));
        expect(res.status).toBe(400);
    });
});
