"use client";
import { useEffect } from "react";

/**
 * Last line of defence against a white screen. Without an error boundary any
 * uncaught render exception unmounts the whole tree and leaves a blank page
 * until someone reloads. This panel retries once on its own, then offers the
 * buttons. Inline styles only: global-error renders outside the root layout,
 * so Tailwind may not be loaded.
 */
/** A deploy landed while this tab was open: its chunk hashes are gone from the CDN. */
export function isStaleChunkError(error: { message?: string; name?: string } | null | undefined): boolean {
    const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
    return /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(text);
}

export default function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[stickies] render error", error);
        try {
            // Stale chunks after a deploy: a retry cannot help, only a fresh document can.
            // Reload once (guarded), so the owner never sees this panel for a mere deploy.
            if (isStaleChunkError(error) && !sessionStorage.getItem("stickies:chunk-reload")) {
                sessionStorage.setItem("stickies:chunk-reload", "1");
                window.location.reload();
                return;
            }
            if (!sessionStorage.getItem("stickies:auto-reset")) {
                sessionStorage.setItem("stickies:auto-reset", "1");
                const t = setTimeout(reset, 1500);
                return () => clearTimeout(t);
            }
        } catch { /* private mode */ }
    }, [error, reset]);
    const btn: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, border: "1px solid #3f3f46", background: "#18181b", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" };
    return (
        <div style={{ minHeight: "100vh", background: "#000", color: "#e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,system-ui,sans-serif", padding: 24 }}>
            <div style={{ maxWidth: 420, width: "100%", background: "#0c0c0e", border: "1px solid #27272a", borderRadius: 16, padding: "28px 26px", boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>
                <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden>🟨</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Stickies hit a snag</div>
                <div style={{ fontSize: 13, color: "#a1a1aa", marginTop: 6, lineHeight: 1.5 }}>The screen could not render. Retrying once automatically; if it sticks, reload.</div>
                <pre style={{ marginTop: 12, fontSize: 11, color: "#71717a", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 90, overflow: "auto" }}>{String(error?.message || error?.digest || "Unknown error").slice(0, 300)}</pre>
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button type="button" onClick={reset} style={btn}>Try again</button>
                    <button type="button" onClick={() => { try { sessionStorage.removeItem("stickies:auto-reset"); sessionStorage.removeItem("stickies:chunk-reload"); } catch {} window.location.reload(); }} style={{ ...btn, background: "#FFCC00", color: "#000", border: "1px solid #FFCC00" }}>Reload</button>
                </div>
            </div>
        </div>
    );
}
