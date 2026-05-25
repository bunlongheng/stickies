// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, userEvent } from "./helpers";
import RichEditor from "@/components/RichEditor";

// TipTap measures the DOM; jsdom lacks a few APIs it touches. Patch the small
// gaps so the editor can mount.
beforeEach(() => {
    if (!(globalThis as any).ResizeObserver) {
        (globalThis as any).ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
    if (!(Range.prototype as any).getClientRects) {
        (Range.prototype as any).getClientRects = () => [];
    }
    if (!(Range.prototype as any).getBoundingClientRect) {
        (Range.prototype as any).getBoundingClientRect = () => ({
            top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
        });
    }
    // ProseMirror's posAtCoords (fired on mousedown) needs elementFromPoint,
    // which jsdom does not implement.
    if (!(document as any).elementFromPoint) {
        (document as any).elementFromPoint = () => null;
    }
});

// Wait until the editor mounts (immediatelyRender:false means the toolbar
// appears a tick after first render).
async function waitForToolbar() {
    return waitFor(() =>
        expect(screen.getByTitle("Bold (⌘B)")).toBeInTheDocument(),
    );
}

describe("RichEditor", () => {
    it("renders the formatting toolbar once the editor mounts", async () => {
        render(<RichEditor />);
        await waitForToolbar();
        expect(screen.getByTitle("Italic (⌘I)")).toBeInTheDocument();
        expect(screen.getByTitle("Inline code")).toBeInTheDocument();
        expect(screen.getByTitle("Bulleted list")).toBeInTheDocument();
        expect(screen.getByTitle("Numbered list")).toBeInTheDocument();
        expect(screen.getByTitle("Task list")).toBeInTheDocument();
        expect(screen.getByTitle("Quote")).toBeInTheDocument();
        expect(screen.getByTitle("Code block")).toBeInTheDocument();
        expect(screen.getByTitle("Link")).toBeInTheDocument();
        expect(screen.getByTitle("Insert table")).toBeInTheDocument();
        expect(screen.getByTitle("Insert image")).toBeInTheDocument();
    });

    it("renders the heading buttons", async () => {
        render(<RichEditor />);
        await waitForToolbar();
        expect(screen.getByTitle("Heading 1")).toBeInTheDocument();
        expect(screen.getByTitle("Heading 2")).toBeInTheDocument();
        expect(screen.getByTitle("Heading 3")).toBeInTheDocument();
    });

    it("renders undo/redo buttons disabled on a fresh editor", async () => {
        render(<RichEditor />);
        await waitForToolbar();
        expect(screen.getByTitle("Undo (⌘Z)")).toBeDisabled();
        expect(screen.getByTitle("Redo (⌘⇧Z)")).toBeDisabled();
    });

    it("renders the contenteditable ProseMirror surface", async () => {
        const { container } = render(<RichEditor />);
        await waitForToolbar();
        const prose = container.querySelector(".rich-editor-prose");
        expect(prose).not.toBeNull();
        expect(prose).toHaveAttribute("contenteditable", "true");
    });

    it("seeds the editor with initialText", async () => {
        const { container } = render(<RichEditor initialText={"Hello from text"} />);
        await waitForToolbar();
        await waitFor(() => {
            const prose = container.querySelector(".rich-editor-prose");
            expect(prose?.textContent).toContain("Hello from text");
        });
    });

    it("seeds the editor with an initialDoc", async () => {
        const doc = {
            type: "doc",
            content: [
                { type: "paragraph", content: [{ type: "text", text: "Doc content here" }] },
            ],
        };
        const { container } = render(<RichEditor initialDoc={doc} />);
        await waitForToolbar();
        await waitFor(() => {
            const prose = container.querySelector(".rich-editor-prose");
            expect(prose?.textContent).toContain("Doc content here");
        });
    });

    it("applies the placeholder text via the Placeholder extension", async () => {
        const { container } = render(<RichEditor placeholder="Type here please" />);
        await waitForToolbar();
        // The Placeholder extension stamps data-placeholder on the empty node.
        await waitFor(() => {
            const ph = container.querySelector('[data-placeholder="Type here please"]');
            expect(ph).not.toBeNull();
        });
    });

    it("fires onChange when the user types", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { container } = render(<RichEditor onChange={onChange} autoFocus />);
        await waitForToolbar();
        const prose = container.querySelector(".rich-editor-prose") as HTMLElement;
        await user.click(prose);
        await user.keyboard("hello");
        await waitFor(() => expect(onChange).toHaveBeenCalled());
        const last = onChange.mock.calls.at(-1)![0];
        expect(last).toHaveProperty("doc");
        expect(last).toHaveProperty("text");
    });

    it("toggles bold active state when the Bold button is clicked while typing", async () => {
        const user = userEvent.setup();
        const { container } = render(<RichEditor autoFocus />);
        await waitForToolbar();
        const prose = container.querySelector(".rich-editor-prose") as HTMLElement;
        await user.click(prose);
        const bold = screen.getByTitle("Bold (⌘B)");
        fireEvent.click(bold);
        await user.keyboard("x");
        await waitFor(() => {
            expect(container.querySelector(".rich-editor-prose strong")).not.toBeNull();
        });
    });

    it("renders a hidden file input for image upload", async () => {
        const { container } = render(<RichEditor onUploadImage={vi.fn()} />);
        await waitForToolbar();
        const input = container.querySelector('input[type="file"]');
        expect(input).not.toBeNull();
        expect(input).toHaveAttribute("accept", "image/*");
    });

    it("shows the drop overlay when files are dragged over the editor", async () => {
        const { container } = render(
            <RichEditor onUploadImage={vi.fn()} accentColor="#ff0000" />,
        );
        await waitForToolbar();
        const root = container.querySelector(".relative.flex.flex-col") as HTMLElement;
        fireEvent.dragEnter(root, { dataTransfer: { types: ["Files"] } });
        await waitFor(() => {
            expect(screen.getByText(/Drop image to add/)).toBeInTheDocument();
        });
    });

    it("does not show the drop overlay for a non-file drag (internal move)", async () => {
        const { container } = render(<RichEditor onUploadImage={vi.fn()} />);
        await waitForToolbar();
        const root = container.querySelector(".relative.flex.flex-col") as HTMLElement;
        fireEvent.dragEnter(root, { dataTransfer: { types: ["text/html"] } });
        expect(screen.queryByText(/Drop image to add/)).toBeNull();
    });

    it("hides the drop overlay after a drag leave balances the enter", async () => {
        const { container } = render(<RichEditor onUploadImage={vi.fn()} />);
        await waitForToolbar();
        const root = container.querySelector(".relative.flex.flex-col") as HTMLElement;
        fireEvent.dragEnter(root, { dataTransfer: { types: ["Files"] } });
        await waitFor(() => expect(screen.getByText(/Drop image to add/)).toBeInTheDocument());
        fireEvent.dragLeave(root, { dataTransfer: { types: ["Files"] } });
        await waitFor(() => expect(screen.queryByText(/Drop image to add/)).toBeNull());
    });

    it("applies the accent color CSS variable on the editor root", async () => {
        const { container } = render(<RichEditor accentColor="#ff0000" />);
        await waitForToolbar();
        const root = container.querySelector(".rich-editor-root") as HTMLElement;
        expect(root.style.getPropertyValue("--rich-accent")).toBe("#ff0000");
    });

    it("prompts for a URL when the Link button is clicked", async () => {
        const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("https://x.test");
        const user = userEvent.setup();
        const { container } = render(<RichEditor autoFocus />);
        await waitForToolbar();
        const prose = container.querySelector(".rich-editor-prose") as HTMLElement;
        await user.click(prose);
        fireEvent.click(screen.getByTitle("Link"));
        expect(promptSpy).toHaveBeenCalled();
        promptSpy.mockRestore();
    });
});
