"use client";

import { useEffect } from "react";

/**
 * Positive proof that React mounted. The inline BOOT_WATCHDOG in the document head
 * only heals when this never runs, so it must stay in the main chunk graph (no
 * dynamic import) and must do nothing else.
 */
export default function BootBeacon() {
    useEffect(() => {
        (window as unknown as { __stickiesBooted?: number }).__stickiesBooted = 1;
        try { sessionStorage.removeItem("stickies:boot-heal"); } catch { /* ignore */ }
    }, []);
    return null;
}
