import { describe, it, expect } from "vitest";
import {
    SMART_TAGS,
    extractSmartTags,
    mergeSmartTags,
    truncateTagsForDisplay,
    switchTrackColors,
    headerColors,
    folderTileForeground,
    noteTileForeground,
    isFixedWhiteTile,
    GREY_TRIGGER_HEXES,
    serializeDraft,
    parseDraftBackup,
    backupHasWork,
    isUnsavedDraft,
    DRAFT_BACKUP_KEY,
} from "@/lib/editor-ui";

// These are the tiny user-facing UI helpers (smart-tag auto-tag, toggle switch
// colors, header tint, tag chip truncation, draft localStorage backup). They
// are pure functions so they're fully unit-testable — no React, no DOM, no
// network. Keep coverage tight here; visual regressions hide in seconds.

describe("extractSmartTags", () => {
    it("returns empty for empty input", () => {
        expect(extractSmartTags("")).toEqual([]);
        expect(extractSmartTags(null as unknown as string)).toEqual([]);
    });

    it("matches AI as a standalone token, case-insensitive", () => {
        expect(extractSmartTags("Let's talk about AI today")).toEqual(["ai"]);
        expect(extractSmartTags("ai is the future")).toEqual(["ai"]);
        expect(extractSmartTags("Ai or ai")).toEqual(["ai"]);
    });

    it("does NOT match AI when embedded in a longer word", () => {
        // The whole point of switching from #hashtag scanning to \b matching
        // was to skip noisy false positives. Verify the boundary.
        expect(extractSmartTags("Maine and Spain")).toEqual([]);
        expect(extractSmartTags("railroad")).toEqual([]);
        expect(extractSmartTags("paint")).toEqual([]);
    });

    it("matches zeta as a standalone token", () => {
        expect(extractSmartTags("Zeta team standup")).toEqual(["zeta"]);
        expect(extractSmartTags("zeta-deploys-and-testing")).toEqual(["zeta"]); // boundary on hyphen
    });

    it("returns both tags when both keywords appear", () => {
        expect(extractSmartTags("Use AI to help zeta team")).toEqual(["ai", "zeta"]);
    });

    it("matches across newlines (haystack = title + content)", () => {
        expect(extractSmartTags("zeta\nAI things")).toEqual(["ai", "zeta"]);
    });

    it("smart-tag table is the one we shipped", () => {
        // Guard: if someone adds a noisy entry, this test fails loudly.
        expect(SMART_TAGS.map(t => t.tag).sort()).toEqual(["ai", "zeta"]);
    });
});

