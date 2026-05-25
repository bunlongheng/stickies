import { describe, it, expect } from "vitest";
import { stripEmoji, colorName } from "@/lib/note-format";

describe("stripEmoji — API titles stay clean text", () => {
    it("removes leading/trailing emoji and trims", () => {
        expect(stripEmoji("🚀 Deploy plan")).toBe("Deploy plan");
        expect(stripEmoji("Standup ✅")).toBe("Standup");
        expect(stripEmoji("📌 Pinned 📌")).toBe("Pinned");
    });

    it("removes emoji in the middle and collapses spaces", () => {
        expect(stripEmoji("Sprint 🔥 Retro")).toBe("Sprint Retro");
    });

    it("removes flags, variation selectors, ZWJ sequences, keycaps", () => {
        expect(stripEmoji("Release 🇺🇸 notes")).toBe("Release notes");
        expect(stripEmoji("Family 👨‍👩‍👧 plan")).toBe("Family plan");
        expect(stripEmoji("Item 1️⃣")).toBe("Item 1"); // keycap combiner removed; base digit is real text
        expect(stripEmoji("heart ❤️")).toBe("heart");
    });

    it("leaves clean text untouched", () => {
        expect(stripEmoji("Email to Vincent - May cleanup")).toBe("Email to Vincent - May cleanup");
        expect(stripEmoji("PR #435 Review")).toBe("PR #435 Review");
    });

    it("handles empty / whitespace-only", () => {
        expect(stripEmoji("")).toBe("");
        expect(stripEmoji("   ")).toBe("");
        expect(stripEmoji("🎉")).toBe("");
    });
});

describe("colorName — friendly palette names for the success response", () => {
    it("maps palette hexes to names (case-insensitive)", () => {
        expect(colorName("#34C759")).toBe("green");
        expect(colorName("#34c759")).toBe("green");
        expect(colorName("#007AFF")).toBe("blue");
        expect(colorName("#FF2D55")).toBe("pink");
    });

    it("falls back to the hex for unknown colors", () => {
        expect(colorName("#123456")).toBe("#123456");
        expect(colorName("")).toBe("");
    });
});
