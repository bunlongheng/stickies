"use client";

import { useEffect, useRef, useState } from "react";

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
            await navigator.clipboard.writeText(note.content);
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

    if (state === "loading") return <div style={{ background: "#0d0d0d", minHeight: "100vh" }} />;

    if (state === "burned") {
        return (
            <div style={{ background: "#0d0d0d", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#555", fontFamily: "monospace", fontSize: 13 }}>This note has been destroyed.</p>
            </div>
        );
    }

    if (state === "error" || !note) {
        return (
            <div style={{ background: "#0d0d0d", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "#555", fontFamily: "monospace", fontSize: 13 }}>Invalid or expired link.</p>
            </div>
        );
    }

    return (
        <div style={{ background: "#0d0d0d", minHeight: "100vh", position: "relative" }}>
            {/* Minimal top bar */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid #1e1e1e",
            }}>
                <span style={{ color: "#444", fontFamily: "monospace", fontSize: 11 }}>
                    {isBurnLink ? "🔥 burn link" : "stickies"}
                </span>
                <button
                    ref={copyBtnRef}
                    type="button"
                    onClick={handleCopy}
                    disabled={hasBurned}
                    style={{
                        background: copied ? "#1a3a1a" : "#1a1a1a",
                        border: `1px solid ${copied ? "#2d6a2d" : "#2a2a2a"}`,
                        color: copied ? "#4ade80" : "#888",
                        fontFamily: "monospace",
                        fontSize: 11,
                        padding: "4px 10px",
                        cursor: hasBurned ? "not-allowed" : "pointer",
                        opacity: hasBurned ? 0.4 : 1,
                        transition: "all 0.15s",
                    }}
                >
                    {copied ? "copied" : "copy"}
                </button>
            </div>

            {/* Raw content */}
            <pre style={{
                margin: 0,
                padding: "24px 20px",
                fontFamily: "'Fira Code', 'Consolas', 'Menlo', monospace",
                fontSize: 13,
                lineHeight: 1.65,
                color: "#c9c9c9",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "break-word",
            }}>
                {note.content}
            </pre>
        </div>
    );
}
