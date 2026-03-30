"use client";

import { useEffect, useRef, useState } from "react";

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

type State = "loading" | "ready" | "burned" | "error";

export default function StickiesShare() {
    const [note, setNote] = useState<SharedNote | null>(null);
    const [state, setState] = useState<State>("loading");
    const [copied, setCopied] = useState(false);
    const [isBurnLink, setIsBurnLink] = useState(false);
    const [burnToken, setBurnToken] = useState<string | null>(null);
    const [hasBurned, setHasBurned] = useState(false);
    const copyBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        const noteId = params.get("noteId");
        if (noteId) {
            fetch(`/api/stickies/public?noteId=${encodeURIComponent(noteId)}`)
                .then(async (res) => {
                    if (!res.ok) { setState("error"); return; }
                    const data = await res.json();
                    setNote({ title: data.title ?? "", content: data.content ?? "", color: data.folder_color ?? "", folder_name: "" });
                    setState("ready");
                })
                .catch(() => setState("error"));
            return;
        }

        const token = params.get("token");
        if (token) {
            setIsBurnLink(true);
            setBurnToken(token);
            fetch(`/api/stickies/share?token=${encodeURIComponent(token)}`)
                .then(async (res) => {
                    if (res.status === 410) { setState("burned"); return; }
                    if (!res.ok) { setState("error"); return; }
                    const data = await res.json();
                    setNote(data);
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

    const handleCopy = async () => {
        if (!note || hasBurned) return;
        try {
            await navigator.clipboard.writeText(extractText(note.content));
        } catch {
            const ta = document.createElement("textarea");
            ta.value = note.content;
            ta.style.cssText = "position:fixed;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (isBurnLink && burnToken && !hasBurned) {
            fetch(`/api/stickies/share?token=${encodeURIComponent(burnToken)}`, { method: "DELETE" }).catch(() => {});
            setHasBurned(true);
        }
    };

    if (state === "loading") return <div style={{ background: "#fff", minHeight: "100vh" }} />;

    if (state === "burned") {
        return (
            <div style={{ background: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#999", fontFamily: "monospace", fontSize: 13 }}>This note has been destroyed.</p>
            </div>
        );
    }

    if (state === "error" || !note) {
        return (
            <div style={{ background: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#999", fontFamily: "monospace", fontSize: 13 }}>Invalid or expired link.</p>
            </div>
        );
    }

    return (
        <div style={{ background: "#fff", minHeight: "100vh", position: "relative" }}>
            {/* Floating copy button — top right */}
            <button
                ref={copyBtnRef}
                type="button"
                onClick={handleCopy}
                disabled={hasBurned}
                style={{
                    position: "fixed",
                    top: 12,
                    right: 14,
                    background: copied ? "#f0fdf4" : "#f5f5f5",
                    border: `1px solid ${copied ? "#bbf7d0" : "#e0e0e0"}`,
                    color: copied ? "#16a34a" : "#555",
                    fontFamily: "monospace",
                    fontSize: 10,
                    padding: "3px 9px",
                    cursor: hasBurned ? "not-allowed" : "pointer",
                    opacity: hasBurned ? 0.4 : 1,
                    transition: "all 0.15s",
                    zIndex: 10,
                }}
            >
                {copied ? "✓ copied" : isBurnLink ? "🔥 copy" : "copy"}
            </button>

            {/* Raw content */}
            <pre style={{
                margin: 0,
                padding: "16px 20px",
                fontFamily: "'Fira Code', 'Consolas', 'Menlo', monospace",
                fontSize: 10,
                lineHeight: 1.65,
                color: "#111",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "break-word",
            }}>
                {extractText(note.content)}
            </pre>
        </div>
    );
}
