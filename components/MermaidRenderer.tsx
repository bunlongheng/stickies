"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";

let initialized = false;

interface Props {
    code: string;
    onChange?: (code: string) => void;
    showCode: boolean;
    theme?: "dark" | "light" | "monokai";
}

// ── Palette & themes ──────────────────────────────────────────────────────────
const PAL         = ["#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6","#8b5cf6","#ec4899","#f43f5e","#84cc16","#0891b2"];
const PAL_MONOKAI = ["#ab9df2","#78dce8","#a9dc76","#ffd866","#fc9867","#f92672","#ff6da2","#23bbad","#25d9c8","#c678dd"];

const THEMES: Record<string, { bg: string; canvasBg: string; titleFill: string; plainTextFill: string; edgeStroke: string; labelFill: string }> = {
    dark:    { bg: "#16161e", canvasBg: "#252636", titleFill: "#c0caf5", plainTextFill: "#c0caf5", edgeStroke: "#64748b", labelFill: "#ffffff" },
    monokai: { bg: "#2C2B2F", canvasBg: "#39383C", titleFill: "#f8f8f2", plainTextFill: "#f8f8f2", edgeStroke: "#75715e", labelFill: "#2C2B2F" },
    light:   { bg: "#ffffff", canvasBg: "#c8d0da", titleFill: "#1e293b", plainTextFill: "#1e293b", edgeStroke: "#94a3b8", labelFill: "#000000" },
};

const NODE_SELECTOR_MAP: Record<string, string> = {
    flowchart: ".node",
    class:     ".classGroup",
    er:        ".node",
    state:     ".node",
    gantt:     ".task",
    pie:       ".slice",
    git:       ".commit-bullet",
    mindmap:   ".mindmap-node",
    timeline:  ".timeline-event",
    quadrant:  ".quadrant-point",
};

const DIAGRAM_TYPES: Record<string, string> = {
    sequencediagram: "sequence",
    graph:           "flowchart",
    flowchart:       "flowchart",
    classdiagram:    "class",
    erdiagram:       "er",
    statediagram:    "state",
    "statediagram-v2": "state",
    gantt:           "gantt",
    pie:             "pie",
    journey:         "journey",
    gitgraph:        "git",
    mindmap:         "mindmap",
    timeline:        "timeline",
    quadrantchart:   "quadrant",
    xychart:         "xychart",
    "xychart-beta":  "xychart",
};

function detectDiagramType(code: string): string {
    const first = code.trim().split("\n")[0].trim().toLowerCase().replace(/\s+.*$/, "");
    return DIAGRAM_TYPES[first] ?? "flowchart";
}

