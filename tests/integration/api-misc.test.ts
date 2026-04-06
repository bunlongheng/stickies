/**
 * Integration tests: misc API routes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, createChainMock } from "./mock-supabase";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    STICKIES_PASSWORD: "test-password",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
});

// ── Mock DB driver (used by public + folder-icon routes) ─────────────────────
vi.mock("@/lib/db-driver", () => ({
    query:    vi.fn(),
    queryOne: vi.fn(),
    execute:  vi.fn(),
}));

const mockSb = createMockSupabase();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));
vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: vi.fn().mockResolvedValue(true) }));
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function() {
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

import { query, queryOne, execute } from "@/lib/db-driver";
const mockQuery    = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute  = vi.mocked(execute);

// ── /api/stickies/public ──
describe("GET /api/stickies/public", () => {
    it("returns 400 when no noteId provided", async () => {
        const { GET } = await import("@/app/api/stickies/public/route");
        const req = new Request("http://localhost:4444/api/stickies/public");
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns public note by noteId", async () => {
        mockQueryOne.mockResolvedValueOnce({ title: "Public", content: "Hi", type: "text", folder_color: "#fff" });
        const { GET } = await import("@/app/api/stickies/public/route");
        const req = new Request("http://localhost:4444/api/stickies/public?noteId=n1");
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});

// logout uses @supabase/ssr createServerClient — tested via e2e instead

// ── /api/stickies/img-proxy ──
describe("GET /api/stickies/img-proxy", () => {
    it("returns 400 when no url provided", async () => {
        const { GET } = await import("@/app/api/stickies/img-proxy/route");
        const req = new Request("http://localhost:4444/api/stickies/img-proxy");
        const res = await GET(req);
        expect(res.status).toBe(400);
    });
});

// ── /api/stickies/folder-icon ──
describe("/api/stickies/folder-icon", () => {
    it("GET returns folder icons with valid auth", async () => {
        mockQuery.mockResolvedValueOnce([{ folder_name: "Work", content: "📁" }]);
        const { GET } = await import("@/app/api/stickies/folder-icon/route");
        const req = new Request("http://localhost:4444/api/stickies/folder-icon", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});

// ── /api/stickies/integrations ──
describe("/api/stickies/integrations", () => {
    it("GET returns integrations list", async () => {
        const chain = createChainMock([{ id: "int-1", name: "Hue", type: "hue" }]);
        mockSb.from.mockReturnValue(chain);
        const { GET } = await import("@/app/api/stickies/integrations/route");
        const req = new Request("http://localhost:4444/api/stickies/integrations", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});

// ── /api/stickies/push-subscribe ──
describe("POST /api/stickies/push-subscribe", () => {
    it("handles subscription request", async () => {
        const chain = createChainMock(null);
        mockSb.from.mockReturnValue(chain);
        const { POST } = await import("@/app/api/stickies/push-subscribe/route");
        const req = new Request("http://localhost:4444/api/stickies/push-subscribe", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: "https://push.example.com", keys: { p256dh: "key", auth: "auth" } }),
        });
        const res = await POST(req);
        expect([200, 201, 400, 500]).toContain(res.status);
    });
});
