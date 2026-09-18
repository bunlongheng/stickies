// Presentational constants extracted from app/(app)/page.tsx (God-component
// decomposition). Pure data, no component state.
import { palette12 } from "@/lib/colors";

// Extra swatches shown in the color picker beyond the 12-color palette.
export const colorPickerPalette = [...palette12, "#8E8E93", "#FFFFFF"];

// Note-type badge: short label + accent color, keyed by note type.
export const TYPE_BADGE: Record<string, { label: string; color: string }> = {
    text:       { label: "TXT",         color: "#71717a" },
    javascript: { label: "Javascript",  color: "#f97316" },
    typescript: { label: "Typescript",  color: "#3b82f6" },
    python:     { label: "Python",      color: "#eab308" },
    css:        { label: "CSS",         color: "#8b5cf6" },
    sql:        { label: "SQL",         color: "#14b8a6" },
    bash:       { label: "Bash",        color: "#22c55e" },
    html:       { label: "HTML",        color: "#f43f5e" },
    json:       { label: "JSON",        color: "#fbbf24" },
    checklist:  { label: "Checklist",   color: "#22c55e" },
};

// Rotating empty-state encouragements shown when a folder/view has no notes.
export const EMPTY_QUOTES = ["🧠 Your second brain starts here. Write it down.", "✨ Great ideas deserve a home. Start now.", "📌 No more forgetting. Capture it.", "🚀 Dreams without notes are just wishes.", "📝 Plan it. Track it. Win it.", "🎯 Nothing works without priorities. Start here.", "💡 One note today. Clarity tomorrow.", "📚 Build your thinking system. One note at a time.", "⚡ Preparing is everything. Write first.", "🏆 Goals become real when you record them."];