function applyColorfulMermaidStyle(svgString: string, diagramType: string, themeName: string): string {
    if (typeof window === "undefined") return svgString;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return svgString;

    const th = THEMES[themeName] ?? THEMES.dark;
    const pal = themeName === "monokai" ? PAL_MONOKAI : PAL;
    const f = `'Inter', ui-sans-serif, system-ui, sans-serif`;

    // These types rely on their CSS for structural rendering — keep their styles
    const CSS_KEEP = new Set(["git", "timeline", "kanban", "sankey", "packet", "radar", "treemap"]);
    if (!CSS_KEEP.has(diagramType)) {
        doc.querySelectorAll("style").forEach(s => s.remove());
    }

    // Background
    const rootBg = svgEl.querySelector(":scope > rect");
    if (rootBg) {
        (rootBg as SVGElement).style.fill = th.bg;
    } else {
        const bgRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
        bgRect.setAttribute("x", "0"); bgRect.setAttribute("y", "0");
        bgRect.setAttribute("width", "100%"); bgRect.setAttribute("height", "100%");
        bgRect.style.fill = th.bg;
        svgEl.insertBefore(bgRect, svgEl.firstChild);
    }

    // CSS for foreignObject content
    const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = `
        /* Baseline — all SVG text visible on dark bg */
        text, tspan { fill: ${th.plainTextFill} !important; font-family: ${f} !important; }
        /* All lines/paths visible */
        line { stroke: ${th.edgeStroke} !important; stroke-width: 1.5px !important; }
        path { stroke: ${th.edgeStroke}; }
        /* Node labels inside foreignObject */
        .node foreignObject div, .node foreignObject span, .node foreignObject p,
        .node .nodeLabel, .node .label div, .node .label p, .node .label span,
        .classGroup foreignObject div, .classGroup foreignObject span {
            color: ${th.labelFill} !important;
            font-weight: 700 !important;
            font-family: ${f} !important;
        }
        /* Edge labels */
        .edgeLabel foreignObject div, .edgeLabel .label {
            color: ${th.plainTextFill} !important;
            background: transparent !important;
            font-family: ${f} !important;
        }
        /* Sequence diagram */
        .messageText, .labelText, .loopText, .noteText { fill: ${th.plainTextFill} !important; font-weight: 600 !important; }
        .sequenceNumber { fill: ${th.labelFill} !important; }
        .loopLine { stroke: ${th.edgeStroke} !important; }
        .note { fill: ${th.bg} !important; stroke: ${th.edgeStroke} !important; }
    `;
    svgEl.insertBefore(styleEl, svgEl.firstChild);

    // Color each node
    const nodeSelector = NODE_SELECTOR_MAP[diagramType] ?? ".node";
    const nodes = Array.from(doc.querySelectorAll(nodeSelector));
    nodes.forEach((node, i) => {
        const color = pal[i % pal.length];

        node.querySelectorAll("rect").forEach(el => {
            const r = el as SVGElement;
            r.style.fill = color;
            r.style.stroke = "none";
            r.setAttribute("rx", "8"); r.setAttribute("ry", "8");
        });
        node.querySelectorAll("polygon").forEach(el => {
            const p = el as SVGElement;
            p.style.fill = color; p.style.stroke = "none";
        });
        node.querySelectorAll("circle, ellipse").forEach(el => {
            const c = el as SVGElement;
            c.style.fill = color; c.style.stroke = "none";
        });
        node.querySelectorAll("path.basic, path.label-container, path.outer").forEach(el => {
            const p = el as SVGElement;
            p.style.fill = color; p.style.stroke = "none";
        });
        node.querySelectorAll("text, tspan").forEach(el => {
            const t = el as SVGElement;
            t.style.fill = th.labelFill;
            t.style.fontWeight = "700";
            t.style.fontFamily = f;
        });
    });

    // Pie slices
    if (diagramType === "pie") {
        doc.querySelectorAll("path.slice, .pieSlice, .slice, path[class*='slice']").forEach((el, i) => {
            const s = el as SVGElement;
            s.style.fill = pal[i % pal.length];
            s.style.stroke = th.bg;
            s.style.strokeWidth = "2";
        });
    }

    // Sequence: color actor boxes
    if (diagramType === "sequence") {
        const actors = Array.from(doc.querySelectorAll(".actor, .actor-box, .actor-man, rect.actor"));
        actors.forEach((el, i) => {
            const r = el as SVGElement;
            r.style.fill = pal[i % pal.length];
            r.style.stroke = "none";
        });
        doc.querySelectorAll(".loopLine, .loopText rect, .labelBox").forEach((el, i) => {
            (el as SVGElement).style.fill = pal[i % pal.length];
            (el as SVGElement).style.stroke = "none";
        });
        doc.querySelectorAll(".actor text, .actor tspan").forEach(el => {
            const t = el as SVGElement;
            t.style.fill = th.labelFill;
            t.style.fontWeight = "700";
        });
        // Lifelines
        doc.querySelectorAll(".lifeLine, line.actor-line").forEach(el => {
            (el as SVGElement).style.stroke = th.edgeStroke;
            (el as SVGElement).style.strokeWidth = "1.5";
        });
        // Message arrows
        doc.querySelectorAll(".messageLine0, .messageLine1, line[class*='message']").forEach(el => {
            (el as SVGElement).style.stroke = th.edgeStroke;
            (el as SVGElement).style.strokeWidth = "1.5";
        });
    }

    // Edge paths
    doc.querySelectorAll(".edgePath path, .flowchart-link, .transition").forEach(el => {
        const e = el as SVGElement;
        e.style.stroke = th.edgeStroke;
        e.style.strokeWidth = "1.5";
        e.style.fill = "none";
    });

    // Arrowheads
    doc.querySelectorAll("marker polygon, marker path, marker circle").forEach(el => {
        const m = el as SVGElement;
        m.style.fill = th.edgeStroke;
        m.style.stroke = "none";
    });

    // All SVG text not inside nodes — titles, axis labels, etc.
    doc.querySelectorAll(".titleText, .sectionTitle, .actor-top text, .actor-bottom text").forEach(el => {
        const t = el as SVGElement;
        t.style.fill = th.titleFill;
        t.style.fontFamily = f;
    });

    return new XMLSerializer().serializeToString(doc);
}

