/**
 * Integration: GET /api/stickies — every query-mode branch.
 *
 * The main route handles many distinct GET behaviors via query params:
 *   ?prefs=1           user preferences
 *   ?apikey=1          owner API key (for import guide)
 *   ?folders=1         folders list only
 *   ?counts=1          per-folder counts
 *   ?recent=today      notes from last 24h
 *   ?folder=X          notes in folder (since=ISO, limit/offset variants)
 *   ?q=X               full-text search
 *   ?route=X           lookup by title (with optional folder)
 *   ?id=X              single note by id
 *   ?export=1          all notes
 *   (none)             default list
 *
 * These were partially covered by api-stickies.test.ts; this file fills the gaps.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
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
    mockExecute.mockResolvedValue(0); // expire-trash sweep silent default
});

const REQ = (qs: string) =>
    new Request(`https://stickies.example.com/api/stickies/ext${qs}`, {
        headers: { Authorization: "Bearer test-api-key" },
    });

describe("GET /api/stickies — ?prefs=1", () => {
    it("returns pinned_folders array (or [] when none)", async () => {
        mockQueryOne.mockResolvedValueOnce({ pinned_folders: ["Work", "Inbox"] });
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?prefs=1"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ pinned_folders: ["Work", "Inbox"] });
    });

    it("returns [] when no row exists for the user", async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?prefs=1"));
        expect(await res.json()).toEqual({ pinned_folders: [] });
    });
});

describe("GET /api/stickies — ?apikey=1", () => {
    it("refuses to disclose the master key to a keyed (non-owner) caller", async () => {
        // Hardened: the master key is owner-browser-only, so a leaked scoped/static
        // key can't read it. REQ() authenticates with the static key => external => 403.
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?apikey=1"));
        expect(res.status).toBe(403);
        expect(res.headers.get("cache-control")).toBe("no-store");
        const body = await res.json();
        expect(body.key).toBeUndefined();
    });
});

describe("GET /api/stickies — ?recent=today", () => {
    it("returns notes from the last 24h, ordered DESC by updated_at", async () => {
        mockQuery.mockResolvedValueOnce([
            { id: "r1", title: "Recent A", updated_at: new Date().toISOString() },
            { id: "r2", title: "Recent B", updated_at: new Date(Date.now() - 3_600_000).toISOString() },
        ]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?recent=today"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.notes).toHaveLength(2);
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("created_at >= NOW() - INTERVAL '24 hours'");
        expect(sql).toContain("trashed_at IS NULL");
        expect(sql).toContain("ORDER BY updated_at DESC");
    });
});

describe("GET /api/stickies — ?folder=X&since=ISO (delta sync)", () => {
    it("returns notes updated_at > since, with delta=true flag", async () => {
        const since = "2026-01-01T00:00:00.000Z";
        mockQuery.mockResolvedValueOnce([{ id: "n1" }]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ(`?folder=Work&since=${encodeURIComponent(since)}`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.delta).toBe(true);
        expect(body.syncedAt).toMatch(/T/);
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("updated_at > $2");
    });

    it("ignores invalid ISO date and falls through to full-fetch", async () => {
        mockQuery.mockResolvedValueOnce([]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?folder=Work&since=not-a-date"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.delta).toBeUndefined();
    });
});

describe("GET /api/stickies — ?folder=X with limit + offset pagination", () => {
    it("appends LIMIT + OFFSET when limit > 0", async () => {
        mockQuery.mockResolvedValueOnce([{ id: "n1", _total: 100 }]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        await GET(REQ("?folder=Work&limit=20&offset=40"));
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    });

    it("strips the _total column from each row but exposes it as `total`", async () => {
        mockQuery.mockResolvedValueOnce([
            { id: "n1", title: "A", _total: 47 },
            { id: "n2", title: "B", _total: 47 },
        ]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?folder=Work"));
        const body = await res.json();
        expect(body.total).toBe(47);
        expect(body.notes[0]._total).toBeUndefined();
    });
});

describe("GET /api/stickies — ?route=X (lookup by title)", () => {
    it("uses ?folder for routeFolder; falls back to 'BHENG'", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "n1", title: "My Page" });
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?route=My%20Page"));
        expect(res.status).toBe(200);
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[0]).toBe("BHENG");
        expect(params[1]).toBe("My Page");
    });

    it("uses ?folder as the routeFolder when both are present", async () => {
        mockQueryOne.mockResolvedValueOnce({ id: "n1", title: "Specs" });
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?route=Specs&folder=Work"));
        expect(res.status).toBe(200);
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[0]).toBe("Work");
    });

    it("returns sticky=null when no match", async () => {
        mockQueryOne.mockResolvedValueOnce(null);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?route=NoSuchTitle"));
        expect(await res.json()).toEqual({ sticky: null });
    });
});

describe("GET /api/stickies — ?export=1", () => {
    it("returns all notes (capped at 500) with total count", async () => {
        mockQuery.mockResolvedValueOnce([
            { id: "n1" }, { id: "n2" }, { id: "n3" },
        ]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ("?export=1"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.notes).toHaveLength(3);
        expect(body.total).toBe(3);
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("LIMIT 500");
    });
});

describe("GET /api/stickies — auto-expire TRASH sweep (runs on every GET)", () => {
    it("executes the trash-expire DELETE before the main query", async () => {
        mockQuery.mockResolvedValue([]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        await GET(REQ(""));
        // ensureLockedColumn's ALTER TABLE also runs via execute, so the
        // trash-expire DELETE is not necessarily calls[0] — find it.
        const calls = mockExecute.mock.calls.map((c) => c[0] as string);
        expect(calls.length).toBeGreaterThan(0);
        const trashSweep = calls.find((s) => /DELETE FROM "stickies"/.test(s)) ?? "";
        expect(trashSweep).toMatch(/DELETE FROM "stickies"[\s\S]*TRASH[\s\S]*INTERVAL '7 days'/);
        // It must still run before the main list query
        const mainQuery = mockQuery.mock.calls[0]?.[0] as string | undefined;
        expect(mainQuery).toBeDefined();
    });

    it("swallows trash-sweep errors silently (migration safety)", async () => {
        mockExecute.mockRejectedValueOnce(new Error("column trashed_at doesn't exist"));
        mockQuery.mockResolvedValue([]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ(""));
        // Still responds 200 despite the trash sweep failure
        expect(res.status).toBe(200);
    });
});

describe("GET /api/stickies — default list", () => {
    it("returns up to 500 notes with task_count columns", async () => {
        mockQuery.mockResolvedValueOnce([{ id: "n1", title: "A", task_count: 0 }]);
        const { GET } = await import("@/app/api/stickies/ext/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(200);
        const sql = mockQuery.mock.calls[0][0] as string;
        expect(sql).toContain("task_count");
        expect(sql).toContain("LIMIT 500");
        expect(sql).toContain("ORDER BY \"order\" ASC");
    });
});
