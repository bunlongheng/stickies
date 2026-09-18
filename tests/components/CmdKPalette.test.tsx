// @vitest-environment jsdom
/**
 * Unit: components/CmdKPalette - the Cmd-K search overlay. Covers the closed
 * short-circuit, result rendering (folders + notes), typing, keyboard nav
 * (arrows / enter / escape), and the click handlers.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "./helpers";
import { CmdKPalette } from "@/components/CmdKPalette";

function makeProps(over: Record<string, any> = {}) {
    return {
        showCmdK: true,
        setShowCmdK: vi.fn(),
        // Non-empty: an empty query intentionally suggests nothing (shows "Type to search").
        cmdKQuery: "note",
        setCmdKQuery: vi.fn(),
        cmdKCursor: 0,
        setCmdKCursor: vi.fn(),
        cmdKGlobal: false,
        setCmdKGlobal: vi.fn(),
        cmdKInFile: false,
        cmdKInputRef: React.createRef<HTMLInputElement>(),
        cmdKResults: [
            { id: "fold1", name: "Work", color: "#34C759", icon: "", count: 3, _isFolder: true },
            { id: "note1", title: "First note", content: "hello", color: "#007AFF", folder_name: "Work", updated_at: new Date().toISOString(), _isFolder: false },
        ],
        openNoteFromCmdK: vi.fn(),
        openAllFromCmdK: vi.fn(),
        activeFolder: "Work",
        dbData: [{ id: "fold1", is_folder: true, folder_name: "Work", name: "Work", parent_folder_name: null }],
        pinnedIds: new Set<string>(),
        enterFolder: vi.fn(),
        loadFolderNotes: vi.fn(),
        ...over,
    } as any;
}

describe("CmdKPalette", () => {
    it("renders nothing when closed", () => {
        const { container } = render(<CmdKPalette {...makeProps({ showCmdK: false })} />);
        expect(container.firstChild).toBeNull();
    });

    it("renders the search input and both a folder and a note result", () => {
        const { getByPlaceholderText, getByText } = render(<CmdKPalette {...makeProps()} />);
        expect(getByPlaceholderText("SEARCH…")).toBeInTheDocument();
        expect(getByText("Notebooks")).toBeInTheDocument();
        expect(getByText("First note")).toBeInTheDocument();
    });

    it("typing updates the query and resets the cursor", () => {
        const p = makeProps();
        const { getByPlaceholderText } = render(<CmdKPalette {...p} />);
        fireEvent.change(getByPlaceholderText("SEARCH…"), { target: { value: "abc" } });
        expect(p.setCmdKQuery).toHaveBeenCalledWith("abc");
        expect(p.setCmdKCursor).toHaveBeenCalledWith(0);
    });

    it("Escape and backdrop click close the palette", () => {
        const p = makeProps();
        const { container, getByPlaceholderText } = render(<CmdKPalette {...p} />);
        fireEvent.keyDown(getByPlaceholderText("SEARCH…"), { key: "Escape" });
        fireEvent.click(container.firstChild as Element); // backdrop
        expect(p.setShowCmdK).toHaveBeenCalledWith(false);
    });

    it("ArrowDown / ArrowUp move the cursor and Enter opens the cursored result", () => {
        const p = makeProps({ cmdKCursor: 1 });
        const { getByPlaceholderText } = render(<CmdKPalette {...p} />);
        const input = getByPlaceholderText("SEARCH…");
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "ArrowUp" });
        expect(p.setCmdKCursor).toHaveBeenCalled();
        fireEvent.keyDown(input, { key: "Enter" });
        expect(p.openNoteFromCmdK).toHaveBeenCalledWith(p.cmdKResults[1]);
    });

    it("clicking a note fires openNoteFromCmdK; clicking a folder navigates", () => {
        const p = makeProps();
        const { getByText } = render(<CmdKPalette {...p} />);
        fireEvent.click(getByText("First note"));
        expect(p.openNoteFromCmdK).toHaveBeenCalled();
        fireEvent.click(getByText(/3 notes?/).closest("button") as Element); // the folder result row
        expect(p.enterFolder).toHaveBeenCalled();
        expect(p.loadFolderNotes).toHaveBeenCalledWith("Work", false);
    });

    it("the folder/global chip toggles global scope", () => {
        const p = makeProps();
        const { getByRole } = render(<CmdKPalette {...p} />);
        fireEvent.click(getByRole("button", { name: "Work" })); // the header chip (name is exactly "Work")
        expect(p.setCmdKGlobal).toHaveBeenCalled();
    });

    it("empty query shows Recent suggestions (no open-all button)", () => {
        const { getByText, queryByRole } = render(<CmdKPalette {...makeProps({
            cmdKQuery: "",
            cmdKResults: [
                { id: "n1", title: "One", updated_at: new Date().toISOString(), _isFolder: false },
                { id: "n2", title: "Two", updated_at: new Date().toISOString(), _isFolder: false },
            ],
        })} />);
        expect(getByText("Recent")).toBeInTheDocument();
        expect(getByText("One")).toBeInTheDocument();
        // No open-all affordance until the user actually types.
        expect(queryByRole("button", { name: /OPEN ALL/i })).toBeNull();
    });

    it("with >1 note matches, Open-all button fires openAllFromCmdK", () => {
        const p = makeProps({
            cmdKResults: [
                { id: "n1", title: "One", updated_at: new Date().toISOString(), _isFolder: false },
                { id: "n2", title: "Two", updated_at: new Date().toISOString(), _isFolder: false },
            ],
        });
        const { getByRole } = render(<CmdKPalette {...p} />);
        fireEvent.click(getByRole("button", { name: /OPEN ALL 2 IN TABS/i }));
        expect(p.openAllFromCmdK).toHaveBeenCalled();
    });

    it("in-file mode with a query but no matches shows the empty message", () => {
        const { getByText } = render(<CmdKPalette {...makeProps({ cmdKInFile: true, cmdKQuery: "zzz", cmdKResults: [] })} />);
        expect(getByText("No matches in file")).toBeInTheDocument();
    });
});
