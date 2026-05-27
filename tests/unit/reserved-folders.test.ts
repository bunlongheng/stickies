/**
 * Unit tests: lib/reserved-folders.ts
 *
 * "Today"/"Yesterday" are virtual views, never real folders. These guards are the
 * single source of truth enforced at every write boundary, so they must hold the
 * line on casing, whitespace, and folder paths.
 *
 * Tags: unit, folders, reserved-views
 * Priority: high
 */
import { describe, it, expect } from "vitest";
import { RESERVED_VIEW_NAMES, isReservedFolderName, remapReservedFolderPath } from "@/lib/reserved-folders";

describe("isReservedFolderName", () => {
    it("flags the reserved view names case-insensitively, ignoring whitespace", () => {
        expect(isReservedFolderName("Today")).toBe(true);
        expect(isReservedFolderName("today")).toBe(true);
        expect(isReservedFolderName("  YESTERDAY  ")).toBe(true);
    });

    it("allows real folder names", () => {
        expect(isReservedFolderName("CLAUDE")).toBe(false);
        expect(isReservedFolderName("Today Notes")).toBe(false);
        expect(isReservedFolderName(null)).toBe(false);
        expect(isReservedFolderName("")).toBe(false);
    });

    it("covers every name in RESERVED_VIEW_NAMES", () => {
        for (const name of RESERVED_VIEW_NAMES) expect(isReservedFolderName(name)).toBe(true);
    });
});

describe("remapReservedFolderPath", () => {
    it("remaps a bare reserved name to the default home", () => {
        expect(remapReservedFolderPath("Today")).toBe("CLAUDE");
        expect(remapReservedFolderPath("yesterday")).toBe("CLAUDE");
    });

    it("remaps only the leading reserved segment of a path", () => {
        expect(remapReservedFolderPath("Today/PM2026")).toBe("CLAUDE/PM2026");
        expect(remapReservedFolderPath("CLAUDE/Today")).toBe("CLAUDE/Today");
    });

    it("leaves non-reserved paths untouched and honours a custom fallback", () => {
        expect(remapReservedFolderPath("WORK/Sprint")).toBe("WORK/Sprint");
        expect(remapReservedFolderPath("Today", "INBOX")).toBe("INBOX");
    });
});