describe("mergeSmartTags", () => {
    it("merges existing + extracted with dedupe", () => {
        expect(mergeSmartTags(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    });

    it("preserves order of existing tags first", () => {
        expect(mergeSmartTags(["custom"], ["ai"])).toEqual(["custom", "ai"]);
    });

    it("handles null/undefined inputs gracefully", () => {
        expect(mergeSmartTags(undefined as unknown as string[], ["ai"])).toEqual(["ai"]);
        expect(mergeSmartTags(["x"], undefined as unknown as string[])).toEqual(["x"]);
    });

    it("returns [] when both inputs empty", () => {
        expect(mergeSmartTags([], [])).toEqual([]);
    });
});

describe("truncateTagsForDisplay", () => {
    it("returns all tags untouched when at or below cap", () => {
        expect(truncateTagsForDisplay(["a", "b", "c"], 3)).toEqual({ visible: ["a", "b", "c"], hiddenCount: 0 });
        expect(truncateTagsForDisplay(["a"], 3)).toEqual({ visible: ["a"], hiddenCount: 0 });
    });

    it("trims to cap and reports remainder", () => {
        expect(truncateTagsForDisplay(["a", "b", "c", "d", "e"], 3)).toEqual({ visible: ["a", "b", "c"], hiddenCount: 2 });
    });

    it("defaults the cap to 3 (matches the chip row)", () => {
        const out = truncateTagsForDisplay(["1", "2", "3", "4", "5", "6", "7", "8"]);
        expect(out.visible).toHaveLength(3);
        expect(out.hiddenCount).toBe(5);
    });

    it("handles empty/nullish input", () => {
        expect(truncateTagsForDisplay([], 3)).toEqual({ visible: [], hiddenCount: 0 });
        expect(truncateTagsForDisplay(null as unknown as string[], 3)).toEqual({ visible: [], hiddenCount: 0 });
    });
});

describe("switchTrackColors", () => {
    it("green when on, regardless of theme", () => {
        expect(switchTrackColors(true, "light").background).toBe("#22c55e");
        expect(switchTrackColors(true, "dark").background).toBe("#22c55e");
    });

    it("dark-grey off-track in dark theme, no border", () => {
        const c = switchTrackColors(false, "dark");
        expect(c.background).toBe("#48484a");
        expect(c.border).toBe("none");
    });

    it("light-grey off-track in light theme, WITH border so it pops on white", () => {
        const c = switchTrackColors(false, "light");
        expect(c.background).toBe("#d1d1d6");
        expect(c.border).toContain("1px solid");
    });

    it("on-state never has a border (would clash with the solid green)", () => {
        expect(switchTrackColors(true, "light").border).toBe("none");
        expect(switchTrackColors(true, "dark").border).toBe("none");
    });
});

describe("headerColors", () => {
    it("uses 13% (hex 22) tint of noteColor for bg", () => {
        const h = headerColors("#FF3B30", "dark");
        expect(h.bg).toBe("#FF3B3022");
    });

    it("uses 33% (hex 55) tint of noteColor for border", () => {
        const h = headerColors("#FF3B30", "dark");
        expect(h.border).toBe("#FF3B3055");
    });

    it("falls back to neutral chrome color when no noteColor", () => {
        expect(headerColors(null, "light").bg).toBe("#f5f5f5");
        expect(headerColors(null, "dark").bg).toBe("#1e1e1e");
    });

    it("text follows the light-mode-black rule", () => {
        // Light theme always shows black foreground — this is Bunlong's
        // repeated rule (see memory: feedback-light-mode-black-fg).
        expect(headerColors("#FF3B30", "light").text).toBe("#1a1a1a");
        expect(headerColors("#FF3B30", "dark").text).toBe("#fff");
    });
});

// Tile foreground rules — locked in so the grey-out / lost-color regression can't recur.
describe("folderTileForeground", () => {
    it("light mode = dark icon stroke, dark mode = white", () => {
        expect(folderTileForeground("light")).toBe("#1c1c1e");
        expect(folderTileForeground("dark")).toBe("#fff");
    });

    it("CLAUDE label is dark in BOTH themes (it's the fixed-white tile)", () => {
        expect(folderTileForeground("light", true)).toBe("#1c1c1e");
        expect(folderTileForeground("dark", true)).toBe("#1c1c1e");
    });

    it("NEVER returns a grey-trigger hex (would flatten the tile to grey)", () => {
        for (const theme of ["light", "dark"] as const) {
            for (const claude of [true, false]) {
                expect(GREY_TRIGGER_HEXES).not.toContain(folderTileForeground(theme, claude));
            }
        }
    });
});

describe("noteTileForeground", () => {
    const dummyIsLight = (hex: string) => hex.toLowerCase().startsWith("#ff") || hex.toLowerCase().startsWith("#fc");

    it("light mode = dark stroke regardless of note color", () => {
        expect(noteTileForeground("light", "#000000", dummyIsLight)).toBe("#1c1c1e");
        expect(noteTileForeground("light", "#FFD600", dummyIsLight)).toBe("#1c1c1e");
    });

    it("dark mode = contrast against the note color", () => {
        expect(noteTileForeground("dark", "#000000", dummyIsLight)).toBe("#fff");   // dark bg -> white
        expect(noteTileForeground("dark", "#FFD600", dummyIsLight)).toBe("#1c1c1e"); // light bg -> dark
    });

    it("NEVER returns a grey-trigger hex", () => {
        expect(GREY_TRIGGER_HEXES).not.toContain(noteTileForeground("light", "#000000", dummyIsLight));
        expect(GREY_TRIGGER_HEXES).not.toContain(noteTileForeground("dark", "#FFD600", dummyIsLight));
    });
});

describe("isFixedWhiteTile", () => {
    it("only CLAUDE is the fixed-white tile", () => {
        expect(isFixedWhiteTile("CLAUDE")).toBe(true);
        expect(isFixedWhiteTile("TODAY")).toBe(false);
        expect(isFixedWhiteTile("Work")).toBe(false);
        expect(isFixedWhiteTile(null)).toBe(false);
        expect(isFixedWhiteTile(undefined)).toBe(false);
    });
});

describe("backupHasWork", () => {
    it("returns false for null/empty backup", () => {
        expect(backupHasWork(null)).toBe(false);
        expect(backupHasWork(undefined)).toBe(false);
        expect(backupHasWork({ title: "", content: "", doc: null } as any)).toBe(false);
        expect(backupHasWork({ title: "   ", content: "", doc: null } as any)).toBe(false);
    });

    it("returns true when title has trimmed content", () => {
        expect(backupHasWork({ title: "Hello", content: "", doc: null } as any)).toBe(true);
    });

    it("returns true when content has trimmed text", () => {
        expect(backupHasWork({ title: "", content: "Some body", doc: null } as any)).toBe(true);
    });

    it("returns true when rich doc has content nodes", () => {
        const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
        expect(backupHasWork({ title: "", content: "", doc } as any)).toBe(true);
    });

    it("returns false for an empty rich doc shell", () => {
        expect(backupHasWork({ title: "", content: "", doc: { type: "doc", content: [] } } as any)).toBe(false);
    });
});

describe("serializeDraft", () => {
    it("uses provided clock for savedAt", () => {
        const now = new Date("2026-05-19T10:30:00.000Z");
        const s = serializeDraft({ title: "x" }, now);
        expect(s.savedAt).toBe("2026-05-19T10:30:00.000Z");
    });

    it("defaults missing fields to safe values", () => {
        const s = serializeDraft({}, new Date(0));
        expect(s).toEqual({
            title: "",
            content: "",
            doc: null,
            color: null,
            folder: null,
            format: null,
            type: null,
            savedAt: "1970-01-01T00:00:00.000Z",
        });
    });
});

describe("parseDraftBackup", () => {
    it("returns null for null/empty/malformed input", () => {
        expect(parseDraftBackup(null)).toBeNull();
        expect(parseDraftBackup("")).toBeNull();
        expect(parseDraftBackup("not json")).toBeNull();
    });

    it("returns null when the backup has no actual work", () => {
        const empty = JSON.stringify(serializeDraft({}, new Date(0)));
        expect(parseDraftBackup(empty)).toBeNull();
    });

    it("round-trips a real draft", () => {
        const draft = serializeDraft({ title: "Hello", content: "Body text" }, new Date("2026-05-19T10:00:00Z"));
        const parsed = parseDraftBackup(JSON.stringify(draft));
        expect(parsed).not.toBeNull();
        expect(parsed!.title).toBe("Hello");
        expect(parsed!.content).toBe("Body text");
    });
});

describe("isUnsavedDraft", () => {
    it("false when editor is closed", () => {
        expect(isUnsavedDraft(false, null)).toBe(false);
        expect(isUnsavedDraft(false, "abc")).toBe(false);
    });

    it("true when editor open and editingNote has no id", () => {
        expect(isUnsavedDraft(true, null)).toBe(true);
        expect(isUnsavedDraft(true, undefined)).toBe(true);
        expect(isUnsavedDraft(true, "")).toBe(true);
    });

    it("false when editor open and editingNote has a real id", () => {
        expect(isUnsavedDraft(true, "abc-123")).toBe(false);
        expect(isUnsavedDraft(true, 42)).toBe(false);
    });
});

describe("DRAFT_BACKUP_KEY constant", () => {
    it("uses a versioned key so schema changes can bump cleanly", () => {
        expect(DRAFT_BACKUP_KEY).toMatch(/:v\d+$/);
        expect(DRAFT_BACKUP_KEY).toContain("stickies");
    });
});
