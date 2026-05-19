/**
 * Unit tests: lib/is-local.ts — isLocal()
 *
 * Critical guard: false positives leak the auth bypass to public traffic.
 * False negatives only annoy the developer.
 *
 * Tags: unit, auth, security, critical
 */
import { describe, it, expect } from "vitest";
import { isLocal } from "@/lib/is-local";

const req = (url: string, host?: string) =>
    new Request(url, host ? { headers: { host } } : undefined);

describe("isLocal", () => {
    describe("loopback hosts (must be local)", () => {
        it("matches localhost", () => {
            expect(isLocal(req("http://localhost:4444/"))).toBe(true);
        });
        it("matches localhost with no port", () => {
            expect(isLocal(req("http://localhost/"))).toBe(true);
        });
        it("matches 127.0.0.1", () => {
            expect(isLocal(req("http://127.0.0.1:4444/"))).toBe(true);
        });
        it("matches *.localhost via header (e.g. stickies.localhost)", () => {
            expect(isLocal(req("http://x.invalid/", "stickies.localhost"))).toBe(true);
        });
    });

    describe("private LAN ranges (must be local)", () => {
        it("matches 192.168.0.0/16", () => {
            expect(isLocal(req("http://192.168.1.100:4444/"))).toBe(true);
            expect(isLocal(req("http://192.168.255.255/"))).toBe(true);
        });
        it("matches 10.0.0.0/8", () => {
            expect(isLocal(req("http://10.0.0.1:4444/"))).toBe(true);
            expect(isLocal(req("http://10.255.255.255/"))).toBe(true);
        });
    });

    describe("public hosts (must NOT be local)", () => {
        it("rejects vercel.app domains", () => {
            expect(isLocal(req("https://stickies-bheng.vercel.app/"))).toBe(false);
        });
        it("rejects arbitrary public IPs", () => {
            expect(isLocal(req("http://66.228.61.170/"))).toBe(false);
        });
        it("rejects 172.16-31.x.x (reserved range NOT in our bypass list)", () => {
            // 172.16/12 is a private LAN range but our regex doesn't include it.
            // Documenting current behavior — if we ever need WSL/Docker support we'd extend the RE.
            expect(isLocal(req("http://172.16.0.5/"))).toBe(false);
        });
        it("rejects host header that looks like localhost in the middle of a domain", () => {
            expect(isLocal(req("https://x.invalid/", "evil.localhost.example.com"))).toBe(false);
        });
        it("rejects empty host header + bad URL hostname", () => {
            expect(isLocal(req("https://stickies-bheng.vercel.app/", ""))).toBe(false);
        });
    });

    describe("host header takes precedence over URL", () => {
        it("uses host header when set, ignoring URL", () => {
            // URL says vercel.app, but header says localhost — header wins (closer to the wire)
            expect(isLocal(req("https://stickies-bheng.vercel.app/", "localhost:4444"))).toBe(true);
        });
        it("falls back to URL hostname when header is absent", () => {
            expect(isLocal(req("http://localhost:4444/"))).toBe(true);
        });
    });

    describe("malformed input (must not crash, must not pass)", () => {
        it("returns false for an unparseable URL when host header is also bad", () => {
            // Request constructor itself requires a valid URL, so we use a host header that
            // doesn't match. The URL parse path returns false via try/catch.
            const r = new Request("http://example.com/", { headers: { host: "evil" } });
            expect(isLocal(r)).toBe(false);
        });
    });
});
