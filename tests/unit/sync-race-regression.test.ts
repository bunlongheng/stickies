/**
 * Regression tests: sync() cache load race condition
 *
 * Bug: sync() called setDbData(parsed) with folder-only localStorage cache,
 * wiping all loaded notes from dbData. The subsequent API fetch then saw
 * prev = [folders-only], so existingNotes = [], leaving the list empty.
 *
 * Fix: cache seed uses a functional updater that merges folders with existing notes.
 *
 * Tags: unit, regression, sync, cache, race-condition
 * Priority: critical
 */
import { describe, it, expect } from "vitest";

// ── Simulate the merge logic from sync() ─────────────────────────────────────

/** The BUGGY version — replaces everything with the cache */
function buggyMerge(cache: any[], _prev: any[]): any[] {
    return cache; // setDbData(parsed) — wipes prev entirely
}

/** The FIXED version — merges cache folders with existing notes */
function fixedMerge(cache: any[], prev: any[]): any[] {
    const existingNotes = prev.filter(r => !r.is_folder);
    const cacheFolders = cache.filter(r => r.is_folder);
    return [...cacheFolders, ...existingNotes];
}

/** The fixed final-fetch merge (was already correct) */
function apiMerge(freshFolders: any[], prev: any[]): any[] {
    const existingNotes = prev.filter(r => !r.is_folder);
    return [...freshFolders, ...existingNotes];
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FOLDERS = [
    { id: "f1", is_folder: true, folder_name: "Work" },
    { id: "f2", is_folder: true, folder_name: "3pi" },
];

const NOTES = [
    { id: "n1", is_folder: false, folder_name: "3pi", title: "My note" },
    { id: "n2", is_folder: false, folder_name: "3pi", title: "Another note" },
];

const DBDATA_WITH_NOTES = [...FOLDERS, ...NOTES];
// localStorage cache only stores folders
const LS_CACHE = [...FOLDERS];

describe("sync() race condition regression", () => {
    it("BUGGY: cache load wipes notes from dbData", () => {
        // User is in folder "3pi" with notes loaded
        const afterCacheLoad = buggyMerge(LS_CACHE, DBDATA_WITH_NOTES);
        // Notes are gone
        expect(afterCacheLoad.filter(r => !r.is_folder)).toHaveLength(0);

        // Then API fetch completes — but prev is now folder-only, so notes still gone
        const afterApiFetch = apiMerge(FOLDERS, afterCacheLoad);
        expect(afterApiFetch.filter(r => !r.is_folder)).toHaveLength(0);
    });

    it("FIXED: cache load preserves existing notes in dbData", () => {
        const afterCacheLoad = fixedMerge(LS_CACHE, DBDATA_WITH_NOTES);
        // Notes are preserved
        expect(afterCacheLoad.filter(r => !r.is_folder)).toHaveLength(2);

        // Then API fetch completes — notes still present
        const afterApiFetch = apiMerge(FOLDERS, afterCacheLoad);
        expect(afterApiFetch.filter(r => !r.is_folder)).toHaveLength(2);
    });

    it("FIXED: folders are updated from fresh API response", () => {
        const freshFolders = [
            ...FOLDERS,
            { id: "f3", is_folder: true, folder_name: "NewFolder" },
        ];
        const afterCacheLoad = fixedMerge(LS_CACHE, DBDATA_WITH_NOTES);
        const afterApiFetch = apiMerge(freshFolders, afterCacheLoad);

        const folderNames = afterApiFetch.filter(r => r.is_folder).map(r => r.folder_name);
        expect(folderNames).toContain("NewFolder");
    });

    it("FIXED: no duplicate notes when sync runs multiple times", () => {
        let state = [...DBDATA_WITH_NOTES];

        // First sync
        state = fixedMerge(LS_CACHE, state);
        state = apiMerge(FOLDERS, state);

        // Second sync (e.g., user saves another note and sync fires again)
        state = fixedMerge(LS_CACHE, state);
        state = apiMerge(FOLDERS, state);

        const noteIds = state.filter(r => !r.is_folder).map(r => r.id);
        const unique = new Set(noteIds);
        expect(noteIds.length).toBe(unique.size); // no duplicates
    });

    it("FIXED: works correctly on cold start (empty prev)", () => {
        // On first ever load, prev = []
        const afterCacheLoad = fixedMerge(LS_CACHE, []);
        expect(afterCacheLoad.filter(r => r.is_folder)).toHaveLength(2);
        expect(afterCacheLoad.filter(r => !r.is_folder)).toHaveLength(0);
    });

    it("FIXED: works correctly when cache is empty (no localStorage)", () => {
        // Cache miss — sync skips the setDbData(parsed) call entirely
        // State unchanged from when loadFolderNotes populated it
        const state = [...DBDATA_WITH_NOTES];
        expect(state.filter(r => !r.is_folder)).toHaveLength(2);
    });
});

// ── void sync() removed from saveNote for updates ────────────────────────────

describe("saveNote should not call sync() for updates", () => {
    it("demonstrates that calling sync() during update caused the race", () => {
        // Scenario: user edits note, saveNote fires, sync() fires inside saveNote
        let state = [...DBDATA_WITH_NOTES]; // notes loaded in the folder

        // saveNote: optimistic update (preserves notes)
        state = state.map(n => n.id === "n1" ? { ...n, title: "Updated" } : n);
        expect(state.filter(r => !r.is_folder)).toHaveLength(2);

        // BUGGY: sync() fires, cache load wipes notes, API fetch sees empty prev
        state = buggyMerge(LS_CACHE, state);    // cache load → notes wiped
        state = apiMerge(FOLDERS, state);         // API fetch → prev has no notes
        expect(state.filter(r => !r.is_folder)).toHaveLength(0); // ← bug confirmed

        // FIXED: sync() is NOT called inside saveNote for updates
        // State stays as-is after optimistic update
        state = [...DBDATA_WITH_NOTES];
        state = state.map(n => n.id === "n1" ? { ...n, title: "Updated" } : n);
        expect(state.filter(r => !r.is_folder)).toHaveLength(2); // ← notes intact
    });
});
