/**
 * Unit: lib/ui-constants - presentational constants extracted from page.tsx.
 */
import { describe, it, expect } from "vitest";
import { colorPickerPalette, TYPE_BADGE, EMPTY_QUOTES } from "@/lib/ui-constants";
import { palette12 } from "@/lib/colors";

describe("ui-constants", () => {
    it("colorPickerPalette is the base palette plus grey + white", () => {
        expect(colorPickerPalette).toEqual([...palette12, "#8E8E93", "#FFFFFF"]);
    });

    it("TYPE_BADGE covers the core note types with a label + hex color", () => {
        for (const t of ["text", "javascript", "typescript", "html", "json", "checklist"]) {
            expect(TYPE_BADGE[t].label).toBeTruthy();
            expect(TYPE_BADGE[t].color).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });

    it("EMPTY_QUOTES has a non-empty rotation of strings", () => {
        expect(EMPTY_QUOTES.length).toBeGreaterThan(0);
        expect(EMPTY_QUOTES.every(q => typeof q === "string" && q.length > 0)).toBe(true);
    });
});
