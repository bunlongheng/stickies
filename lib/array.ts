// Pure array helpers for the notes UI. No React, no app state.

// Reorder `items` by moving the element whose id === fromId to just before or
// after the element whose id === toId. Ids are compared as strings so numeric
// and string ids match. Returns the original array unchanged if either id is
// missing (no-op drag). Does not mutate the input.
export function insertById<T extends { id: unknown }>(
    items: T[],
    fromId: string,
    toId: string,
    side: "before" | "after",
): T[] {
    const fromIndex = items.findIndex((item) => String(item.id) === fromId);
    if (fromIndex === -1) return items;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    const toIndex = next.findIndex((item) => String(item.id) === toId);
    if (toIndex === -1) return items;
    next.splice(side === "before" ? toIndex : toIndex + 1, 0, moved);
    return next;
}
