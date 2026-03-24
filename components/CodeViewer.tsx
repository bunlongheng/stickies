"use client";
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-css";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";

// Custom Prism grammar for Mermaid
Prism.languages.mermaid = {
    comment:   { pattern: /%%.*$/m, greedy: true },
    string:    { pattern: /"[^"]*"/, greedy: true },
    keyword:   /\b(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|stateDiagram-v2|erDiagram|gantt|pie|mindmap|timeline|gitGraph|journey|xychart-beta|xychart|quadrantChart|requirementDiagram|block-beta|block|sankey-beta|sankey|packet-beta|packet|kanban|architecture-beta|architecture|radar-beta|radar|treemap|subgraph|end|direction|participant|actor|activate|deactivate|loop|alt|else|opt|par|and|critical|break|rect|note|over|section|title|accTitle|accDescr|style|classDef|click|dateFormat|axisFormat|todayMarker|tickInterval|excludes|includes|milestone|service|junction|edge|group|left|right|top|bottom)\b/,
    direction: /\b(?:TB|TD|BT|LR|RL|DT)\b/,
    arrow:     /--?>|===>?|-.->|<--?|<==|\.\.\.?>?|--/,
    bracket:   /[()[\]{}]/,
    label:     /\|[^|\n]*\|/,
    colon:     { pattern: /:/, alias: "punctuation" },
    number:    /\b\d+(?:\.\d+)?%?\b/,
};

const LANG_MAP: Record<string, string> = {
    javascript: "javascript",
    typescript: "typescript",
    python:     "python",
    css:        "css",
    sql:        "sql",
    bash:       "bash",
    json:       "json",
    html:       "markup",
    markdown:   "markdown",
    mermaid:    "mermaid",
};

const MONOKAI = `
.token{transition:none;color:#e8e8e8}
.token.comment,.token.prolog,.token.doctype,.token.cdata{color:#666}
/* Override iOS Safari font-size zoom and disable word wrap */
.code-viewer-wrap textarea,
.code-viewer-wrap pre {
  font-size: 13px !important;
  line-height: 19px !important;
  white-space: pre !important;
  overflow-wrap: normal !important;
  word-break: normal !important;
  -webkit-text-size-adjust: none !important;
}
/* Word-wrap mode */
.code-viewer-wrap.word-wrap textarea,
.code-viewer-wrap.word-wrap pre {
  white-space: pre-wrap !important;
  overflow-wrap: break-word !important;
  word-break: break-all !important;
}
`;

const GUTTER_W = 48; // px
const FONT_SIZE = 13;   // px — single source of truth
const LINE_HEIGHT = 19; // px — single source of truth
const PAD_TOP = 8;
const PAD_BOTTOM = 24;

interface Props {
    code: string;
    language: string;
    editing: boolean;
    autoFocus?: boolean;
    wordWrap?: boolean;
    searchTerm?: string;
    searchIndex?: number;
    onSearchResults?: (count: number) => void;
    onChange?: (val: string) => void;
    onBlur?: () => void;
    onClick?: () => void;
}

