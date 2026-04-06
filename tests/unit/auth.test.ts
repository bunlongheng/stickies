/**
 * Unit tests: _auth.ts — authorizeOwner
 *
 * Covers: dev bypass, API key auth, password auth, JWT auth, owner check
 *
 * Tags: unit, auth, security
 * Priority: critical
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const API_KEY = "test-api-key-123";
const PASSWORD = "test-password";
const OWNER_ID = "owner-uuid-1234";

// Set env before imports
Object.assign(process.env, {
    STICKIES_API_KEY: API_KEY,
    STICKIES_PASSWORD: PASSWORD,
    OWNER_USER_ID: OWNER_ID,
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
});

// Mock Supabase
const mockGetUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: mockGetUser },
    })),
}));

import { authorizeOwner } from "@/app/api/stickies/_auth";

beforeEach(() => {
    mockGetUser.mockReset();
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

    describe("API key auth", () => {
        it("accepts valid API key", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: `Bearer ${API_KEY}` },
            });
            expect(await authorizeOwner(req)).toBe(true);
            process.env.NODE_ENV = origEnv;
        });

        it("accepts valid password", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: `Bearer ${PASSWORD}` },
            });
            expect(await authorizeOwner(req)).toBe(true);
            process.env.NODE_ENV = origEnv;
        });

        it("rejects invalid API key", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: "Bearer wrong-key" },
            });
            expect(await authorizeOwner(req)).toBe(false);
            process.env.NODE_ENV = origEnv;
        });
    });

    describe("JWT auth", () => {
        it("accepts JWT with matching owner user ID", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            mockGetUser.mockResolvedValue({ data: { user: { id: OWNER_ID } }, error: null });
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: "Bearer valid-jwt" },
            });
            expect(await authorizeOwner(req)).toBe(true);
            process.env.NODE_ENV = origEnv;
        });

        it("rejects JWT with non-owner user ID", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            mockGetUser.mockResolvedValue({ data: { user: { id: "different-user" } }, error: null });
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: "Bearer other-jwt" },
            });
            expect(await authorizeOwner(req)).toBe(false);
            process.env.NODE_ENV = origEnv;
        });
    });

    describe("no auth", () => {
        it("rejects request with no Authorization header (prod)", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            const req = new Request("https://stickies.example.com/api/test");
            expect(await authorizeOwner(req)).toBe(false);
            process.env.NODE_ENV = origEnv;
        });

        it("rejects empty Bearer token (prod)", async () => {
            const origEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            const req = new Request("https://stickies.example.com/api/test", {
                headers: { Authorization: "Bearer " },
            });
            expect(await authorizeOwner(req)).toBe(false);
            process.env.NODE_ENV = origEnv;
        });
    });
});
