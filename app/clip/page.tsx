"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

function extractText(content: string): string {
    try {
        const doc = JSON.parse(content);
        const lines: string[] = [];
        const walk = (nodes: any[]) => {
            for (const n of nodes) {
                if (n.type === "text") lines.push(n.text ?? "");
                else if (n.type === "hardBreak") lines.push("\n");
                else if (n.content) {
                    if (["paragraph","heading","listItem","blockquote"].includes(n.type)) {
                        walk(n.content);
                        lines.push("\n");
                    } else {
                        walk(n.content);
                    }
                } else {
                    lines.push("\n");
                }
            }
        };
        if (doc?.content) walk(doc.content);
        return lines.join("").replace(/\n{2,}/g, "\n").trim();
    } catch {
        return content;
    }
}

interface SharedNote {
    title: string;
    content: string;
    color: string;
    folder_name: string;
}

type State = "loading" | "ready" | "error";

export default function StickiesShare() {
    const [note, setNote] = useState<SharedNote | null>(null);
    const [state, setState] = useState<State>("loading");
    const [copied, setCopied] = useState(false);
    const copyBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const noteId = params.get("noteId");
        if (noteId) {
            apiFetch(`/api/stickies/public?noteId=${encodeURIComponent(noteId)}`)
                .then(async (res) => {
                    if (!res.ok) { setState("error"); return; }
                    const data = await res.json();
                    // Passcode-locked note: no content is served - send the viewer to the
                    // /raw password gate to unlock (same gate the raw route renders).
                    if (data.locked) { window.location.href = `/share?noteId=${encodeURIComponent(noteId)}`; return; }
                    setNote({ title: data.title ?? "", content: data.content ?? "", color: data.folder_color ?? "", folder_name: "" });
                    setState("ready");
                })
                .catch(() => setState("error"));
            return;
        }

        try {
            const clip = params.get("clip");
            if (clip) {
                const text = decodeURIComponent(escape(atob(clip)));
                const firstLine = text.split("\n")[0].replace(/^#+\s*/, "").trim();
                setNote({ title: firstLine || "Note", content: text, color: "", folder_name: "" });
                setState("ready");
                return;
            }
            const data = params.get("data");
            if (!data) { setState("error"); return; }
            const decoded: SharedNote = JSON.parse(decodeURIComponent(escape(atob(data))));
            if (!decoded?.title && !decoded?.content) { setState("error"); return; }
            setNote(decoded);
            setState("ready");
        } catch {
            setState("error");
        }
    }, []);

    const preRef = useRef<HTMLPreElement>(null);

    const handleCopy = async () => {
        if (!note) return;
        try {
            await navigator.clipboard.writeText(extractText(note.content));
        } catch {
            const ta = document.createElement("textarea");
            ta.value = extractText(note.content);
            ta.style.cssText = "position:fixed;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Cmd+C anywhere → copy full content; Cmd+A → select only the <pre>
    useEffect(() => {
        if (!note) return;
        const handler = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === "c") {
                    handleCopy();
                } else if (e.key === "a") {
                    e.preventDefault();
                    if (preRef.current) {
                        const range = document.createRange();
                        range.selectNodeContents(preRef.current);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                    }
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [note]);

    if (state === "loading") return <div style={{ background: "#fff", minHeight: "100vh" }} />;

    if (state === "error" || !note) {
        return (
            <div style={{ background: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#999", fontFamily: "monospace", fontSize: 13 }}>Invalid or expired link.</p>
            </div>
        );
    }

    return (
        <div style={{ background: "#fff", minHeight: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            {/* Floating copy button — top right */}
            <button
                ref={copyBtnRef}
                type="button"
                onClick={handleCopy}
                style={{
                    position: "fixed",
                    top: 12,
                    right: 14,
                    background: copied ? "#f0fdf4" : "#f5f5f5",
                    border: `1px solid ${copied ? "#bbf7d0" : "#e0e0e0"}`,
                    color: copied ? "#16a34a" : "#555",
                    fontFamily: "monospace",
                    fontSize: 11,
                    padding: "5px 12px",
                    cursor: "pointer",
                    opacity: 1,
                    transition: "all 0.15s",
                    zIndex: 10,
                    borderRadius: 4,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    userSelect: "none",
                }}
            >
                {copied ? "✓ copied" : "copy"}
            </button>

            {/* Raw content */}
            <pre ref={preRef} style={{
                margin: 0,
                padding: "16px 20px 40px 20px",
                fontFamily: "'Fira Code', 'Consolas', 'Menlo', monospace",
                fontSize: "clamp(7px, 1.4vw, 9px)",
                lineHeight: 1.7,
                color: "#111",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "break-word",
                maxWidth: 860,
                boxSizing: "border-box",
                width: "100%",
            }}>
                {extractText(note.content)}
            </pre>
        </div>
    );
}
