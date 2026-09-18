/**
 * /share route: the public note link. ?noteId= delegates to the /raw handler
 * (render + OG card); legacy ?clip= / ?data= redirect to /clip.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db-driver", () => ({ queryOne: vi.fn(), query: vi.fn(), execute: vi.fn() }));

import { GET } from "@/app/share/route";

describe("/share route", () => {
    it("redirects legacy ?clip= to /clip (308, preserves query)", async () => {
        const res = await GET(new Request("https://x.dev/share?clip=aGk="));
        expect(res.status).toBe(308);
        expect(res.headers.get("location")).toContain("/clip?clip=aGk=");
    });

    it("redirects legacy ?data= to /clip (308)", async () => {
        const res = await GET(new Request("https://x.dev/share?data=abc"));
        expect(res.status).toBe(308);
        expect(res.headers.get("location")).toContain("/clip?data=abc");
    });
});
