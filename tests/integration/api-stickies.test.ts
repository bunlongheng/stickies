/**
 * Integration tests: /api/stickies — GET, POST, PATCH, DELETE
 *
 * DB driver and Supabase auth are mocked. Tests validate:
 * - auth enforcement (401 for no auth)
 * - table routing (stickies vs users_stickies)
 * - request/response shapes for every endpoint variant
 * - business rules: PATCH whitelist, upsert, batch limits, validation errors
 * - tags TEXT[] handling (regression for Supabase 400 bug)
 *
 * Tags: integration, api, crud, auth, tags
 * Priority: critical
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { ENV, API_KEY, USER_ID, apiReq, userReq, noAuthReq, json, noteRow, folderRow } from "./helpers";

// ── Set env vars before any imports (vi.mock is hoisted, env must be set first) ──
Object.assign(process.env, ENV);
process.env.OWNER_EMAIL = "owner@example.com";
// Force production-like mode so dev bypass is disabled for the noAuth tests
process.env.NODE_ENV = "test";

// ── Mock DB driver ────────────────────────────────────────────────────────────
vi.mock("@/lib/db-driver", () => ({
    query:    vi.fn(),
    queryOne: vi.fn(),
    execute:  vi.fn(),
}));

// ── Mock NextAuth — controllable per-test via mockAuth ───────────────────────
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({
    auth: mockAuth,
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// ── Mock Pusher ───────────────────────────────────────────────────────────────
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function() {
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import { GET, POST, PATCH, DELETE } from "@/app/api/stickies/route";
import { query, queryOne, execute } from "@/lib/db-driver";

const mockQuery    = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute  = vi.mocked(execute);

// ── Reset mocks before each test ─────────────────────────────────────────────
beforeEach(() => {
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockExecute.mockReset();
    mockAuth.mockReset();

    // Default: no session (so only API key auth works)
    mockAuth.mockResolvedValue(null);
    // Default: execute resolves to row count
    mockExecute.mockResolvedValue(1);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════════════════

describe("Auth enforcement", () => {
    it("GET → 401 with no Authorization header", async () => {
        const res = await GET(noAuthReq("/api/stickies?folders=1"));
        expect(res.status).toBe(401);
        expect(await json(res)).toMatchObject({ error: "Unauthorized" });
    });

    it("POST → 401 with no Authorization header", async () => {
        const res = await POST(noAuthReq("/api/stickies", "POST"));
        expect(res.status).toBe(401);
    });

    it("PATCH → 401 with no Authorization header", async () => {
        const res = await PATCH(noAuthReq("/api/stickies", "PATCH"));
        expect(res.status).toBe(401);
    });

    it("DELETE → 401 with no Authorization header", async () => {
        const res = await DELETE(noAuthReq("/api/stickies", "DELETE"));
        expect(res.status).toBe(401);
    });

    it("GET with bogus bearer token and no session → 401", async () => {
        // Not the API key, no NextAuth session → unauthenticated
        const req = new Request("http://localhost:4444/api/stickies?folders=1", {
            headers: { Authorization: "Bearer bad-token", "User-Agent": "Mozilla/5.0" },
        });
        mockQuery.mockResolvedValue([]);
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("API key auth uses 'stickies' table", async () => {
        mockQuery.mockResolvedValue([folderRow()]);
        await GET(apiReq("/api/stickies?folders=1"));
        const call = mockQuery.mock.calls[0][0] as string;
        expect(call).toContain('"stickies"');
        expect(call).not.toContain("users_stickies");
    });

    it("Non-owner NextAuth session uses 'stickies' table with user_id filter", async () => {
        // Non-owner session → route's "user" branch, userId = session.user.id
        mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "someone-else@example.com" } });
        mockQuery.mockResolvedValue([folderRow()]);
        const req = new Request("http://localhost:4444/api/stickies?folders=1", {
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        await GET(req);
        const call = mockQuery.mock.calls[0][0] as string;
        expect(call).toContain('"stickies"');
        expect(call).toContain("user_id");
    });

    it("Non-owner NextAuth session appends user_id to query params", async () => {
        mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "someone-else@example.com" } });
        mockQuery.mockResolvedValue([]);
        const req = new Request("http://localhost:4444/api/stickies?folders=1", {
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        await GET(req);
        const params = mockQuery.mock.calls[0][1] as unknown[];
        expect(params).toContain(USER_ID);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET — all variants
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/stickies", () => {

    describe("?folders=1", () => {
        it("returns folder list", async () => {
            const folders = [folderRow(), folderRow({ id: "f2", folder_name: "Personal" })];
            mockQuery.mockResolvedValue(folders);
            const res = await GET(apiReq("/api/stickies?folders=1"));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.folders).toHaveLength(2);
            expect(body.folders[0].folder_name).toBe("Work");
        });

        it("returns empty array when no folders", async () => {
            mockQuery.mockResolvedValue([]);
            const body = await json(await GET(apiReq("/api/stickies?folders=1")));
            expect(body.folders).toEqual([]);
        });
    });

    describe("?counts=1", () => {
        it("returns counts grouped by folder_name", async () => {
            mockQuery.mockResolvedValue([
                { folder_name: "Work", folder_id: null, cnt: "5" },
                { folder_name: "Personal", folder_id: "f2", cnt: "3" },
            ]);
            const body = await json(await GET(apiReq("/api/stickies?counts=1")));
            expect(body.counts.Work).toBe(5);
            expect(body.counts.Personal).toBe(3);
            expect(body.total).toBe(8);
        });

        it("returns countsByFolderId for UUID-keyed folders", async () => {
            mockQuery.mockResolvedValue([
                { folder_name: "Work", folder_id: "f1", cnt: "7" },
            ]);
            const body = await json(await GET(apiReq("/api/stickies?counts=1")));
            expect(body.countsByFolderId["f1"]).toBe(7);
        });
    });

    describe("?folder=name", () => {
        it("returns notes for the given folder", async () => {
            const notes = [
                { ...noteRow(), _total: "2" },
                { ...noteRow({ id: "n2", title: "Second" }), _total: "2" },
            ];
            mockQuery.mockResolvedValueOnce(notes);
            const body = await json(await GET(apiReq("/api/stickies?folder=Work")));
            expect(body.notes).toHaveLength(2);
            expect(body.total).toBe(2);
        });

        it("respects limit and offset pagination", async () => {
            mockQuery.mockResolvedValue([{ ...noteRow(), _total: "50" }]);
            const body = await json(await GET(apiReq("/api/stickies?folder=Work&limit=20&offset=0")));
            expect(body.notes).toHaveLength(1);
            expect(body.total).toBe(50);
            const sql = mockQuery.mock.calls[0][0] as string;
            expect(sql).toMatch(/LIMIT/);
            expect(sql).toMatch(/OFFSET/);
        });

        it("returns empty notes array for empty folder", async () => {
            mockQuery.mockResolvedValue([]);
            const body = await json(await GET(apiReq("/api/stickies?folder=Empty")));
            expect(body.notes).toEqual([]);
            expect(body.total).toBe(0);
        });
    });

    describe("?q=search", () => {
        it("returns matching notes with search term", async () => {
            mockQuery.mockResolvedValue([noteRow({ title: "Meeting notes" })]);
            const body = await json(await GET(apiReq("/api/stickies?q=meeting")));
            expect(body.notes[0].title).toBe("Meeting notes");
            expect(body.query).toBe("meeting");
        });

        it("uses ILIKE for case-insensitive search", async () => {
            mockQuery.mockResolvedValue([]);
            await GET(apiReq("/api/stickies?q=hello"));
            const sql = mockQuery.mock.calls[0][0] as string;
            expect(sql).toContain("ILIKE");
        });
    });

    describe("?id=uuid", () => {
        it("returns single note by id", async () => {
            mockQueryOne.mockResolvedValue(noteRow({ id: "note-uuid-1" }));
            const body = await json(await GET(apiReq("/api/stickies?id=note-uuid-1")));
            expect(body.note.id).toBe("note-uuid-1");
        });

        it("returns null when note not found", async () => {
            mockQueryOne.mockResolvedValue(null);
            const body = await json(await GET(apiReq("/api/stickies?id=nonexistent")));
            expect(body.note).toBeNull();
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — create note, folder, batch
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/stickies", () => {

    describe("Single note creation", () => {
        beforeEach(() => {
            // Simple folder lookup: no existing folders → plain folder_name
            mockQuery.mockResolvedValue([]);   // root folders check + folder lookup
            // No existing note with same title
            mockQueryOne
                .mockResolvedValueOnce({ order: 0 })     // color pick query
                .mockResolvedValueOnce(null)              // existing note check
                .mockResolvedValueOnce({ order: 1 })     // getNextOrder
                .mockResolvedValueOnce(noteRow());        // INSERT RETURNING
        });

        it("creates a note and returns 201 with note data", async () => {
            const res = await POST(apiReq("/api/stickies", {
                method: "POST",
                body: { title: "Test Note", content: "Hello world", folder_name: "Work" },
                headers: { "User-Agent": "Mozilla/5.0" },
            }));
            expect(res.status).toBe(201);
            const body = await json(res);
            expect(body.note).toBeDefined();
        });

        // NOTE: "returns 400 when title is missing" was deleted — the route now
        // auto-derives a title from content (frontmatter, first heading, or first
        // non-empty line), so missing title is no longer a 400-error path.

        it("returns 400 when content is missing", async () => {
            const res = await POST(apiReq("/api/stickies", {
                method: "POST",
                body: { title: "My Note", folder_name: "Work" },
                headers: { "User-Agent": "Mozilla/5.0" },
            }));
            expect(res.status).toBe(400);
            const body = await json(res);
            expect(body.error).toMatch(/content/i);
        });

        it("returns 400 for invalid JSON body", async () => {
            const res = await POST(new Request("http://localhost:4444/api/stickies/ext", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${API_KEY}`,
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                },
                body: "{ bad json }",
            }));
            expect(res.status).toBe(400);
        });
    });

    describe("Folder creation", () => {
        it("creates a folder with ?type=folder&name=...", async () => {
            mockQuery.mockResolvedValue([{ folder_color: "#34C759" }]); // color pick
            mockQueryOne
                .mockResolvedValueOnce(null)             // dup-check (no existing)
                .mockResolvedValueOnce({ order: 5 })     // getNextOrder
                .mockResolvedValueOnce(folderRow());      // INSERT RETURNING
            const res = await POST(apiReq("/api/stickies?type=folder&name=NewFolder", { method: "POST" }));
            expect(res.status).toBe(201);
            const body = await json(res);
            expect(body.folder).toBeDefined();
        });

        it("returns 400 when folder name is missing", async () => {
            const res = await POST(apiReq("/api/stickies?type=folder", { method: "POST" }));
            expect(res.status).toBe(400);
            expect(await json(res)).toMatchObject({ error: expect.stringMatching(/name/i) });
        });
    });

    describe("Batch creation", () => {
        it("creates multiple notes and returns results array", async () => {
            mockQuery.mockResolvedValue([{ folder_color: "#FF3B30" }]); // color pick
            mockQueryOne
                .mockResolvedValueOnce({ order: 10 }) // max order
                .mockResolvedValue(noteRow());          // each INSERT

            const res = await POST(apiReq("/api/stickies", {
                method: "POST",
                body: { batch: [
                    { type: "note", title: "Note A", content: "Content A", folder_name: "Work" },
                    { type: "note", title: "Note B", content: "Content B", folder_name: "Work" },
                ]},
            }));
            expect(res.status).toBe(201);
            const body = await json(res);
            expect(body.results).toHaveLength(2);
            expect(body.total).toBe(2);
        });

        it("rejects batch with >500 items", async () => {
            const bigBatch = Array.from({ length: 501 }, (_, i) => ({ type: "note", title: `N${i}`, content: "c" }));
            const res = await POST(apiReq("/api/stickies", {
                method: "POST",
                body: { batch: bigBatch },
            }));
            expect(res.status).toBe(400);
            expect(await json(res)).toMatchObject({ error: expect.stringMatching(/500/i) });
        });

        it("rejects compact array batch with >500 items", async () => {
            const bigBatch = Array.from({ length: 501 }, (_, i) => ["note", `N${i}`, "c"]);
            const res = await POST(apiReq("/api/stickies", {
                method: "POST",
                body: bigBatch,
            }));
            expect(res.status).toBe(400);
        });
    });

    describe("Note upsert (same title in same folder → update)", () => {
        it("updates existing note instead of inserting", async () => {
            // Setup: note with same title already exists
            // pickLeastUsedColor uses query() not queryOne()
            mockQuery.mockResolvedValue([]);
            mockQueryOne
                .mockResolvedValueOnce({ id: "existing-note" })  // existing note check
                .mockResolvedValueOnce(noteRow({ id: "existing-note", title: "Dupe" })); // UPDATE RETURNING

            const res = await POST(apiReq("/api/stickies", {
                method: "POST",
                body: { title: "Dupe", content: "Updated content", folder_name: "Work" },
                headers: { "User-Agent": "Mozilla/5.0" },
            }));
            expect(res.status).toBe(201);
            const body = await json(res);
            expect(body.action).toBe("updated");
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH — update, rename, merge, tags
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/stickies", () => {

    describe("Single note update", () => {
        it("updates allowed fields and returns note", async () => {
            mockQueryOne.mockResolvedValue(noteRow({ title: "Updated" }));
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { id: "note-uuid-1", title: "Updated", content: "New content" },
            }));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.note).toBeDefined();
        });

        it("blocks unknown/dangerous columns via PATCH_ALLOWED_COLS", async () => {
            mockQueryOne.mockResolvedValue(noteRow());
            await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: {
                    id: "note-uuid-1",
                    title: "Safe",
                    // These should be stripped from SET clause
                    user_id: "hacked",
                    password: "secret",
                    __proto__: "bad",
                },
            }));
            const sql = mockQueryOne.mock.calls[0][0] as string;
            // Note: user_id legitimately appears in WHERE clause (user-scoping).
            // The defense-in-depth check is that it never appears as a SET assignment.
            const setClause = sql.split("WHERE")[0];
            expect(setClause).not.toContain("user_id");
            expect(setClause).not.toContain("password");
            expect(setClause).not.toContain("__proto__");
        });

        it("updates tags as TEXT[] (regression: Supabase array serialization)", async () => {
            mockQueryOne.mockResolvedValue(noteRow({ tags: ["#work", "#urgent"] }));
            await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { id: "note-uuid-1", tags: ["#work", "#urgent"] },
            }));
            // tags must be in the SET clause
            const sql = mockQueryOne.mock.calls[0][0] as string;
            expect(sql).toContain('"tags"');
        });

        it("returns 400 when id is missing", async () => {
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { title: "No id here" },
            }));
            expect(res.status).toBe(400);
            expect(await json(res)).toMatchObject({ error: expect.stringMatching(/id/i) });
        });

        it("still updates updated_at even when only dangerous fields are sent", async () => {
            // PATCH_ALLOWED_COLS strips user_id/__proto__, but updated_at is always added,
            // so a DB call IS made (updating only the timestamp).
            mockQueryOne.mockResolvedValue(noteRow());
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { id: "note-uuid-1", user_id: "bad", __proto__: "evil" },
            }));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.note).toBeDefined();
            // Only updated_at should be in the SET clause (user_id legitimately in WHERE)
            const sql = mockQueryOne.mock.calls[0][0] as string;
            const setClause = sql.split("WHERE")[0];
            expect(setClause).toContain("updated_at");
            expect(setClause).not.toContain("user_id");
        });
    });

    describe("rename_note", () => {
        it("renames a note by id", async () => {
            mockQueryOne.mockResolvedValue(noteRow({ title: "Renamed" }));
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { rename_note: { id: "note-uuid-1", title: "Renamed" } },
            }));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.ok).toBe(true);
        });

        it("returns 400 when rename_note is missing id or title", async () => {
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { rename_note: { id: "", title: "" } },
            }));
            expect(res.status).toBe(400);
        });
    });

    describe("rename_folder", () => {
        it("renames a folder (updates both folder row and notes)", async () => {
            mockExecute.mockResolvedValue(5);
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { rename_folder: { from: "OldName", to: "NewName" } },
            }));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.ok).toBe(true);
            expect(body.renamed.from).toBe("OldName");
            expect(body.renamed.to).toBe("NewName");
            // Should execute 2 updates: folder row + notes
            expect(mockExecute).toHaveBeenCalledTimes(2);
        });

        it("returns 400 when from or to is empty", async () => {
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { rename_folder: { from: "Old", to: "" } },
            }));
            expect(res.status).toBe(400);
        });
    });

    describe("merge_folder", () => {
        it("moves notes from source folder and deletes source folder", async () => {
            mockQuery.mockResolvedValue([{ id: "n1" }, { id: "n2" }]);
            mockExecute.mockResolvedValue(1);
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { merge_folder: { from: "Archive", to: "Work" } },
            }));
            expect(res.status).toBe(200);
            const body = await json(res);
            expect(body.ok).toBe(true);
            expect(body.merged.moved).toBe(2);
        });
    });

    describe("bulk updates", () => {
        it("applies multiple note updates in parallel", async () => {
            mockExecute.mockResolvedValue(1);
            const res = await PATCH(apiReq("/api/stickies", {
                method: "PATCH",
                body: { updates: [
                    { id: "n1", title: "A" },
                    { id: "n2", title: "B" },
                ]},
            }));
            expect(res.status).toBe(200);
            expect(await json(res)).toMatchObject({ ok: true });
            expect(mockExecute).toHaveBeenCalledTimes(2);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/stickies", () => {
    it("deletes note by id", async () => {
        mockExecute.mockResolvedValue(1);
        const res = await DELETE(apiReq("/api/stickies?id=note-uuid-1", { method: "DELETE" }));
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.ok).toBe(true);
        expect(body.deleted_note).toBe("note-uuid-1");
    });

    it("deletes all notes in a folder by folder_name", async () => {
        mockExecute.mockResolvedValue(5);
        const res = await DELETE(apiReq("/api/stickies?folder_name=Work", { method: "DELETE" }));
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.ok).toBe(true);
        expect(body.deleted_folder).toBe("Work");
    });

    it("returns 400 when neither id nor folder_name is provided", async () => {
        const res = await DELETE(apiReq("/api/stickies", { method: "DELETE" }));
        expect(res.status).toBe(400);
        expect(await json(res)).toMatchObject({ error: expect.stringMatching(/id|folder_name/i) });
    });

    it("user-scoped delete appends user_id to WHERE clause", async () => {
        // Non-owner NextAuth session → "user" branch → DELETE scoped to that user_id
        mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "someone-else@example.com" } });
        mockExecute.mockResolvedValue(1);
        const req = new Request("http://localhost:4444/api/stickies?id=note-uuid-1", {
            method: "DELETE",
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        await DELETE(req);
        const sql = mockExecute.mock.calls[0][0] as string;
        expect(sql).toContain("user_id");
    });
});
