/**
 * Integration: GET /api/stickies/public/raw
 * Like GitHub Gist raw - plain text only, public notes only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockQueryOne } = vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
}));

vi.mock("@/lib/db-driver", () => ({
    query: vi.fn(),
    queryOne: mockQueryOne,
    execute: vi.fn(),
}));

beforeEach(() => mockQueryOne.mockReset());

const REQ = (qs: string) => new Request(`https://stickies.example.com/api/stickies/public/raw${qs}`);

describe("GET /api/stickies/public/raw", () => {
    it("returns 404 when noteId param is missing", async () => {
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ(""));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe("Not found");
        expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    });

    it("returns 404 when the note doesn't exist", async () => {
        mockQueryOne.mockResolvedValue(null);
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=missing"));
        expect(res.status).toBe(404);
    });

    it("returns 404 when the note exists but is NOT public (don't leak)", async () => {
        mockQueryOne.mockResolvedValue({ title: "secret", content: "shh", is_public: false });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=private-uuid"));
        expect(res.status).toBe(404);
    });

    it("returns 200 with the raw content when note is public", async () => {
        mockQueryOne.mockResolvedValue({ title: "Hello World", content: "Body text\nLine 2", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("Body text\nLine 2");
    });

    it("encodes the title in X-Note-Title (so unicode + spaces survive)", async () => {
        mockQueryOne.mockResolvedValue({ title: "Hello / World 🌍", content: "x", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        const header = res.headers.get("x-note-title");
        expect(header).toBe(encodeURIComponent("Hello / World 🌍"));
    });

    it("scopes by trashed_at IS NULL (does not leak trashed notes)", async () => {
        mockQueryOne.mockResolvedValue({ title: "x", content: "y", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        await GET(REQ("?noteId=note-uuid"));
        const sql = mockQueryOne.mock.calls[0][0] as string;
        expect(sql).toContain("trashed_at IS NULL");
    });

    it("sets a no-cache header (public note bodies must never be cached)", async () => {
        mockQueryOne.mockResolvedValue({ title: "t", content: "x", is_public: true });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        expect(res.headers.get("cache-control")).toBe("private, max-age=0, no-store");
    });

    it("sandboxes public HTML notes to an opaque origin (no allow-same-origin)", async () => {
        mockQueryOne.mockResolvedValue({ title: "t", content: "<h1>hi</h1>", is_public: true, type: "html" });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        const csp = res.headers.get("content-security-policy") ?? "";
        expect(csp).toContain("sandbox");
        expect(csp).toContain("allow-scripts");
        expect(csp).not.toContain("allow-same-origin");
        expect(res.headers.get("content-type")).toContain("text/html");
    });

    it("does not send a sandbox CSP for plain-text notes", async () => {
        mockQueryOne.mockResolvedValue({ title: "t", content: "plain", is_public: true, type: "text" });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=pub-uuid"));
        expect(res.headers.get("content-security-policy")).toBeNull();
    });
});

// --- POST unlock + GET gate for locked notes (the previously-untested flow) ---
import { hashLockPassword, signUnlockCookie, unlockCookieName } from "@/lib/lock-password";

const REQ_POST = (noteId: string, password: string) =>
    new Request(`https://stickies.example.com/api/stickies/public/raw${noteId ? `?noteId=${noteId}` : ""}`,
        { method: "POST", body: new URLSearchParams({ password }) });

describe("POST /api/stickies/public/raw (unlock)", () => {
    it("returns 404 when noteId is missing", async () => {
        const { POST } = await import("@/app/api/stickies/public/raw/route");
        expect((await POST(REQ_POST("", "x"))).status).toBe(404);
    });
    it("returns 404 when the note is not public", async () => {
        mockQueryOne.mockResolvedValue({ title: "t", lock_password_hash: "h", is_public: false, locked: true });
        const { POST } = await import("@/app/api/stickies/public/raw/route");
        expect((await POST(REQ_POST("n", "x"))).status).toBe(404);
    });
    it("redirects (302) when the note is public but no longer locked", async () => {
        mockQueryOne.mockResolvedValue({ title: "t", lock_password_hash: null, is_public: true, locked: false });
        const { POST } = await import("@/app/api/stickies/public/raw/route");
        expect((await POST(REQ_POST("n", "x"))).status).toBe(302);
    });
    it("wrong password -> gate page, NO unlock cookie set", async () => {
        const hash = await hashLockPassword("correct");
        mockQueryOne.mockResolvedValue({ title: "t", lock_password_hash: hash, is_public: true, locked: true });
        const { POST } = await import("@/app/api/stickies/public/raw/route");
        const res = await POST(REQ_POST("n", "wrong"));
        expect(res.status).toBe(401); // gate page rejects with 401, no unlock cookie
        expect(res.headers.get("set-cookie")).toBeNull();
    });
    it("correct password -> 200 + signed httpOnly unlock cookie", async () => {
        const hash = await hashLockPassword("correct");
        mockQueryOne.mockResolvedValue({ title: "t", lock_password_hash: hash, is_public: true, locked: true });
        const { POST } = await import("@/app/api/stickies/public/raw/route");
        const res = await POST(REQ_POST("note-1", "correct"));
        expect(res.status).toBe(200);
        const sc = res.headers.get("set-cookie") ?? "";
        expect(sc).toContain(unlockCookieName("note-1"));
        expect(sc.toLowerCase()).toContain("httponly");
    });
});

describe("GET gate for locked+public notes", () => {
    it("locked note WITHOUT a valid cookie -> gate page, body not leaked", async () => {
        const hash = await hashLockPassword("pw");
        mockQueryOne.mockResolvedValue({ title: "secret", content: "TOPSECRETBODY", type: "text", is_public: true, locked: true, lock_password_hash: hash });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(REQ("?noteId=n"));
        const body = await res.text();
        expect(body).not.toContain("TOPSECRETBODY");
        expect(res.headers.get("content-type")).toContain("text/html");
    });
    it("locked note WITH a valid unlock cookie -> serves content", async () => {
        const hash = await hashLockPassword("pw");
        const token = signUnlockCookie("note-xyz", hash);
        mockQueryOne.mockResolvedValue({ title: "t", content: "UNLOCKEDBODY", type: "text", is_public: true, locked: true, lock_password_hash: hash });
        const req = new Request("https://stickies.example.com/api/stickies/public/raw?noteId=note-xyz", { headers: { cookie: `${unlockCookieName("note-xyz")}=${token}` } });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(await res.text()).toContain("UNLOCKEDBODY");
    });
    it("a cookie signed for a DIFFERENT note does not unlock this one", async () => {
        const hash = await hashLockPassword("pw");
        const token = signUnlockCookie("other-note", hash);
        mockQueryOne.mockResolvedValue({ title: "t", content: "TOPSECRETBODY", type: "text", is_public: true, locked: true, lock_password_hash: hash });
        const req = new Request("https://stickies.example.com/api/stickies/public/raw?noteId=this-note", { headers: { cookie: `${unlockCookieName("this-note")}=${token}` } });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        expect(await (await GET(req)).text()).not.toContain("TOPSECRETBODY");
    });
});

// --- share parity: HTML notes render through the SAME wrapper as the in-app preview ---
describe("GET share parity (HTML notes)", () => {
    const html = { title: "Dash", content: "<h1>hi</h1>", is_public: true, type: "html" };

    it("wraps the note with the light theme surface by default, keeping the author content", async () => {
        mockQueryOne.mockResolvedValue(html);
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const body = await (await GET(REQ("?noteId=pub"))).text();
        expect(body).toContain("<h1>hi</h1>");
        expect(body).toContain("html,body{background:#ffffff!important");
        expect(body).toContain("body{zoom:0.67}");
        expect(body).toContain("<title>Dash</title>");
        expect(body).toContain('property="og:title"');
        expect(body).not.toContain("stickiesReveal");
    });

    it("honours &theme=dark so the share matches what the owner saw", async () => {
        mockQueryOne.mockResolvedValue(html);
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const body = await (await GET(REQ("?noteId=pub&theme=dark"))).text();
        expect(body).toContain("html,body{background:#1a1a1a!important");
    });

    it("adds the reveal fade when arriving from the unlock page", async () => {
        mockQueryOne.mockResolvedValue(html);
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        const body = await (await GET(REQ("?noteId=pub&unlocked=1"))).text();
        expect(body).toContain("stickiesReveal");
    });

    it("leaves plain-text notes and ?as=text untouched", async () => {
        mockQueryOne.mockResolvedValue({ ...html, type: "text", content: "plain" });
        const { GET } = await import("@/app/api/stickies/public/raw/route");
        expect(await (await GET(REQ("?noteId=pub"))).text()).toBe("plain");
        mockQueryOne.mockResolvedValue(html);
        expect(await (await GET(REQ("?noteId=pub&as=text"))).text()).toBe("<h1>hi</h1>");
    });
});

describe("unlock flow hand-off", () => {
    it("gate form carries the theme; success page is dark and lands on the reveal URL", async () => {
        const hash = await hashLockPassword("pw");
        mockQueryOne.mockResolvedValue({ title: "t", content: "x", type: "html", is_public: true, locked: true, lock_password_hash: hash });
        const { GET, POST } = await import("@/app/api/stickies/public/raw/route");
        const gate = await (await GET(REQ("?noteId=n1&theme=dark"))).text();
        expect(gate).toContain('action="/share?noteId=n1&theme=dark"');
        const res = await POST(new Request("https://stickies.example.com/api/stickies/public/raw?noteId=n1&theme=dark", { method: "POST", body: new URLSearchParams({ password: "pw" }) }));
        const body = await res.text();
        expect(res.status).toBe(200);
        expect(body).not.toContain("#f6f9fd");
        expect(body).toContain('window.location.replace("/share?noteId=n1&theme=dark&unlocked=1")');
    });
});
