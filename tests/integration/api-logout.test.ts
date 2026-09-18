/**
 * Integration: POST /api/stickies/logout
 * Thin wrapper around NextAuth's signOut — verify it delegates correctly.
 */
import { describe, it, expect, vi } from "vitest";

const { mockSignOut } = vi.hoisted(() => ({
    mockSignOut: vi.fn(),
}));

vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: mockSignOut,
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));

describe("POST /api/stickies/logout", () => {
    it("calls signOut with redirect=false and redirectTo='/sign-in'", async () => {
        const expectedResponse = new Response(null, { status: 200 });
        mockSignOut.mockResolvedValueOnce(expectedResponse);

        const { POST } = await import("@/app/api/stickies/logout/route");
        const res = await POST();

        expect(mockSignOut).toHaveBeenCalledWith({ redirect: false, redirectTo: "/sign-in" });
        expect(res).toBe(expectedResponse);
    });

    it("forwards whatever Response signOut returns", async () => {
        const redirectResp = new Response(null, { status: 302, headers: { location: "/sign-in" } });
        mockSignOut.mockResolvedValueOnce(redirectResp);

        const { POST } = await import("@/app/api/stickies/logout/route");
        const res = await POST();

        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("/sign-in");
    });
});
