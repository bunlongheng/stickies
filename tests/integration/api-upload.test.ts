/**
 * Integration tests: /api/stickies/upload
 */
import { describe, it, expect, vi } from "vitest";
import { createMockSupabase } from "./mock-supabase";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    NEXT_PUBLIC_APP_BASE_URL: "http://localhost:4444",
});

const mockSb = createMockSupabase();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockSb) }));

import { POST } from "@/app/api/stickies/upload/route";

describe("POST /api/stickies/upload", () => {
    it("returns 401 without auth", async () => {
        mockSb.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "no" } });
        const fd = new FormData();
        fd.append("file", new File(["test"], "test.txt", { type: "text/plain" }));
        const req = new Request("http://localhost:4444/api/stickies/upload", { method: "POST", body: fd });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});
