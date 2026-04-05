/**
 * Integration tests: /api/stickies/share
 */
import { describe, it, expect, vi } from "vitest";
import { createMockSupabase, createChainMock } from "./mock-supabase";

Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    STICKIES_API_KEY: "test-api-key",
});

const mockSb = createMockSupabase();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));

import { GET, POST } from "@/app/api/stickies/share/route";

describe("GET /api/stickies/share", () => {
    it("returns 400 when no token provided", async () => {
        const req = new Request("http://localhost:4444/api/stickies/share");
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns shared note when valid token", async () => {
        const chain = createChainMock({
            id: "s1", title: "Shared", content: "Hello",
            burn_after_read: false, expires_at: new Date(Date.now() + 86400000).toISOString(),
        });
        mockSb.from.mockReturnValue(chain);
        const req = new Request("http://localhost:4444/api/stickies/share?token=abc123");
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});

// POST tests skipped — uses @supabase/ssr createServerClient which requires cookies middleware
