// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "./helpers";
import { FolderTileIcon } from "@/components/FolderTileIcon";

describe("FolderTileIcon", () => {
    it("renders the Claude glyph for the CLAUDE folder", () => {
        render(<FolderTileIcon item={{ id: "f1", name: "CLAUDE" }} onEnter={() => {}} />);
        expect(screen.getByAltText("Claude")).toHaveAttribute("src", "/claude-icon.png");
    });

    it("renders a hero icon for a normal folder (no Claude image)", () => {
        render(<FolderTileIcon item={{ id: "f2", name: "Work", icon: "" }} onEnter={() => {}} />);
        expect(screen.queryByAltText("Claude")).not.toBeInTheDocument();
    });

    it("fires onEnter when clicked", () => {
        const onEnter = vi.fn();
        render(<FolderTileIcon item={{ id: "f3", name: "CLAUDE" }} onEnter={onEnter} />);
        fireEvent.click(screen.getByAltText("Claude"));
        expect(onEnter).toHaveBeenCalledOnce();
    });
});
