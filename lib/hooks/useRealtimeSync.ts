import { useEffect, useRef, useCallback } from "react";
import { fetchRetry } from "@/lib/fetch-retry";
import { hydrateLive } from "@/lib/live-payload";
import PusherClient from "pusher-js";
import { mergeRecentNotes } from "@/lib/editor-ui";
import { COUNTS_CACHE_KEY } from "@/lib/storage-keys";
import type { JSONContent } from "@tiptap/react";


export interface UseRealtimeSyncParams {
    mounted: boolean;
    setDbData: React.Dispatch<React.SetStateAction<any[]>>;
    setFolderCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setFolderCountsById: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    setFlashColor: React.Dispatch<React.SetStateAction<string>>;
    setFlashNote: React.Dispatch<React.SetStateAction<any | null>>;
    setPusherFlash: React.Dispatch<React.SetStateAction<boolean>>;
    setIncomingNoteIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setRemovingNoteIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setEditingNote: React.Dispatch<React.SetStateAction<any>>;
    setContent: React.Dispatch<React.SetStateAction<string>>;
    setTitle: React.Dispatch<React.SetStateAction<string>>;
    setRichDoc: React.Dispatch<React.SetStateAction<JSONContent | null>>;
    setListModeNotes: React.Dispatch<React.SetStateAction<Set<string>>>;
    showToast: (msg: string, color?: string, confetti?: boolean) => void;
    localWriteRef: React.RefObject<Map<string, number>>;
    integrationsRef: React.RefObject<Array<{ trigger: string; condition: Record<string, string>; type: string; config: Record<string, string> }>>;
    isFlashingRef: React.RefObject<boolean>;
    flashQueueRef: React.RefObject<Array<{ note: any; color: string }>>;
    mainListModeRef: React.RefObject<"list" | "tabs">;
    openNoteRef: React.RefObject<(note: any) => any>;
    latestRichDocRef: React.RefObject<JSONContent | null>;
    pendingDeleteRef: React.RefObject<{ note: any; title: string; content: string; noteColor: string; targetFolder: string; timeoutId: ReturnType<typeof setTimeout> } | null>;
}

