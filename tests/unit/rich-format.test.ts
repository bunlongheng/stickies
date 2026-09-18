/**
 * Unit tests: rich-format.ts
 * Covers: textToDoc, docToText, emptyDoc, isEmptyDoc
 * (markdownToDoc / docToMarkdown were dropped 2026-07-27 — notes are text or HTML now.)
 *
 * Tags: unit, rich-text, prosemirror
 * Priority: critical — these are the boundary functions when switching note format
 */
import { describe, it, expect } from "vitest";
import {
    emptyDoc,
    isEmptyDoc,
    textToDoc,
    docToText,
} from "@/lib/rich-format";

// ── emptyDoc / isEmptyDoc ────────────────────────────────────────────────────

describe("emptyDoc", () => {
    it("returns a fresh paragraph-only doc", () => {
        const d = emptyDoc();
        expect(d.type).toBe("doc");
        expect(d.content).toHaveLength(1);
        expect(d.content?.[0].type).toBe("paragraph");
    });

    it("returns a new object each call (no shared mutation)", () => {
        const a = emptyDoc();
        const b = emptyDoc();
        expect(a).not.toBe(b);
        (a.content as any)[0].type = "mutated";
        expect(b.content?.[0].type).toBe("paragraph");
    });
});

describe("isEmptyDoc", () => {
    it("treats null/undefined as empty", () => {
        expect(isEmptyDoc(null)).toBe(true);
        expect(isEmptyDoc(undefined)).toBe(true);
    });
    it("treats a single empty paragraph as empty", () => {
        expect(isEmptyDoc(emptyDoc())).toBe(true);
    });
    it("treats a doc with text as non-empty", () => {
        expect(isEmptyDoc({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] })).toBe(false);
    });
});

// ── textToDoc ────────────────────────────────────────────────────────────────

describe("textToDoc", () => {
    it("returns empty doc for empty / whitespace input", () => {
        expect(isEmptyDoc(textToDoc(""))).toBe(true);
        expect(isEmptyDoc(textToDoc("   "))).toBe(true);
        expect(isEmptyDoc(textToDoc("\n\n"))).toBe(true);
    });

    it("wraps single-line text in one paragraph", () => {
        const d = textToDoc("Hello world");
        expect(d.content?.[0].type).toBe("paragraph");
        expect(d.content?.[0].content?.[0]).toEqual({ type: "text", text: "Hello world" });
    });

    it("splits on blank lines into separate paragraphs", () => {
        const d = textToDoc("First.\n\nSecond.\n\nThird.");
        expect(d.content).toHaveLength(3);
        expect(d.content?.[0].content?.[0]).toMatchObject({ text: "First." });
        expect(d.content?.[2].content?.[0]).toMatchObject({ text: "Third." });
    });

    it("does NOT split on single newlines", () => {
        const d = textToDoc("Line one\nLine two");
        expect(d.content).toHaveLength(1);
    });
});

// ── docToText ────────────────────────────────────────────────────────────────

describe("docToText", () => {
    it("returns empty string for null", () => {
        expect(docToText(null)).toBe("");
        expect(docToText(undefined)).toBe("");
    });

    it("extracts text from a paragraph", () => {
        expect(docToText({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] })).toBe("Hello");
    });

    it("joins paragraphs with blank lines", () => {
        const d = textToDoc("First.\n\nSecond.");
        const back = docToText(d);
        expect(back).toContain("First.");
        expect(back).toContain("Second.");
    });

    it("walks nested content (bullets, headings)", () => {
        const d: any = {
            type: "doc",
            content: [
                { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
                {
                    type: "bulletList",
                    content: [
                        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item one" }] }] },
                        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item two" }] }] },
                    ],
                },
            ],
        };
        const text = docToText(d);
        expect(text).toContain("Title");
        expect(text).toContain("item one");
        expect(text).toContain("item two");
    });
});

// ── Switch-format simulation: text -> rich -> text ───────────────────────────

describe("real switch-format flows", () => {
    it("text -> rich (doc) -> text survives the round trip for prose", () => {
        const original = "First paragraph.\n\nSecond paragraph with more words.";
        const doc = textToDoc(original);
        const back = docToText(doc);
        expect(back).toContain("First paragraph.");
        expect(back).toContain("Second paragraph");
    });
});
