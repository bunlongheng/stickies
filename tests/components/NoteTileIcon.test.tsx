// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "./helpers";
import { NoteTileIcon } from "@/components/NoteTileIcon";

const base = {
    item: { id: "n1", title: "Hello world", color: "#34C759" },
    iconAnim: false,
    iconSpin: false,
    createdByFilter: null,
    onOpen: () => {},
    onSetFilter: () => {},
};

describe("NoteTileIcon", () => {
    it("shows the note's first-letter initial when it has no custom icon", () => {
        render(<NoteTileIcon {...base} />);
        expect(screen.getByText("H")).toBeInTheDocument();
    });

    it("uses the owner avatar for a browser-created note (no key, non-hub machine)", () => {
        render(<NoteTileIcon {...base} item={{ ...base.item, created_by_machine: "SomeLaptop" }} />);
        expect(screen.getByAltText("SomeLaptop")).toHaveAttribute("src", "/avatar.png");
    });

    it("uses the app icon for an external-key note and labels the badge", () => {
        render(<NoteTileIcon {...base} item={{ ...base.item, created_by_key: "3pi" }} />);
        const badge = screen.getByAltText("3pi");
        expect(badge.getAttribute("src")).toContain("/app-icons/3pi");
    });

    it("fires onOpen when the icon is clicked, onSetFilter when the badge is clicked", () => {
        const onOpen = vi.fn();
        const onSetFilter = vi.fn();
        render(<NoteTileIcon {...base} item={{ ...base.item, created_by_key: "3pi" }} onOpen={onOpen} onSetFilter={onSetFilter} />);
        fireEvent.click(screen.getByText("H"));
        expect(onOpen).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByAltText("3pi"));
        expect(onSetFilter).toHaveBeenCalledWith("3pi");
    });

    it("clears the filter when the badge is clicked while already active", () => {
        const onSetFilter = vi.fn();
        render(<NoteTileIcon {...base} item={{ ...base.item, created_by_key: "3pi" }} createdByFilter="3pi" onSetFilter={onSetFilter} />);
        fireEvent.click(screen.getByAltText("3pi"));
        expect(onSetFilter).toHaveBeenCalledWith(null);
    });
});
