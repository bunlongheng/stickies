/**
 * Integration tests: /api/stickies/ai-mode — AI cleanup broadcast
 * Tags: integration, api, ai-mode, pusher
 * Priority: medium
 */
import { describe, it, expect, vi } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
});

vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })) }));

const mockTrigger = vi.fn().mockResolvedValue(undefined);
vi.mock("pusher", () => {
    class MockPusher { trigger = mockTrigger; }
    return { default: MockPusher };
});

import { POST, DELETE } from "@/app/api/stickies/ai-mode/route";

describe("POST /api/stickies/ai-mode", () => {
    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const req = new Request("http://localhost:4444/api/stickies/ai-mode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("broadcasts ai-mode-start event", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai-mode", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Cleaning up..." }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.event).toBe("ai-mode-start");
    });

    it("uses default message when none provided", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai-mode", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
    });
});

describe("DELETE /api/stickies/ai-mode", () => {
    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const req = new Request("http://localhost:4444/api/stickies/ai-mode", { method: "DELETE" });
        const res = await DELETE(req);
        expect(res.status).toBe(401);
    });

    it("broadcasts ai-mode-end event", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai-mode", {
            method: "DELETE",
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await DELETE(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.event).toBe("ai-mode-end");
    });
});