export function CodeViewer({ code, language, editing, autoFocus = true, wordWrap = false, searchTerm = "", searchIndex = 0, onSearchResults, onChange, onBlur, onClick }: Props) {
    const lang = language === "text" ? "text" : (LANG_MAP[language] ?? "javascript");
    const lines = (code || "").split("\n");
    const lineCount = lines.length;
    const [activeLine, setActiveLine] = useState<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Track container width for wrap row calculation
    useEffect(() => {
        if (!wordWrap) return;
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, [wordWrap]);

    // Calculate visual rows per logical line (for VS Code-style gutter in wrap mode)
    const visualRowsPerLine = wordWrap && containerWidth > 0
        ? lines.map(l => {
            const editorWidth = containerWidth - GUTTER_W - 20 - 24; // minus gutter, left/right pad
            const charsPerRow = Math.max(1, Math.floor(editorWidth / (FONT_SIZE * 0.6)));
            return Math.max(1, Math.ceil((l.length || 1) / charsPerRow));
          })
        : null;

    // Compute search matches from plain code string
    const searchMatches = useMemo(() => {
        if (!searchTerm) return [];
        const lower = code.toLowerCase();
        const term = searchTerm.toLowerCase();
        const matches: { start: number; end: number }[] = [];
        let idx = 0;
        while (true) {
            const pos = lower.indexOf(term, idx);
            if (pos === -1) break;
            matches.push({ start: pos, end: pos + term.length });
            idx = pos + term.length;
        }
        return matches;
    }, [code, searchTerm]);

    // Report match count to parent
    useEffect(() => {
        onSearchResults?.(searchMatches.length);
    }, [searchMatches.length, onSearchResults]);

    // Scroll active match into view
    useEffect(() => {
        if (!searchTerm || searchMatches.length === 0) return;
        const match = searchMatches[searchIndex] ?? searchMatches[0];
        if (!match) return;
        const lineNum = code.substring(0, match.start).split("\n").length - 1;
        const matchTop = PAD_TOP + lineNum * LINE_HEIGHT;
        const container = containerRef.current;
        if (container) {
            const targetScroll = matchTop - container.clientHeight / 2 + LINE_HEIGHT / 2;
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
        }
    }, [searchTerm, searchIndex, searchMatches, code]);

    // Build highlight overlay spans
    const searchOverlay = useMemo(() => {
        if (!searchTerm || searchMatches.length === 0) return null;
        const currentMatch = searchMatches[searchIndex] ?? searchMatches[0];
        const spans: React.ReactNode[] = [];

        searchMatches.forEach((m, mi) => {
            const isCurrent = m === currentMatch;
            // Find line/col of match start
            const before = code.substring(0, m.start);
            const lineIdx = before.split("\n").length - 1;
            const colStart = before.length - before.lastIndexOf("\n") - 1;

            // A match may span multiple lines — handle simple single-line case
            const matchText = code.substring(m.start, m.end);
            const matchLines = matchText.split("\n");
            matchLines.forEach((part, partIdx) => {
                const line = lineIdx + partIdx;
                const col = partIdx === 0 ? colStart : 0;
                const top = PAD_TOP + line * LINE_HEIGHT;
                // Approximate char width for monospace: FONT_SIZE * 0.6
                const charW = FONT_SIZE * 0.601;
                const left = 20 + col * charW; // 20 = PAD_LEFT
                const width = part.length * charW;
                if (width === 0) return;
                spans.push(
                    <span
                        key={`${mi}-${partIdx}`}
                        style={{
                            position: "absolute",
                            top,
                            left,
                            width,
                            height: LINE_HEIGHT,
                            background: isCurrent ? "rgba(255,214,0,0.85)" : "rgba(255,214,0,0.3)",
                            borderRadius: 2,
                            pointerEvents: "none",
                        }}
                    />
                );
            });
        });
        return spans;
    }, [searchTerm, searchMatches, searchIndex, code]);

    const readActiveLine = useCallback(() => {
        const ta = wrapperRef.current?.querySelector("textarea");
        if (!ta) return;
        const pos = ta.selectionStart ?? 0;
        const line = ta.value.slice(0, pos).split("\n").length - 1;
        setActiveLine(line);
    }, []);

    // Clear highlight when not editing
    useEffect(() => {
        if (!editing) setActiveLine(null);
    }, [editing]);

    // Re-attach listeners whenever editing toggles on
    useEffect(() => {
        if (!editing) return;
        const container = wrapperRef.current;
        if (!container) return;

        // Poll for the textarea (it mounts async inside the Editor)
        let ta: HTMLTextAreaElement | null = null;
        const attach = () => {
            ta = container.querySelector("textarea");
            if (!ta) return;
            ta.addEventListener("keydown",  readActiveLine);
            ta.addEventListener("keyup",    readActiveLine);
            ta.addEventListener("input",    readActiveLine);
            ta.addEventListener("mouseup",  readActiveLine);
            ta.addEventListener("touchend", readActiveLine);
            ta.addEventListener("focus",    readActiveLine);
            ta.addEventListener("select",   readActiveLine);
            ta.addEventListener("click",    readActiveLine);
        };

        // Try immediately, then via rAF in case Editor hasn't mounted yet
        attach();
        const raf = requestAnimationFrame(attach);

        return () => {
            cancelAnimationFrame(raf);
            if (ta) {
                ta.removeEventListener("keydown",  readActiveLine);
                ta.removeEventListener("keyup",    readActiveLine);
                ta.removeEventListener("input",    readActiveLine);
                ta.removeEventListener("mouseup",  readActiveLine);
                ta.removeEventListener("touchend", readActiveLine);
                ta.removeEventListener("focus",    readActiveLine);
                ta.removeEventListener("select",   readActiveLine);
                ta.removeEventListener("click",    readActiveLine);
            }
        };
    }, [editing, readActiveLine]);

    const highlight = (val: string) =>
        lang === "text"
            ? val.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            : Prism.highlight(val, Prism.languages[lang] ?? Prism.languages.javascript, lang);

    const highlightTop = activeLine !== null
        ? PAD_TOP + activeLine * LINE_HEIGHT
        : null;

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-auto relative"
            style={{ background: "#000", display: "flex" }}
            onClick={!editing ? onClick : undefined}
        >
            <style>{MONOKAI}</style>

            {/* Active-line highlight — spans full width behind gutter + editor */}
            {highlightTop !== null && (
                <div
                    aria-hidden
                    style={{
                        position: "absolute",
                        top: highlightTop,
                        left: 0,
                        right: 0,
                        height: LINE_HEIGHT,
                        background: "rgba(255,255,255,0.06)",
                        pointerEvents: "none",
                        zIndex: 0,
                    }}
                />
            )}

            {/* Line number gutter */}
            <div
                aria-hidden
                style={{
                    position: "relative",
                    zIndex: 1,
                    width: GUTTER_W,
                    minWidth: GUTTER_W,
                    paddingTop: PAD_TOP,
                    paddingBottom: PAD_BOTTOM,
                    background: "transparent",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    textAlign: "right",
                    userSelect: "none",
                    pointerEvents: "none",
                    lineHeight: `${LINE_HEIGHT}px`,
                    fontSize: FONT_SIZE,
                    fontFamily: "ui-monospace, 'Fira Code', monospace",
                    color: "#75715e",
                }}
            >
                {Array.from({ length: lineCount }, (_, i) => {
                    const rows = visualRowsPerLine ? visualRowsPerLine[i] : 1;
                    return (
                        <div key={i} style={{ height: LINE_HEIGHT * rows }}>
                            {/* First visual row: show line number */}
                            <div style={{
                                height: LINE_HEIGHT,
                                paddingRight: 10,
                                color: i === activeLine ? "#f8f8f2" : "#75715e",
                                fontWeight: i === activeLine ? 700 : 400,
                            }}>
                                {i + 1}
                            </div>
                            {/* Extra wrapped rows: blank */}
                        </div>
                    );
                })}
            </div>

            {/* Editor */}
            <div ref={wrapperRef} className={`code-viewer-wrap${wordWrap ? " word-wrap" : ""}`} style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
                {/* Search highlight overlay — sits above syntax highlighting */}
                {searchOverlay && (
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            top: 0, left: 0, right: 0, bottom: 0,
                            pointerEvents: "none",
                            zIndex: 10,
                        }}
                    >
                        {searchOverlay}
                    </div>
                )}
                <Editor
                    value={code}
                    onValueChange={editing ? (onChange ?? (() => {})) : () => {}}
                    highlight={highlight}
                    readOnly={!editing}
                    autoFocus={editing && autoFocus}
                    onBlur={() => { setActiveLine(null); onBlur?.(); }}
                    padding={{ top: PAD_TOP, bottom: PAD_BOTTOM, left: 20, right: 24 }}
                    style={{
                        fontFamily: "ui-monospace, 'Fira Code', 'Cascadia Code', monospace",
                        fontSize: FONT_SIZE,
                        lineHeight: `${LINE_HEIGHT}px`,
                        background: "transparent",
                        color: "#f8f8f2",
                        minHeight: "100%",
                        caretColor: "#f8f8f2",
                        outline: "none",
                    }}
                />
            </div>
        </div>
    );
}
