import { useState, useEffect, useRef } from "react";
import type React from "react";
import type { NoteRow } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";

// State + effects for the Cmd-K palette, lifted out of the page God component.
// Owns the palette's own state and its two self-contained effects (query debounce
// + server-side search fetch). Results computation lives in computeCmdKResults
// (lib/editor-ui) and the render in CmdKPalette, both fed from this state.
export interface CmdKState {
    showCmdK: boolean;
    setShowCmdK: React.Dispatch<React.SetStateAction<boolean>>;
    cmdKQuery: string;
    setCmdKQuery: React.Dispatch<React.SetStateAction<string>>;
    cmdKCursor: number;
    setCmdKCursor: React.Dispatch<React.SetStateAction<number>>;
    cmdKGlobal: boolean;
    setCmdKGlobal: React.Dispatch<React.SetStateAction<boolean>>;
    cmdKInFile: boolean;
    setCmdKInFile: React.Dispatch<React.SetStateAction<boolean>>;
    cmdKInputRef: React.RefObject<HTMLInputElement | null>;
    deferredCmdKQuery: string;
    cmdKServerResults: NoteRow[];
}

export function useCmdK(): CmdKState {
    const [showCmdK, setShowCmdK] = useState(false);
    const [cmdKQuery, setCmdKQuery] = useState("");
    const [cmdKCursor, setCmdKCursor] = useState(0);
    const [cmdKGlobal, setCmdKGlobal] = useState(false);
    const [cmdKInFile, setCmdKInFile] = useState(false);
    // Server-side hits for the palette. The local index only covers the ~500 notes
    // in dbData, so notes outside that window need a DB query to surface.
    const [cmdKServerResults, setCmdKServerResults] = useState<NoteRow[]>([]);
    const cmdKInputRef = useRef<HTMLInputElement | null>(null);

    // Debounced: wait 120ms after the user stops typing before running search
    const [deferredCmdKQuery, setDeferredCmdKQuery] = useState(cmdKQuery);
    useEffect(() => {
        const t = setTimeout(() => setDeferredCmdKQuery(cmdKQuery), 120);
        return () => clearTimeout(t);
    }, [cmdKQuery]);

    // Server-side search: the local index is capped at ~500 rows, so query the DB
    // (title/content ILIKE, all rows) and merge the hits into the results below.
    useEffect(() => {
        const q = deferredCmdKQuery.trim();
        if (cmdKInFile || !q) { setCmdKServerResults([]); return; }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiFetch(`/api/stickies?q=${encodeURIComponent(q)}`);
                if (!res.ok) return;
                const { notes = [] } = await res.json();
                if (!cancelled) setCmdKServerResults(notes);
            } catch { /* offline / transient — local index still applies */ }
        })();
        return () => { cancelled = true; };
    }, [deferredCmdKQuery, cmdKInFile]);

    return {
        showCmdK, setShowCmdK,
        cmdKQuery, setCmdKQuery,
        cmdKCursor, setCmdKCursor,
        cmdKGlobal, setCmdKGlobal,
        cmdKInFile, setCmdKInFile,
        cmdKInputRef, deferredCmdKQuery, cmdKServerResults,
    };
}
