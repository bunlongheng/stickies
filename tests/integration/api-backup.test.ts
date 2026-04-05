/**
 * Integration tests: /api/stickies/backup
 */
import { describe, it, expect, vi } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
    DB_DRIVER: "postgres",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
});

import { createMockSupabase } from "./mock-supabase";
const mockSb = createMockSupabase();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));

vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn().mockResolvedValue([
        { id: "n1", title: "Note 1", content: "Hello", folder_name: "Work", is_folder: false, created_at: "2026-01-01", updated_at: "2026-01-01" },
    ]),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue(1),
}));

describe("GET /api/stickies/backup", () => {
    it("returns backup data", async () => {
        const { GET } = await import("@/app/api/stickies/backup/route");
        const req = new Request("http://localhost:4444/api/stickies/backup", {
            headers: { Authorization: "Bearer test-api-key" },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
    });
});
