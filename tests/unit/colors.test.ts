import { describe, it, expect } from "vitest";
import { isLightColor, shadedRowBg, taskColor, palette12, VIVID12 } from "@/lib/colors";

describe("isLightColor", () => {
    it("classifies light vs dark by luminance", () => {
        expect(isLightColor("#FFFFFF")).toBe(true);
        expect(isLightColor("#FFCC00")).toBe(true);
        expect(isLightColor("#000000")).toBe(false);
        expect(isLightColor("#007AFF")).toBe(false);
    });
    it("returns false for short/invalid hex", () => {
        expect(isLightColor("#fff")).toBe(false);
    });
});

describe("shadedRowBg", () => {
    it("returns a hex+alpha tint for notes in dark mode", () => {
        expect(shadedRowBg("#34C759", 0, 5)).toMatch(/^#34C759[0-9a-f]{2}$/i);
    });
    it("returns rgba for folders", () => {
        expect(shadedRowBg("#34C759", 0, 1, true)).toMatch(/^rgba\(/);
    });
});

describe("taskColor", () => {
    it("returns a palette color and wraps within range", () => {
        expect(VIVID12).toContain(taskColor(0, 4));
        expect(VIVID12).toContain(taskColor(20, 4));
    });
    it("palette12 has 12 colors", () => {
        expect(palette12).toHaveLength(12);
    });
});
