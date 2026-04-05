/**
 * Integration tests: /api/stickies/ai — Claude AI streaming endpoint
 * Tags: integration, api, ai
 * Priority: high
 */
import { describe, it, expect, vi } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-key",
    OWNER_USER_ID: "owner-uuid-1234",
    ANTHROPIC_API_KEY: "test-anthropic-key",
});

vi.mock("@/app/api/stickies/_auth", () => ({ authorizeOwner: vi.fn().mockResolvedValue(true) }));

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
    const mockStream = {
        [Symbol.asyncIterator]() {
            let i = 0;
            const items = [
                { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } },
                { type: "content_block_delta", delta: { type: "text_delta", text: " world" } },
            ];
            return { next: async () => i < items.length ? { done: false, value: items[i++] } : { done: true, value: undefined } };
        },
    };
    class MockAnthropic {
        messages = { stream: vi.fn().mockResolvedValue(mockStream) };
    }
    return { default: MockAnthropic };
});

import { POST } from "@/app/api/stickies/ai/route";

describe("POST /api/stickies/ai", () => {
    it("returns 401 without auth", async () => {
        const { authorizeOwner } = await import("@/app/api/stickies/_auth");
        (authorizeOwner as any).mockResolvedValueOnce(false);
        const req = new Request("http://localhost:4444/api/stickies/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "test" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when prompt is missing", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("returns 400 for empty prompt", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "   " }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("streams response for valid prompt", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "Summarize this note", content: "Hello world", title: "Test" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/plain");
    });

    it("handles invalid JSON body gracefully", async () => {
        const req = new Request("http://localhost:4444/api/stickies/ai", {
            method: "POST",
            headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json" },
            body: "not json",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
