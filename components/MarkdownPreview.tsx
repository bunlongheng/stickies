"use client";
import { useMemo } from "react";
import { marked, Renderer } from "marked";
import dynamic from "next/dynamic";
import hljs from "highlight.js/lib/core";
import _js from "highlight.js/lib/languages/javascript";
import _ts from "highlight.js/lib/languages/typescript";
import _py from "highlight.js/lib/languages/python";
import _bash from "highlight.js/lib/languages/bash";
import _css from "highlight.js/lib/languages/css";
import _json from "highlight.js/lib/languages/json";
import _sql from "highlight.js/lib/languages/sql";
import _xml from "highlight.js/lib/languages/xml";
import _yaml from "highlight.js/lib/languages/yaml";
import _go from "highlight.js/lib/languages/go";
import _diff from "highlight.js/lib/languages/diff";
hljs.registerLanguage("javascript", _js); hljs.registerLanguage("js", _js);
hljs.registerLanguage("typescript", _ts); hljs.registerLanguage("ts", _ts);
hljs.registerLanguage("python", _py); hljs.registerLanguage("py", _py);
hljs.registerLanguage("bash", _bash); hljs.registerLanguage("sh", _bash); hljs.registerLanguage("shell", _bash);
hljs.registerLanguage("css", _css); hljs.registerLanguage("json", _json);
hljs.registerLanguage("sql", _sql); hljs.registerLanguage("html", _xml); hljs.registerLanguage("xml", _xml);
hljs.registerLanguage("yaml", _yaml); hljs.registerLanguage("yml", _yaml);
hljs.registerLanguage("go", _go); hljs.registerLanguage("diff", _diff);

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

// Preprocess GitHub-style alerts: > [!NOTE/TIP/WARNING/IMPORTANT/CAUTION/SUCCESS/INFO/TODO]
function preprocessAlerts(text: string): string {
    const ALERT_TYPES: Record<string, { emoji: string; color: string; label: string }> = {
        NOTE:      { emoji: "📝", color: "#0969da", label: "Note" },
        TIP:       { emoji: "💡", color: "#1a7f37", label: "Tip" },
        IMPORTANT: { emoji: "⚡", color: "#8250df", label: "Important" },
        WARNING:   { emoji: "⚠️", color: "#bf8700", label: "Warning" },
        CAUTION:   { emoji: "🛑", color: "#cf222e", label: "Caution" },
        SUCCESS:   { emoji: "✅", color: "#1a7f37", label: "Success" },
        INFO:      { emoji: "ℹ️", color: "#0969da", label: "Info" },
        TODO:      { emoji: "✔️", color: "#9a6700", label: "Todo" },
        EXCEPTION: { emoji: "🔥", color: "#cf222e", label: "Exception" },
    };
    return text.replace(
        /^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SUCCESS|INFO|TODO|EXCEPTION)\]\s*\n((?:^>.*\n?)+)/gm,
        (_m, type, body) => {
            const config = ALERT_TYPES[type];
            const cleanBody = body.replace(/^>\s?/gm, "").trim();
            return `<div class="md-alert" style="border-left:4px solid ${config.color};background:${config.color}11;padding:0.8em 1em;margin:0.8em 0;border-radius:0 6px 6px 0;"><div style="font-weight:700;color:${config.color};font-size:0.9em;margin-bottom:0.4em;">${config.emoji} ${config.label}</div><div>${cleanBody.replace(/\n/g, "<br>")}</div></div>\n\n`;
        }
    );
}

export function MarkdownPreview({ content, theme = "dark" }: Props) {
    const segments = useMemo(() => segment(content), [content]);

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-none">
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
                            className="md-preview max-w-none"
                            dangerouslySetInnerHTML={{ __html: marked.parse(preprocessAlerts(seg.text), { async: false, renderer }) as string }}
                        />
                    )
                )}
            </div>
        </div>
    );
}

// Alias for backwards compatibility
export const MarkdownWithMermaid = MarkdownPreview;
