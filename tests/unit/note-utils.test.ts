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

    it("returns 'json' for TipTap-like doc JSON (TipTap removed)", () => {
        const doc = JSON.stringify({ type: "doc", content: [] });
        expect(detectNoteType(doc)).toBe("json");
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

    // TipTap was removed — doc JSON is now detected as generic json
    it("detects TipTap-like doc as json (TipTap removed)", () => {
        const doc = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
        expect(detectNoteType(doc)).toBe("json");
    });

    // Code types (javascript, typescript, python, css, sql, bash) are set explicitly
    // via pendingNoteType or stored in DB — detectNoteType does NOT auto-detect them.
    // These should all fall back to "text" unless the content happens to match another rule.
    it("code types are not auto-detected — javascript falls back to text", () => {
        expect(detectNoteType("function hello() {\n  return 'world';\n}")).toBe("text");
    });

    it("code types are not auto-detected — typescript falls back to text", () => {
        expect(detectNoteType("const x: number = 42;\ninterface Foo { bar: string; }")).toBe("text");
    });

    it("code types are not auto-detected — python falls back to text", () => {
        expect(detectNoteType("def hello():\n    return 'world'")).toBe("text");
    });

    it("code types are not auto-detected — css falls back to text", () => {
        expect(detectNoteType(".foo {\n  color: red;\n  font-size: 14px;\n}")).toBe("text");
    });

    it("code types are not auto-detected — sql falls back to text", () => {
        expect(detectNoteType("SELECT id, title FROM notes WHERE folder_name = 'Work'")).toBe("text");
    });

    it("code types are not auto-detected — bash falls back to text", () => {
        expect(detectNoteType("#!/bin/bash\necho hello world\ncd /tmp")).toBe("text");
    });

    // Edge: a JS file with a markdown heading would detect as markdown (not JS)
    // This confirms detection priority: mermaid > json > html > markdown > text
    it("detection priority: markdown wins over plain code-like text with # heading", () => {
        expect(detectNoteType("# My Script\nconst x = 1;")).toBe("markdown");
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

    // Missing diagram types — full coverage of all supported subtypes
    const missingCases: [string, string][] = [
        ["stateDiagram\n  [*] --> A",        "State"],
        ["stateDiagram-v2\n  [*] --> A",     "State"],
        ["xychart-beta\n  title Sales",      "XY Chart"],
        ["xychart\n  title Sales",           "XY Chart"],
        ["quadrantChart\n  title Q",         "Quadrant"],
        ["requirementDiagram\n  req A",      "Requirement"],
        ["zenuml\n  A->B: msg",              "ZenUML"],
        ["sankey-beta\n  A,B,10",            "Sankey"],
        ["sankey\n  A,B,10",                 "Sankey"],
        ["block-beta\n  A",                  "Block"],
        ["block\n  A",                       "Block"],
        ["packet-beta\n  field1 8",          "Packet"],
        ["packet\n  field1 8",               "Packet"],
        ["architecture-beta\n  service A",   "Architecture"],
        ["architecture\n  service A",        "Architecture"],
        ["c4container\n  title Sys",         "C4 Container"],
        ["c4component\n  title Comp",        "C4 Component"],
        ["c4dynamic\n  title Dyn",           "C4 Dynamic"],
        ["c4deployment\n  title Dep",        "C4 Deployment"],
    ];

    it.each(missingCases)("detects %s → %s", (input, expected) => {
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
