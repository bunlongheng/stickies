"use client";
import { useState, useRef, useCallback, useEffect } from "react";
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
};

const MONOKAI = `
.token.comment,.token.prolog,.token.doctype,.token.cdata{color:#75715e}
.token.punctuation{color:#f8f8f2}
.token.property,.token.tag,.token.constant,.token.symbol,.token.deleted{color:#f92672}
.token.boolean,.token.number{color:#ae81ff}
.token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted{color:#a6e22e}
.token.operator,.token.entity,.token.url,.language-css .token.string,.token.variable{color:#f8f8f2}
.token.atrule,.token.attr-value,.token.function,.token.class-name{color:#e6db74}
.token.keyword{color:#66d9e8}
.token.regex,.token.important{color:#fd971f}
`;

const GUTTER_W = 48; // px
const FONT_SIZE = 13;   // px — single source of truth
const LINE_HEIGHT = 20; // px — single source of truth
const PAD_TOP = 8;
const PAD_BOTTOM = 24;

interface Props {
    code: string;
    language: string;
    editing: boolean;
    onChange?: (val: string) => void;
    onBlur?: () => void;
    onClick?: () => void;
}

export function CodeViewer({ code, language, editing, onChange, onBlur, onClick }: Props) {
    const lang = LANG_MAP[language] ?? "javascript";
    const lineCount = (code || "").split("\n").length;
    const [activeLine, setActiveLine] = useState<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

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
            ta.addEventListener("keyup",    readActiveLine);
            ta.addEventListener("mouseup",  readActiveLine);
            ta.addEventListener("touchend", readActiveLine);
            ta.addEventListener("focus",    readActiveLine);
            ta.addEventListener("select",   readActiveLine);
        };

        // Try immediately, then via rAF in case Editor hasn't mounted yet
        attach();
        const raf = requestAnimationFrame(attach);

        return () => {
            cancelAnimationFrame(raf);
            if (ta) {
                ta.removeEventListener("keyup",    readActiveLine);
                ta.removeEventListener("mouseup",  readActiveLine);
                ta.removeEventListener("touchend", readActiveLine);
                ta.removeEventListener("focus",    readActiveLine);
                ta.removeEventListener("select",   readActiveLine);
            }
        };
    }, [editing, readActiveLine]);

    const highlight = (val: string) =>
        Prism.highlight(val, Prism.languages[lang] ?? Prism.languages.javascript, lang);

    const highlightTop = activeLine !== null
        ? PAD_TOP + activeLine * LINE_HEIGHT
        : null;

    return (
        <div
            className="flex-1 overflow-auto relative"
            style={{ background: "#272822", display: "flex" }}
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
                {Array.from({ length: lineCount }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            height: LINE_HEIGHT,
                            paddingRight: 10,
                            color: i === activeLine ? "#f8f8f2" : "#75715e",
                            fontWeight: i === activeLine ? 700 : 400,
                        }}
                    >
                        {i + 1}
                    </div>
                ))}
            </div>

            {/* Editor */}
            <div ref={wrapperRef} style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
                <Editor
                    value={code}
                    onValueChange={editing ? (onChange ?? (() => {})) : () => {}}
                    highlight={highlight}
                    readOnly={!editing}
                    autoFocus={editing}
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
