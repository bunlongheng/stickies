/**
 * Unit tests: _auth.ts — authorizeOwner (NextAuth edition)
 *
 * Covers: local bypass, API key, password, NextAuth session, rejection paths.
 *
 * Tags: unit, auth, security
 * Priority: critical
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const API_KEY = "test-api-key-123";
const PASSWORD = "test-password";
const OWNER_EMAIL = "owner@example.com";

Object.assign(process.env, {
    STICKIES_API_KEY: API_KEY,
    STICKIES_PASSWORD: PASSWORD,
    OWNER_EMAIL,
});

// vi.mock is hoisted above imports — use vi.hoisted so the controllable mock is visible
// to both the mocked module and the test bodies.
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({
    auth: mockAuth,
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { authorizeOwner } from "@/app/api/stickies/_auth";

beforeEach(() => {
    mockAuth.mockReset();
});

describe("authorizeOwner", () => {
    describe("local bypass", () => {
        it("returns true for localhost requests", async () => {
            const req = new Request("http://localhost:4444/api/test");
            expect(await authorizeOwner(req)).toBe(true);
        });

        it("returns true for 127.0.0.1 requests", async () => {
            const req = new Request("http://127.0.0.1:4444/api/test");
            expect(await authorizeOwner(req)).toBe(true);
        });

        it("returns true for LAN 192.168.x.x requests", async () => {
            const req = new Request("http://192.168.1.100:4444/api/test");
            expect(await authorizeOwner(req)).toBe(true);
        });
    });

    describe("API key / password auth", () => {
        it("accepts valid API key", async () => {
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: `Bearer ${API_KEY}` },
            });
            expect(await authorizeOwner(req)).toBe(true);
        });

        it("accepts valid password", async () => {
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: `Bearer ${PASSWORD}` },
            });
            expect(await authorizeOwner(req)).toBe(true);
        });

        it("rejects invalid bearer secret (and falls through to session check)", async () => {
            mockAuth.mockResolvedValue(null);
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: "Bearer wrong-key" },
            });
            expect(await authorizeOwner(req)).toBe(false);
        });
    });

    describe("NextAuth session auth", () => {
        it("accepts session whose email matches OWNER_EMAIL", async () => {
            mockAuth.mockResolvedValue({ user: { email: OWNER_EMAIL } });
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(true);
        });

        it("accepts session whose email matches OWNER_EMAIL case-insensitively", async () => {
            mockAuth.mockResolvedValue({ user: { email: OWNER_EMAIL.toUpperCase() } });
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(true);
        });

        it("rejects session for a non-owner email", async () => {
            mockAuth.mockResolvedValue({ user: { email: "stranger@example.com" } });
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(false);
        });

        it("rejects when session has no user email", async () => {
            mockAuth.mockResolvedValue({ user: {} });
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(false);
        });

        it("rejects when session is null", async () => {
            mockAuth.mockResolvedValue(null);
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(false);
        });
    });

    describe("no auth", () => {
        it("rejects request with no Authorization header AND no session", async () => {
            mockAuth.mockResolvedValue(null);
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(false);
        });

        it("rejects empty Bearer token AND no session", async () => {
            mockAuth.mockResolvedValue(null);
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: "Bearer " },
            });
            expect(await authorizeOwner(req)).toBe(false);
        });
    });

    describe("OWNER_EMAIL safety", () => {
        it("rejects all session-based auth if OWNER_EMAIL is unset (fail-closed)", async () => {
            const orig = process.env.OWNER_EMAIL;
            delete process.env.OWNER_EMAIL;
            mockAuth.mockResolvedValue({ user: { email: "anyone@example.com" } });
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(false);
            process.env.OWNER_EMAIL = orig;
        });
    });
});
