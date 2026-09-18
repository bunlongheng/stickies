import { describe, it, expect } from "vitest";
import { matchNoteIcon, pickNoteIcon, normalizeIcon, SUPPORTED_NOTE_ICONS, DEFAULT_NOTE_ICON, TYPE_ICON } from "@/lib/note-icons";

// Auto-icon matching. These lock in coverage so "auto icon not working much"
// can't recur — every note resolves to a usable __hero: icon.

describe("matchNoteIcon", () => {
    it("gives any 'Fable' title the Fable app icon, ahead of keyword rules", () => {
        expect(matchNoteIcon("Fable Scan - skill-audit 2026-07-17")).toBe("__app:fable");
        expect(matchNoteIcon("iPaaS Deep Audit (claude-fable-5)")).toBe("__app:fable");
        expect(matchNoteIcon("FABLE run")).toBe("__app:fable");
        // non-fable, non-skill audit titles still fall through to the keyword table
        expect(matchNoteIcon("Compliance Audit - stickies")).toBe("__hero:CheckCircleIcon");
    });

    it("gives skill reports their on-brand tile by title, ahead of keyword rules", () => {
        expect(matchNoteIcon("GitHub Profile Audit - bunlongheng")).toBe("__github");
        expect(matchNoteIcon("Repo Recon - integration-service")).toBe("__hero:FingerPrintIcon");
        expect(matchNoteIcon("Repo Audit - stickies")).toBe("__hero:MagnifyingGlassIcon");
        expect(matchNoteIcon("Usage Report - M4")).toBe("__hero:ChartBarIcon");
        expect(matchNoteIcon("Zeta Team Report 2026-08-06")).toBe("__hero:UserGroupIcon");
        expect(matchNoteIcon("Dev Audit v2 - Miguel 2026-08-05")).toBe("__hero:UserIcon");
        expect(matchNoteIcon("Resource Audit - 5 findings")).toBe("__hero:CpuChipIcon");
        expect(matchNoteIcon("Session Recap - ai-jobs - 2026-08-05")).toBe("__hero:ArrowPathIcon");
    });

    it("maps the email keyword to the Gmail brand icon", () => {
        expect(matchNoteIcon("Email to Vincent - cleanup plan")).toBe("__gmail");
        expect(matchNoteIcon("Reply to client")).toBe("__gmail");
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
        expect(pickNoteIcon("zxcv", "", "json")).toBe(TYPE_ICON.json);
    });

    it("falls back to the default doc icon for plain text with a generic title", () => {
        expect(pickNoteIcon("zxcv", "", "text")).toBe(TYPE_ICON.text);
        expect(pickNoteIcon("zxcv", "", null)).toBe(DEFAULT_NOTE_ICON);
        expect(pickNoteIcon("zxcv", "", undefined)).toBe(DEFAULT_NOTE_ICON);
    });

    it("ALWAYS returns a usable icon value (100% coverage guarantee)", () => {
        for (const [title, type] of [["", null], ["random words", "text"], ["xyz", "html"], ["Email", "text"]] as const) {
            const icon = pickNoteIcon(title, "", type);
            expect(icon).toMatch(/^(__hero:[A-Za-z]+Icon|__[a-z]+)$/);
        }
    });
});

describe("normalizeIcon — what agents are allowed to POST", () => {
    it("accepts a bare supported name", () => {
        expect(normalizeIcon("RocketLaunchIcon")).toBe("__hero:RocketLaunchIcon");
    });

    it("accepts the __hero: prefixed form and is case-insensitive", () => {
        expect(normalizeIcon("__hero:CheckCircleIcon")).toBe("__hero:CheckCircleIcon");
        expect(normalizeIcon("rocketlaunchicon")).toBe("__hero:RocketLaunchIcon");
    });

    it("rejects unsupported / junk input", () => {
        expect(normalizeIcon("NotARealIcon")).toBeNull();
        expect(normalizeIcon("")).toBeNull();
        expect(normalizeIcon(null)).toBeNull();
        expect(normalizeIcon(42)).toBeNull();
    });

    it("every supported icon normalizes to itself (round-trip)", () => {
        for (const name of SUPPORTED_NOTE_ICONS) {
            expect(normalizeIcon(name)).toBe(`__hero:${name}`);
        }
    });
});
