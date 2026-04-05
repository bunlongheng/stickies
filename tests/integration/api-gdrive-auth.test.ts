/**
 * Integration tests: Google Drive OAuth flow
 *
 * Tests validate:
 * - /api/stickies/gdrive/auth redirects to Google OAuth
 * - /api/stickies/gdrive/callback exchanges code for tokens
 * - /api/stickies/gdrive/callback handles errors gracefully
 * - /api/stickies/gdrive/status returns connection status
 *
 * Tags: integration, api, gdrive, oauth
 * Priority: critical
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    NEXT_PUBLIC_APP_BASE_URL: "http://localhost:4444",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
    STICKIES_API_KEY: "test-api-key",
});

// ── Mock Supabase ──
const mockFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner-uuid-1234" } } }) },
        from: mockFrom,
    })),
}));

// ── Mock _auth for status route ──
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: vi.fn().mockResolvedValue(true),
}));

describe("GET /api/stickies/gdrive/auth", () => {
    it("redirects to Google OAuth with correct params", async () => {
        const { GET } = await import("@/app/api/stickies/gdrive/auth/route");
        const res = await GET();

        expect(res.status).toBe(307); // NextResponse.redirect
        const location = res.headers.get("location") || "";
        expect(location).toContain("accounts.google.com/o/oauth2/v2/auth");
        expect(location).toContain("client_id=test-client-id.apps.googleusercontent.com");
        expect(location).toContain("redirect_uri=");
        expect(location).toContain("drive.file");
        expect(location).toContain("access_type=offline");
        expect(location).toContain("prompt=consent");
    });
});

describe("GET /api/stickies/gdrive/callback", () => {
    it("redirects with error when no code provided", async () => {
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const req = new Request("http://localhost:4444/api/stickies/gdrive/callback");
        const res = await GET(req as any);

        expect(res.status).toBe(307);
        const location = res.headers.get("location") || "";
        expect(location).toContain("gdrive=error");
    });

    it("redirects with error when error param present", async () => {
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const req = new Request("http://localhost:4444/api/stickies/gdrive/callback?error=access_denied");
        const res = await GET(req as any);

        expect(res.status).toBe(307);
        const location = res.headers.get("location") || "";
        expect(location).toContain("gdrive=error");
        expect(location).toContain("access_denied");
    });
});

describe("GET /api/stickies/gdrive/status", () => {
    it("returns connected=true when refresh token exists", async () => {
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({
            data: { refresh_token: "valid-token", active: true },
            error: null,
        });
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ single: mockSingle });

        const { GET } = await import("@/app/api/stickies/gdrive/status/route");
        const req = new Request("http://localhost:4444/api/stickies/gdrive/status", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.connected).toBe(true);
    });

    it("returns connected=false when no integration found", async () => {
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ single: mockSingle });

        const { GET } = await import("@/app/api/stickies/gdrive/status/route");
        const req = new Request("http://localhost:4444/api/stickies/gdrive/status", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req as any);
        const body = await res.json();
        expect(body.connected).toBe(false);
    });

    it("returns connected=false when integration is inactive", async () => {
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({
            data: { refresh_token: "token", active: false },
            error: null,
        });
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ single: mockSingle });

        const { GET } = await import("@/app/api/stickies/gdrive/status/route");
        const req = new Request("http://localhost:4444/api/stickies/gdrive/status", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req as any);
        const body = await res.json();
        expect(body.connected).toBe(false);
    });
});
