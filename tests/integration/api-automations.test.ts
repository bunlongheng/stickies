/**
 * Integration tests: /api/stickies/automations + /api/stickies/automation-logs
 */
import { describe, it, expect, vi } from "vitest";
import { createMockSupabase, createChainMock } from "./mock-supabase";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
});

const mockSb = createMockSupabase();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));
vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: vi.fn().mockResolvedValue(true) }));

describe("GET /api/stickies/automations", () => {
    it("returns automations list", async () => {
        const chain = createChainMock([{ id: "a1", name: "Backup", active: true }]);
        mockSb.from.mockReturnValue(chain);

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
        const chain = createChainMock({ id: "a-new", name: "Test" });
        mockSb.from.mockReturnValue(chain);

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
        const chain = createChainMock([{ id: "l1", status: "success" }]);
        mockSb.from.mockReturnValue(chain);

        const { GET } = await import("@/app/api/stickies/automation-logs/route");
        const req = new Request("http://localhost:4444/api/stickies/automation-logs", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});
