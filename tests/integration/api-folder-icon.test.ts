/**
 * Integration: /api/stickies/folder-icon (GET + PATCH)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockExecute, mockAuth } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockExecute: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: vi.fn(),
    execute: mockExecute,
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));

beforeEach(() => {
    mockQuery.mockReset();
    mockExecute.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (path: string, init?: RequestInit) =>
    new Request(`https://stickies.example.com${path}`, init);

describe("GET /api/stickies/folder-icon", () => {
    it("returns icons keyed by folder_name (trimmed)", async () => {
        mockQuery.mockResolvedValue([
            { folder_name: "Work", content: "💼" },
            { folder_name: "Personal", content: "🏠 " },
            { folder_name: "Empty", content: "" },           // skipped (empty)
            { folder_name: "Whitespace", content: "   " },   // skipped (trims to empty)
            { folder_name: "", content: "🚫" },              // skipped (empty key)
        ]);
        const { GET } = await import("@/app/api/stickies/folder-icon/route");
        const res = await GET(REQ("/api/stickies/folder-icon"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.icons).toEqual({ Work: "💼", Personal: "🏠" });
    });

    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { GET } = await import("@/app/api/stickies/folder-icon/route");
        const res = await GET(REQ("/api/stickies/folder-icon"));
        expect(res.status).toBe(401);
    });
});

describe("PATCH /api/stickies/folder-icon", () => {
    it("updates a folder icon", async () => {
        mockExecute.mockResolvedValue(1);
        const { PATCH } = await import("@/app/api/stickies/folder-icon/route");
        const res = await PATCH(REQ("/api/stickies/folder-icon", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderName: "Work", icon: "💼" }),
        }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        // Verify SQL is user-scoped
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toContain("user_id");
        expect(sql).toContain("is_folder = true");
        expect(mockExecute.mock.calls[0][1]).toContain("💼");
        expect(mockExecute.mock.calls[0][1]).toContain("Work");
    });

    it("returns 400 when folderName is empty", async () => {
        const { PATCH } = await import("@/app/api/stickies/folder-icon/route");
        const res = await PATCH(REQ("/api/stickies/folder-icon", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderName: "", icon: "💼" }),
        }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when folderName is missing", async () => {
        const { PATCH } = await import("@/app/api/stickies/folder-icon/route");
        const res = await PATCH(REQ("/api/stickies/folder-icon", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ icon: "💼" }),
        }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when JSON body is malformed", async () => {
        const { PATCH } = await import("@/app/api/stickies/folder-icon/route");
        const res = await PATCH(REQ("/api/stickies/folder-icon", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: "not json",
        }));
        expect(res.status).toBe(400);
    });

    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { PATCH } = await import("@/app/api/stickies/folder-icon/route");
        const res = await PATCH(REQ("/api/stickies/folder-icon", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderName: "X", icon: "💼" }),
        }));
        expect(res.status).toBe(401);
    });

    it("trims icon whitespace before save", async () => {
        mockExecute.mockResolvedValue(1);
        const { PATCH } = await import("@/app/api/stickies/folder-icon/route");
        await PATCH(REQ("/api/stickies/folder-icon", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderName: " Work ", icon: "  💼  " }),
        }));
        const params = mockExecute.mock.calls[0][1];
        expect(params[0]).toBe("💼");      // icon
        expect(params[2]).toBe("Work");     // folderName
    });
});