// ── Monokai syntax highlighter ─────────────────────────────────────────────────
function highlightMermaid(code: string): string {
    const lines = code.split("\n");
    return lines.map(line => {
        let l = escHtml(line);
        l = l.replace(
            /\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart|quadrantChart|requirementDiagram|zenuml|sankey|block-beta|subgraph|end|direction|participant|actor|activate|deactivate|loop|alt|else|opt|par|and|critical|break|rect|note|over|section|title|accTitle|accDescr|class|style|classDef|click|callback|call|href|interpolate|dateFormat|axisFormat|todayMarker|tickInterval|weekday|excludes|includes|milestone)\b/g,
            '<span style="color:#66d9e8;font-weight:700">$1</span>'
        );
        l = l.replace(/\b(TD|TB|BT|RL|LR|DT)\b/g, '<span style="color:#ae81ff">$1</span>');
        l = l.replace(
            /(-{1,3}&gt;|={2,3}&gt;|-\.-&gt;|&lt;-{1,3}|&lt;={2,3}|---+|\.\.\.+|-{1,3})/g,
            '<span style="color:#f92672">$&</span>'
        );
        l = l.replace(/(\[|\]|\(|\)|\{|\})/g, '<span style="color:#fd971f">$1</span>');
        l = l.replace(/(&quot;[^&]*&quot;|&#x27;[^&#]*&#x27;)/g, '<span style="color:#e6db74">$1</span>');
        l = l.replace(/\b([A-Za-z_][A-Za-z0-9_]*)(?=\s*[\[({>]|\s*--)/g, '<span style="color:#a6e22e">$1</span>');
        l = l.replace(/(%%.*$)/g, '<span style="color:#75715e;font-style:italic">$1</span>');
        l = l.replace(/\b(\d+(\.\d+)?)\b/g, '<span style="color:#ae81ff">$1</span>');
        return l;
    }).join("\n");
}

function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

const ZOOM_PRESETS = [50, 75, 100, 150, 200];

export function MermaidRenderer({ code, onChange, showCode, theme = "dark" }: Props) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [isFit, setIsFit] = useState(true);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [svgSize, setSvgSize] = useState<{ w: number; h: number } | null>(null);
    const dragging = useRef(false);
    const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
    const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2)}`);

    useEffect(() => {
        if (!initialized) {
            mermaid.initialize({
                startOnLoad: false,
                theme: "base",
                fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                fontSize: 13,
                themeVariables: {
                    background: "#16161e",
                    primaryColor: PAL[0],
                    primaryTextColor: "#ffffff",
                    primaryBorderColor: "none",
                    lineColor: "#64748b",
                    secondaryColor: PAL[1],
                    tertiaryColor: PAL[2],
                    edgeLabelBackground: "transparent",
                    clusterBkg: "#1e1e2e",
                    titleColor: "#c0caf5",
                    nodeTextColor: "#ffffff",
                },
            });
            initialized = true;
        }
    }, []);

    // Sync textarea scroll to pre highlight
    const syncScroll = useCallback(() => {
        if (preRef.current && textareaRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    useEffect(() => {
        if (showCode) return;
        if (!wrapRef.current || !code.trim()) return;
        const id = idRef.current;
        setError(null);

        (async () => {
            try {
                const { svg } = await mermaid.render(id, code.trim());
                if (!wrapRef.current) return;

                // Apply colorful post-processing
                const diagramType = detectDiagramType(code);
                const coloredSvg = applyColorfulMermaidStyle(svg, diagramType, theme);

                wrapRef.current.innerHTML = coloredSvg;
                const svgEl = wrapRef.current.querySelector("svg");
                if (!svgEl) return;

                // Parse natural size from viewBox
                const vb = svgEl.getAttribute("viewBox");
                if (vb) {
                    const [, , vbW, vbH] = vb.split(" ").map(Number);
                    if (vbW > 0 && vbH > 0) setSvgSize({ w: vbW, h: vbH });
                }

                // Leave width/height unset here — the scale effect below will set them
                svgEl.style.width = "";
                svgEl.style.height = "";
                svgEl.style.display = "block";
                // Reset to fit on new render
                setIsFit(true);
                setZoom(1);
                setPan({ x: 0, y: 0 });
            } catch (err: any) {
                setError(String(err?.message ?? err));
            }
        })();
    }, [code, showCode, theme]);

    // Compute actual scale for fit mode
    const getFitScale = useCallback(() => {
        if (!canvasRef.current || !svgSize) return 1;
        const { clientWidth: cw, clientHeight: ch } = canvasRef.current;
        const scaleX = (cw - 32) / svgSize.w;
        const scaleY = (ch - 32) / svgSize.h;
        // Wide diagrams (gitGraph, gantt, timeline): fit to height, pan horizontally
        const wide = svgSize.w > svgSize.h * 2.5;
        return wide ? Math.min(scaleY, 1.5) : Math.min(scaleX, scaleY);
    }, [svgSize]);

    const activeScale = isFit ? getFitScale() : zoom;
    const displayPct = Math.round(activeScale * 100);

    // Resize SVG directly (no CSS transform scale) so foreignObject re-renders crisply
    useEffect(() => {
        if (!wrapRef.current || !svgSize || activeScale <= 0) return;
        const svgEl = wrapRef.current.querySelector("svg");
        if (!svgEl) return;
        svgEl.setAttribute("width",  String(Math.round(svgSize.w * activeScale)));
        svgEl.setAttribute("height", String(Math.round(svgSize.h * activeScale)));
    }, [activeScale, svgSize]);

    const applyZoom = (scale: number) => {
        setIsFit(false);
        setZoom(Math.max(0.1, Math.min(4, scale)));
    };

    const applyFit = () => {
        setIsFit(true);
        setZoom(getFitScale());
        setPan({ x: 0, y: 0 });
    };

    // Mouse pan
    const onMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        dragging.current = true;
        dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
        e.preventDefault();
    };
    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging.current) return;
        setPan({
            x: dragStart.current.px + (e.clientX - dragStart.current.mx),
            y: dragStart.current.py + (e.clientY - dragStart.current.my),
        });
    }, []);
    const onMouseUp = useCallback(() => { dragging.current = false; }, []);

    useEffect(() => {
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
    }, [onMouseMove, onMouseUp]);

    // Scroll to zoom
    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        applyZoom(activeScale + delta);
    };

    const canvasBg = THEMES[theme]?.canvasBg ?? "#252636";

    if (!showCode) {
        if (error) {
            return (
                <div className="flex-1 overflow-auto p-6">
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap bg-red-950/20 border border-red-900/40 p-4">{error}</pre>
                </div>
            );
        }
        return (
            <div ref={canvasRef} className="flex-1 min-h-0 relative overflow-hidden select-none"
                style={{ background: canvasBg, cursor: dragging.current ? "grabbing" : "grab" }}
                onMouseDown={onMouseDown}
                onWheel={onWheel}
            >
                {/* Diagram */}
                <div style={{
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
                    transition: dragging.current ? "none" : "transform 0.15s ease",
                }}>
                    <div ref={wrapRef} />
                </div>

                {/* Zoom toolbar */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0 pointer-events-auto"
                    style={{ background: "rgba(240,240,245,0.96)", borderRadius: 999, boxShadow: "0 2px 16px rgba(0,0,0,0.25)", padding: "0 6px" }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <button onClick={() => applyZoom(activeScale - 0.1)}
                        className="w-9 h-9 flex items-center justify-center text-[18px] font-light text-zinc-500 hover:text-zinc-900 transition">−</button>

                    <span className="text-[13px] font-semibold text-zinc-700 w-10 text-center tabular-nums">{displayPct}%</span>

                    <button onClick={() => applyZoom(activeScale + 0.1)}
                        className="w-9 h-9 flex items-center justify-center text-[18px] font-light text-zinc-500 hover:text-zinc-900 transition">+</button>

                    <div className="w-px h-5 bg-zinc-300 mx-1" />

                    {ZOOM_PRESETS.map(p => (
                        <button key={p} onClick={() => applyZoom(p / 100)}
                            className="px-2.5 h-9 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 transition">
                            {p}%
                        </button>
                    ))}

                    <div className="w-px h-5 bg-zinc-300 mx-1" />

                    <button onClick={applyFit}
                        className="px-3 h-9 text-[12px] font-semibold transition"
                        style={isFit ? { background: "#1a1a2e", color: "#fff", borderRadius: 999 } : { color: "#71717a" }}>
                        Fit
                    </button>

                    <div className="w-px h-5 bg-zinc-300 mx-1" />

                    <button title="Scroll to zoom · Drag to pan"
                        className="w-8 h-8 rounded-full border border-zinc-300 flex items-center justify-center text-[12px] font-semibold text-zinc-500 hover:text-zinc-900 transition mr-1">?</button>
                </div>
            </div>
        );
    }

    // Code view with monokai syntax highlighting
    return (
        <div className="flex-1 min-h-0 relative" style={{ background: "#272822", overflow: "hidden" }}>
            <pre
                ref={preRef}
                aria-hidden
                className="absolute inset-0 m-0 p-4 sm:p-6 font-mono text-xs leading-relaxed overflow-auto pointer-events-none select-none whitespace-pre"
                style={{ background: "transparent", color: "#f8f8f2", tabSize: 2 }}
                dangerouslySetInnerHTML={{ __html: highlightMermaid(code) + "\n" }}
            />
            <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => onChange?.(e.target.value)}
                onScroll={syncScroll}
                className="absolute inset-0 w-full h-full p-4 sm:p-6 font-mono text-xs leading-relaxed resize-none outline-none border-none"
                style={{ background: "transparent", color: "transparent", caretColor: "#f8f8f2", tabSize: 2, WebkitTextFillColor: "transparent", WebkitOverflowScrolling: "touch", overflowY: "scroll" }}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
            />
        </div>
    );
}
