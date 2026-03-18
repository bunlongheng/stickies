/**
 * Unit tests: note-utils.ts
 * Covers: detectNoteType, extractMermaid, cleanMermaidContent, mermaidSubType,
 *         detectJson, detectMermaid, toUrlToken
 *
 * Tags: unit, note-type, mermaid, json, url
 * Priority: critical
 */
import { describe, it, expect } from "vitest";
import {
    detectNoteType,
    extractMermaid,
    cleanMermaidContent,
    mermaidSubType,
    detectJson,
    detectMermaid,
    toUrlToken,
} from "@/lib/note-utils";

// ── detectNoteType ────────────────────────────────────────────────────────────

describe("detectNoteType", () => {
    it("returns 'text' for empty string", () => {
        expect(detectNoteType("")).toBe("text");
        expect(detectNoteType("   ")).toBe("text");
    });

    it("returns 'text' for plain prose", () => {
        expect(detectNoteType("Hello world")).toBe("text");
        expect(detectNoteType("Just a note with no special syntax")).toBe("text");
    });

    it("returns 'voice' for voice note JSON", () => {
        const voice = JSON.stringify({ _type: "voice", transcript: "hi" });
        expect(detectNoteType(voice)).toBe("voice");
    });

    it("returns 'voice' for array voice note JSON", () => {
        const voice = JSON.stringify([{ _type: "voice", transcript: "hi" }]);
        expect(detectNoteType(voice)).toBe("voice");
    });

    it("returns 'rich' for TipTap doc JSON", () => {
        const doc = JSON.stringify({ type: "doc", content: [] });
        expect(detectNoteType(doc)).toBe("rich");
    });

    it("returns 'mermaid' for flowchart", () => {
        expect(detectNoteType("flowchart TD\n  A --> B")).toBe("mermaid");
    });

    it("returns 'mermaid' for sequenceDiagram", () => {
        expect(detectNoteType("sequenceDiagram\n  Alice->>Bob: Hello")).toBe("mermaid");
    });

    it("returns 'mermaid' for fenced mermaid block", () => {
        expect(detectNoteType("```mermaid\nflowchart TD\n  A-->B\n```")).toBe("mermaid");
    });

    it("returns 'json' for valid JSON object", () => {
        expect(detectNoteType('{"key":"value"}')).toBe("json");
    });

    it("returns 'json' for valid JSON array", () => {
        expect(detectNoteType('[1,2,3]')).toBe("json");
    });

    it("does NOT return 'json' for invalid JSON", () => {
        expect(detectNoteType("{bad json}")).toBe("text");
    });

    it("returns 'html' for full HTML document", () => {
        expect(detectNoteType("<!DOCTYPE html>\n<html>")).toBe("html");
        expect(detectNoteType("<html lang='en'>")).toBe("html");
    });

    it("returns 'markdown' for heading syntax", () => {
        expect(detectNoteType("# My Title\nSome text")).toBe("markdown");
    });

    it("returns 'markdown' for bold syntax", () => {
        expect(detectNoteType("**bold text** here")).toBe("markdown");
    });

    it("returns 'markdown' for blockquote", () => {
        expect(detectNoteType("> a quoted line")).toBe("markdown");
    });

    it("does NOT detect markdown when inline HTML is present", () => {
        // Mixed HTML+markdown-like → not detected as markdown
        expect(detectNoteType("<p>**bold**</p>")).not.toBe("markdown");
    });

    // Regression: TipTap JSON should NOT be detected as generic json
    it("prefers 'rich' over 'json' for TipTap doc", () => {
        const doc = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
        expect(detectNoteType(doc)).toBe("rich");
    });
});

// ── extractMermaid ────────────────────────────────────────────────────────────

describe("extractMermaid", () => {
    it("returns plain text unchanged", () => {
        expect(extractMermaid("flowchart TD\n  A-->B")).toBe("flowchart TD\n  A-->B");
    });

    it("strips ```mermaid fences", () => {
        const result = extractMermaid("```mermaid\nflowchart TD\n  A-->B\n```");
        expect(result).toBe("flowchart TD\n  A-->B");
    });

    it("strips plain ``` fences", () => {
        const result = extractMermaid("```\nflowchart TD\n  A-->B\n```");
        expect(result).toBe("flowchart TD\n  A-->B");
    });

    it("strips YAML frontmatter and injects title as %% comment", () => {
        const input = `---\ntitle: My Flow\n---\nflowchart TD\n  A-->B`;
        const result = extractMermaid(input);
        expect(result).toContain("%% My Flow");
        expect(result).toContain("flowchart TD");
    });

    it("strips YAML frontmatter without title", () => {
        const input = `---\nfoo: bar\n---\nflowchart TD\n  A-->B`;
        const result = extractMermaid(input);
        expect(result).toBe("flowchart TD\n  A-->B");
        expect(result).not.toContain("---");
    });
});

