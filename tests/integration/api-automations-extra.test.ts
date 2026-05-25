/**
 * Integration tests: /api/stickies/automations + automations/[id] — uncovered paths
 *
 * Targets gaps not covered by api-automations.test.ts / api-dynamic-routes.test.ts:
 * - GET last_fired enrichment branch (logs joined onto automations)
 * - GET 401 (unauthorized) + 500 (DB throws)
 * - POST validation 400s (missing name / trigger_type / action_type)
 * - POST 401 + 400 (invalid JSON) + 500 (insert throws)
 * - [id] PATCH dynamic SET clause (condition/action_config stringified) + 500 catch
 * - [id] DELETE 500 catch
 *
 * Tags: integration, api, automations
 * Priority: high
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
});

const { mockQuery, mockQueryOne, mockExecute, mockAuth } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockQueryOne: vi.fn(),
    mockExecute: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query:    mockQuery,
    queryOne: mockQueryOne,
    execute:  mockExecute,
}));
vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: mockAuth }));

beforeEach(() => {
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockExecute.mockReset().mockResolvedValue(1);
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (init?: RequestInit) =>
    new Request("http://localhost:4444/api/stickies/automations", init);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/stickies/automations
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/stickies/automations", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { GET } = await import("@/app/api/stickies/automations/route");
        const res = await GET(REQ({ headers: {} }));
        expect(res.status).toBe(401);
    });

    it("enriches automations with last_fired from automation_logs", async () => {
        mockQuery
            .mockResolvedValueOnce([
                { id: "a1", name: "Backup", active: true },
                { id: "a2", name: "Flash", active: true },
            ])
            .mockResolvedValueOnce([
                { automation_id: "a1", triggered_at: "2026-05-20T10:00:00Z" },
                { automation_id: "a1", triggered_at: "2026-05-19T10:00:00Z" }, // older, ignored
            ]);
        const { GET } = await import("@/app/api/stickies/automations/route");
        const res = await GET(REQ({ headers: { Authorization: "Bearer test-api-key" } }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body[0].last_fired).toBe("2026-05-20T10:00:00Z"); // newest kept
        expect(body[1].last_fired).toBeNull();                    // no logs for a2
        // The logs query must use IN (...) placeholders for each id
        const logsSql = mockQuery.mock.calls[1][0] as string;
        expect(logsSql).toMatch(/automation_id IN \(\$1, \$2\)/);
    });

    it("skips the logs query when there are no automations", async () => {
        mockQuery.mockResolvedValueOnce([]); // no automations
        const { GET } = await import("@/app/api/stickies/automations/route");
        const res = await GET(REQ({ headers: { Authorization: "Bearer test-api-key" } }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual([]);
        // Only the initial automations query ran (no second logs query)
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when the DB throws", async () => {
        mockQuery.mockRejectedValueOnce(new Error("automations table missing"));
        const { GET } = await import("@/app/api/stickies/automations/route");
        const res = await GET(REQ({ headers: { Authorization: "Bearer test-api-key" } }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/automations table missing/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/stickies/automations
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/automations", () => {
    const postBody = (b: unknown) => REQ({
        method: "POST",
        headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
        body: JSON.stringify(b),
    });

    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(postBody({ name: "x", trigger_type: "t", action_type: "a" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 for invalid JSON", async () => {
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(REQ({
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: "not json",
        }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when name is missing", async () => {
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(postBody({ trigger_type: "t", action_type: "a" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/name/i);
    });

    it("returns 400 when trigger_type is missing", async () => {
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(postBody({ name: "n", action_type: "a" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/trigger_type/i);
    });

    it("returns 400 when action_type is missing", async () => {
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(postBody({ name: "n", trigger_type: "t" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/action_type/i);
    });

    it("creates an automation and stringifies condition + action_config", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "a-new", name: "Test" });
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(postBody({
            name: "  Test  ",
            trigger_type: "note_created",
            action_type: "hue_flash",
            condition: { folder: "Work" },
            action_config: { color: "#FF0000" },
        }));
        expect(res.status).toBe(201);
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[0]).toBe("Test");                                // trimmed name
        expect(params[3]).toBe(JSON.stringify({ folder: "Work" }));    // condition
        expect(params[6]).toBe(JSON.stringify({ color: "#FF0000" }));  // action_config
        expect(params[7]).toBe(true);                                  // active
    });

    it("defaults condition + action_config to {} when omitted", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "a-new" });
        const { POST } = await import("@/app/api/stickies/automations/route");
        await POST(postBody({ name: "n", trigger_type: "t", action_type: "a" }));
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[3]).toBe(JSON.stringify({}));
        expect(params[6]).toBe(JSON.stringify({}));
    });

    it("returns 500 when insert throws", async () => {
        mockQueryOne.mockRejectedValueOnce(new Error("unique_violation"));
        const { POST } = await import("@/app/api/stickies/automations/route");
        const res = await POST(postBody({ name: "n", trigger_type: "t", action_type: "a" }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/unique_violation/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/stickies/automations/[id]
// ═══════════════════════════════════════════════════════════════════════════════
describe("PATCH /api/stickies/automations/[id]", () => {
    const ID_REQ = (b: unknown) => new Request("http://localhost:4444/api/stickies/automations/auto-1", {
        method: "PATCH",
        headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
        body: JSON.stringify(b),
    });

    it("builds a dynamic SET clause and stringifies condition + action_config", async () => {
        const { PATCH } = await import("@/app/api/stickies/automations/[id]/route");
        const res = await PATCH(
            ID_REQ({ name: "Renamed", condition: { x: 1 }, action_config: { c: "#000" }, active: false }),
            { params: Promise.resolve({ id: "auto-1" }) }
        );
        expect(res.status).toBe(200);
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toMatch(/UPDATE automations SET/);
        expect(sql).toMatch(/updated_at = \$/);
        const vals = mockExecute.mock.calls[0][1] as unknown[];
        expect(vals).toContain(JSON.stringify({ x: 1 }));
        expect(vals).toContain(JSON.stringify({ c: "#000" }));
        expect(vals[vals.length - 1]).toBe("auto-1"); // id is last param (WHERE)
    });

    it("returns 500 when execute throws", async () => {
        mockExecute.mockRejectedValueOnce(new Error("update failed"));
        const { PATCH } = await import("@/app/api/stickies/automations/[id]/route");
        const res = await PATCH(ID_REQ({ active: true }), { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/update failed/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/stickies/automations/[id]
// ═══════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/stickies/automations/[id]", () => {
    it("returns 500 when delete throws", async () => {
        mockExecute.mockRejectedValueOnce(new Error("delete failed"));
        const { DELETE } = await import("@/app/api/stickies/automations/[id]/route");
        const req = new Request("http://localhost:4444/api/stickies/automations/auto-1", {
            method: "DELETE",
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await DELETE(req, { params: Promise.resolve({ id: "auto-1" }) });
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/delete failed/);
    });
});
