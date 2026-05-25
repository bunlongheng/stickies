// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, userEvent } from "./helpers";
import { CodeViewer } from "@/components/CodeViewer";

// jsdom has no ResizeObserver (used only in wordWrap mode) and no
// Element.scrollTo (used to scroll the active search match into view).
beforeEach(() => {
    if (!(globalThis as any).ResizeObserver) {
        (globalThis as any).ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }
    if (!(Element.prototype as any).scrollTo) {
        (Element.prototype as any).scrollTo = () => {};
    }
});

describe("CodeViewer", () => {
    it("renders a textarea editor with the given code", () => {
        const { container } = render(
            <CodeViewer code={"const x = 1;"} language="javascript" editing={false} />,
        );
        const ta = container.querySelector("textarea");
        expect(ta).not.toBeNull();
        expect((ta as HTMLTextAreaElement).value).toBe("const x = 1;");
    });

    it("renders one gutter number per line of code", () => {
        const { container } = render(
            <CodeViewer code={"a\nb\nc\nd"} language="text" editing={false} />,
        );
        const gutter = container.querySelector('[aria-hidden]');
        expect(gutter?.textContent).toContain("1");
        expect(gutter?.textContent).toContain("4");
    });

    it("marks the textarea readOnly when not editing", () => {
        const { container } = render(
            <CodeViewer code={"x"} language="javascript" editing={false} />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        expect(ta).toHaveAttribute("readonly");
    });

    it("allows editing the textarea when editing is true", () => {
        const { container } = render(
            <CodeViewer code={"x"} language="javascript" editing={true} autoFocus={false} />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        expect(ta).not.toHaveAttribute("readonly");
    });

    it("fires onChange when typing while editing", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { container } = render(
            <CodeViewer
                code={""}
                language="javascript"
                editing={true}
                autoFocus={false}
                onChange={onChange}
            />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        await user.type(ta, "hi");
        expect(onChange).toHaveBeenCalled();
    });

    it("does not fire onChange when not editing", () => {
        const onChange = vi.fn();
        const { container } = render(
            <CodeViewer
                code={"x"}
                language="javascript"
                editing={false}
                onChange={onChange}
            />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        fireEvent.change(ta, { target: { value: "changed" } });
        expect(onChange).not.toHaveBeenCalled();
    });

    it("calls onClick when clicked while not editing", () => {
        const onClick = vi.fn();
        const { container } = render(
            <CodeViewer
                code={"x"}
                language="javascript"
                editing={false}
                onClick={onClick}
            />,
        );
        const root = container.firstChild as HTMLElement;
        fireEvent.click(root);
        expect(onClick).toHaveBeenCalled();
    });

    it("does not wire the container onClick while editing", () => {
        const onClick = vi.fn();
        const { container } = render(
            <CodeViewer
                code={"x"}
                language="javascript"
                editing={true}
                autoFocus={false}
                onClick={onClick}
            />,
        );
        const root = container.firstChild as HTMLElement;
        fireEvent.click(root);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("calls onBlur when the textarea loses focus", () => {
        const onBlur = vi.fn();
        const { container } = render(
            <CodeViewer
                code={"x"}
                language="javascript"
                editing={true}
                autoFocus={false}
                onBlur={onBlur}
            />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        fireEvent.blur(ta);
        expect(onBlur).toHaveBeenCalled();
    });

    it("reports the number of search matches via onSearchResults", async () => {
        const onSearchResults = vi.fn();
        render(
            <CodeViewer
                code={"foo bar foo baz foo"}
                language="text"
                editing={false}
                searchTerm="foo"
                onSearchResults={onSearchResults}
            />,
        );
        await waitFor(() => {
            expect(onSearchResults).toHaveBeenLastCalledWith(3);
        });
    });

    it("reports zero matches when the search term is absent", async () => {
        const onSearchResults = vi.fn();
        render(
            <CodeViewer
                code={"hello world"}
                language="text"
                editing={false}
                searchTerm="zzz"
                onSearchResults={onSearchResults}
            />,
        );
        await waitFor(() => {
            expect(onSearchResults).toHaveBeenLastCalledWith(0);
        });
    });

    it("escapes HTML in plain-text mode highlight without injecting markup", () => {
        const { container } = render(
            <CodeViewer code={"<script>&\"x\""} language="text" editing={false} />,
        );
        // No actual <script> tag should be present in the highlighted output.
        expect(container.querySelector("script")).toBeNull();
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        expect(ta.value).toContain("<script>");
    });

    it("handles empty code by rendering a single gutter line", () => {
        const { container } = render(
            <CodeViewer code={""} language="javascript" editing={false} />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        expect(ta.value).toBe("");
        const gutter = container.querySelector('[aria-hidden]');
        expect(gutter?.textContent).toContain("1");
    });

    it("renders in word-wrap mode without crashing", () => {
        const { container } = render(
            <CodeViewer
                code={"a very long line that should wrap around"}
                language="text"
                editing={false}
                wordWrap={true}
            />,
        );
        expect(container.querySelector(".code-viewer-wrap.word-wrap")).not.toBeNull();
    });

    it("falls back to javascript grammar for an unknown language", () => {
        const { container } = render(
            <CodeViewer code={"const x = 1;"} language="brainfuck" editing={false} />,
        );
        // Just verify it renders without throwing on the unknown language.
        expect(container.querySelector("textarea")).not.toBeNull();
    });
});
