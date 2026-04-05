/**
 * Integration tests: /api/stickies/local
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

import { createMockSupabase } from "./mock-supabase";
const mockSb = createMockSupabase();
mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no" } });
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue({ id: "new-note", title: "Test", order: 1 }),
    execute: vi.fn().mockResolvedValue(1),
}));

vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function() {
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

describe("POST /api/stickies/local", () => {
    it("returns 401 without auth", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const req = new Request("http://localhost:4444/api/stickies/local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "test" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("accepts API key auth", async () => {
        const { POST } = await import("@/app/api/stickies/local/route");
        const req = new Request("http://localhost:4444/api/stickies/local", {
            method: "POST",
            headers: {
                Authorization: "Bearer test-api-key",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ title: "Hello", content: "World" }),
        });
        const res = await POST(req);
        expect([200, 201]).toContain(res.status);
    });
});
