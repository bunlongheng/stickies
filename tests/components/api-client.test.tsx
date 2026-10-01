// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// BASE is read once at module load, so each case re-imports with its own env.
async function load(base?: string) {
    vi.resetModules();
    if (base === undefined) delete process.env.NEXT_PUBLIC_STICKIES_API_BASE;
    else process.env.NEXT_PUBLIC_STICKIES_API_BASE = base;
    return import("@/lib/api-client");
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("without a remote base", () => {
    it("leaves every path alone and fetches it unchanged", async () => {
        const m = await load();
        expect(m.usingRemoteApi).toBe(false);
        expect(m.apiUrl("/api/stickies?folder=Quick")).toBe("/api/stickies?folder=Quick");
        const fetchMock = vi.fn(async () => new Response("{}"));
        vi.stubGlobal("fetch", fetchMock);
        await m.apiFetch("/api/stickies");
        expect(fetchMock).toHaveBeenCalledWith("/api/stickies", {});
        vi.unstubAllGlobals();
    });
});

describe("with a remote base", () => {
    it("maps the notes surface and keeps the query string", async () => {
        const m = await load("https://api.example.com/");
        expect(m.usingRemoteApi).toBe(true);
        expect(m.apiUrl("/api/stickies")).toBe("https://api.example.com/notes");
        expect(m.apiUrl("/api/stickies?folder=Quick")).toBe("https://api.example.com/notes?folder=Quick");
    });

    it("drops the /api/stickies and /api prefixes from everything else", async () => {
        const m = await load("https://api.example.com");
        expect(m.apiUrl("/api/stickies/keys")).toBe("https://api.example.com/keys");
        expect(m.apiUrl("/api/hue/trigger")).toBe("https://api.example.com/hue/trigger");
    });

    it("leaves NextAuth and non-api paths in this app", async () => {
        const m = await load("https://api.example.com");
        expect(m.apiUrl("/api/auth/session")).toBe("/api/auth/session");
        expect(m.apiUrl("/share?noteId=n1")).toBe("/share?noteId=n1");
    });

    it("attaches the stored bearer token and sends credentials", async () => {
        const m = await load("https://api.example.com");
        m.setAccessToken("tok-1");
        expect(m.accessToken()).toBe("tok-1");
        const fetchMock = vi.fn(async () => new Response("{}"));
        vi.stubGlobal("fetch", fetchMock);
        await m.apiFetch("/api/stickies", { method: "POST" });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.example.com/notes");
        expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok-1");
        expect(init.credentials).toBe("include");
        vi.unstubAllGlobals();
    });

    it("never overwrites an Authorization header the caller set", async () => {
        const m = await load("https://api.example.com");
        m.setAccessToken("tok-1");
        const fetchMock = vi.fn(async () => new Response("{}"));
        vi.stubGlobal("fetch", fetchMock);
        await m.apiFetch("/api/stickies", { headers: { Authorization: "Bearer caller" } });
        expect(((fetchMock.mock.calls[0] as any)[1].headers as Headers).get("Authorization")).toBe("Bearer caller");
        vi.unstubAllGlobals();
    });

    it("sends no token once it is cleared", async () => {
        const m = await load("https://api.example.com");
        m.setAccessToken("tok-1");
        m.clearAccessToken();
        expect(m.accessToken()).toBeNull();
        const fetchMock = vi.fn(async () => new Response("{}"));
        vi.stubGlobal("fetch", fetchMock);
        await m.apiFetch("/api/stickies");
        expect(((fetchMock.mock.calls[0] as any)[1].headers as Headers).has("Authorization")).toBe(false);
        vi.unstubAllGlobals();
    });
});
