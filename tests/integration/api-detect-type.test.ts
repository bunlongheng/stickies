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

    // ── mermaid was dropped (2026-07-29): diagram content now falls back to text ──
    it("returns 'text' for flowchart / graph / sequenceDiagram content (mermaid dropped)", () => {
        expect(detectType("flowchart TD\n  A --> B")).toBe("text");
        expect(detectType("graph LR\n  A --> B")).toBe("text");
        expect(detectType("sequenceDiagram\n  A->>B: Hello")).toBe("text");
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

    // ── markdown was dropped (2026-07-27): md-shaped content now falls through to text ──
    it("returns 'text' for # heading (markdown dropped)", () => {
        expect(detectType("# My Title\n\nSome content here.")).toBe("text");
    });
    it("returns 'text' for bullet lists / **bold** / > blockquote (markdown dropped)", () => {
        expect(detectType("- item one\n- item two")).toBe("text");
        expect(detectType("This is **bold** text")).toBe("text");
        expect(detectType("> a quoted line")).toBe("text");
    });

    it("returns 'text' for a plain ``` fenced block (mermaid dropped)", () => {
        expect(detectType("```\nsome code\n```")).toBe("text");
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
        ["<html>hi</html>",         "page.html",       "html"],
        ["<html>hi</html>",         "page.htm",        "html"],
        ['{"k":1}',                 "data.json",       "json"],
    ];

    it.each(extCases)("title '%s' → type '%s'", (content, title, expected) => {
        expect(detectType(content, title)).toBe(expected);
    });

    // ── priority: file extension wins over content heuristic ─────────────────
    it("file extension wins over content heuristic for .js files", () => {
        // A .js file even with plain text content → javascript
        expect(detectType("hello world", "myfile.js")).toBe("javascript");
    });

    // ── all VALID_TYPES are reachable ─────────────────────────────────────────
    const allTypes = ["text","html","json","javascript","typescript","python","css","sql","bash","checklist"];
    it.each(allTypes)("type '%s' is detectable", (type) => {
        const samples: Record<string, () => string> = {
            text:       () => "plain text",
            html:       () => "<!DOCTYPE html><html></html>",
            json:       () => '{"a":1}',
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
