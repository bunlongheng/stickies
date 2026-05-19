/**
 * Integration tests: /api/stickies/push-nav — Push navigation
 * Tags: integration, api, push-nav
 * Priority: medium
 */
import { describe, it, expect, vi } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
    VAPID_SUBJECT: "mailto:test@example.com",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-vapid-public",
    VAPID_PRIVATE_KEY: "test-vapid-private",
});

// ── Mock DB driver (push-nav reads push_subscriptions) ─────────────────────
vi.mock("@/lib/db-driver", () => ({
    query:    vi.fn().mockResolvedValue([]),
    queryOne: vi.fn(),
    execute:  vi.fn(),
}));
vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(() => ({ trigger: vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("web-push", () => ({
    default: { setVapidDetails: vi.fn(), sendNotification: vi.fn().mockResolvedValue({}) },
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
}));

import { POST } from "@/app/api/stickies/push-nav/route";

describe("POST /api/stickies/push-nav", () => {
    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: "/test" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when url is missing", async () => {
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/url/i);
    });

    it("broadcasts navigate event with valid url", async () => {
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ url: "/?folder=Work", title: "Go to Work" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it("sends web-push notifications to subscriptions, skipping the sender's own endpoint", async () => {
        const { query } = await import("@/lib/db-driver");
        (query as any).mockResolvedValueOnce([
            { endpoint: "https://push.example.com/A", keys: { p256dh: "k1", auth: "a1" } },
            { endpoint: "https://push.example.com/B", keys: { p256dh: "k2", auth: "a2" } },
            { endpoint: "https://push.example.com/SELF", keys: { p256dh: "k3", auth: "a3" } },
        ]);
        const webpush = (await import("web-push")) as any;
        webpush.default.sendNotification.mockClear();
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ url: "/?id=note-1", title: "Open Note", senderEndpoint: "https://push.example.com/SELF" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        // 2 endpoints (A and B), not 3 — SELF is filtered out
        expect(webpush.default.sendNotification).toHaveBeenCalledTimes(2);
        // Payload includes the title + url
        const sentPayload = JSON.parse(webpush.default.sendNotification.mock.calls[0][1]);
        expect(sentPayload.url).toBe("/?id=note-1");
        expect(sentPayload.title).toBe("Open Note");
    });

    it("uses default 'Stickies' title when none supplied", async () => {
        const { query } = await import("@/lib/db-driver");
        (query as any).mockResolvedValueOnce([
            { endpoint: "https://push.example.com/A", keys: { p256dh: "k", auth: "a" } },
        ]);
        const webpush = (await import("web-push")) as any;
        webpush.default.sendNotification.mockClear();
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ url: "/x" }),
        });
        await POST(req);
        const sentPayload = JSON.parse(webpush.default.sendNotification.mock.calls[0][1]);
        expect(sentPayload.title).toBe("Stickies");
    });

    it("swallows web-push errors (Promise.allSettled, individual failures don't fail the route)", async () => {
        const { query } = await import("@/lib/db-driver");
        (query as any).mockResolvedValueOnce([
            { endpoint: "https://push.example.com/dead", keys: { p256dh: "k", auth: "a" } },
        ]);
        const webpush = (await import("web-push")) as any;
        webpush.default.sendNotification.mockReset().mockRejectedValueOnce(new Error("410 gone"));
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ url: "/x" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);  // still ok despite the rejected send
    });

    it("rejects non-string url values (e.g. number, object) with 400", async () => {
        const req = new Request("http://localhost:4444/api/stickies/push-nav", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ url: 42 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
