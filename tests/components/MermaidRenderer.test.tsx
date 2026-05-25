// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, userEvent } from "./helpers";
import { MermaidRenderer } from "@/components/MermaidRenderer";

// mermaid does real layout/measuring that jsdom can't do, so stub it. render()
// returns a tiny SVG with a viewBox so the size-parsing branch runs.
const renderMock = vi.fn();
vi.mock("mermaid", () => ({
    default: {
        initialize: vi.fn(),
        render: (...args: unknown[]) => renderMock(...args),
    },
}));

beforeEach(() => {
    renderMock.mockReset();
    renderMock.mockResolvedValue({
        svg: '<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%"/><g class="node"><rect/><text>A</text></g></svg>',
    });
});

const FLOW = "flowchart TD\nA-->B";

describe("MermaidRenderer", () => {
    it("renders the diagram canvas with the zoom toolbar when showCode is false", async () => {
        render(<MermaidRenderer code={FLOW} showCode={false} />);
        // Fit button + zoom presets prove the toolbar mounted.
        expect(screen.getByRole("button", { name: "Fit" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "100%" })).toBeInTheDocument();
        await waitFor(() => expect(renderMock).toHaveBeenCalled());
    });

    it("passes the trimmed code to mermaid.render", async () => {
        render(<MermaidRenderer code={"  " + FLOW + "  "} showCode={false} />);
        await waitFor(() => expect(renderMock).toHaveBeenCalled());
        const [, codeArg] = renderMock.mock.calls[0];
        expect(codeArg).toBe(FLOW);
    });

    it("shows an error pane when mermaid.render rejects", async () => {
        renderMock.mockRejectedValueOnce(new Error("Parse error on line 1"));
        render(<MermaidRenderer code={FLOW} showCode={false} />);
        await waitFor(() => {
            expect(screen.getByText(/Parse error on line 1/)).toBeInTheDocument();
        });
    });

    it("does not call mermaid.render for blank code", async () => {
        render(<MermaidRenderer code={"   "} showCode={false} />);
        // Give effects a tick to flush.
        await Promise.resolve();
        expect(renderMock).not.toHaveBeenCalled();
    });

    it("renders a code editor textarea when showCode is true", () => {
        const { container } = render(<MermaidRenderer code={FLOW} showCode={true} />);
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        expect(ta).not.toBeNull();
        expect(ta.value).toBe(FLOW);
        // In code mode mermaid should not be invoked.
        expect(renderMock).not.toHaveBeenCalled();
    });

    it("fires onChange when editing the code textarea", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        const { container } = render(
            <MermaidRenderer code={""} showCode={true} onChange={onChange} />,
        );
        const ta = container.querySelector("textarea") as HTMLTextAreaElement;
        await user.type(ta, "pie");
        expect(onChange).toHaveBeenCalled();
    });

    it("renders syntax-highlighted code in the hidden <pre> overlay", () => {
        const { container } = render(
            <MermaidRenderer code={"flowchart TD"} showCode={true} />,
        );
        const pre = container.querySelector("pre");
        expect(pre).not.toBeNull();
        // The keyword "flowchart" gets wrapped in a colored span.
        expect(pre?.querySelector("span")).not.toBeNull();
    });

    it("zooms out when the minus button is clicked (toggles off Fit)", async () => {
        const { container } = render(<MermaidRenderer code={FLOW} showCode={false} />);
        await waitFor(() => expect(renderMock).toHaveBeenCalled());
        const fit = screen.getByRole("button", { name: "Fit" });
        const minus = screen.getByRole("button", { name: "−" });
        fireEvent.click(minus);
        // After an explicit zoom the percentage label (a <span>, not a button)
        // still renders and the Fit button is still mounted.
        const pctLabel = container.querySelector("span.tabular-nums");
        expect(pctLabel?.textContent).toMatch(/%$/);
        expect(fit).toBeInTheDocument();
    });

    it("applies a zoom preset when its button is clicked", async () => {
        const { container } = render(<MermaidRenderer code={FLOW} showCode={false} />);
        await waitFor(() => expect(renderMock).toHaveBeenCalled());
        fireEvent.click(screen.getByRole("button", { name: "200%" }));
        // The label span (not the preset button) reflects the active scale.
        const pctLabel = container.querySelector("span.tabular-nums");
        expect(pctLabel?.textContent).toBe("200%");
    });

    it("re-renders the diagram when the code prop changes", async () => {
        const { rerender } = render(<MermaidRenderer code={FLOW} showCode={false} />);
        await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(1));
        rerender(<MermaidRenderer code={"sequenceDiagram\nA->>B: hi"} showCode={false} />);
        await waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
    });

    it("accepts the light theme without crashing", async () => {
        render(<MermaidRenderer code={FLOW} showCode={false} theme="light" />);
        await waitFor(() => expect(renderMock).toHaveBeenCalled());
        expect(screen.getByRole("button", { name: "Fit" })).toBeInTheDocument();
    });

    it("accepts the monokai theme without crashing", async () => {
        render(<MermaidRenderer code={"pie\n\"A\": 1"} showCode={false} theme="monokai" />);
        await waitFor(() => expect(renderMock).toHaveBeenCalled());
        expect(screen.getByRole("button", { name: "Fit" })).toBeInTheDocument();
    });
});
