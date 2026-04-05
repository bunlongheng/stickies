/**
 * Integration tests: /api/stickies/push-nav — Push navigation
 * Tags: integration, api, push-nav
 * Priority: medium
 */
import { describe, it, expect, vi } from "vitest";
import { createMockSupabase, createChainMock } from "./mock-supabase";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
    VAPID_SUBJECT: "mailto:test@example.com",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-vapid-public",
    VAPID_PRIVATE_KEY: "test-vapid-private",
});

const mockSb = createMockSupabase([]);
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));
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
        const chain = createChainMock([]);
        mockSb.from.mockReturnValue(chain);
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
});
