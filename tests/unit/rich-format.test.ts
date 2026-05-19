/**
 * Unit tests: rich-format.ts
 * Covers: markdownToDoc, textToDoc, docToText, docToMarkdown, emptyDoc, isEmptyDoc
 *
 * Tags: unit, rich-text, prosemirror, markdown
 * Priority: critical — these are the boundary functions when switching note format
 */
import { describe, it, expect } from "vitest";
import {
    emptyDoc,
    isEmptyDoc,
    markdownToDoc,
    textToDoc,
    docToText,
    docToMarkdown,
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

    it("does NOT split on single newlines (those become hard breaks in markdown)", () => {
        const d = textToDoc("Line one\nLine two");
        expect(d.content).toHaveLength(1);
    });
});

// ── markdownToDoc ────────────────────────────────────────────────────────────

describe("markdownToDoc", () => {
    it("returns empty doc for empty input", () => {
        expect(isEmptyDoc(markdownToDoc(""))).toBe(true);
    });

    it("parses headings", () => {
        const d = markdownToDoc("# Hello");
        expect(d.content?.[0].type).toBe("heading");
        expect((d.content?.[0] as any).attrs?.level).toBe(1);
    });

    it("parses bullet lists", () => {
        const d = markdownToDoc("- one\n- two");
        expect(d.content?.[0].type).toBe("bullet_list");
    });

    it("parses bold and italic marks", () => {
        const d = markdownToDoc("**bold** and *italic*");
        const para = d.content?.[0];
        expect(para?.type).toBe("paragraph");
        const marks = (para?.content?.[0] as any)?.marks ?? [];
        expect(marks.map((m: any) => m.type)).toContain("strong");
    });

    it("falls back gracefully on garbage input (never throws)", () => {
        expect(() => markdownToDoc("\x00\x01nonsense")).not.toThrow();
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
        const d = markdownToDoc("# Title\n- item one\n- item two");
        const text = docToText(d);
        expect(text).toContain("Title");
        expect(text).toContain("item one");
        expect(text).toContain("item two");
    });
});

// ── docToMarkdown ────────────────────────────────────────────────────────────

describe("docToMarkdown", () => {
    it("returns empty on null input", () => {
        expect(docToMarkdown(null)).toEqual({ md: "", lossy: false });
    });

    it("round-trips a heading", () => {
        const d = markdownToDoc("# Hello");
        expect(docToMarkdown(d).md.trim()).toBe("# Hello");
    });

    it("round-trips a bullet list (either - or * marker is valid md)", () => {
        const d = markdownToDoc("- one\n- two");
        const { md } = docToMarkdown(d);
        expect(md).toMatch(/[-*]\s*one/);
        expect(md).toMatch(/[-*]\s*two/);
    });

    it("flags lossy=true when the doc contains a table", () => {
        const d: any = {
            type: "doc",
            content: [{
                type: "table",
                content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] }] }],
            }],
        };
        expect(docToMarkdown(d).lossy).toBe(true);
    });

    it("flags lossy=true when the doc contains an image", () => {
        const d: any = {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "image", attrs: { src: "https://x" } }] }],
        };
        expect(docToMarkdown(d).lossy).toBe(true);
    });

    it("flags lossy=true when the doc contains a task list", () => {
        const d: any = {
            type: "doc",
            content: [{ type: "taskList", content: [{ type: "taskItem", content: [{ type: "paragraph", content: [{ type: "text", text: "todo" }] }] }] }],
        };
        expect(docToMarkdown(d).lossy).toBe(true);
    });

    it("does NOT flag lossy on plain paragraphs", () => {
        const d = markdownToDoc("just text");
        expect(docToMarkdown(d).lossy).toBe(false);
    });
});

// ── Round-trip: md → doc → md ────────────────────────────────────────────────

describe("md → doc → md round-trip", () => {
    it("preserves a paragraph", () => {
        const src = "Plain text paragraph.";
        const back = docToMarkdown(markdownToDoc(src)).md.trim();
        expect(back).toBe(src);
    });

    it("preserves headings of multiple levels", () => {
        const src = "# H1\n\n## H2\n\n### H3";
        const back = docToMarkdown(markdownToDoc(src)).md.trim();
        expect(back).toBe(src);
    });

    it("preserves bullet lists (marker style normalized to *)", () => {
        const src = "- one\n- two\n- three";
        const back = docToMarkdown(markdownToDoc(src)).md;
        expect(back).toMatch(/[-*]\s*one/);
        expect(back).toMatch(/[-*]\s*two/);
        expect(back).toMatch(/[-*]\s*three/);
    });

    it("preserves bold and italic", () => {
        const src = "**bold** and *italic*";
        const back = docToMarkdown(markdownToDoc(src)).md.trim();
        expect(back).toContain("**bold**");
        expect(back).toContain("*italic*");
    });

    it("preserves inline code", () => {
        const src = "Use `foo()` to call.";
        const back = docToMarkdown(markdownToDoc(src)).md.trim();
        expect(back).toContain("`foo()`");
    });

    it("preserves fenced code blocks", () => {
        const src = "```\nconst x = 1\n```";
        const back = docToMarkdown(markdownToDoc(src)).md.trim();
        expect(back).toContain("const x = 1");
    });
});

// ── Switch-format simulation: text -> rich -> markdown ───────────────────────

describe("real switch-format flows", () => {
    it("text -> rich -> markdown survives the round trip for prose", () => {
        const original = "First paragraph.\n\nSecond paragraph with more words.";
        const doc = textToDoc(original);
        const { md, lossy } = docToMarkdown(doc);
        expect(lossy).toBe(false);
        expect(md).toContain("First paragraph.");
        expect(md).toContain("Second paragraph");
    });

    it("markdown -> rich -> markdown preserves headings + list", () => {
        const original = "# Project\n\n- Design\n- Build\n- Ship";
        const doc = markdownToDoc(original);
        const { md, lossy } = docToMarkdown(doc);
        expect(lossy).toBe(false);
        expect(md).toContain("# Project");
        expect(md).toMatch(/Design/);
        expect(md).toMatch(/Ship/);
    });

    it("rich (with table) -> markdown reports lossy and still returns text content", () => {
        const doc: any = {
            type: "doc",
            content: [
                { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Inventory" }] },
                {
                    type: "table",
                    content: [{
                        type: "tableRow",
                        content: [{
                            type: "tableCell",
                            content: [{ type: "paragraph", content: [{ type: "text", text: "Apples" }] }],
                        }],
                    }],
                },
            ],
        };
        const { md, lossy } = docToMarkdown(doc);
        expect(lossy).toBe(true);
        // We don't guarantee the table renders, but the heading should still come through somewhere
        expect(md.length).toBeGreaterThan(0);
    });
});
