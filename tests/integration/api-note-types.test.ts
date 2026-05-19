/**
 * Integration: CRUD coverage for every note type the app supports.
 *
 * Note types come in two flavors:
 *  - `type` column (auto-detected): text, markdown, html, json, mermaid,
 *    code-javascript, code-typescript, code-python, code-css, code-sql, code-bash, voice
 *  - `format` column (Phase 1): text, markdown, rich
 *
 * These tests verify each type round-trips through POST → GET cleanly and
 * the route doesn't silently downgrade or strip a code type.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
    OWNER_EMAIL: "owner@example.com",
    PUSHER_APP_ID: "app-id",
    PUSHER_KEY: "key",
    PUSHER_SECRET: "secret",
    PUSHER_CLUSTER: "us2",
});

const { mockQuery, mockQueryOne, mockExecute } = vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockQueryOne: vi.fn(),
    mockExecute: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: mockQuery,
    queryOne: mockQueryOne,
    execute: mockExecute,
}));
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function () {
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

beforeEach(() => {
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockExecute.mockReset();
});

const apiReq = (path: string, init?: RequestInit) =>
    new Request(`https://stickies.example.com${path}`, {
        ...init,
        headers: { Authorization: "Bearer test-api-key", "Content-Type": "application/json", ...(init?.headers as Record<string, string> ?? {}) },
    });

// ─── POST round-trip per type ────────────────────────────────────────────────
const TYPE_CASES: { name: string; type: string; content: string }[] = [
    { name: "text",            type: "text",            content: "Just a plain paragraph." },
    { name: "markdown",        type: "markdown",        content: "# Heading\n\n- bullet one\n- bullet two\n\n> quote" },
    { name: "html",            type: "html",            content: "<!DOCTYPE html><html><body><h1>hi</h1></body></html>" },
    { name: "json",            type: "json",            content: '{"hello":"world","items":[1,2,3]}' },
    { name: "mermaid",         type: "mermaid",         content: "graph TD\n  A-->B" },
    { name: "javascript code", type: "code-javascript", content: "const x = 1;\nconsole.log(x);" },
    { name: "typescript code", type: "code-typescript", content: "type X = { y: string };" },
    { name: "python code",     type: "code-python",     content: "def hello():\n    print('hi')" },
    { name: "css code",        type: "code-css",        content: ".foo { color: red; }" },
    { name: "sql code",        type: "code-sql",        content: "SELECT * FROM stickies WHERE id = $1;" },
    { name: "bash code",       type: "code-bash",       content: "#!/bin/bash\necho hello" },
    { name: "checklist",       type: "checklist",       content: "[ ] todo one\n[x] done\n[ ] todo three" },
];

describe.each(TYPE_CASES)("POST /api/stickies?raw=1 — $name", ({ type, content }) => {
    it("persists the `type` and `content` round-trip", async () => {
        const expected = { id: "uuid-1", title: type, content, type, folder_name: "CLAUDE", folder_color: "#FF3B30", user_id: "owner-uuid-1234" };
        mockQueryOne.mockResolvedValue(expected);
        const { POST } = await import("@/app/api/stickies/ext/route");
        const res = await POST(apiReq("/api/stickies/ext?raw=1", {
            method: "POST",
            body: JSON.stringify({ title: type, content, type, folder_name: "CLAUDE", folder_color: "#FF3B30" }),
        }));
        expect(res.status).toBe(201);
        const body = await res.json();
        // The route doesn't strip the `type` we passed in
        expect(body.note.type).toBe(type);
        expect(body.note.content).toBe(content);
        // The SQL INSERT included our `type` column
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params).toContain(type);
    });
});

// ─── format flag (Phase 1) — rich + markdown + text round-trip ──────────────
describe.each([
    { name: "format=text", format: "text",     doc: null },
    { name: "format=markdown", format: "markdown", doc: null },
    { name: "format=rich", format: "rich",     doc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] } },
])("POST /api/stickies?raw=1 — $name", ({ format, doc }) => {
    it("persists format and doc", async () => {
        const expected: any = { id: "uuid-fmt", title: "T", content: "hi", format, doc };
        mockQueryOne.mockResolvedValue(expected);
        const { POST } = await import("@/app/api/stickies/ext/route");
        const res = await POST(apiReq("/api/stickies/ext?raw=1", {
            method: "POST",
            body: JSON.stringify({ title: "T", content: "hi", format, ...(doc ? { doc } : {}) }),
        }));
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.note.format).toBe(format);
        if (doc) expect(body.note.doc).toEqual(doc);
    });
});

// ─── PATCH per-type type-preservation ────────────────────────────────────────
describe("PATCH /api/stickies — preserves note type when updating other fields", () => {
    it.each(TYPE_CASES)("does not downgrade `$name` on PATCH content", async ({ type, content }) => {
        // First call: existing note lookup. Second call: UPDATE RETURNING *
        mockQueryOne
            .mockResolvedValueOnce({ id: "uuid-1", type, content: "old", title: "T" })
            .mockResolvedValueOnce({ id: "uuid-1", type, content, title: "T" });
        const { PATCH } = await import("@/app/api/stickies/ext/route");
        const res = await PATCH(apiReq("/api/stickies/ext", {
            method: "PATCH",
            body: JSON.stringify({ id: "uuid-1", content }),
        }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.note.type).toBe(type);
    });
});

// ─── Checklist list_mode flag ────────────────────────────────────────────────
describe("checklist mode flag", () => {
    it("PATCH accepts list_mode=true", async () => {
        mockQueryOne
            .mockResolvedValueOnce({ id: "uuid-1", list_mode: true });
        const { PATCH } = await import("@/app/api/stickies/ext/route");
        const res = await PATCH(apiReq("/api/stickies/ext", {
            method: "PATCH",
            body: JSON.stringify({ id: "uuid-1", list_mode: true }),
        }));
        expect(res.status).toBe(200);
        const sql = mockQueryOne.mock.calls[0][0] as string;
        expect(sql).toContain("list_mode");
    });
});

// ─── format ('rich') doc JSONB stringification ──────────────────────────────
describe("JSONB doc binding (Phase 1 regression)", () => {
    it("stringifies doc JSON when sent via PATCH so node-pg serializes correctly", async () => {
        const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H" }] }] };
        mockQueryOne.mockResolvedValueOnce({ id: "uuid-1", doc, format: "rich" });
        const { PATCH } = await import("@/app/api/stickies/ext/route");
        await PATCH(apiReq("/api/stickies/ext", {
            method: "PATCH",
            body: JSON.stringify({ id: "uuid-1", doc, format: "rich" }),
        }));
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        // The doc must arrive as a string (JSON.stringify), not as `[object Object]`
        const docParam = params.find(p => typeof p === "string" && p.startsWith("{\"type\":\"doc\""));
        expect(docParam).toBeDefined();
    });

    it("stringifies doc JSON when sent via raw INSERT too", async () => {
        const doc = { type: "doc", content: [{ type: "paragraph" }] };
        mockQueryOne.mockResolvedValueOnce({ id: "uuid-new", doc, format: "rich" });
        const { POST } = await import("@/app/api/stickies/ext/route");
        await POST(apiReq("/api/stickies/ext?raw=1", {
            method: "POST",
            body: JSON.stringify({ title: "T", content: "", format: "rich", doc }),
        }));
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params.some(p => typeof p === "string" && p.startsWith("{\"type\":\"doc\""))).toBe(true);
    });
});
