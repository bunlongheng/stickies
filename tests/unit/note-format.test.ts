import { describe, it, expect } from "vitest";
import { stripEmoji, colorName, detectJson, detectNoteType, ogPreviewLines } from "@/lib/note-format";

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

describe("detectJson", () => {
    it("parses JSON objects/arrays", () => {
        expect(detectJson('{"a":1}')).toEqual({ ok: true, parsed: { a: 1 } });
        expect(detectJson("[1,2]").ok).toBe(true);
    });
    it("rejects non-JSON and malformed input", () => {
        expect(detectJson("hello").ok).toBe(false);
        expect(detectJson("{bad").ok).toBe(false);
    });
});

describe("detectNoteType", () => {
    it("detects json / html / text (markdown was dropped -> text)", () => {
        expect(detectNoteType('{"a":1}')).toBe("json");
        expect(detectNoteType("<!DOCTYPE html><html></html>")).toBe("html");
        expect(detectNoteType("# Heading\nbody")).toBe("text"); // markdown dropped
        expect(detectNoteType("just some words")).toBe("text");
        expect(detectNoteType("")).toBe("text");
    });
});

describe("ogPreviewLines", () => {
    it("returns cleaned, marker-stripped, non-empty lines", () => {
        const md = "# Title\n\n- first item\n> a quote\n\n1. numbered\nplain tail";
        expect(ogPreviewLines(md)).toEqual(["Title", "first item", "a quote", "numbered", "plain tail"]);
    });
    it("caps the number of lines", () => {
        const many = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
        expect(ogPreviewLines(many, 3)).toEqual(["line 0", "line 1", "line 2"]);
    });
    it("truncates long lines with an ellipsis", () => {
        const long = "x".repeat(80);
        const [line] = ogPreviewLines(long, 5, 20);
        expect(line).toBe("x".repeat(19) + "...");
        expect(line.length).toBe(22);
    });
    it("strips HTML to plain text before splitting", () => {
        expect(ogPreviewLines("<p>hello</p><p>world</p>")).toEqual(["hello", "world"]);
    });
    it("returns [] for empty or whitespace-only content", () => {
        expect(ogPreviewLines("")).toEqual([]);
        expect(ogPreviewLines("   \n  \n")).toEqual([]);
    });
});

