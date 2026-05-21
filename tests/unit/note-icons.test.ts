import { describe, it, expect } from "vitest";
import { matchNoteIcon, pickNoteIcon, DEFAULT_NOTE_ICON, TYPE_ICON } from "@/lib/note-icons";

// Auto-icon matching. These lock in coverage so "auto icon not working much"
// can't recur — every note resolves to a usable __hero: icon.

describe("matchNoteIcon", () => {
    it("matches the newly-added email keyword", () => {
        expect(matchNoteIcon("Email to Vincent — cleanup plan")).toBe("__hero:EnvelopeIcon");
        expect(matchNoteIcon("Reply to client")).toBe("__hero:EnvelopeIcon");
    });

    it("matches review / PR work", () => {
        expect(matchNoteIcon("PR #435 Review: k6 Refactor")).toBe("__hero:CheckCircleIcon");
        expect(matchNoteIcon("reviewer feedback")).toBe("__hero:CheckCircleIcon");
    });

    it("matches common keywords", () => {
        expect(matchNoteIcon("Deploy to prod")).toBe("__hero:RocketLaunchIcon");
        expect(matchNoteIcon("Claude AI agent")).toBe("__hero:RobotIcon");
        expect(matchNoteIcon("Postgres migration")).toBe("__hero:TableCellsIcon");
        expect(matchNoteIcon("Sprint standup")).toBe("__hero:ChatBubbleLeftRightIcon");
    });

    it("returns null when nothing matches", () => {
        expect(matchNoteIcon("zxcv qwerty")).toBeNull();
        expect(matchNoteIcon("")).toBeNull();
    });

    it("matches against content too (first 200 chars)", () => {
        expect(matchNoteIcon("Untitled", "Here is the postgres schema")).toBe("__hero:TableCellsIcon");
    });
});

describe("pickNoteIcon — always returns an icon (never null)", () => {
    it("keyword match wins first", () => {
        expect(pickNoteIcon("Deploy notes", "", "text")).toBe("__hero:RocketLaunchIcon");
    });

    it("falls back to the note type when no keyword matches", () => {
        expect(pickNoteIcon("zxcv", "", "html")).toBe(TYPE_ICON.html);
        expect(pickNoteIcon("zxcv", "", "sql")).toBe(TYPE_ICON.sql);
        expect(pickNoteIcon("zxcv", "", "markdown")).toBe(TYPE_ICON.markdown);
    });

    it("falls back to the default doc icon for plain text with a generic title", () => {
        expect(pickNoteIcon("zxcv", "", "text")).toBe(TYPE_ICON.text);
        expect(pickNoteIcon("zxcv", "", null)).toBe(DEFAULT_NOTE_ICON);
        expect(pickNoteIcon("zxcv", "", undefined)).toBe(DEFAULT_NOTE_ICON);
    });

    it("ALWAYS returns a __hero: value (100% coverage guarantee)", () => {
        for (const [title, type] of [["", null], ["random words", "text"], ["xyz", "html"], ["Email", "text"]] as const) {
            const icon = pickNoteIcon(title, "", type);
            expect(icon).toMatch(/^__hero:[A-Za-z]+Icon$/);
        }
    });
});
