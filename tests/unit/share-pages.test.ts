/**
 * Unit: lib/share-pages.ts - the dark unlock beat + the reveal style.
 */
import { describe, it, expect } from "vitest";
import { unlockedSuccessPage, REVEAL_STYLE, SHARE_BG } from "@/lib/share-pages";

describe("unlockedSuccessPage", () => {
    it("stays in the black safe room (no light flash) and veils into the note's theme color", () => {
        const light = unlockedSuccessPage("/share?noteId=n&theme=light&unlocked=1", false);
        expect(light).toContain("#181818 0%,#000 80%"); // same room as the gate
        expect(light).not.toContain("#f6f9fd");          // the old light scene is gone
        expect(light).toContain(`.veil{position:fixed;inset:0;background:${SHARE_BG.light}`);
        const dark = unlockedSuccessPage("/share?noteId=n&theme=dark&unlocked=1", true);
        expect(dark).toContain(`background:${SHARE_BG.dark}`);
    });
    it("scans the file with a radar sweep and flips the readout to ACCESS GRANTED", () => {
        const html = unlockedSuccessPage("/x", true);
        expect(html).toContain('class="sweep"');
        expect(html).toContain("SCANNING FILE");
        expect(html).toContain("ACCESS GRANTED");
        expect(html).not.toContain('class="dial"');
    });
    it("navigates to the given target with the reveal flag, escaped as JSON", () => {
        const html = unlockedSuccessPage("/share?noteId=a&theme=dark&unlocked=1", true);
        expect(html).toContain('window.location.replace("/share?noteId=a&theme=dark&unlocked=1")');
    });
    it("hands off in under 2s", () => {
        const m = unlockedSuccessPage("/x", true).match(/\}, (\d+)\);/);
        expect(Number(m?.[1])).toBeLessThanOrEqual(2000);
    });
});

describe("REVEAL_STYLE", () => {
    it("fades the body in and respects reduced motion", () => {
        expect(REVEAL_STYLE).toContain("stickiesReveal");
        expect(REVEAL_STYLE).toContain("prefers-reduced-motion");
    });
});
