/**
 * Integration: POST /api/stickies/magic
 *
 * AI icon-assignment + title-cleanup over a folder's notes/subfolders.
 * Covers: auth gate, env gate, body validation, empty-folder paths,
 * the JSON-extraction parser around the AI response, and DB write fan-out.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQuery, mockExecute, mockAuth, mockCreate } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockExecute: vi.fn(),
    mockAuth: vi.fn().mockResolvedValue(true),
    mockCreate: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: vi.fn(),
    execute: mockExecute,
}));
vi.mock("@/app/api/stickies/_auth", () => ({
    authorizeOwner: mockAuth,
}));
vi.mock("@anthropic-ai/sdk", () => ({
    // Use a real class so `new Anthropic(...)` works as a constructor.
    default: class MockAnthropic {
        messages = { create: mockCreate };
        constructor(_args: unknown) { /* swallow */ }
    },
}));

beforeEach(() => {
    mockQuery.mockReset();
    mockExecute.mockReset();
    mockAuth.mockReset().mockResolvedValue(true);
    mockCreate.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
});

const REQ = (body: unknown) => new Request("https://stickies.example.com/api/stickies/magic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

describe("POST /api/stickies/magic", () => {
    it("returns 401 when unauthorized", async () => {
        mockAuth.mockResolvedValueOnce(false);
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "Work" }));
        expect(res.status).toBe(401);
    });

    it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "Work" }));
        expect(res.status).toBe(500);
    });

    it("returns 400 when folder_name is missing", async () => {
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({}));
        expect(res.status).toBe(400);
    });

    it("returns 400 when folder_name is empty string", async () => {
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "   " }));
        expect(res.status).toBe(400);
    });

    it("returns early with updated=0 when folder has no notes and no subfolders", async () => {
        mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]); // notes + subfolders
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "Empty" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ updated: 0, message: "No items to process" });
        // Anthropic should never be called
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns early when every item already has an icon", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "Note", content: "x", icon: "__hero:StarIcon", type: "text" }])
            .mockResolvedValueOnce([]);
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "Done" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updated).toBe(0);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("happy path: assigns icon + title to a note that lacks an icon", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "Untitled", content: "shopping list eggs milk bread", icon: null, type: "text" }])
            .mockResolvedValueOnce([]); // no subfolders
        mockCreate.mockResolvedValueOnce({
            content: [{
                type: "text",
                text: '[{"index":1,"icon":"ShoppingCartIcon","title":"Grocery List"}]',
            }],
        });
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "Errands" }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updated).toBe(1);
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toMatch(/UPDATE "stickies" SET/);
        expect(sql).toContain("icon");
        expect(sql).toContain("title");
        const params = mockExecute.mock.calls[0][1] as unknown[];
        expect(params).toContain("__hero:ShoppingCartIcon");
        expect(params).toContain("Grocery List");
    });

    it("ignores unknown icon names from the AI (defaults to no icon)", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "x", content: "x", icon: null, type: "text" }])
            .mockResolvedValueOnce([]);
        mockCreate.mockResolvedValueOnce({
            content: [{ type: "text", text: '[{"index":1,"icon":"NotARealIcon","title":null}]' }],
        });
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "F" }));
        // Nothing to update because icon is null AND title is null
        expect(res.status).toBe(200);
        expect(mockExecute).not.toHaveBeenCalled();
    });

    it("strips trailing commas / line comments from the AI's JSON before parsing", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "x", content: "x", icon: null, type: "text" }])
            .mockResolvedValueOnce([]);
        mockCreate.mockResolvedValueOnce({
            content: [{
                type: "text",
                text: '// here is the json\n[{"index":1,"icon":"StarIcon","title":"Nice",},]',
            }],
        });
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "F" }));
        expect(res.status).toBe(200);
        expect((await res.json()).updated).toBe(1);
    });

    it("returns 500 when AI returns text without any JSON array", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "x", content: "x", icon: null, type: "text" }])
            .mockResolvedValueOnce([]);
        mockCreate.mockResolvedValueOnce({
            content: [{ type: "text", text: "I don't have a JSON for you" }],
        });
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "F" }));
        expect(res.status).toBe(500);
    });

    it("returns 500 when Anthropic SDK throws", async () => {
        mockQuery
            .mockResolvedValueOnce([{ id: "n1", title: "x", content: "x", icon: null, type: "text" }])
            .mockResolvedValueOnce([]);
        mockCreate.mockRejectedValueOnce(new Error("rate_limit"));
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "F" }));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toContain("rate_limit");
    });

    it("subfolder branch: updates content field with __hero: prefix", async () => {
        mockQuery
            .mockResolvedValueOnce([]) // no notes
            .mockResolvedValueOnce([{ id: "f1", folder_name: "Recipes", content: "" }])
            .mockResolvedValueOnce([{ title: "Pasta" }]); // subnotes preview for "Recipes"
        mockCreate.mockResolvedValueOnce({
            content: [{ type: "text", text: '[{"index":1,"icon":"CakeIcon","title":null}]' }],
        });
        mockExecute.mockResolvedValue(1);
        const { POST } = await import("@/app/api/stickies/magic/route");
        const res = await POST(REQ({ folder_name: "Cooking" }));
        expect(res.status).toBe(200);
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toMatch(/UPDATE "stickies" SET content = \$1/);
        expect(mockExecute.mock.calls[0][1][0]).toBe("__hero:CakeIcon");
    });
});
