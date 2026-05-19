/**
 * Integration: GET /api/stickies/gdrive/callback
 * Google OAuth callback for gdrive integration.
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
    process.env.NEXT_PUBLIC_APP_BASE_URL = "http://localhost:4444";
    process.env.GOOGLE_CLIENT_ID = "test-google-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
});

const REQ = (qs: string) => new Request(`http://localhost:4444/api/stickies/gdrive/callback${qs}`);

describe("GET /api/stickies/gdrive/callback", () => {
    it("redirects with error when Google returns ?error=access_denied", async () => {
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const res = await GET(REQ("?error=access_denied"));
        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.status).toBeLessThan(400);
        const loc = res.headers.get("location") ?? "";
        expect(loc).toContain("/?gdrive=error");
        expect(loc).toContain("access_denied");
    });

    it("redirects with error when neither code nor error is present", async () => {
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const res = await GET(REQ(""));
        expect(res.status).toBeGreaterThanOrEqual(300);
        expect(res.status).toBeLessThan(400);
        expect(res.headers.get("location") ?? "").toContain("/?gdrive=error");
    });

    it("redirects with no_refresh_token when Google's token response lacks refresh_token", async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "at", expires_in: 3600 }), // no refresh_token
        } as Response);
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const res = await GET(REQ("?code=test-code"));
        expect(res.headers.get("location") ?? "").toContain("no_refresh_token");
    });

    it("UPDATEs existing integration row when one already exists", async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }),
        } as Response);
        mockQueryOne.mockResolvedValueOnce({ id: "existing-uuid" });
        mockExecute.mockResolvedValue(1);
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const res = await GET(REQ("?code=ok-code"));
        expect(res.headers.get("location")).toBe("http://localhost:4444/?gdrive=connected");
        const updateSql = mockExecute.mock.calls[0][0] as string;
        expect(updateSql).toMatch(/UPDATE integrations SET/);
        expect(updateSql).toContain("refresh_token");
    });

    it("INSERTs a new integration row when none exists", async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }),
        } as Response);
        mockQueryOne.mockResolvedValueOnce(null);
        mockExecute.mockResolvedValue(1);
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const res = await GET(REQ("?code=ok-code"));
        expect(res.headers.get("location")).toBe("http://localhost:4444/?gdrive=connected");
        const insertSql = mockExecute.mock.calls[0][0] as string;
        expect(insertSql).toMatch(/INSERT INTO integrations/);
    });

    it("redirects with unknown error message when the token exchange throws", async () => {
        fetchSpy.mockRejectedValueOnce(new Error("network down"));
        const { GET } = await import("@/app/api/stickies/gdrive/callback/route");
        const res = await GET(REQ("?code=oops"));
        expect(res.headers.get("location") ?? "").toMatch(/gdrive=error/);
        expect(res.headers.get("location") ?? "").toContain("network%20down");
    });
});
