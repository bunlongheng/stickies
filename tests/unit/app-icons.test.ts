import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { appIconForKey, DEFAULT_APP_ICON } from "@/lib/app-icons";

describe("appIconForKey", () => {
    it("resolves an exact key match", () => {
        expect(appIconForKey("3pi")).toBe("/app-icons/3pi.png");
        expect(appIconForKey("pixel")).toBe("/app-icons/pixel.png");
    });

    it("is case-insensitive", () => {
        expect(appIconForKey("PIXEL")).toBe("/app-icons/pixel.png");
        expect(appIconForKey("Claude")).toBe("/app-icons/claude.png");
    });

    it("keeps svg extensions where the registry uses them", () => {
        expect(appIconForKey("chrome")).toBe("/app-icons/chrome.svg");
        expect(appIconForKey("recap")).toBe("/app-icons/recap.svg");
    });

    it("prefers an exact suffixed key over its leading segment", () => {
        // "3pi-poc" is its own registry entry, not "3pi"
        expect(appIconForKey("3pi-poc")).toBe("/app-icons/3pi-poc.png");
    });

    it("falls back to the leading segment for unknown suffixed keys", () => {
        expect(appIconForKey("automations-pipeline")).toBe("/app-icons/automations.png");
        expect(appIconForKey("3pi-unknown-suffix")).toBe("/app-icons/3pi.png");
    });

    it("returns null for unknown keys and empty input", () => {
        expect(appIconForKey("nope")).toBeNull();
        expect(appIconForKey("")).toBeNull();
        expect(appIconForKey(null)).toBeNull();
        expect(appIconForKey(undefined)).toBeNull();
    });

    it("never serves the retired yellow job art", () => {
        // Every job-hunt key renders the green jobs icon; job.png is deleted.
        for (const key of ["job", "jobs", "ai-jobs", "JOB"]) {
            expect(appIconForKey(key)).toBe("/app-icons/jobs.png");
        }
        // The registry must never point at the retired art file again.
        expect(readFileSync("lib/app-icons.ts", "utf8")).not.toContain('"job.png"');
    });

    it("exposes a default icon fallback path", () => {
        expect(DEFAULT_APP_ICON).toBe("/app-icons/stickies.png");
    });
});
