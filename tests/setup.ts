/**
 * Global vitest setup.
 *
 * 1. Mocks `@/auth` so test files that import API routes don't drag in the full
 *    next-auth bundle (which has incomplete ESM resolution in vitest as of v5-beta).
 *    Tests that care about auth behavior re-mock these per-file with `vi.mock("@/auth", ...)`.
 *
 * 2. Provides safe defaults for required env vars so route modules don't crash
 *    at import time.
 */
import { vi } from "vitest";

// Env defaults — only set if not already present
const defaults: Record<string, string> = {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
    OWNER_EMAIL: "owner@example.com",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
    DATABASE_URL: "postgres://test:test@127.0.0.1:5432/test",
    AUTH_SECRET: "test-auth-secret-base64-placeholder-32-bytes",
    GOOGLE_CLIENT_ID: "test-google-id",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
};
for (const [k, v] of Object.entries(defaults)) {
    if (process.env[k] === undefined) process.env[k] = v;
}

// Default @/auth mock — returns no session. Per-test files can override via vi.mock.
vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));
