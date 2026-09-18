"use client";

import { useEffect } from "react";

const POLL_MS = 60_000;

/**
 * Reload BEFORE a stale tab hits a missing chunk.
 *
 * boot-watchdog and ErrorPanel are recovery: they act after a chunk 404 has
 * already happened, which the user sees as a flicker. This is prevention - the
 * tab notices the server was rebuilt and refreshes at a moment that costs
 * nothing (#63). Never reloads while the user is typing or holds an unsaved
 * draft; it waits for the next safe moment instead.
 */
export default function BuildWatch({ current }: { current: string }) {
    useEffect(() => {
        if (!current) return;
        let stopped = false;
        let pending = false;

        const unsafe = () => {
            if ((window as unknown as { __stickiesDirty?: boolean }).__stickiesDirty) return true;
            const el = document.activeElement as HTMLElement | null;
            return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
        };

        const apply = () => { if (!stopped && pending && !unsafe()) window.location.reload(); };

        const check = async () => {
            if (stopped) return;
            if (pending) { apply(); return; }
            try {
                const res = await fetch("/api/build-id", { cache: "no-store" });
                if (!res.ok) return;
                const { id } = await res.json();
                if (id && id !== current) { pending = true; apply(); }
            } catch { /* offline - retry on the next tick */ }
        };

        const onVisibility = () => { if (document.visibilityState === "visible") void check(); else apply(); };

        const timer = setInterval(() => void check(), POLL_MS);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("focus", () => void check());
        return () => {
            stopped = true;
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [current]);

    return null;
}
