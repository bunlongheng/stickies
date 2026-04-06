"use client";
import { useMemo } from "react";
import { marked, Renderer } from "marked";
import dynamic from "next/dynamic";
import hljs from "highlight.js";

// Custom renderer — clean code blocks with syntax highlighting, no visible fences
const renderer = new Renderer();
renderer.link = ({ href, title, tokens }) => {
    const text = tokens.map(t => ("raw" in t ? t.raw : "")).join("") || href;
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};
renderer.codespan = ({ text }) => {
    return `<code>${text.replace(/^`+|`+$/g, "")}</code>`;
};
renderer.code = ({ text, lang }) => {
    const langBadge = lang ? `<span class="code-lang-badge">${lang}</span>` : "";
    let highlighted = text;
    if (lang && hljs.getLanguage(lang)) {
        try { highlighted = hljs.highlight(text, { language: lang }).value; } catch {}
    } else {
        try { highlighted = hljs.highlightAuto(text).value; } catch {}
    }
    return `<div class="code-block-wrapper">${langBadge}<button class="copy-code-btn" aria-label="Copy code">Copy</button><pre><code class="hljs">${highlighted}</code></pre></div>`;
};

const DiagramRenderer = dynamic(() => import("./MermaidRenderer").then(m => ({ default: m.MermaidRenderer })), { ssr: false });

interface Props {
    content: string;
    theme?: "dark" | "light" | "monokai";
}

type Segment = { kind: "md"; text: string } | { kind: "diagram"; code: string };

function segment(raw: string): Segment[] {
    const segments: Segment[] = [];
    const DIAGRAM_KW = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|gitGraph|mindmap|timeline|xychart(-beta)?|quadrantChart|requirementDiagram|zenuml|sankey|block-beta)\b/im;
    const re = /^```mermaid\s*\r?\n([\s\S]*?)^```\s*$/gim;
    let last = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(raw)) !== null) {
        const code = match[1].trim();
        if (!DIAGRAM_KW.test(code)) continue;

        const before = raw.slice(last, match.index);
        if (before.trim()) segments.push({ kind: "md", text: before });
        segments.push({ kind: "diagram", code });
        last = match.index + match[0].length;
    }

    const remaining = raw.slice(last);
    if (remaining.trim()) segments.push({ kind: "md", text: remaining });

    return segments.length ? segments : [{ kind: "md", text: raw }];
}

export function MarkdownPreview({ content, theme = "dark" }: Props) {
    const segments = useMemo(() => segment(content), [content]);

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 max-w-none">
                {segments.map((seg, i) =>
                    seg.kind === "diagram" ? (
                        <div key={i} className="my-4 rounded overflow-hidden" style={{ minHeight: 200 }}>
                            <DiagramRenderer
                                code={seg.code}
                                showCode={false}
                                theme={theme}
                            />
                        </div>
                    ) : (
                        <div key={i}
                            className="prose prose-sm prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: marked.parse(seg.text, { async: false, renderer }) as string }}
                        />
                    )
                )}
            </div>
        </div>
    );
}

// Alias for backwards compatibility
export const MarkdownWithMermaid = MarkdownPreview;
