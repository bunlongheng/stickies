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
    stripPlaceholderImages,
    PLACEHOLDER_IMAGE_PREFIX,
    isImageFile,
    dragHasFiles,
    mergeRecentNotes,
    cmdkMatchTier,
    CMDK_NO_MATCH,
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

    // Same helper drives the breadcrumb folder-badge icon/initial color
    // (app/(app)/page.tsx ~7420). It must NOT be hardcoded white — a TODAY/Work
    // badge in light mode shows a DARK glyph, like every other tile.
    it("breadcrumb badge: dark glyph in light mode, white in dark", () => {
        expect(folderTileForeground("light", false)).toBe("#1c1c1e");
        expect(folderTileForeground("dark", false)).toBe("#fff");
    });
});

describe("noteTileForeground", () => {
    it("light mode = dark stroke, dark mode = white (same rule as folders, all letters)", () => {
        expect(noteTileForeground("light")).toBe("#1c1c1e");
        expect(noteTileForeground("dark")).toBe("#fff");
    });

    it("NEVER returns a grey-trigger hex", () => {
        expect(GREY_TRIGGER_HEXES).not.toContain(noteTileForeground("light"));
        expect(GREY_TRIGGER_HEXES).not.toContain(noteTileForeground("dark"));
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

// Regression guard: an in-flight upload renders a `placeholder://` image node.
// If that node is ever persisted, the note reloads as a permanently-broken
// spinner (no upload left to resolve it). stripPlaceholderImages must remove
// them before save and on load, while leaving real images untouched.
describe("stripPlaceholderImages", () => {
    const img = (src: string) => ({ type: "image", attrs: { src, alt: "x" } });
    const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

    it("removes a top-level placeholder image but keeps real images", () => {
        const doc = {
            type: "doc",
            content: [
                para("hello"),
                img(`${PLACEHOLDER_IMAGE_PREFIX}1-1700000000000`),
                img("/api/stickies/gdrive?img=abc123"),
            ],
        };
        const out = stripPlaceholderImages(doc);
        expect(out.content).toHaveLength(2);
        expect(out.content.some((n: any) => n.type === "image" && n.attrs.src.startsWith(PLACEHOLDER_IMAGE_PREFIX))).toBe(false);
        expect(out.content.some((n: any) => n.attrs?.src === "/api/stickies/gdrive?img=abc123")).toBe(true);
    });

    it("strips placeholders nested inside other nodes (e.g. table cells)", () => {
        const doc = {
            type: "doc",
            content: [
                {
                    type: "tableCell",
                    content: [img(`${PLACEHOLDER_IMAGE_PREFIX}9-x`), img("https://cdn/real.png")],
                },
            ],
        };
        const out = stripPlaceholderImages(doc);
        expect(out.content[0].content).toHaveLength(1);
        expect(out.content[0].content[0].attrs.src).toBe("https://cdn/real.png");
    });

    it("leaves a clean doc structurally unchanged", () => {
        const doc = { type: "doc", content: [para("a"), img("https://cdn/x.png"), para("b")] };
        expect(stripPlaceholderImages(doc)).toEqual(doc);
    });

    it("is a no-op for null / leaf / contentless nodes", () => {
        expect(stripPlaceholderImages(null as any)).toBeNull();
        expect(stripPlaceholderImages({ type: "text", text: "hi" } as any)).toEqual({ type: "text", text: "hi" });
    });

    it("removes a doc made up entirely of placeholders (the reported stuck note)", () => {
        const doc = {
            type: "doc",
            content: [
                img(`${PLACEHOLDER_IMAGE_PREFIX}1-a`),
                img(`${PLACEHOLDER_IMAGE_PREFIX}2-b`),
            ],
        };
        expect(stripPlaceholderImages(doc).content).toHaveLength(0);
    });
});

// Drag-and-drop image support: a drop anywhere in the editor must be accepted.
// These guard the two pure predicates the drop handler relies on.
describe("isImageFile", () => {
    const file = (name: string, type = "") => new File([new Uint8Array([0])], name, { type });

    it("accepts files by image/* MIME type", () => {
        expect(isImageFile(file("x.png", "image/png"))).toBe(true);
        expect(isImageFile(file("photo", "image/jpeg"))).toBe(true);
    });

    it("accepts image extensions even when the browser sets no MIME type", () => {
        for (const ext of ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "avif", "svg", "jfif"]) {
            expect(isImageFile(file(`pic.${ext}`))).toBe(true);
        }
    });

    it("rejects non-image files", () => {
        expect(isImageFile(file("notes.txt", "text/plain"))).toBe(false);
        expect(isImageFile(file("archive.zip", "application/zip"))).toBe(false);
        expect(isImageFile(file("data"))).toBe(false);
    });
});

describe("dragHasFiles", () => {
    it("is true only when the drag carries external files", () => {
        expect(dragHasFiles({ types: ["Files"] })).toBe(true);
        expect(dragHasFiles({ types: ["Files", "text/plain"] })).toBe(true);
    });

    it("is false for internal node drags (no Files type) and missing data", () => {
        expect(dragHasFiles({ types: ["text/html"] })).toBe(false);
        expect(dragHasFiles({ types: [] })).toBe(false);
        expect(dragHasFiles(null)).toBe(false);
        expect(dragHasFiles(undefined)).toBe(false);
    });
});

// Realtime catch-up: when the tab refocuses we re-fetch recent notes to recover
// any Pusher events missed while the socket slept. This merge must add the new
// note, dedupe it if it already arrived live, never drop folders, and keep
// optimistic (un-saved) notes the server doesn't know about yet.
describe("mergeRecentNotes", () => {
    const folder = { id: "f1", is_folder: true, folder_name: "CLAUDE" };
    const noteA = { id: "a", is_folder: false, title: "A" };

    it("appends a brand-new incoming note (the missed-while-asleep case)", () => {
        const incoming = [{ id: "b", is_folder: false, title: "B (new via API)" }];
        const out = mergeRecentNotes([folder, noteA], incoming);
        expect(out.map((n) => n.id)).toEqual(["f1", "a", "b"]);
    });

    it("dedupes when the note also arrived live (no double row), incoming wins", () => {
        const stale = { id: "b", is_folder: false, title: "old title" };
        const incoming = [{ id: "b", is_folder: false, title: "fresh title" }];
        const out = mergeRecentNotes([folder, noteA, stale], incoming);
        expect(out.filter((n) => n.id === "b")).toHaveLength(1);
        expect(out.find((n) => n.id === "b")!.title).toBe("fresh title");
    });

    it("never drops folders and keeps optimistic notes not yet on the server", () => {
        const optimistic = { id: "tmp-1", is_folder: false, _optimistic: true, title: "typing…" };
        const incoming = [{ id: "a", is_folder: false, title: "A refreshed" }];
        const out = mergeRecentNotes([folder, optimistic, noteA], incoming);
        expect(out.some((n) => n.id === "f1")).toBe(true);
        expect(out.some((n) => n.id === "tmp-1")).toBe(true);
        expect(out.find((n) => n.id === "a")!.title).toBe("A refreshed");
    });

    it("returns just folders + existing rows when nothing new comes back", () => {
        const out = mergeRecentNotes([folder, noteA], []);
        expect(out.map((n) => n.id)).toEqual(["f1", "a"]);
    });
});

// Cmd+K ranking. The reported bug: searching "vincen" put older notes whose
// title STARTS with the query above a fresher "Email to Vincent…" note. The fix
// is that prefix and substring title matches share a tier, so recency (applied
// by the caller) decides — the latest match ends up on top.
describe("cmdkMatchTier", () => {
    it("ranks exact title above any partial, and title above content", () => {
        expect(cmdkMatchTier("vincen", "", "vincen")).toBe(0);
        expect(cmdkMatchTier("Vincent notes", "", "vincen")).toBeLessThan(cmdkMatchTier("x", "vincen body", "vincen"));
    });

    it("REGRESSION: prefix and substring title matches share the same tier", () => {
        const prefix = cmdkMatchTier("Vincent Performance", "", "vincen");      // title starts with query
        const substring = cmdkMatchTier("Email to Vincent (final)", "", "vincen"); // query mid-title
        expect(prefix).toBe(substring); // so date desc (caller) lets the latest win
    });

    it("pinned notes edge out non-pinned within the same match kind", () => {
        expect(cmdkMatchTier("Email to Vincent", "", "vincen", true))
            .toBeLessThan(cmdkMatchTier("Email to Vincent", "", "vincen", false));
    });

    it("returns CMDK_NO_MATCH for no match or empty query", () => {
        expect(cmdkMatchTier("hello", "world", "zzz")).toBe(CMDK_NO_MATCH);
        expect(cmdkMatchTier("hello", "world", "")).toBe(CMDK_NO_MATCH);
    });

    it("is case-insensitive", () => {
        expect(cmdkMatchTier("VINCENT", "", "vincent")).toBe(0);
    });
});
