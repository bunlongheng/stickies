/**
 * Unit: lib/share-pages.ts - the firefly reveal a note plays after a right passcode.
 */
import { describe, it, expect } from "vitest";
import { unlockReveal } from "@/lib/share-pages";

describe("unlockReveal", () => {
    it("frosts the note and wipes it away over 3 s with 1000 fireflies", () => {
        const html = unlockReveal(true);
        expect(html).toContain("#stickiesReveal");
        expect(html).toContain("backdrop-filter:blur(22px)");
        expect(html).toContain("DURATION=3000");
        expect(html).toContain("COUNT=1000");
        expect(html).toContain("linear-gradient(to bottom, transparent");
    });
    it("only plays on the unlocked=1 arrival, drops the flag, and respects reduced motion", () => {
        const html = unlockReveal(false);
        expect(html).toContain('/[?&]unlocked=1(&|$)/.test(location.search)');
        expect(html).toContain('searchParams.delete("unlocked")');
        expect(html).toContain("prefers-reduced-motion: reduce");
    });
    it("screens light blue points over a dark note and draws saturated blue on a white one", () => {
        const dark = unlockReveal(true);
        expect(dark).toContain("mix-blend-mode:screen");
        expect(dark).toContain("rgba(15,15,15,0.28)");
        expect(dark).toContain('"170,215,255"');
        const light = unlockReveal(false);
        expect(light).toContain("mix-blend-mode:normal");
        expect(light).toContain("rgba(255,255,255,0.35)");
        expect(light).toContain('"70,150,255"');
    });
});