// Realtime sync seam extracted 1:1 from app/(app)/page.tsx — the Pusher channel,
// its note-created/updated/deleted/navigate-to/api-request bindings, the
// reconnect catch-up, and the focus/visibility/online + 15s poll backstop.
// Behavior is preserved verbatim; every value the effects close over is threaded
// in via params so nothing goes stale differently than it did inline.
export function useRealtimeSync(params: UseRealtimeSyncParams) {
    const {
        mounted,
        setDbData,
        setFolderCounts,
        setFolderCountsById,
        setFlashColor,
        setFlashNote,
        setPusherFlash,
        setIncomingNoteIds,
        setRemovingNoteIds,
        setEditingNote,
        setContent,
        setTitle,
        setRichDoc,
        setListModeNotes,
        showToast,
        localWriteRef,
        integrationsRef,
        isFlashingRef,
        flashQueueRef,
        mainListModeRef,
        openNoteRef,
        latestRichDocRef,
        pendingDeleteRef,
    } = params;

    // Realtime catch-up — pull any notes created while the socket was asleep and
    // merge them in (by id, non-destructive). Shared by the focus/visibility/online
    // listeners AND the Pusher reconnect handler, so a slept-then-woken socket
    // self-heals immediately instead of waiting for a manual refresh.
    const catchUpInFlightRef = useRef(false);
    const catchUp = useCallback(async () => {
        if (catchUpInFlightRef.current || document.visibilityState !== "visible") return;
        catchUpInFlightRef.current = true;
        try {
            const res = await fetchRetry("/api/stickies?recent=today");
            if (!res.ok) return;
            const { notes = [] } = await res.json();
            if (notes.length === 0) return;
            setDbData((prev) => mergeRecentNotes(prev, notes));
        } catch { /* offline / transient — next trigger retries */ }
        finally { catchUpInFlightRef.current = false; }
    }, []);

    // Pusher — real-time note events
    useEffect(() => {
        if (!mounted) return;
        const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!pusherKey || !pusherCluster) return;
        const pusher = new PusherClient(pusherKey, { cluster: pusherCluster });
        pusher.connection.bind("connected", () => {
            localWriteRef.current.set("__socket_id__", pusher.connection.socket_id as any);
            // (Re)connected — the socket may have slept (backgrounded tab / network
            // blip) and missed note-created events. Pull the recent notes so the list
            // catches up in the same second, no manual refresh.
            void catchUp();
        });
        const channel = pusher.subscribe("stickies");

const fireIntegrations = (trigger: string, note: any) => {
            for (const integration of integrationsRef.current) {
                if (integration.trigger !== trigger) continue;
                const cond = integration.condition ?? {};
                if (cond.color && cond.color !== note.folder_color) continue;
                if (cond.folder && cond.folder !== note.folder_name) continue;
                if (integration.type === "hue") {
                    const { group_id } = integration.config;
                    // Server-side relay — avoids browser cert/CORS issues (IFTTT-style)
                    fetch("/api/hue/trigger", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        // source lets the route honor the "Note Created → Hue Flash" toggle
                        body: JSON.stringify({ color: note.folder_color || "#FFCC00", group_id, source: "note_created" }),
                    }).catch(() => {});
                }
            }
        };

        const processFlashQueue = () => {
            if (isFlashingRef.current || flashQueueRef.current.length === 0) return;
            const { note, color } = flashQueueRef.current.shift()!;
            isFlashingRef.current = true;
            setFlashColor(color);
            setFlashNote(note);
            setPusherFlash(true);
            setTimeout(() => {
                setPusherFlash(false);
                setFlashNote(null);
                isFlashingRef.current = false;
                processFlashQueue();
            }, 2000);
        };

        channel.bind("note-created", async (raw: any) => {
            const note = await hydrateLive(raw); // slim event (>8KB row) -> fetch the full row
            if (!note?.id) return;
            // Don't stomp a note the owner is mid-edit, or one being deleted locally.
            if (pendingDeleteRef.current && String(pendingDeleteRef.current.note.id) === String(note.id)) return;
            const lastWrite = localWriteRef.current.get(String(note.id));
            const editingLocally = !!lastWrite && Date.now() - lastWrite < 3000;
            let wasNew = false;
            setDbData((prev) => {
                const idx = prev.findIndex((r) => String(r.id) === String(note.id));
                // Upsert: add if new, or refresh in place (a resurfaced re-post carries a
                // bumped created_at, so the created_at-ranked All view re-sorts it to top).
                if (idx === -1) { wasNew = true; return [...prev, note]; }
                if (editingLocally) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], ...note };
                return next;
            });
            // Live-update folder tile count badge — only for a genuinely new note, not a
            // resurfaced re-post of one already counted (that would double-count the folder).
            if (wasNew && !note.is_folder && note.folder_name) {
                setFolderCounts((prev) => {
                    const next = { ...prev, [note.folder_name]: (prev[note.folder_name] || 0) + 1 };
                    try {
                        const cached = localStorage.getItem(COUNTS_CACHE_KEY);
                        const parsed = cached ? JSON.parse(cached) : {};
                        localStorage.setItem(COUNTS_CACHE_KEY, JSON.stringify({ ...parsed, counts: next }));
                    } catch { /* ignore */ }
                    return next;
                });
                if (note.folder_id) {
                    setFolderCountsById((prev) => ({ ...prev, [String(note.folder_id)]: (prev[String(note.folder_id)] || 0) + 1 }));
                }
            }
            const color = note.folder_color || "#34C759";
            showToast(`+ ${note.title || "New note"}`, color);
            flashQueueRef.current.push({ note, color });
            processFlashQueue();

            // Light up the new tile (note-incoming pulse) and scroll it into view so
            // the note that just arrived is impossible to miss — focus lands on it in
            // the same second it comes in. Clear the flag once the animation is done.
            const nid = String(note.id);
            setIncomingNoteIds((prev) => new Set(prev).add(nid));
            setTimeout(() => setIncomingNoteIds((prev) => { const s = new Set(prev); s.delete(nid); return s; }), 1600);
            setTimeout(() => {
                try { document.querySelector(`[data-note-id="${CSS.escape(nid)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch { /* not in current view */ }
            }, 120);

            // In tabs mode, focus the tab on the note that just came in — unless the
            // owner is actively typing, in which case don't yank their caret away.
            if (!note.is_folder && mainListModeRef.current === "tabs") {
                const el = document.activeElement as HTMLElement | null;
                const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
                if (!typing) void openNoteRef.current?.(note);
            }

            // 🔌 Integration engine — fire matching triggers
            fireIntegrations("note_created", note);
        });

        channel.bind("note-updated", async (raw: any) => {
            const note = await hydrateLive(raw);
            if (!note?.id) return;
            if (pendingDeleteRef.current && String(pendingDeleteRef.current.note.id) === String(note.id)) return;
            const lastWrite = localWriteRef.current.get(String(note.id));
            if (lastWrite && Date.now() - lastWrite < 3000) return;
            setDbData((prev) => prev.map((r) => String(r.id) === String(note.id) ? { ...r, ...note } : r));
            // Write-through: keep notes cache in sync with real-time updates
            setEditingNote((prev: any) => {
                if (!prev || String(prev.id) !== String(note.id)) return prev;
                if (note.content !== undefined) setContent(note.content);
                if (note.title   !== undefined) setTitle(note.title);
                if (note.doc     !== undefined) { setRichDoc(note.doc); latestRichDocRef.current = note.doc; }
                if (note.list_mode !== undefined) {
                    const isChecklist = note.list_mode || note.type === "checklist";
                    if (isChecklist) setListModeNotes((s) => new Set([...s, String(note.id)]));
                    else setListModeNotes((s) => { const n = new Set(s); n.delete(String(note.id)); return n; });
                }
                return { ...prev, ...note };
            });
        });


        channel.bind("note-deleted", (data: any) => {
            if (!data?.id && !data?.folder_name) return;
            if (data.id) {
                const nid = String(data.id);
                setRemovingNoteIds((prev) => new Set([...prev, nid]));
                setTimeout(() => {
                    setDbData((prev) => prev.filter((r) => String(r.id) !== nid));
                    setRemovingNoteIds((prev) => { const s = new Set(prev); s.delete(nid); return s; });
                }, 700);
            }
            if (data.folder_name) {
                setFolderCounts((prev) => { const next = { ...prev }; delete next[data.folder_name]; return next; });
            }
        });

        channel.bind("navigate-to", (data: { url: string }) => {
            if (data?.url) window.location.href = data.url;
        });

        return () => { channel.unbind_all(); pusher.unsubscribe("stickies"); pusher.disconnect(); };
    }, [mounted]);

    // Supabase Realtime removed — Pusher handles all real-time events.
    // If external tools (curl, batch) need live updates, they should POST
    // through the API which triggers Pusher.

    // Realtime catch-up — Pusher only delivers events while the socket is alive.
    // On iPad/Safari the socket sleeps when the tab is backgrounded (or a network
    // blip drops it), so notes posted via the API during that window are missed
    // and the list looks stale until a manual hard-refresh. Re-fetch the recent
    // notes whenever the tab regains focus / the network comes back so the list
    // self-heals seamlessly. Non-destructive: merges by id, keeps folders + any
    // un-confirmed optimistic notes.
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === "visible") void catchUp(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        window.addEventListener("online", onVisible);
        // Backstop: if Pusher is unavailable (keys missing, network blocked) the socket
        // never delivers and the focus events may not fire while the tab stays open.
        // A light 15s poll while visible guarantees the list still self-heals — so a
        // new note shows on its own, never a manual refresh.
        const poll = window.setInterval(onVisible, 15000);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
            window.removeEventListener("online", onVisible);
            window.clearInterval(poll);
        };
    }, [catchUp]);
}
