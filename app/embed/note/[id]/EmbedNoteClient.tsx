"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";

const RichEditor = dynamic(() => import("@/components/RichEditor"), {
    ssr: false,
    loading: () => <div style={{ padding: 24, color: "#a1a1aa" }}>Loading editor…</div>,
});

interface Note {
    id: string;
    title: string | null;
    content: string | null;
    format: "text" | "markdown" | "rich" | null;
    doc: unknown;
    folder_color: string | null;
}

export default function EmbedNoteClient({ note, apiKey }: { note: Note; apiKey: string }) {
    const [title, setTitle] = useState(note.title ?? "");
    const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const docRef = useRef<JSONContent | null>((note.doc as JSONContent | null) ?? null);
    const textRef = useRef<string>(note.content ?? "");
    const titleRef = useRef<string>(note.title ?? "");
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Strip ?key= from the URL after first paint so it doesn't sit in history
    useEffect(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.has("key")) {
            url.searchParams.delete("key");
            window.history.replaceState({}, "", url.toString());
        }
    }, []);

    const save = useCallback(async () => {
        setSavingState("saving");
        try {
            const res = await fetch("/api/stickies/ext", {
                method: "PATCH",
                headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: note.id,
                    title: titleRef.current || "Untitled",
                    content: textRef.current,
                    format: "rich",
                    doc: docRef.current,
                    updated_at: new Date().toISOString(),
                }),
            });
            if (!res.ok) throw new Error(`save ${res.status}`);
            setSavingState("saved");
            // Tell native host the save landed (for offline-cache eviction etc.)
            try {
                const win = window as any;
                win.webkit?.messageHandlers?.stickies?.postMessage({ type: "saved", id: note.id, doc: docRef.current });
            } catch {}
            setTimeout(() => setSavingState("idle"), 1200);
        } catch (e) {
            console.error("[embed save]", e);
            setSavingState("error");
        }
    }, [apiKey, note.id]);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(save, 2000);
    }, [save]);

    const accent = note.folder_color ?? "#22d3ee";

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1a1a1a", color: "#e4e4e7" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
                <input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); titleRef.current = e.target.value; scheduleSave(); }}
                    placeholder="Untitled"
                    style={{
                        flex: 1, background: "transparent", border: "none", outline: "none",
                        color: "#fff", fontSize: 18, fontWeight: 700, caretColor: accent,
                    }}
                />
                <span style={{
                    fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 800,
                    color: savingState === "saving" ? "#fbbf24"
                        : savingState === "saved" ? "#34d399"
                        : savingState === "error" ? "#f87171"
                        : "#52525b",
                }}>
                    {savingState === "saving" ? "Saving…"
                     : savingState === "saved"  ? "Saved"
                     : savingState === "error"  ? "Error"
                     : ""}
                </span>
            </div>
            <RichEditor
                initialDoc={docRef.current}
                placeholder="Start writing…"
                accentColor={accent}
                onChange={({ doc, text }) => {
                    docRef.current = doc;
                    textRef.current = text;
                    scheduleSave();
                }}
                onUploadImage={async (file) => {
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("folder", "unsorted");
                    const r = await fetch("/api/stickies/gdrive", {
                        method: "POST",
                        headers: { Authorization: `Bearer ${apiKey}` },
                        body: fd,
                    });
                    if (!r.ok) throw new Error("upload failed");
                    const j = await r.json();
                    return j.url as string;
                }}
            />
        </div>
    );
}
