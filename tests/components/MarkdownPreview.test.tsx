// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "./helpers";
import { MarkdownPreview, MarkdownWithMermaid } from "@/components/MarkdownPreview";

// MarkdownPreview lazily pulls in MermaidRenderer (via next/dynamic) for
// ```mermaid blocks. Mermaid does not run in jsdom, so stub it out — the
// segments we test here are still routed correctly.
vi.mock("mermaid", () => ({
    default: {
        initialize: vi.fn(),
        render: vi.fn().mockResolvedValue({ svg: "<svg></svg>" }),
    },
}));

describe("MarkdownPreview", () => {
    it("renders markdown headings and paragraphs as HTML", () => {
        render(<MarkdownPreview content={"# Title\n\nHello **world**"} />);
        expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
        expect(screen.getByText("world")).toBeInTheDocument();
    });

    it("renders an empty container for empty content without crashing", () => {
        const { container } = render(<MarkdownPreview content={""} />);
        expect(container).toBeInTheDocument();
    });

    it("renders bold text in a <strong> element", () => {
        render(<MarkdownPreview content={"Hello **world**"} />);
        const strong = screen.getByText("world");
        expect(strong.tagName).toBe("STRONG");
    });

    it("renders inline code without surrounding backticks", () => {
        const { container } = render(<MarkdownPreview content={"Run `npm test` now"} />);
        const code = container.querySelector("code");
        expect(code).not.toBeNull();
        expect(code?.textContent).toBe("npm test");
    });

    it("renders links with target=_blank and rel=noopener", () => {
        const { container } = render(<MarkdownPreview content={"[click](https://example.com)"} />);
        const link = container.querySelector("a");
        expect(link).not.toBeNull();
        expect(link?.getAttribute("href")).toBe("https://example.com");
        expect(link?.getAttribute("target")).toBe("_blank");
        expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("renders fenced code blocks inside the code-block wrapper with a Copy button", () => {
        const { container } = render(<MarkdownPreview content={"```js\nconst x = 1;\n```"} />);
        expect(container.querySelector(".code-block-wrapper")).not.toBeNull();
        expect(container.querySelector(".copy-code-btn")).not.toBeNull();
        expect(container.querySelector(".code-lang-badge")?.textContent).toBe("js");
    });

    it("renders unordered lists", () => {
        const { container } = render(<MarkdownPreview content={"- one\n- two\n- three"} />);
        const items = container.querySelectorAll("li");
        expect(items.length).toBe(3);
        expect(items[0].textContent).toContain("one");
    });

    it("renders a GitHub-style alert callout via preprocessAlerts", () => {
        const { container } = render(
            <MarkdownPreview content={"> [!WARNING]\n> Be careful here"} />,
        );
        const alert = container.querySelector(".md-alert");
        expect(alert).not.toBeNull();
        expect(alert?.textContent).toContain("Warning");
        expect(alert?.textContent).toContain("Be careful here");
    });

    it("renders the mermaid diagram segment container for a mermaid fence", () => {
        const { container } = render(
            <MarkdownPreview content={"```mermaid\nflowchart TD\nA-->B\n```"} />,
        );
        // The diagram segment wraps the lazy DiagramRenderer in a min-height box.
        const diagramWrap = container.querySelector('[style*="min-height"]');
        expect(diagramWrap).not.toBeNull();
    });

    it("treats a mermaid fence without a diagram keyword as plain markdown", () => {
        const { container } = render(
            <MarkdownPreview content={"```mermaid\njust some text\n```"} />,
        );
        // No diagram keyword -> falls back to a normal code block, not a diagram box.
        expect(container.querySelector(".code-block-wrapper")).not.toBeNull();
    });

    it("accepts the theme prop without crashing", () => {
        const { container } = render(
            <MarkdownPreview content={"# Light"} theme="light" />,
        );
        expect(screen.getByRole("heading", { name: "Light" })).toBeInTheDocument();
        expect(container).toBeInTheDocument();
    });

    it("exposes MarkdownWithMermaid as an alias of MarkdownPreview", () => {
        expect(MarkdownWithMermaid).toBe(MarkdownPreview);
    });
});
