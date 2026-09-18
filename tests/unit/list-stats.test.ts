import { describe, it, expect } from "vitest";
import { listStatsSummary } from "@/lib/list-stats";

describe("listStatsSummary", () => {
    it("summarizes folders, notes, and char size for an open folder", () => {
        const items = [
            { is_folder: true }, { is_folder: true },
            { is_folder: false, content: "hello" }, { is_folder: false, content: "world!" },
        ];
        expect(listStatsSummary({ items, atRoot: false, folderCounts: {}, dbNoteCount: 0 }))
            .toBe("2 folders · 2 notes · 11 chars");
    });

    it("ignores _header sentinels", () => {
        const items = [{ _header: "TODAY" }, { is_folder: false, content: "x" }];
        expect(listStatsSummary({ items, atRoot: false, folderCounts: {}, dbNoteCount: 0 }))
            .toBe("1 note · 1 chars");
    });

    it("at root, prefers folderCounts total (excluding TRASH) for the note count", () => {
        const items = [{ is_folder: true }];
        const out = listStatsSummary({ items, atRoot: true, folderCounts: { Work: 5, TRASH: 99 }, dbNoteCount: 0 });
        expect(out).toContain("1 folder");
        expect(out).toContain("5 notes");
    });

    it("at root, falls back to dbNoteCount when counts are empty", () => {
        const out = listStatsSummary({ items: [], atRoot: true, folderCounts: {}, dbNoteCount: 7 });
        expect(out).toBe("7 notes");
    });

    it("formats k and M char sizes", () => {
        const big = [{ is_folder: false, content: "x".repeat(3400) }];
        expect(listStatsSummary({ items: big, atRoot: false, folderCounts: {}, dbNoteCount: 0 })).toContain("3.4k chars");
        const huge = [{ is_folder: false, content: "x".repeat(1_200_000) }];
        expect(listStatsSummary({ items: huge, atRoot: false, folderCounts: {}, dbNoteCount: 0 })).toContain("1.2M chars");
    });

    it("returns an empty string when there is nothing to count", () => {
        expect(listStatsSummary({ items: [], atRoot: false, folderCounts: {}, dbNoteCount: 0 })).toBe("");
    });
});
