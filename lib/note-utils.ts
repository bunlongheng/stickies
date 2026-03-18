/**
 * Pure utility functions extracted from app/(app)/page.tsx
 * Exported here so they can be unit-tested without loading the full React component.
 */

// ── Mermaid ──────────────────────────────────────────────────────────────────

export const MERMAID_KEYWORDS =
    /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|c4container|c4component|c4dynamic|c4deployment)\b/im;

/** Extract raw mermaid code — strips ```mermaid fences + YAML frontmatter */
export function extractMermaid(text: string): string {
    let t = text.trim();
    const fenced = t.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)```\s*$/im);
    if (fenced) t = fenced[1].trim();
    const frontmatter = t.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/m);
    if (frontmatter) {
        const titleMatch = frontmatter[1].match(/^title:\s*(.+)$/m);
        const body = frontmatter[2].trim();
        if (titleMatch) {
            const lines = body.split("\n");
            lines.splice(1, 0, `%% ${titleMatch[1].trim()}`);
            return lines.join("\n");
        }
        return body;
    }
    return t;
}

/** Strip ```mermaid or plain ``` fences */
export function cleanMermaidContent(text: string): string {
    let t = text.trim();
    const fenced = t.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)```\s*$/im);
    if (fenced) t = fenced[1].trim();
    return t;
}

export function detectMermaid(text: string): boolean {
    return MERMAID_KEYWORDS.test(extractMermaid(text));
}

export function mermaidSubType(text: string): string {
    const t = extractMermaid(text);
    const m = t.match(
        /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|c4container|c4component|c4dynamic|c4deployment)\b/im
    );
    if (!m) return "Mermaid";
    const map: Record<string, string> = {
        flowchart: "Flow", graph: "Flow", sequencediagram: "Sequence",
        classdiagram: "Class", statediagram: "State", "statediagram-v2": "State",
        erdiagram: "ER", gantt: "Gantt", pie: "Pie", gitgraph: "Git",
        mindmap: "Mindmap", timeline: "Timeline", xychart: "XY Chart",
        "xychart-beta": "XY Chart", quadrantchart: "Quadrant",
        requirementdiagram: "Requirement", zenuml: "ZenUML",
        sankey: "Sankey", "sankey-beta": "Sankey",
        block: "Block", "block-beta": "Block",
        packet: "Packet", "packet-beta": "Packet",
        kanban: "Kanban",
        architecture: "Architecture", "architecture-beta": "Architecture",
        c4container: "C4 Container", c4component: "C4 Component",
        c4dynamic: "C4 Dynamic", c4deployment: "C4 Deployment",
    };
    return map[m[1].toLowerCase()] ?? m[1];
}

// ── JSON ──────────────────────────────────────────────────────────────────────

export function detectJson(text: string): { ok: boolean; parsed?: unknown } {
    const t = text.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) return { ok: false };
    try { return { ok: true, parsed: JSON.parse(t) }; } catch { return { ok: false }; }
}

// ── Note type detection ───────────────────────────────────────────────────────

/** Client-side fallback type detection — used only when DB type is null (legacy notes) */
export function detectNoteType(content: string): string {
    const t = content.trim();
    if (!t) return "text";
    if (t.startsWith('{"_type":"voice"') || t.startsWith('[{"_type":"voice"')) {
        try {
            const p = JSON.parse(t);
            if (p?._type === "voice" || (Array.isArray(p) && (p as any[])[0]?._type === "voice")) return "voice";
        } catch { /* fall through */ }
    }
    // TipTap JSON — must check before generic JSON detection
    try { const p = JSON.parse(t); if ((p as any)?.type === "doc" && Array.isArray((p as any).content)) return "rich"; } catch { /* fall through */ }
    if (MERMAID_KEYWORDS.test(extractMermaid(t))) return "mermaid";
    if ((t.startsWith("{") || t.startsWith("[")) && detectJson(t).ok) return "json";
    if (/^\s*<!DOCTYPE\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t)) return "html";
    if (/^#{1,6}\s|^\*\*|^>\s/m.test(t) && !/<[a-z][^>]*>/i.test(t)) return "markdown";
    return "text";
}

// ── URL tokens ────────────────────────────────────────────────────────────────

export const toUrlToken = (value: string) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
