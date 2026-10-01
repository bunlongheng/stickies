import { describe, it, expect } from "vitest";
import { noteTileStyle, noteTileClassName } from "@/lib/tile-style";
import { shadedRowBg } from "@/lib/colors";

const baseOpts = { showFileIcons: false, activeFolder: false, parentColor: "#000000", appTheme: "dark" as const, idx: 0, total: 1 };

describe("noteTileStyle - no file icons", () => {
    it("shades a note row with the parent-color gradient", () => {
        const o = { ...baseOpts, parentColor: "#FF0000" };
        expect(noteTileStyle({ color: "#FF0000" }, o)).toEqual({
            position: "relative", isolation: "isolate",
            "--row-color": "#FF0000", "--fc": "#FF0000",
            borderBottom: "1px solid #FF000030",
            background: shadedRowBg("#FF0000", 0, 1, false, false),
        });
    });
    it("flat-tints a root folder row instead of gradient", () => {
        const o = { ...baseOpts, parentColor: "#00FF00", activeFolder: false };
        const style = noteTileStyle({ is_folder: true, color: "#00FF00" }, o);
        expect(style.background).toBe("#00FF0012"); // dark theme root folder tint
    });
});

describe("noteTileStyle - file icons shown", () => {
    it("flat-tints a folder row and a plain note row", () => {
        const o = { ...baseOpts, showFileIcons: true };
        expect(noteTileStyle({ is_folder: true, color: "#123456" }, o).background).toBe("#12345618");
        expect(noteTileStyle({ color: "#123456" }, o).background).toBeUndefined();
    });
});

describe("noteTileClassName", () => {
    const base = { isDragging: false, dropMode: null, incoming: false, removing: false, isSelectMode: false, selected: false } as const;
    it("marks a dragging note", () => {
        const cls = noteTileClassName({}, { ...base, isDragging: true });
        expect(cls).toContain("list-row-hover");
        expect(cls).toContain("opacity-30");
    });
    it("rings a folder row that is a drop-into target", () => {
        const cls = noteTileClassName({ is_folder: true }, { ...base, dropMode: "into" });
        expect(cls).toContain("ring-cyan-400");
        expect(cls).not.toContain("grid-square-tile");
    });
    it("never emits the removed grid classes", () => {
        const cls = noteTileClassName({ is_folder: true, name: "CLAUDE" }, base);
        expect(cls).not.toContain("folder-grid-tile");
        expect(cls).toContain("list-row-hover");
    });
});

describe("thumbnail mode", () => {
    const o = { showFileIcons: false, activeFolder: false, parentColor: "#111111", appTheme: "dark" as const, idx: 0, total: 1, thumb: true };

    it("paints a card in the item's own colour, with no row rule", () => {
        const s = noteTileStyle({ color: "#FFB84D" }, o);
        expect(s.background).toBe("#FFB84D1f");
        expect(s.border).toBe("1px solid #FFB84D59");
        expect(s.borderBottom).toBeUndefined();
        expect(s["--row-color"]).toBe("#FFB84D");
    });

    it("lifts the tint in light mode, and takes the parent colour inside a folder", () => {
        expect(noteTileStyle({ color: "#FFB84D" }, { ...o, appTheme: "light" }).background).toBe("#FFB84D26");
        expect(noteTileStyle({ color: "#FFB84D" }, { ...o, activeFolder: true }).background).toBe("#1111111f");
        // a folder keeps its own colour even inside another folder
        expect(noteTileStyle({ is_folder: true, color: "#00FF00" }, { ...o, activeFolder: true }).background).toBe("#00FF001f");
    });

    it("stacks the card contents instead of laying them out as a row", () => {
        const cls = noteTileClassName({}, { isDragging: false, dropMode: null, incoming: false, removing: false, isSelectMode: false, selected: false, thumb: true });
        expect(cls).toContain("flex-col");
        expect(cls).toContain("rounded-xl");
        expect(cls).not.toContain("min-h-[56px]");
    });

    it("still carries the drag, drop and selection states", () => {
        const o2 = { isDragging: true, dropMode: "into" as const, incoming: true, removing: true, isSelectMode: true, selected: true, thumb: true };
        expect(noteTileClassName({}, o2)).toContain("opacity-30");
        expect(noteTileClassName({}, { ...o2, isDragging: false })).toContain("ring-cyan-400");
        expect(noteTileClassName({}, { ...o2, isDragging: false, dropMode: null })).toContain("ring-blue-400");
        expect(noteTileClassName({}, { ...o2, isDragging: false, dropMode: null })).toContain("note-incoming");
    });
});
