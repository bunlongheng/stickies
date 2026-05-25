/**
 * Integration tests: misc uncovered branches
 *
 * - magic: the "last resort" per-object JSON extraction (lines 141-143) when
 *   JSON.parse of the cleaned blob fails but individual {...} objects parse;
 *   and the "could not parse" 500 when even that fails.
 * - integrations/[id]: DELETE 401 + DELETE 500 + PATCH 500 catch branches.
 *
 * Tags: integration, api, magic, integrations
 * Priority: medium
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
});

const { mockQuery, mockQueryOne, mockExecute, mockAuth, mockCreate } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockQueryOne: vi.fn(),
    mockExecute: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
    mockCreate: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: mockQueryOne,
    execute: mockExecute,
}));
vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: mockAuth }));
vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
        messages = { create: mockCreate };
        constructor(_args: unknown) {}
    },
}));

beforeEach(() => {
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockExecute.mockReset().mockResolvedValue(1);
    mockAuth.mockReset().mockResolvedValue(true);
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
});

// ═══════════════════════════════════════════════════════════════════════════════
// magic — last-resort per-object JSON parsing
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/magic — last-resort parser", () => {
    const REQ = (body: unknown) => new Request("https://stickies.example.com/api/stickies/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    it("recovers individual {...} objects when the array won't JSON.parse as a whole", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "x", content: "x", icon: null, type: "text" }])
            .mockResolvedValueOnce([]); // no subfolders
        // A malformed array (extra junk between objects) that fails JSON.parse but
        // still has individually-parseable {...} objects.
        mockCreate.mockResolvedValueOnce({
            content: [{
                type: "text",
                text: '[{"index":1,"icon":"StarIcon","title":"Recovered"} GARBAGE {"index":2,"icon":"FireIcon","title":null}]',
            }],
        });
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "F" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        // index 1 matched n1 → updated; index 2 has no matching item → skipped
        expect(body.updated).toBe(1);
        const params = mockExecute.mock.calls[0][1] as unknown[];
        expect(params).toContain("__hero:StarIcon");
        expect(params).toContain("Recovered");
    });

    it("returns 500 when neither the array nor any object can be parsed", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "x", content: "x", icon: null, type: "text" }])
            .mockResolvedValueOnce([]);
        // Has [...] so jsonMatch succeeds, but contents are unparseable garbage with
        // no valid {...} object inside.
        mockCreate.mockResolvedValueOnce({
            content: [{ type: "text", text: "[ this is not json at all { broken ]" }],
        });
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "F" }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/Could not parse/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// integrations/[id] — DELETE 401 + error catches
// ═══════════════════════════════════════════════════════════════════════════════
describe("integrations/[id] — auth + error branches", () => {
    it("DELETE returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { DELETE } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", { method: "DELETE" });
        const res = await DELETE(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(401);
    });

    it("DELETE returns 500 when execute throws", async () => {
        mockExecute.mockRejectedValueOnce(new Error("fk_constraint"));
        const { DELETE } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", {
            method: "DELETE",
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await DELETE(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/fk_constraint/);
    });

    it("PATCH stringifies object fields and returns 500 when execute throws", async () => {
        mockExecute.mockRejectedValueOnce(new Error("patch_failed"));
        const { PATCH } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", {
            method: "PATCH",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ config: { app_key: "k" }, name: "Hue" }),
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/patch_failed/);
    });

    it("PATCH updates and JSON-stringifies object config fields", async () => {
        mockExecute.mockResolvedValueOnce(1);
        const { PATCH } = await import("@/app/api/stickies/integrations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations/int-1", {
            method: "PATCH",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ config: { app_key: "k" }, active: true }),
        });
        const res = await PATCH(req, { params: Promise.resolve({ id: "int-1" }) });
        expect(res.status).toBe(200);
        const vals = mockExecute.mock.calls[0][1] as unknown[];
        expect(vals).toContain(JSON.stringify({ app_key: "k" }));
        expect(vals).toContain(true);
    });
});
