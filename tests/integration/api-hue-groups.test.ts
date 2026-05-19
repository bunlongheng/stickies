/**
 * Integration: GET /api/hue/groups
 *
 * Joins Hue v2 grouped_light resources with their parent room/zone
 * so each `grouped_light` shows up with the human-readable name
 * (e.g. "Office", "Living Room") instead of just a UUID.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOne, mockExecute } = vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
    mockExecute: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn(),
    queryOne: mockQueryOne,
    execute: mockExecute,
}));

const fetchSpy = vi.spyOn(global, "fetch");

beforeEach(() => {
    mockQueryOne.mockReset();
    mockExecute.mockReset();
    fetchSpy.mockReset();
});

// Helper — Hue v2 API shapes
const remoteGL = (data: { id: string; type?: string; metadata?: any }[]) =>
    ({ ok: true, json: async () => ({ data }) }) as unknown as Response;

const remoteRoom = (rooms: { metadata: { name: string }; services: { rtype: string; rid: string }[] }[]) =>
    ({ ok: true, json: async () => ({ data: rooms.map(r => ({ ...r, type: "room" })) }) }) as unknown as Response;

const remoteZone = (zones: { metadata: { name: string }; services: { rtype: string; rid: string }[] }[]) =>
    ({ ok: true, json: async () => ({ data: zones.map(z => ({ ...z, type: "zone" })) }) }) as unknown as Response;

describe("GET /api/hue/groups", () => {
    it("returns 503 when no active Hue integration row exists", async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toMatch(/No active Hue integration/);
    });

    it("returns 503 when integration row lacks app_key", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "int-1", config: { app_key: "" } });
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toMatch(/app_key not configured/);
    });

    it("maps grouped_light IDs to parent room name (remote path)", async () => {
        mockQueryOne.mockResolvedValueOnce({
            id: "int-1",
            config: { app_key: "appkey", client_id: "cid", client_secret: "secret", bridge_ip: "10.0.0.41" },
            access_token: "valid-token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        });
        fetchSpy
            .mockResolvedValueOnce(remoteGL([
                { id: "gl-office", type: "grouped_light" },
                { id: "gl-living", type: "grouped_light" },
            ]))
            .mockResolvedValueOnce(remoteRoom([
                { metadata: { name: "Office" },      services: [{ rtype: "grouped_light", rid: "gl-office" }] },
                { metadata: { name: "Living Room" }, services: [{ rtype: "grouped_light", rid: "gl-living" }] },
            ]))
            .mockResolvedValueOnce(remoteZone([]));
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.via).toBe("remote");
        expect(body.groups).toEqual([
            { id: "gl-office", name: "Office",      type: "room" },
            { id: "gl-living", name: "Living Room", type: "room" },
        ]);
    });

    it("maps grouped_light IDs to zone name when no room owns it", async () => {
        mockQueryOne.mockResolvedValueOnce({
            id: "int-1",
            config: { app_key: "appkey", client_id: "cid", client_secret: "secret" },
            access_token: "valid-token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        });
        fetchSpy
            .mockResolvedValueOnce(remoteGL([{ id: "gl-downstairs", type: "grouped_light" }]))
            .mockResolvedValueOnce(remoteRoom([]))
            .mockResolvedValueOnce(remoteZone([
                { metadata: { name: "Downstairs" }, services: [{ rtype: "grouped_light", rid: "gl-downstairs" }] },
            ]));
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        const body = await res.json();
        expect(body.groups[0]).toEqual({ id: "gl-downstairs", name: "Downstairs", type: "zone" });
    });

    it("falls back to 'All lights' label when no room/zone owns the grouped_light", async () => {
        mockQueryOne.mockResolvedValueOnce({
            id: "int-1",
            config: { app_key: "appkey", client_id: "cid", client_secret: "secret" },
            access_token: "valid-token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        });
        fetchSpy
            .mockResolvedValueOnce(remoteGL([{ id: "gl-orphan", type: "grouped_light" }]))
            .mockResolvedValueOnce(remoteRoom([]))
            .mockResolvedValueOnce(remoteZone([]));
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        const body = await res.json();
        expect(body.groups[0].name).toBe("All lights");
        expect(body.groups[0].type).toBe("grouped_light");
    });

    it("returns 500 when Hue Remote API throws", async () => {
        mockQueryOne.mockResolvedValueOnce({
            id: "int-1",
            config: { app_key: "appkey", client_id: "cid", client_secret: "secret" },
            access_token: "valid-token",
            token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        });
        fetchSpy.mockRejectedValueOnce(new Error("network down"));
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        expect(res.status).toBe(500);
        expect((await res.json()).error).toMatch(/network down/);
    });

    it("returns 503 when remote token is unavailable AND no bridge_ip is set (local fallback impossible)", async () => {
        mockQueryOne.mockResolvedValueOnce({
            id: "int-1",
            config: { app_key: "appkey" }, // no client_id/secret → no remote token
        });
        const { GET } = await import("@/app/api/hue/groups/route");
        const res = await GET();
        expect(res.status).toBe(503);
        expect((await res.json()).error).toMatch(/No remote token and no bridge_ip configured/);
    });
});
