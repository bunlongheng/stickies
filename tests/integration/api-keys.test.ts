/**
 * Integration tests: /api/stickies/keys (CRUD) + per-machine key attribution.
 *
 * DB driver and NextAuth are mocked; the real _auth.identifyCaller + lib/api-keys
 * run so we exercise the actual auth gating and hashing.
 *
 * Validates:
 * - mint returns plaintext ONCE (201)
 * - GET never leaks hash/plaintext
 * - DELETE soft-revokes (200) / 404 when missing
 * - management rejects static + per-machine key auth (403) but allows JWT/local
 * - minted-key note POST stamps created_by_key + bumps last_used_at
 * - revoked key -> 401 (note route); legacy static key still works
 *
 * Tags: integration, api, api-keys, auth, attribution
 * Priority: critical
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Env (set before imports; vi.mock is hoisted) ──
Object.assign(process.env, {
    STICKIES_API_KEY: "test-api-key",
    OWNER_USER_ID: "owner-uuid-1234",
    OWNER_EMAIL: "owner@example.com",
    NODE_ENV: "test",
});

// ── Mock DB driver ──
vi.mock("@/lib/db-driver", () => ({
    query:    vi.fn(),
    queryOne: vi.fn(),
    execute:  vi.fn(),
}));

// ── Mock NextAuth — controllable per-test ──
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock("@/auth", () => ({
    auth: mockAuth,
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// ── Mock Pusher (used by the main note route) ──
vi.mock("pusher", () => ({
    default: vi.fn().mockImplementation(function() {
        return { trigger: vi.fn().mockResolvedValue(undefined) };
    }),
}));

// ── Import after mocks ──
import { GET, POST, DELETE } from "@/app/api/stickies/keys/route";
import { POST as NOTE_POST } from "@/app/api/stickies/route";
import { query, queryOne, execute } from "@/lib/db-driver";
import { hashApiKey } from "@/lib/api-keys";

const mockQuery    = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockExecute  = vi.mocked(execute);

const REMOTE = "https://stickies.example.com";   // non-local host → no isLocal bypass
const OWNER_SESSION = { user: { id: "owner-uuid-1234", email: "owner@example.com" } };

function keysReq(path: string, opts: { method?: string; body?: unknown; bearer?: string } = {}): Request {
    const { method = "GET", body, bearer } = opts;
    const headers: Record<string, string> = { "User-Agent": "Mozilla/5.0" };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    return new Request(`${REMOTE}${path}`, init);
}

beforeEach(() => {
    mockQuery.mockReset();
    mockQueryOne.mockReset();
    mockExecute.mockReset().mockResolvedValue(1);
    mockAuth.mockReset().mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGEMENT — auth gating (owner-only)
// ═══════════════════════════════════════════════════════════════════════════════
describe("keys management — auth gating", () => {
    it("rejects unauthenticated callers with 401", async () => {
        mockQuery.mockResolvedValue([]); // api_keys lookup -> no match
        const res = await GET(keysReq("/api/stickies/keys", { bearer: "totally-unknown" }));
        expect(res.status).toBe(401);
    });

    it("rejects the static legacy key with 403 (machine keys cannot manage keys)", async () => {
        const res = await GET(keysReq("/api/stickies/keys", { bearer: "test-api-key" }));
        expect(res.status).toBe(403);
    });

    it("rejects a per-machine api key with 403", async () => {
        // identifyCaller: not static -> api_keys lookup returns a row -> via 'apikey'
        mockQuery.mockResolvedValue([{ id: "k1", label: "m4-mini" }]);
        const res = await GET(keysReq("/api/stickies/keys", { bearer: "sk_someminted" }));
        expect(res.status).toBe(403);
    });

    it("allows the owner JWT session", async () => {
        mockAuth.mockResolvedValue(OWNER_SESSION);
        mockQuery.mockResolvedValue([]); // GET list
        const res = await GET(keysReq("/api/stickies/keys"));
        expect(res.status).toBe(200);
    });

    it("allows local dev (localhost host bypass)", async () => {
        mockQuery.mockResolvedValue([]);
        const res = await GET(new Request("http://localhost:4444/api/stickies/keys"));
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST — mint
// ═══════════════════════════════════════════════════════════════════════════════
describe("POST /api/stickies/keys — mint", () => {
    beforeEach(() => { mockAuth.mockResolvedValue(OWNER_SESSION); });

    it("mints a key and returns plaintext ONCE (201)", async () => {
        mockQueryOne.mockResolvedValue({ id: "new-key-id", label: "ci-runner" });
        const res = await POST(keysReq("/api/stickies/keys", { method: "POST", body: { label: "ci-runner" } }));
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBe("new-key-id");
        expect(body.label).toBe("ci-runner");
        expect(body.key).toMatch(/^sk_[0-9A-Za-z]{32}$/);
        expect(body.prefix).toBe(body.key.slice(0, 12));

        // The stored hash matches the returned plaintext; only hash+prefix are inserted.
        const params = mockQueryOne.mock.calls[0][1] as unknown[];
        expect(params[1]).toBe(hashApiKey(body.key)); // key_hash
        expect(params).not.toContain(body.key);        // plaintext never persisted
    });

    it("rejects an empty label with 400", async () => {
        const res = await POST(keysReq("/api/stickies/keys", { method: "POST", body: { label: "   " } }));
        expect(res.status).toBe(400);
        expect(mockQueryOne).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET — list (no leak)
// ═══════════════════════════════════════════════════════════════════════════════
describe("GET /api/stickies/keys — list", () => {
    beforeEach(() => { mockAuth.mockResolvedValue(OWNER_SESSION); });

    it("never selects or returns hash/plaintext", async () => {
        mockQuery.mockResolvedValue([
            { id: "k1", label: "m4", key_prefix: "sk_abc12345", created_at: "2026-01-01", last_used_at: null, revoked_at: null },
        ]);
        const res = await GET(keysReq("/api/stickies/keys"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.keys).toHaveLength(1);
        expect(body.keys[0]).not.toHaveProperty("key_hash");
        expect(body.keys[0]).not.toHaveProperty("key");
        // SELECT must not pull the hash column
        const sql = mockQuery.mock.calls.at(-1)![0] as string;
        expect(sql).not.toContain("key_hash");
        expect(sql).toContain("key_prefix");
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE — revoke
// ═══════════════════════════════════════════════════════════════════════════════
describe("DELETE /api/stickies/keys — revoke", () => {
    beforeEach(() => { mockAuth.mockResolvedValue(OWNER_SESSION); });

    it("soft-revokes an existing key (sets revoked_at, 200)", async () => {
        mockExecute.mockResolvedValue(1);
        const res = await DELETE(keysReq("/api/stickies/keys?id=k1", { method: "DELETE" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ ok: true, revoked: "k1" });
        const sql = mockExecute.mock.calls.at(-1)![0] as string;
        expect(sql).toContain("revoked_at = now()");
    });

    it("returns 404 when the key does not exist", async () => {
        mockExecute.mockResolvedValue(0);
        const res = await DELETE(keysReq("/api/stickies/keys?id=missing", { method: "DELETE" }));
        expect(res.status).toBe(404);
    });

    it("returns 400 when id is missing", async () => {
        const res = await DELETE(keysReq("/api/stickies/keys", { method: "DELETE" }));
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATTRIBUTION — note POST stamps created_by_key + bumps last_used_at
// ═══════════════════════════════════════════════════════════════════════════════
describe("note attribution via per-machine key", () => {
    function noteReq(bearer: string) {
        return new Request(`${REMOTE}/api/stickies/ext`, {
            method: "POST",
            headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", "User-Agent": "curl/8" },
            body: JSON.stringify({ title: "Attributed", content: "<p>hi from a machine</p>", type: "html", folder: "CLAUDE" }),
        });
    }

    it("stamps created_by_key with the key label and bumps last_used_at", async () => {
        const PLAINTEXT = "sk_machinekeyplaintext";
        const KEY_HASH = hashApiKey(PLAINTEXT);

        // mockQuery handles BOTH api_keys lookups (authenticate + identifyCaller)
        // and the route's folder/color lookups. Return the key row when the SQL
        // targets api_keys, an existing CLAUDE root folder for folder lookups.
        mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes("api_keys")) {
                expect(params?.[0]).toBe(KEY_HASH);
                return [{ id: "k1", label: "m4-mini" }] as any;
            }
            if (sql.includes("is_folder = true")) {
                return [{ id: "claude-folder", folder_name: "CLAUDE", parent_folder_name: null }] as any;
            }
            return [] as any;
        });

        mockQueryOne
            .mockResolvedValueOnce(null)            // existing-note (upsert) check
            .mockResolvedValueOnce({ order: 5 })    // getNextOrder
            .mockResolvedValueOnce({ id: "n1", title: "Attributed", folder_color: "#34C759", created_by_key: "m4-mini" }); // INSERT RETURNING

        const res = await NOTE_POST(noteReq(PLAINTEXT));
        expect(res.status).toBe(201);

        // INSERT carried created_by_key + label in the column list + params
        const insertCall = mockQueryOne.mock.calls.find(c => String(c[0]).includes("INSERT INTO \"stickies\""))!;
        expect(String(insertCall[0])).toContain("created_by_key");
        expect(insertCall[1] as unknown[]).toContain("m4-mini");

        // ADD COLUMN ensure + last_used_at bump both fired via execute
        const executeSqls = mockExecute.mock.calls.map(c => String(c[0]));
        expect(executeSqls.some(s => s.includes("ADD COLUMN IF NOT EXISTS created_by_key"))).toBe(true);
        expect(executeSqls.some(s => s.includes("UPDATE api_keys SET last_used_at"))).toBe(true);
    });

    it("revoked / unknown key on the note route -> 401", async () => {
        mockQuery.mockImplementation(async (sql: string) => {
            if (sql.includes("api_keys")) return [] as any; // no active match (revoked)
            return [] as any;
        });
        const res = await NOTE_POST(noteReq("sk_revokedkey"));
        expect(res.status).toBe(401);
    });

    it("legacy static key still creates a note (created_by_key = legacy)", async () => {
        mockQuery.mockImplementation(async (sql: string) => {
            if (sql.includes("is_folder = true")) {
                return [{ id: "claude-folder", folder_name: "CLAUDE", parent_folder_name: null }] as any;
            }
            return [] as any;
        });
        mockQueryOne
            .mockResolvedValueOnce(null)            // existing-note check
            .mockResolvedValueOnce({ order: 1 })    // getNextOrder
            .mockResolvedValueOnce({ id: "n2", title: "Legacy", folder_color: "#FF3B30", created_by_key: "legacy" }); // INSERT

        const res = await NOTE_POST(noteReq("test-api-key"));
        expect(res.status).toBe(201);
        const insertCall = mockQueryOne.mock.calls.find(c => String(c[0]).includes("INSERT INTO \"stickies\""))!;
        expect(insertCall[1] as unknown[]).toContain("legacy");
    });
});
