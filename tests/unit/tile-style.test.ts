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
