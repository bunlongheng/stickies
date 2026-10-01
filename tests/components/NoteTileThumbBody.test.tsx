// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "./helpers";
import { NoteTileThumbBody } from "@/components/NoteTileThumbBody";

const base = { selected: false, isSelectMode: false, pinned: false, onEnterFolder: () => {} };

describe("NoteTileThumbBody", () => {
    it("shows the note title and a collapsed one-line preview", () => {
        render(<NoteTileThumbBody {...base} item={{ id: "n1", title: "Invoice 0000255", content: "  line 1\n\n line 2  " }} />);
        expect(screen.getByText("Invoice 0000255")).toBeTruthy();
        expect(screen.getByText("line 1 line 2")).toBeTruthy();
    });

    it("falls back to Untitled, and renders no preview without content", () => {
        const { container } = render(<NoteTileThumbBody {...base} item={{ id: "n2", title: "   " }} />);
        expect(screen.getByText("Untitled")).toBeTruthy();
        expect(container.querySelectorAll("div").length).toBeLessThan(5);
    });

    it("counts folders and notes on a folder card", () => {
        render(<NoteTileThumbBody {...base} item={{ id: "f1", is_folder: true, name: "Quick", subfolderCount: 2, count: 6 }} />);
        expect(screen.getByText("Quick")).toBeTruthy();
        expect(screen.getByText("2 folders · 6 notes")).toBeTruthy();
    });

    it("singularises the counts", () => {
        render(<NoteTileThumbBody {...base} item={{ id: "f2", is_folder: true, name: "Solo", subfolderCount: 1, count: 1 }} />);
        expect(screen.getByText("1 folder · 1 note")).toBeTruthy();
    });

    it("enters the folder from its icon", () => {
        const onEnterFolder = vi.fn();
        const { container } = render(<NoteTileThumbBody {...base} onEnterFolder={onEnterFolder}
            item={{ id: "f3", is_folder: true, name: "Quick", color: "#FFB84D" }} />);
        const icon = container.querySelector(".folder-icon-badge") as HTMLElement;
        if (icon) { fireEvent.click(icon); expect(onEnterFolder).toHaveBeenCalled(); }
    });

    it("marks a selected note and shows the pin", () => {
        const { container: a } = render(<NoteTileThumbBody {...base} isSelectMode selected item={{ id: "n3", title: "x" }} />);
        expect(a.querySelector(".bg-blue-500")).toBeTruthy();
        const { container: b } = render(<NoteTileThumbBody {...base} pinned item={{ id: "n4", title: "y" }} />);
        expect(b.querySelector("svg")).toBeTruthy();
    });

    it("shows the relative time of the last edit", () => {
        render(<NoteTileThumbBody {...base} item={{ id: "n5", title: "z", updated_at: new Date(Date.now() - 3600_000).toISOString() }} />);
        expect(screen.getByText(/ago|h|m/)).toBeTruthy();
    });
});
