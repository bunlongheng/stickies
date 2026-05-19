/**
 * Integration: POST /api/stickies/push-subscribe
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecute, mockAuth } = vi.hoisted(() => ({
    mockExecute: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn(),
    queryOne: vi.fn(),
    execute: mockExecute,
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));

beforeEach(() => {
    mockExecute.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
});

const REQ = (body: unknown) => new Request("https://stickies.example.com/api/stickies/push-subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

describe("POST /api/stickies/push-subscribe", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/push-subscribe/route");
        const res = await POST(REQ({ subscription: { endpoint: "x", keys: {} } }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when subscription is missing endpoint", async () => {
        const { POST } = await import("@/app/api/stickies/push-subscribe/route");
        const res = await POST(REQ({ subscription: { keys: {} } }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when body has no subscription object", async () => {
        const { POST } = await import("@/app/api/stickies/push-subscribe/route");
        const res = await POST(REQ({}));
        expect(res.status).toBe(400);
    });

    it("upserts the subscription on conflict (endpoint as primary key)", async () => {
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/push-subscribe/route");
        const res = await POST(REQ({ subscription: { endpoint: "https://fcm.googleapis.com/xyz", keys: { p256dh: "k1", auth: "k2" } } }));
        expect(res.status).toBe(200);
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toMatch(/INSERT INTO push_subscriptions/);
        expect(sql).toMatch(/ON CONFLICT \(endpoint\)/);
        expect(mockExecute.mock.calls[0][1][0]).toBe("https://fcm.googleapis.com/xyz");
        // keys are JSON-stringified
        expect(mockExecute.mock.calls[0][1][1]).toBe(JSON.stringify({ p256dh: "k1", auth: "k2" }));
    });

    it("returns 500 when the DB throws", async () => {
        mockExecute.mockRejectedValueOnce(new Error("connection refused"));
        const { POST } = await import("@/app/api/stickies/push-subscribe/route");
        const res = await POST(REQ({ subscription: { endpoint: "x", keys: {} } }));
        expect(res.status).toBe(500);
    });
});
