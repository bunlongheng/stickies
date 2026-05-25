// Pure formatting helpers for the notes API — unit-tested.

const PALETTE = [
    "#FF3B30", "#FF6B4E", "#FF9500", "#FFCC00",
    "#D4E157", "#34C759", "#00C7BE", "#32ADE6",
    "#007AFF", "#5856D6", "#AF52DE", "#FF2D55",
];

export const COLOR_NAMES: Record<string, string> = {
    "#FF3B30": "red", "#FF6B4E": "coral", "#FF9500": "orange", "#FFCC00": "yellow",
    "#D4E157": "lime", "#34C759": "green", "#00C7BE": "teal", "#32ADE6": "sky blue",
    "#007AFF": "blue", "#5856D6": "indigo", "#AF52DE": "purple", "#FF2D55": "pink",
};

/** Friendly name for a palette hex; falls back to the hex itself. */
export function colorName(hex: string): string {
    return COLOR_NAMES[(hex || "").toUpperCase()] ?? hex;
}

/**
 * Strip emoji/pictographs from a title so API note titles stay clean text and
 * don't clash with the note's assigned icon. Removes pictographs, regional
 * indicators (flags), variation selectors, ZWJ, and keycap combiners; collapses
 * leftover whitespace.
 */
export function stripEmoji(s: string): string {
    return (s || "")
        .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

export { PALETTE };
