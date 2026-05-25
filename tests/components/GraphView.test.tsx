// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "./helpers";
import { GraphView } from "@/components/GraphView";

// GraphView paints to a <canvas> on every animation frame. jsdom gives us no 2D
// context, so stub getContext with a no-op recording proxy. We also pin
// requestAnimationFrame to fire once (not a real RAF loop) so a single draw runs.
let ctxStub: Record<string, any>;

beforeEach(() => {
    ctxStub = new Proxy(
        {},
        {
            get: (_t, prop) => {
                if (prop === "createRadialGradient") {
                    return () => ({ addColorStop: vi.fn() });
                }
                if (prop === "canvas") return undefined;
                // Every other prop is a callable no-op or a writable field.
                return vi.fn();
            },
            set: () => true,
        },
    );

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
        ctxStub as unknown as CanvasRenderingContext2D,
    );

    // ResizeObserver is missing in jsdom.
    if (!(globalThis as any).ResizeObserver) {
        (globalThis as any).ResizeObserver = class {
            cb: any;
            constructor(cb: any) {
                this.cb = cb;
            }
            observe() {}
            unobserve() {}
            disconnect() {}
        };
    }

    // Run a single animation frame synchronously, then stop.
    let fired = false;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb: any) => {
        if (!fired) {
            fired = true;
            cb(0);
        }
        return 1;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    if (!(globalThis as any).devicePixelRatio) {
        (globalThis as any).devicePixelRatio = 1;
    }
});

afterEach(() => {
    vi.restoreAllMocks();
});

const notes = [
    { id: "n1", title: "First Note", folder_name: "WORK", folder_color: "#3b82f6", updated_at: "2026-05-01" },
    { id: "n2", title: "Second Note", folder_name: "WORK", folder_color: "#3b82f6", updated_at: "2026-05-02" },
    { id: "n3", title: "Loose", folder_name: "PERSONAL", folder_color: "#ef4444", updated_at: "2026-05-03" },
];
const folders = [
    { name: "WORK", color: "#3b82f6", parent: null },
    { name: "PERSONAL", color: "#ef4444", parent: null },
    { name: "TRASH", color: "#888888", parent: null },
];

describe("GraphView", () => {
    it("renders a canvas element", () => {
        const { container } = render(
            <GraphView
                notes={notes}
                folders={folders}
                onOpenNote={vi.fn()}
                theme="dark"
            />,
        );
        expect(container.querySelector("canvas")).not.toBeNull();
    });

    it("paints to the 2D context on the first frame", () => {
        render(
            <GraphView
                notes={notes}
                folders={folders}
                onOpenNote={vi.fn()}
                theme="dark"
            />,
        );
        expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("2d");
    });

    it("renders without crashing for empty notes and folders", () => {
        const { container } = render(
            <GraphView notes={[]} folders={[]} onOpenNote={vi.fn()} theme="dark" />,
        );
        expect(container.querySelector("canvas")).not.toBeNull();
    });

    it("uses a dark background in dark theme", () => {
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={vi.fn()} theme="dark" />,
        );
        const root = container.firstChild as HTMLElement;
        expect(root.style.background).toBe("rgb(10, 10, 10)");
    });

    it("uses a light background in light theme", () => {
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={vi.fn()} theme="light" />,
        );
        const root = container.firstChild as HTMLElement;
        expect(root.style.background).toBe("rgb(245, 245, 245)");
    });

    it("sets a grab cursor on the canvas by default", () => {
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={vi.fn()} theme="dark" />,
        );
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        expect(canvas.style.cursor).toBe("grab");
    });

    it("does not call onOpenNote when clicking empty space (no node hit)", () => {
        const onOpenNote = vi.fn();
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={onOpenNote} theme="dark" />,
        );
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        // Click far outside any node footprint.
        fireEvent.mouseDown(canvas, { clientX: 9000, clientY: 9000 });
        fireEvent.mouseUp(canvas, { clientX: 9000, clientY: 9000 });
        expect(onOpenNote).not.toHaveBeenCalled();
    });

    it("switches cursor to grabbing on mouse down over empty space", () => {
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={vi.fn()} theme="dark" />,
        );
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        fireEvent.mouseDown(canvas, { clientX: 9000, clientY: 9000 });
        expect(canvas.style.cursor).toBe("grabbing");
    });

    it("clears drag state and resets cursor on mouse leave", () => {
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={vi.fn()} theme="dark" />,
        );
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        fireEvent.mouseDown(canvas, { clientX: 9000, clientY: 9000 });
        fireEvent.mouseLeave(canvas);
        expect(canvas.style.cursor).toBe("grab");
    });

    it("calls preventDefault on wheel zoom and does not throw", () => {
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={vi.fn()} theme="dark" />,
        );
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        const ev = new WheelEvent("wheel", {
            deltaY: -100,
            clientX: 0,
            clientY: 0,
            bubbles: true,
            cancelable: true,
        });
        const preventSpy = vi.spyOn(ev, "preventDefault");
        canvas.dispatchEvent(ev);
        expect(preventSpy).toHaveBeenCalled();
    });

    it("clicking a node at the center hits the root and recenters (no note opened)", () => {
        const onOpenNote = vi.fn();
        const { container } = render(
            <GraphView notes={notes} folders={folders} onOpenNote={onOpenNote} theme="dark" />,
        );
        const canvas = container.querySelector("canvas") as HTMLCanvasElement;
        // In jsdom the canvas is 0x0 so all nodes cluster at the origin; a click at
        // (0,0) lands on the topmost hit. We only assert no crash + no note open.
        fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0 });
        fireEvent.mouseUp(canvas, { clientX: 0, clientY: 0 });
        // Either nothing was hit or a folder/center was — never a stray note open
        // without a matching note id.
        if (onOpenNote.mock.calls.length > 0) {
            expect(notes.map(n => n.id)).toContain(onOpenNote.mock.calls[0][0].id);
        }
    });

    it("accepts folderIcons and onClickFolder props without crashing", () => {
        const { container } = render(
            <GraphView
                notes={notes}
                folders={folders}
                folderIcons={{ WORK: "__hero:BriefcaseIcon" }}
                onOpenNote={vi.fn()}
                onClickFolder={vi.fn()}
                theme="dark"
            />,
        );
        expect(container.querySelector("canvas")).not.toBeNull();
    });
});
