/**
 * Integration tests: server-side detectType() — route.ts
 *
 * This is the authoritative server-side type detector (distinct from the
 * client-side detectNoteType in note-utils.ts). Tests every detectable type.
 *
 * Tags: integration, type-detection, all-types
 * Priority: critical
 */
import { describe, it, expect } from "vitest";
import { detectType } from "@/app/api/stickies/route";

describe("detectType (server-side)", () => {

    // ── text (default fallback) ───────────────────────────────────────────────
    it("returns 'text' for empty string", () => {
        expect(detectType("")).toBe("text");
        expect(detectType("   ")).toBe("text");
    });

    it("returns 'text' for plain prose", () => {
        expect(detectType("Just some plain text here")).toBe("text");
    });

    // ── voice (removed — now detected as json) ────────────────────────────────
    it("returns 'json' for voice-like JSON (voice type removed)", () => {
        expect(detectType('{"_type":"voice","transcript":"hello"}')).toBe("json");
    });

    // ── mermaid ───────────────────────────────────────────────────────────────
    it("returns 'mermaid' for flowchart keyword", () => {
        expect(detectType("flowchart TD\n  A --> B")).toBe("mermaid");
    });

    it("returns 'mermaid' for graph keyword", () => {
        expect(detectType("graph LR\n  A --> B")).toBe("mermaid");
    });

    it("returns 'mermaid' for sequenceDiagram", () => {
        expect(detectType("sequenceDiagram\n  A->>B: Hello")).toBe("mermaid");
    });

    it("returns 'mermaid' for fenced ```mermaid block", () => {
        expect(detectType("```mermaid\nflowchart TD\n  A-->B\n```")).toBe("mermaid");
    });

    it("returns 'mermaid' for plain ``` fenced block", () => {
        expect(detectType("```\nflowchart TD\n  A-->B\n```")).toBe("mermaid");
    });

    // ── json ──────────────────────────────────────────────────────────────────
    it("returns 'json' for valid JSON object", () => {
        expect(detectType('{"key":"value","n":42}')).toBe("json");
    });

    it("returns 'json' for valid JSON array", () => {
        expect(detectType('[1,"two",3]')).toBe("json");
    });

    it("does NOT return 'json' for invalid JSON", () => {
        expect(detectType('{bad json}')).not.toBe("json");
    });

    // ── html ──────────────────────────────────────────────────────────────────
    it("returns 'html' for <!DOCTYPE html>", () => {
        expect(detectType("<!DOCTYPE html>\n<html><body>hi</body></html>")).toBe("html");
    });

    it("returns 'html' for <html> tag", () => {
        expect(detectType("<html lang='en'><body>hi</body></html>")).toBe("html");
    });

    // ── checklist ─────────────────────────────────────────────────────────────
    it("returns 'checklist' for unchecked [ ] items", () => {
        expect(detectType("[ ] Buy milk\n[ ] Write tests")).toBe("checklist");
    });

    it("returns 'checklist' for checked [x] items", () => {
        expect(detectType("[x] Done\n[ ] Todo")).toBe("checklist");
    });

    it("returns 'checklist' for [X] uppercase", () => {
        expect(detectType("[X] Task one")).toBe("checklist");
    });

    // ── markdown ──────────────────────────────────────────────────────────────
    it("returns 'markdown' for # heading", () => {
        expect(detectType("# My Title\n\nSome content here.")).toBe("markdown");
    });

    it("returns 'markdown' for bullet list -", () => {
        expect(detectType("- item one\n- item two\n- item three")).toBe("markdown");
    });

    it("returns 'markdown' for bullet list *", () => {
        expect(detectType("* first\n* second")).toBe("markdown");
    });

    it("returns 'markdown' for **bold** syntax", () => {
        expect(detectType("This is **bold** text")).toBe("markdown");
    });

    it("returns 'markdown' for > blockquote", () => {
        expect(detectType("> a quoted line")).toBe("markdown");
    });

    // NOTE: plain ``` fences are detected as 'mermaid' (not 'markdown') because the
    // server-side regex `/^```(?:mermaid)?\s*\n/` matches both ``` and ```mermaid.
    // Markdown detection via ^``` still fires for non-fenced-block contexts.
    it("returns 'mermaid' for plain ``` fenced block", () => {
        expect(detectType("```\nsome code\n```")).toBe("mermaid");
    });

    // ── file extension detection (title-based) ────────────────────────────────
    const extCases: [string, string, string][] = [
        ["code content",            "script.js",       "javascript"],
        ["code content",            "app.ts",          "typescript"],
        ["def hello():\n  pass",    "main.py",         "python"],
        [".foo { color: red }",     "styles.css",      "css"],
        ["SELECT * FROM t",         "query.sql",       "sql"],
        ["#!/bin/bash\necho hi",    "deploy.sh",       "bash"],
        ["#!/bin/bash\necho hi",    "run.bash",        "bash"],
        ["# My Doc\n\ncontent",    "notes.md",        "markdown"],
        ["# My Doc\n\ncontent",    "notes.markdown",  "markdown"],
        ["<html>hi</html>",         "page.html",       "html"],
        ["<html>hi</html>",         "page.htm",        "html"],
        ['{"k":1}',                 "data.json",       "json"],
        ["flowchart TD",            "diagram.mermaid", "mermaid"],
        ["flowchart TD",            "diagram.mmd",     "mermaid"],
    ];

    it.each(extCases)("title '%s' → type '%s'", (content, title, expected) => {
        expect(detectType(content, title)).toBe(expected);
    });

    // ── priority: file extension wins over content heuristic ─────────────────
    it("file extension wins over content heuristic for .js files", () => {
        // A .js file even with plain text content → javascript
        expect(detectType("hello world", "myfile.js")).toBe("javascript");
    });

    it("content-based mermaid wins if no title extension", () => {
        expect(detectType("flowchart TD\n  A-->B")).toBe("mermaid");
    });

    // ── all VALID_TYPES are reachable ─────────────────────────────────────────
    const allTypes = ["text","markdown","html","json","mermaid","javascript","typescript","python","css","sql","bash","checklist"];
    it.each(allTypes)("type '%s' is detectable", (type) => {
        const samples: Record<string, () => string> = {
            text:       () => "plain text",
            markdown:   () => "# heading",
            html:       () => "<!DOCTYPE html><html></html>",
            json:       () => '{"a":1}',
            mermaid:    () => "flowchart TD\n  A-->B",
            javascript: () => detectType("code", "f.js") && "code",
            typescript: () => detectType("code", "f.ts") && "code",
            python:     () => detectType("code", "f.py") && "code",
            css:        () => detectType("code", "f.css") && "code",
            sql:        () => detectType("code", "f.sql") && "code",
            bash:       () => detectType("code", "f.sh") && "code",
            voice:      () => '{"_type":"voice","transcript":"hi"}',
            checklist:  () => "[ ] task one",
        };
        const content = samples[type]?.() ?? "content";
        const title   = ["javascript","typescript","python","css","sql","bash"].includes(type)
            ? `file.${type === "javascript" ? "js" : type === "typescript" ? "ts" : type === "python" ? "py" : type === "bash" ? "sh" : type}`
            : undefined;
        expect(detectType(content, title)).toBe(type);
    });
});
