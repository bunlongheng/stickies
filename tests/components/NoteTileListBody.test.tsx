// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "./helpers";
import { NoteTileListBody } from "@/components/NoteTileListBody";

const base = {
    selected: false,
    showFileIcons: false,
    activeFolder: null,
    isSelectMode: false,
    pinned: false,
    createdByFilter: null,
    iconAnim: false,
    iconSpin: false,
    onOpen: () => {},
    onIconOpen: () => {},
    onEnterFolder: () => {},
    onSetFilter: () => {},
};

describe("NoteTileListBody", () => {
    it("renders a note title, truncating past 40 chars", () => {
        render(<NoteTileListBody {...base} item={{ id: "n1", title: "Short note" }} />);
        expect(screen.getByText("Short note")).toBeInTheDocument();
        const long = "x".repeat(80);
        render(<NoteTileListBody {...base} item={{ id: "n2", title: long }} />);
        expect(screen.getByText(long.slice(0, 40) + "…")).toBeInTheDocument();
    });

    it("renders a folder name uppercased with a child-count line", () => {
        render(<NoteTileListBody {...base} item={{ id: "f1", is_folder: true, name: "Work", subfolderCount: 1, count: 4 }} />);
        expect(screen.getByText("Work")).toBeInTheDocument();
        expect(screen.getByText(/1 folder/)).toBeInTheDocument();
        expect(screen.getByText(/4 notes/)).toBeInTheDocument();
    });

    it("shows a bookmark-edit button for a URL note and fires onOpen", () => {
        const onOpen = vi.fn();
        render(<NoteTileListBody {...base} item={{ id: "n3", title: "link", content: "https://example.com/x" }} onOpen={onOpen} />);
        fireEvent.click(screen.getByTitle("Edit bookmark"));
        expect(onOpen).toHaveBeenCalledOnce();
    });

    it("shows a trash countdown for a trashed note", () => {
        const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
        render(<NoteTileListBody {...base} item={{ id: "n4", title: "old", trashed_at: oneDayAgo }} />);
        expect(screen.getByText(/d left|expiring/)).toBeInTheDocument();
    });

    it("renders a source-key badge (no file icons) and toggles the filter", () => {
        const onSetFilter = vi.fn();
        render(<NoteTileListBody {...base} item={{ id: "n5", title: "x", created_by_key: "3pi", created_by_machine: "M4" }} onSetFilter={onSetFilter} />);
        fireEvent.click(screen.getByAltText("3pi"));
        expect(onSetFilter).toHaveBeenCalledWith("3pi");
    });

    it("uses a hyphen (not an em dash) in the filter tooltip", () => {
        render(<NoteTileListBody {...base} item={{ id: "n6", title: "x", created_by_key: "3pi", created_by_machine: "M4" }} createdByFilter="3pi" />);
        const badge = screen.getByAltText("3pi").closest("button")!;
        expect(badge.getAttribute("title")).toContain("- click to clear");
        expect(badge.getAttribute("title")).not.toContain("—");
    });
});
