/**
 * Unit: lib/storage-keys - localStorage key constants extracted from page.tsx.
 */
import { describe, it, expect } from "vitest";
import * as KEYS from "@/lib/storage-keys";

describe("storage-keys", () => {
    it("exposes 17 stable, unique, non-empty keys", () => {
        const vals = Object.values(KEYS);
        expect(vals.length).toBe(17);
        expect(vals.every(v => typeof v === "string" && v.length > 0)).toBe(true);
        expect(new Set(vals).size).toBe(vals.length); // no collisions - a dup would cross-wipe state
    });

    it("keeps the known key values stable (changing one silently orphans persisted state)", () => {
        expect(KEYS.APP_THEME_KEY).toBe("stickies:app-theme:v1");
        expect(KEYS.MAIN_LIST_MODE_KEY).toBe("stickies:main-list-mode:v1");
        expect(KEYS.PINNED_KEY).toBe("stickies_pinned_ids");
    });
});