// ── cleanMermaidContent ───────────────────────────────────────────────────────

describe("cleanMermaidContent", () => {
    it("returns plain text unchanged", () => {
        expect(cleanMermaidContent("flowchart TD\n  A-->B")).toBe("flowchart TD\n  A-->B");
    });

    it("strips ```mermaid fences", () => {
        expect(cleanMermaidContent("```mermaid\nflowchart TD\n  A-->B\n```")).toBe("flowchart TD\n  A-->B");
    });

    it("strips plain ``` fences", () => {
        expect(cleanMermaidContent("```\nflowchart TD\n  A-->B\n```")).toBe("flowchart TD\n  A-->B");
    });

    it("trims surrounding whitespace", () => {
        expect(cleanMermaidContent("  flowchart TD  ")).toBe("flowchart TD");
    });
});

// ── mermaidSubType ────────────────────────────────────────────────────────────

describe("mermaidSubType", () => {
    const cases: [string, string][] = [
        ["flowchart TD\n  A-->B",      "Flow"],
        ["graph LR\n  A-->B",          "Flow"],
        ["sequenceDiagram\n  A->>B: hi", "Sequence"],
        ["classDiagram\n  class Foo",  "Class"],
        ["erDiagram\n  USER ||--o{ ORDER", "ER"],
        ["gantt\n  title My",          "Gantt"],
        ["pie\n  title Votes",         "Pie"],
        ["gitGraph\n  commit",         "Git"],
        ["mindmap\n  root",            "Mindmap"],
        ["timeline\n  title Events",   "Timeline"],
        ["kanban\n  column A",         "Kanban"],
    ];

    it.each(cases)("detects %s → %s", (input, expected) => {
        expect(mermaidSubType(input)).toBe(expected);
    });

    it("returns 'Mermaid' for unknown diagram type", () => {
        expect(mermaidSubType("some random text")).toBe("Mermaid");
    });
});

// ── detectJson ────────────────────────────────────────────────────────────────

describe("detectJson", () => {
    it("ok=true for valid object", () => {
        expect(detectJson('{"a":1}').ok).toBe(true);
    });

    it("ok=true for valid array", () => {
        expect(detectJson('[1,2,3]').ok).toBe(true);
    });

    it("ok=false for invalid JSON", () => {
        expect(detectJson('{bad}').ok).toBe(false);
    });

    it("ok=false for plain text", () => {
        expect(detectJson("hello").ok).toBe(false);
    });

    it("ok=false for string starting with quote", () => {
        expect(detectJson('"hello"').ok).toBe(false);
    });

    it("returns parsed value when ok", () => {
        const result = detectJson('{"x":42}');
        expect(result.ok).toBe(true);
        expect((result.parsed as any).x).toBe(42);
    });
});

// ── detectMermaid ─────────────────────────────────────────────────────────────

describe("detectMermaid", () => {
    it("returns true for flowchart text", () => {
        expect(detectMermaid("flowchart TD\n  A-->B")).toBe(true);
    });

    it("returns true for fenced mermaid block", () => {
        expect(detectMermaid("```mermaid\nflowchart TD\n  A-->B\n```")).toBe(true);
    });

    it("returns false for plain text", () => {
        expect(detectMermaid("just some text")).toBe(false);
    });

    it("returns false for HTML", () => {
        expect(detectMermaid("<html><body>hello</body></html>")).toBe(false);
    });
});

// ── toUrlToken ────────────────────────────────────────────────────────────────

describe("toUrlToken", () => {
    it("lowercases", () => {
        expect(toUrlToken("Hello World")).toBe("hello-world");
    });

    it("replaces spaces with dashes", () => {
        expect(toUrlToken("my folder")).toBe("my-folder");
    });

    it("strips leading and trailing dashes", () => {
        expect(toUrlToken("  -hello- ")).toBe("hello");
    });

    it("collapses multiple non-alphanumeric chars into single dash", () => {
        expect(toUrlToken("a / b & c")).toBe("a-b-c");
    });

    it("handles alphanumeric-only input unchanged", () => {
        expect(toUrlToken("3pi")).toBe("3pi");
        expect(toUrlToken("integrations")).toBe("integrations");
    });

    it("handles empty string", () => {
        expect(toUrlToken("")).toBe("");
    });

    it("handles special chars in folder names", () => {
        expect(toUrlToken("My Notes (2024)")).toBe("my-notes-2024");
    });
});
