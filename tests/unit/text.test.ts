import { describe, it, expect } from "vitest";
import { meaningfulInitial, previewText, timeAgo, looksLikeUrl, toUrlToken, parseInlineImages } from "@/lib/text";

describe("meaningfulInitial", () => {
    it("returns the first letter/number uppercased", () => {
        expect(meaningfulInitial("hello")).toBe("H");
        expect(meaningfulInitial("  42 notes")).toBe("4");
    });
    it("skips leading punctuation/whitespace", () => {
        expect(meaningfulInitial("  - todo")).toBe("T");
    });
    it("falls back when there is no letter/number", () => {
        expect(meaningfulInitial("", "X")).toBe("X");
        expect(meaningfulInitial("...")).toBe("N");
    });
});

describe("previewText", () => {
    it("strips HTML tags and collapses whitespace", () => {
        expect(previewText("<p>hello   world</p>")).toBe("hello world");
    });
    it("replaces base64 image markdown with a placeholder", () => {
        expect(previewText("![x](data:image/png;base64,AAAA) done")).toBe("[image] done");
    });
});

describe("timeAgo", () => {
    it("labels recent and older times", () => {
        const now = Date.now();
        expect(timeAgo(new Date(now - 10_000).toISOString())).toBe("just now");
        expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
        expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe("3h ago");
        expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe("2d ago");
    });
});

describe("looksLikeUrl", () => {
    it("accepts http(s) URLs only", () => {
        expect(looksLikeUrl("https://example.com/x")).toBe(true);
        expect(looksLikeUrl("  http://a.b  ")).toBe(true);
        expect(looksLikeUrl("not a url")).toBe(false);
        expect(looksLikeUrl("ftp://x")).toBe(false);
    });
});

describe("toUrlToken", () => {
    it("lowercases and hyphenates for URL segments", () => {
        expect(toUrlToken("Hello World")).toBe("hello-world");
        expect(toUrlToken("PR #435 Review")).toBe("pr-435-review");
    });
    it("collapses runs and trims edge hyphens", () => {
        expect(toUrlToken("  --Foo / Bar--  ")).toBe("foo-bar");
        expect(toUrlToken("a__b  c")).toBe("a-b-c");
    });
    it("handles empty / punctuation-only input", () => {
        expect(toUrlToken("")).toBe("");
        expect(toUrlToken("!!!")).toBe("");
    });
});

describe("parseInlineImages", () => {
    it("extracts alt, url, and 0-based line for each image", () => {
        const text = "intro\n![cat](https://x/c.png) mid\n![](y.jpg)";
        expect(parseInlineImages(text)).toEqual([
            { index: 6, alt: "cat", url: "https://x/c.png", line: 1 },
            { index: 34, alt: "", url: "y.jpg", line: 2 },
        ]);
    });
    it("returns [] when there are no images", () => {
        expect(parseInlineImages("just words")).toEqual([]);
        expect(parseInlineImages("")).toEqual([]);
    });
});
