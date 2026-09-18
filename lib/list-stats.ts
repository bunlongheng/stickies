// Pure summary for the list-mode stats footer ("2 folders · 40 notes · 1.2k chars").
// No React, no app state - unit-tested.

export interface StatItem {
    _header?: unknown;
    is_folder?: boolean;
    content?: string | null;
}

export interface ListStatsOpts {
    items: StatItem[];
    atRoot: boolean;                       // root view (no folder open, no search)
    folderCounts: Record<string, number>;  // per-folder note counts (TRASH excluded here)
    dbNoteCount: number;                    // fallback count of live notes when counts are empty
}

// Human size label for a character total: 1.2M / 3.4k / 950 chars.
function charsLabel(totalChars: number): string {
    if (totalChars >= 1_000_000) return `${(totalChars / 1_000_000).toFixed(1)}M chars`;
    if (totalChars >= 1000) return `${(totalChars / 1000).toFixed(1)}k chars`;
    return `${totalChars} chars`;
}

/** Build the footer summary string; empty when there is nothing to count. */
export function listStatsSummary(o: ListStatsOpts): string {
    const realItems = o.items.filter((i) => !i._header);
    const fCount = realItems.filter((i) => i.is_folder).length;
    const totalFromCounts = Object.entries(o.folderCounts).reduce((s, [name, c]) => s + (name === "TRASH" ? 0 : c), 0);
    const nCount = o.atRoot
        ? (totalFromCounts > 0 ? totalFromCounts : o.dbNoteCount)
        : realItems.filter((i) => !i.is_folder).length;
    const totalChars = realItems.filter((i) => !i.is_folder).reduce((acc, i) => acc + (i.content || "").length, 0);
    const parts = [
        fCount > 0 && `${fCount} folder${fCount !== 1 ? "s" : ""}`,
        nCount > 0 && `${nCount} note${nCount !== 1 ? "s" : ""}`,
        totalChars > 0 && charsLabel(totalChars),
    ].filter(Boolean);
    return parts.join(" · ");
}
