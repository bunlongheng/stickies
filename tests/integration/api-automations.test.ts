/**
 * Integration tests: /api/stickies/automations + /api/stickies/automation-logs
 */
import { describe, it, expect, vi } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
});

// ── Mock DB driver — routes use query/queryOne ────────────────────────────────
vi.mock("@/lib/db-driver", () => ({
    query:    vi.fn().mockResolvedValue([]),
    queryOne: vi.fn(),
    execute:  vi.fn(),
}));
vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: vi.fn().mockResolvedValue(true) }));

import { query, queryOne } from "@/lib/db-driver";
const mockQuery    = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);

describe("GET /api/stickies/automations", () => {
    it("returns automations list", async () => {
        mockQuery.mockResolvedValueOnce([{ id: "a1", name: "Backup", active: true }]);

        const { GET } = await import("@/app/api/stickies/automations/route");
        const req = new Request("http://localhost:4444/api/stickies/automations", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});

describe("POST /api/stickies/automations", () => {
    it("creates an automation", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "a-new", name: "Test" });

        const { POST } = await import("@/app/api/stickies/automations/route");
        const req = new Request("http://localhost:4444/api/stickies/automations", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Test", trigger_type: "note_created", action_type: "hue_flash" }),
        });
        const res = await POST(req);
        expect([200, 201]).toContain(res.status);
    });
});

describe("GET /api/stickies/automation-logs", () => {
    it("returns logs list", async () => {
        mockQuery.mockResolvedValueOnce([{ id: "l1", status: "success" }]);

        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        const req = new Request("http://localhost:4444/api/stickies/automation-logs", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});
