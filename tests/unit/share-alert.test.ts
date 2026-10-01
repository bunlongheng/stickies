import { describe, it, expect, vi, beforeEach } from "vitest";

const execute = vi.fn(async () => undefined);
const query = vi.fn(async () => [{ n: "3" }]);
vi.mock("@/lib/db-driver", () => ({ execute: (...a: unknown[]) => execute(...a), query: (...a: unknown[]) => query(...a) }));

import { clientIp, readVisit, notifyShareUnlock } from "@/lib/share-alert";

function req(headers: Record<string, string>) {
    return new Request("https://stickies-bheng.vercel.app/share?noteId=n1", { headers });
}

beforeEach(() => { execute.mockClear(); query.mockClear(); delete process.env.RESEND_API_KEY; delete process.env.OWNER_USER_ID; });

describe("clientIp", () => {
    it("takes the first hop of x-forwarded-for", () => {
        expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    });
    it("falls back to x-real-ip, then unknown", () => {
        expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
        expect(clientIp(req({}))).toBe("unknown");
    });
});

describe("readVisit", () => {
    it("captures ip, geo, agent and referer", () => {
        const v = readVisit(req({
            "x-forwarded-for": "203.0.113.7",
            "x-vercel-ip-city": "Woburn",
            "x-vercel-ip-country": "US",
            "user-agent": "Mozilla/5.0",
            referer: "https://mail.google.com/",
        }), "n1", "Invoice 0000255");
        expect(v).toMatchObject({
            noteId: "n1", title: "Invoice 0000255", ip: "203.0.113.7",
            city: "Woburn", country: "US", userAgent: "Mozilla/5.0", referer: "https://mail.google.com/",
        });
    });
});

describe("notifyShareUnlock", () => {
    it("logs the visit, then emails when Resend is configured", async () => {
        process.env.RESEND_API_KEY = "re_test";
        process.env.OWNER_EMAIL = "owner@example.com";
        const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        await notifyShareUnlock(readVisit(req({ "x-forwarded-for": "203.0.113.7" }), "n1", "Invoice 0000255"));

        expect(fetchMock).toHaveBeenCalledOnce();
        const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
        expect(body.to).toEqual(["owner@example.com"]);
        expect(body.subject).toBe("Opened: Invoice 0000255 - 203.0.113.7");
        expect(body.html).toContain("203.0.113.7");
        expect(body.html).toContain("view 3");
        vi.unstubAllGlobals();
    });

    it("posts an alert note instead when no email provider is set", async () => {
        process.env.OWNER_USER_ID = "u1";
        await notifyShareUnlock(readVisit(req({ "x-forwarded-for": "203.0.113.7" }), "n1", "Invoice"));
        const sql = execute.mock.calls.map(c => String(c[0])).join("\n");
        expect(sql).toContain('INSERT INTO "stickies"');
        expect(sql).toContain("'Alerts'");
    });

    it("never throws when the database is down", async () => {
        execute.mockRejectedValueOnce(new Error("db down"));
        await expect(notifyShareUnlock(readVisit(req({}), "n1", "t"))).resolves.toBeUndefined();
    });
});
