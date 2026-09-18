// Notes REST client - extracted from app/(app)/page.tsx as part of decomposing the
// page God component. Thin fetch wrappers over /api/stickies. Auth rides the session
// cookie (the server reads it via auth()); no Authorization header is needed for the
// owner browser.

export const notesApi = {
    update: async (id: string, fields: Record<string, unknown>) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...fields }),
        });
        // 423 Locked: server refused because the note is write-protected. Swallow
        // silently so background autosaves on a locked note don't crash the UI;
        // the lock toggle in the share picker is the only sanctioned way to mutate.
        if (res.status === 423) return { note: { id, locked: true } };
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "update failed"); }
        return res.json() as Promise<{ note: Record<string, unknown> }>;
    },
    bulkUpdate: async (updates: Array<{ id: string } & Record<string, unknown>>) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates }),
        });
        if (res.status === 423) return;
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "bulk update failed"); }
    },
    insert: async (payload: Record<string, unknown>) => {
        const res = await fetch("/api/stickies?raw=1", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "insert failed"); }
        return res.json() as Promise<{ note: Record<string, unknown> }>;
    },
    delete: async (id: string) => {
        const res = await fetch(`/api/stickies?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "delete failed"); }
    },
    deleteByFolder: async (folderName: string) => {
        const res = await fetch(`/api/stickies?folder_name=${encodeURIComponent(folderName)}`, { method: "DELETE" });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "delete folder failed"); }
    },
    renameFolder: async (from: string, to: string) => {
        const res = await fetch("/api/stickies", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rename_folder: { from, to } }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "rename failed"); }
    },
};
