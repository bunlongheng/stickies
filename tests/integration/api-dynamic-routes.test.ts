/**
 * Integration tests: Dynamic routes — automations/[id], integrations/[id]
 * Tags: integration, api, dynamic-routes
 * Priority: high
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

// ═══════════════════════════════════════════════════════════════════════════════
// /api/stickies/automations/[id]
// ═══════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/stickies/automations/[id]", () => {
    it("updates automation by id", async () => {
        const chain = createChainMock(null);
        mockSb.from.mockReturnValue(chain);
        const { PATCH } = await import("@/app/api/stickies/automations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/automations/auto-1", {
            method: "PATCH",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ active: false }),
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const { PATCH } = await import("@/app/api/stickies/automations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/automations/auto-1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: false }),
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(401);
    });

    it("returns 400 for invalid JSON", async () => {
        const { PATCH } = await import("@/app/api/stickies/automations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/automations/auto-1", {
            method: "PATCH",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: "bad json",
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(400);
    });
});

describe("DELETE /api/stickies/automations/[id]", () => {
    it("deletes automation by id", async () => {
        const chain = createChainMock(null);
        mockSb.from.mockReturnValue(chain);
        const { DELETE } = await import("@/app/api/stickies/automations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/automations/auto-1", {
            method: "DELETE",
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await DELETE(req, { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const { DELETE } = await import("@/app/api/stickies/automations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/automations/auto-1", {
            method: "DELETE",
        });
        const res = await DELETE(req, { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// /api/stickies/integrations/[id]
// ═══════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/stickies/integrations/[id]", () => {
    it("updates integration by id", async () => {
        const chain = createChainMock(null);
        mockSb.from.mockReturnValue(chain);
        const { PATCH } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", {
            method: "PATCH",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ active: false }),
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(200);
    });

    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const { PATCH } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: false }),
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(401);
    });
});

describe("DELETE /api/stickies/integrations/[id]", () => {
    it("deletes integration by id", async () => {
        const chain = createChainMock(null);
        mockSb.from.mockReturnValue(chain);
        const { DELETE } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", {
            method: "DELETE",
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await DELETE(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(200);
    });
});
