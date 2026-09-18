/**
 * Integration: POST /api/stickies/upload
 * Auth gate + thin proxy that forwards to /api/stickies/gdrive.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_EMAIL: "owner@example.com",
    NEXT_PUBLIC_APP_BASE_URL: "http://localhost:4444",
});

const { mockAuth } = vi.hoisted(() => ({
    mockAuth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/auth", () => ({
    auth: mockAuth,
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));

const fetchSpy = vi.spyOn(global, "fetch");

beforeEach(() => {
    mockAuth.mockReset().mockResolvedValue(null);
    fetchSpy.mockReset();
});

const buildReq = (auth?: string) => {
    const fd = new FormData();
    fd.append("file", new File(["test-bytes"], "test.txt", { type: "text/plain" }));
    fd.append("folder", "Inbox");
    return new Request("https://stickies.example.com/api/stickies/upload", {
        method: "POST",
        body: fd,
        ...(auth ? { headers: { Authorization: auth } } : {}),
    });
};

describe("POST /api/stickies/upload", () => {
    it("returns 401 without auth", async () => {
        const { POST } = await import("@/app/api/stickies/upload/route");
        const res = await POST(buildReq());
        expect(res.status).toBe(401);
    });

    it("accepts STICKIES_API_KEY bearer", async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ url: "https://lh3.googleusercontent.com/d/x", name: "test.txt" }),
        } as Response);
        const { POST } = await import("@/app/api/stickies/upload/route");
        const res = await POST(buildReq("Bearer test-api-key"));
        expect(res.status).toBe(200);
        // Forwarded to gdrive
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/api\/stickies\/gdrive$/);
    });

    it("accepts NextAuth owner session", async () => {
        mockAuth.mockResolvedValueOnce({ user: { email: "owner@example.com" } });
        fetchSpy.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ url: "https://lh3.googleusercontent.com/d/x" }),
        } as Response);
        const { POST } = await import("@/app/api/stickies/upload/route");
        const res = await POST(buildReq());
        expect(res.status).toBe(200);
    });

    it("rejects non-owner session", async () => {
        mockAuth.mockResolvedValueOnce({ user: { email: "stranger@example.com" } });
        const { POST } = await import("@/app/api/stickies/upload/route");
        const res = await POST(buildReq());
        expect(res.status).toBe(401);
    });

    it("forwards the gdrive error status when upstream fails", async () => {
        fetchSpy.mockResolvedValueOnce({
            ok: false,
            status: 502,
            json: async () => ({ error: "gdrive down" }),
        } as Response);
        const { POST } = await import("@/app/api/stickies/upload/route");
        const res = await POST(buildReq("Bearer test-api-key"));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.error).toBe("gdrive down");
    });
});
