'use client';

import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, all } from 'lowlight';
import TipTapImage from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { marked } from 'marked';
import { useEffect, useRef, useState, useCallback } from 'react';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/core';

// ── Inline search-highlight extension ─────────────────────────────────────────
const searchPluginKey = new PluginKey<{ decos: DecorationSet; results: number[][] }>('stickiesSearch');

function buildSearchDecos(doc: EditorState['doc'], term: string, currentIdx: number) {
    if (!term) return { decos: DecorationSet.empty, results: [] as number[][] };
    const q = term.toLowerCase();
    const results: number[][] = [];
    doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const text = node.text.toLowerCase();
        let i = text.indexOf(q);
        while (i !== -1) { results.push([pos + i, pos + i + q.length]); i = text.indexOf(q, i + 1); }
    });
    const decos = results.map(([from, to], idx) =>
        Decoration.inline(from, to, {
            style: idx === currentIdx
                ? 'background:rgba(255,214,0,1);color:#000;border-radius:3px;padding:0 3px;margin:0 -3px;'
                : 'background:rgba(255,214,0,0.35);border-radius:3px;padding:0 3px;margin:0 -3px;',
        })
    );
    return { decos: DecorationSet.create(doc, decos), results };
}

const SearchHighlight = Extension.create({
    name: 'stickiesSearch',
    addProseMirrorPlugins() {
        return [new Plugin({
            key: searchPluginKey,
            state: {
                init: (_, state) => buildSearchDecos(state.doc, '', 0),
                apply(tr, prev) {
                    const meta = tr.getMeta(searchPluginKey);
                    if (meta !== undefined) return buildSearchDecos(tr.doc, meta.term ?? '', meta.idx ?? 0);
                    if (tr.docChanged) return { ...prev, decos: prev.decos.map(tr.mapping, tr.doc) };
                    return prev;
                },
            },
            props: { decorations(state) { return searchPluginKey.getState(state)?.decos ?? DecorationSet.empty; } },
        })];
    },
});

/** Detect TipTap JSON format */
function isTiptapJson(s: string): boolean {
    try { const p = JSON.parse(s); return p?.type === 'doc'; } catch { return false; }
}

/** Parse content into something TipTap can consume (JSON object, HTML string, or empty) */
function parseContent(content: string): object | string {
    if (!content.trim()) return '';
    if (isTiptapJson(content)) return JSON.parse(content);
    if (/^\s*<[a-zA-Z]/.test(content)) return content; // legacy HTML
    return marked.parse(content, { async: false }) as string; // markdown
}

/** Compress image to 50% of original dimensions, JPEG 85% quality. */
async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const w = Math.max(60, Math.ceil(img.width * 0.5));
            const h = Math.ceil(img.height * 0.5);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            canvas.toBlob((blob) => {
                if (!blob) { resolve(file); return; }
                if (outType === 'image/png' && blob.size > file.size) { resolve(file); return; }
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, outType === 'image/png' ? '.png' : '.jpg'), { type: outType }));
            }, outType, 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = url;
    });
}

// ── File attachment helpers ──────────────────────────────────────────────────

const ATTACHABLE_EXT = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|zip|rar|7z|tar|gz|bz2)$/i;

function isAttachableFile(f: File): boolean {
    return ATTACHABLE_EXT.test(f.name)
        || f.type === 'application/pdf'
        || f.type.includes('zip') || f.type.includes('archive')
        || f.type.includes('document') || f.type.includes('spreadsheet')
        || f.type.includes('presentation');
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(type: string, name: string): string {
    if (type === 'application/pdf' || name.endsWith('.pdf')) return '📄';
    if (/\.(zip|rar|7z|tar|gz|bz2)$/i.test(name) || type.includes('zip') || type.includes('archive')) return '🗜️';
    if (/\.(doc|docx)$/i.test(name) || type.includes('word')) return '📝';
    if (/\.(xls|xlsx|csv)$/i.test(name) || type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (/\.(ppt|pptx)$/i.test(name) || type.includes('powerpoint') || type.includes('presentation')) return '📊';
    return '📎';
}

// ── File Attachment NodeView ─────────────────────────────────────────────────

function FileAttachmentNodeView({ node }: NodeViewProps) {
    const { src, fileName, fileType, fileSize } = node.attrs as {
        src: string; fileName: string; fileType: string; fileSize: number;
    };
    return (
        <NodeViewWrapper as="span" style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }}>
            <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                contentEditable={false}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 8px 3px 6px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.13)',
                    color: 'rgba(255,255,255,0.82)', fontSize: 12,
                    textDecoration: 'none', cursor: 'pointer',
                    maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden',
                    userSelect: 'none',
                }}
            >
                <span style={{ flexShrink: 0, fontSize: 13 }}>{fileEmoji(fileType ?? '', fileName ?? '')}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                    {fileName || 'file'}
                </span>
                {fileSize > 0 && (
                    <span style={{ opacity: 0.45, flexShrink: 0, fontSize: 11 }}>
                        {formatFileSize(fileSize)}
                    </span>
                )}
            </a>
        </NodeViewWrapper>
    );
}

const FileAttachmentExtension = Node.create({
    name: 'fileAttachment',
    group: 'inline',
    inline: true,
    atom: true,
    addAttributes() {
        return {
            src: { default: null },
            fileName: { default: '' },
            fileType: { default: '' },
            fileSize: { default: 0 },
        };
    },
    parseHTML() { return [{ tag: 'span[data-file-attachment]' }]; },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes({ 'data-file-attachment': '' }, HTMLAttributes)];
    },
    addNodeView() { return ReactNodeViewRenderer(FileAttachmentNodeView); },
});

// ── Resizable Image ──────────────────────────────────────────────────────────

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [resizing, setResizing] = useState(false);
    const [pct, setPct] = useState<number | null>(null);

    const startResize = (e: React.MouseEvent, dir: string) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const imgEl = containerRef.current?.querySelector('img') as HTMLImageElement | null;
        const startW = node.attrs.width ?? imgEl?.offsetWidth ?? 400;
        const naturalW = imgEl?.naturalWidth ?? startW;
        setResizing(true);
        const onMove = (ev: MouseEvent) => {
            const delta = dir === 'w' || dir === 'sw' || dir === 'nw'
                ? startX - ev.clientX
                : ev.clientX - startX;
            const newW = Math.max(60, Math.round(startW + delta));
            updateAttributes({ width: newW });
            setPct(Math.round((newW / naturalW) * 100));
        };
        const onUp = () => {
            setResizing(false);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleStyle: React.CSSProperties = {
        position: 'absolute', width: 10, height: 10,
        background: 'white', border: '1.5px solid rgba(0,0,0,0.4)',
        borderRadius: 2, zIndex: 10,
    };

    return (
        <NodeViewWrapper>
            <div ref={containerRef} className="group relative inline-block" style={{ maxWidth: '100%', lineHeight: 0 }}>
                <img
                    src={node.attrs.src}
                    alt={node.attrs.alt ?? ''}
                    draggable={false}
                    style={{
                        width: node.attrs.width ? `min(100%, ${node.attrs.width}px)` : '100%',
                        maxWidth: '100%',
                        display: 'block',
                        borderRadius: 6,
                        border: selected ? '2px solid #a6e22e' : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: selected ? '0 0 0 3px rgba(166,226,46,0.25)' : 'none',
                        transition: 'border 0.1s, box-shadow 0.1s',
                    }}
                />
                {resizing && pct !== null && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[11px] font-black text-white pointer-events-none"
                        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                        {pct}%
                    </div>
                )}
                {[
                    { dir: 'nw', style: { top: -4, left: -4, cursor: 'nw-resize' } },
                    { dir: 'ne', style: { top: -4, right: -4, cursor: 'ne-resize' } },
                    { dir: 'sw', style: { bottom: -4, left: -4, cursor: 'sw-resize' } },
                    { dir: 'se', style: { bottom: -4, right: -4, cursor: 'se-resize' } },
                ].map(({ dir, style }) => (
                    <div
                        key={dir}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ ...handleStyle, ...style }}
                        onMouseDown={(e) => startResize(e, dir)}
                    />
                ))}
            </div>
        </NodeViewWrapper>
    );
}

const ResizableImage = TipTapImage.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: { default: null, renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {} },
        };
    },
    addNodeView() { return ReactNodeViewRenderer(ImageNodeView); },
});

// ── Editor view helper types ─────────────────────────────────────────────────
type PmView = { state: EditorState; dispatch: (tr: Transaction) => void };

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
    noteId: string | null;
    content: string;
    onChange: (html: string) => void;
    onBlur: () => void;
    onUploadImage: (file: File) => Promise<string>;
    onDelete?: () => void;
    accentColor: string;
    editMode?: boolean;
    searchTerm?: string;
    searchIndex?: number;
    onSearchResults?: (count: number) => void;
}

// ── Code block node view with floating copy button ────────────────────────────
function CodeBlockView({ node }: NodeViewProps) {
    const copy = useCallback(() => {
        const text = node.textContent;
        const success = () => window.dispatchEvent(new CustomEvent('stickies-toast', { detail: { msg: '📋 Copied!', color: '#34C759' } }));
        const fail = () => window.dispatchEvent(new CustomEvent('stickies-toast', { detail: { msg: 'Copy failed', color: '#FF3B30' } }));
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(success).catch(() => {
                try { const el = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); success(); } catch { fail(); }
            });
        } else {
            try { const el = Object.assign(document.createElement('textarea'), { value: text }); document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); success(); } catch { fail(); }
        }
    }, [node.textContent]);
    return (
        <NodeViewWrapper className="relative group">
            <pre><NodeViewContent as={"code" as any} className={`language-${node.attrs.language || 'bash'}`} /></pre>
            <button
                onClick={copy}
                contentEditable={false}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#f8f8f2', border: 'none', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
            >
                Copy
            </button>
        </NodeViewWrapper>
    );
}

const lowlight = createLowlight(all);

const CodeBlockWithCopy = CodeBlockLowlight.extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
    },
});

export function RichTextEditor({ noteId, content, onChange, onBlur, onUploadImage, onDelete, accentColor, editMode, searchTerm, searchIndex, onSearchResults }: Props) {
    const [uploading, setUploading] = useState(false);
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const [fontOpen, setFontOpen] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const fontRef = useRef<HTMLDivElement>(null);
    const isProgrammaticUpdate = useRef(false);
    // Keep latest callbacks in refs so debounced timer always calls the current version
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    const onBlurRef = useRef(onBlur);
    useEffect(() => { onBlurRef.current = onBlur; }, [onBlur]);
    const onUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Tracks the last JSON we sent to parent — used to skip re-sync when content came from us
    const lastSentRef = useRef('');
    const flushOnChange = useCallback((editor: { getJSON(): unknown }) => {
        if (onUpdateTimer.current) { clearTimeout(onUpdateTimer.current); onUpdateTimer.current = null; }
        const json = JSON.stringify(editor.getJSON());
        if (json === lastSentRef.current) return;
        lastSentRef.current = json;
        onChangeRef.current(json);
    }, []);

    const uploadAndCompress = async (file: File) => onUploadImage(await compressImage(file));

    /** Insert image nodes at a specific position (or current selection). */
    const insertImages = (view: PmView, files: File[], atPos?: number) => {
        setUploading(true);
        Promise.all(files.map(f => uploadAndCompress(f))).then(urls => {
            const { state, dispatch } = view;
            let tr = state.tr;
            let pos = atPos ?? state.selection.anchor;
            urls.forEach(url => {
                const node = state.schema.nodes.image?.create({ src: url, alt: 'image' });
                if (node) { tr = tr.insert(pos, node); pos += node.nodeSize; }
            });
            dispatch(tr);
        }).catch(console.error).finally(() => setUploading(false));
    };

    /** Insert file attachment pills at a specific position (or current selection). */
    const insertAttachments = (view: PmView, files: File[], atPos?: number) => {
        setUploading(true);
        Promise.all(files.map(f => onUploadImage(f).then(url => ({ url, file: f })))).then(results => {
            const { state, dispatch } = view;
            let tr = state.tr;
            let pos = atPos ?? state.selection.anchor;
            results.forEach(({ url, file }) => {
                const node = state.schema.nodes.fileAttachment?.create({
                    src: url,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                });
                if (node) { tr = tr.insert(pos, node); pos += node.nodeSize; }
            });
            dispatch(tr);
        }).catch(console.error).finally(() => setUploading(false));
    };

    /** Get the document position from pointer event coordinates. */
    const posAtEvent = (view: { posAtCoords: (coords: { left: number; top: number }) => { pos: number } | null }, e: MouseEvent | React.MouseEvent) => {
        const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
        return coords?.pos ?? undefined;
    };

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            TextStyle,
            FontFamily,
            CodeBlockWithCopy.configure({ lowlight, defaultLanguage: 'bash' }),
            ResizableImage.configure({ inline: false, allowBase64: false }),
            FileAttachmentExtension,
            Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({ placeholder: 'Start typing…' }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            SearchHighlight,
        ],
        content: parseContent(content),
        onUpdate: ({ editor }) => {
            if (isProgrammaticUpdate.current) return;
            // Debounce: serialization + React state update deferred 300ms after last keystroke
            if (onUpdateTimer.current) clearTimeout(onUpdateTimer.current);
            onUpdateTimer.current = setTimeout(() => {
                onUpdateTimer.current = null;
                const json = JSON.stringify(editor.getJSON());
                if (json === lastSentRef.current) return;
                lastSentRef.current = json;
                onChangeRef.current(json);
            }, 300);
        },
        onSelectionUpdate: ({ editor }) => {
            setHasSelection(!editor.state.selection.empty);
        },
        onBlur: ({ editor }) => { flushOnChange(editor); onBlurRef.current(); setHasSelection(false); },
        editorProps: {
            handlePaste(view, event) {
                const items = Array.from(event.clipboardData?.items ?? []);
                const imageFiles = items
                    .filter(i => i.type.startsWith('image/'))
                    .map(i => i.getAsFile())
                    .filter(Boolean) as File[];
                const otherFiles = items
                    .filter(i => !i.type.startsWith('image/') && i.kind === 'file')
                    .map(i => i.getAsFile())
                    .filter((f): f is File => f !== null && isAttachableFile(f));
                if (imageFiles.length === 0 && otherFiles.length === 0) return false;
                event.preventDefault();
                if (imageFiles.length > 0) insertImages(view, imageFiles);
                if (otherFiles.length > 0) insertAttachments(view, otherFiles);
                return true;
            },
            handleDrop(view, event) {
                const dt = (event as DragEvent).dataTransfer;
                const allFiles = Array.from(dt?.files ?? []);
                const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
                const attachFiles = allFiles.filter(f => !f.type.startsWith('image/') && isAttachableFile(f));
                if (imageFiles.length === 0 && attachFiles.length === 0) return false;
                event.preventDefault();
                // Resolve drop position from pointer coordinates so files land where dropped
                const at = posAtEvent(view as Parameters<typeof posAtEvent>[0], event as MouseEvent);
                if (imageFiles.length > 0) insertImages(view, imageFiles, at);
                if (attachFiles.length > 0) insertAttachments(view, attachFiles, at);
                return true;
            },
            attributes: { class: 'rich-editor-content', spellcheck: 'true' },
        },
    });

    // Re-sync content when switching notes OR when content arrives async after remount.
    // Skip if content came from this editor (lastSentRef) — avoids a re-sync loop on every save.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        if (!content) return;
        if (content === lastSentRef.current) return; // we sent this — don't push it back
        // Defer setContent out of the React render cycle to avoid flushSync conflict
        queueMicrotask(() => {
            if (!editor || editor.isDestroyed) return;
            isProgrammaticUpdate.current = true;
            editor.commands.setContent(parseContent(content));
            isProgrammaticUpdate.current = false;
            lastSentRef.current = content;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noteId, content]);

    // Search highlight — dispatch to ProseMirror plugin whenever term or index changes
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        const term = searchTerm ?? '';
        const idx = searchIndex ?? 0;
        const tr = editor.state.tr.setMeta(searchPluginKey, { term, idx });
        editor.view.dispatch(tr);
        // State is updated synchronously after dispatch
        const ps = searchPluginKey.getState(editor.state);
        const results: number[][] = ps?.results ?? [];
        onSearchResults?.(results.length);
        const match = results[idx];
        if (match) {
            editor.commands.setTextSelection({ from: match[0], to: match[1] });
            editor.commands.scrollIntoView();
        }
    }, [searchTerm, searchIndex, editor]);

    const FONTS = [
        { label: 'Default',    value: '' },
        { label: 'Sans',       value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
        { label: 'Serif',      value: 'Georgia, "Times New Roman", serif' },
        { label: 'Mono',       value: '"Fira Code", "Cascadia Code", Consolas, monospace' },
        { label: 'Inter',      value: 'Inter, sans-serif' },
        { label: 'Garamond',   value: 'Garamond, "EB Garamond", serif' },
        { label: 'Courier',    value: '"Courier New", Courier, monospace' },
    ];

    // Close font dropdown on outside click
    useEffect(() => {
        if (!fontOpen) return;
        const handler = (e: MouseEvent) => {
            if (fontRef.current && !fontRef.current.contains(e.target as globalThis.Node)) setFontOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [fontOpen]);

    const tb = editor; // shorthand for toolbar commands

    const btnBase = (active?: boolean): React.CSSProperties => ({
        height: 29, padding: '0 6px', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
        border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
        background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.72)',
        transition: 'background 0.1s, color 0.1s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const ToolBtn = ({
        label, active, onClick, wide,
    }: { label: string; active?: boolean; onClick: () => void; wide?: boolean }) => (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            title={label}
            style={{
                ...btnBase(active),
                minWidth: wide ? 36 : 29,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'ui-monospace, monospace',
                letterSpacing: '-0.01em',
            }}
        >{label}</button>
    );

    const Sep = () => (
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', flexShrink: 0, margin: '0 3px' }} />
    );

    /* SVG icons for clarity */
    const IcoBold    = () => <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor"><path d="M2 1h4.5a3 3 0 0 1 0 6H2V1Zm0 6h5a3 3 0 0 1 0 6H2V7Z"/></svg>;
    const IcoItalic  = () => <svg width="9"  height="13" viewBox="0 0 9 13"  fill="currentColor"><path d="M3 1h6M0 12h6M5.5 1 3.5 12"/><line x1="3" y1="1" x2="9" y2="1" stroke="currentColor" strokeWidth="1.5"/><line x1="0" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5"/><line x1="6.5" y1="1" x2="3.5" y2="12" stroke="currentColor" strokeWidth="1.5"/></svg>;
    const IcoStrike  = () => <svg width="12" height="13" viewBox="0 0 12 13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4a3.5 3.5 0 0 1 3.5-3h3A3 3 0 0 1 10 4.5c0 .7-.2 1.3-.6 1.8" strokeLinecap="round"/><path d="M3 9.5A3 3 0 0 0 5.5 12h1A3.5 3.5 0 0 0 10 8.5" strokeLinecap="round"/><line x1="0" y1="6.5" x2="12" y2="6.5"/></svg>;
    const IcoQuote   = () => <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor"><path d="M0 7V4a4 4 0 0 1 4-4h.5v2H4a2 2 0 0 0-2 2v.5h2V7H0Zm7 0V4a4 4 0 0 1 4-4h.5v2H11a2 2 0 0 0-2 2v.5h2V7H7Z"/></svg>;
    const IcoCode    = () => <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,2 1,5.5 4,9"/><polyline points="10,2 13,5.5 10,9"/><line x1="8" y1="0.5" x2="6" y2="10.5"/></svg>;
    const IcoHR      = () => <svg width="14" height="8"  viewBox="0 0 14 8"  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="0" y1="4" x2="14" y2="4"/><circle cx="4"  cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="4" r="1.5" fill="currentColor" stroke="none"/></svg>;
    const IcoTable   = () => <svg width="15" height="13" viewBox="0 0 15 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square"><rect x="0.65" y="0.65" width="13.7" height="11.7" rx="1"/><line x1="0.65" y1="4"   x2="14.35" y2="4"/><line x1="0.65" y1="8.5" x2="14.35" y2="8.5"/><line x1="7.5"  y1="4"   x2="7.5"   y2="12.35"/></svg>;
    const IcoTrash   = () => <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><polyline points="1,3 12,3"/><path d="M4 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1"/><rect x="2" y="3" width="9" height="10" rx="1"/><line x1="5" y1="6" x2="5" y2="10"/><line x1="8" y1="6" x2="8" y2="10"/></svg>;
    const IcoBullet  = () => <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor"><circle cx="1.5" cy="2"   r="1.5"/><circle cx="1.5" cy="6"   r="1.5"/><circle cx="1.5" cy="10"  r="1.5"/><rect x="4" y="1"  width="10" height="2" rx="1"/><rect x="4" y="5"  width="10" height="2" rx="1"/><rect x="4" y="9"  width="10" height="2" rx="1"/></svg>;
    const IcoOrdered = () => <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor"><text x="0" y="3"  fontSize="3.5" fontWeight="700" fontFamily="monospace">1.</text><text x="0" y="7"  fontSize="3.5" fontWeight="700" fontFamily="monospace">2.</text><text x="0" y="11" fontSize="3.5" fontWeight="700" fontFamily="monospace">3.</text><rect x="5" y="1"  width="9" height="2" rx="1"/><rect x="5" y="5"  width="9" height="2" rx="1"/><rect x="5" y="9"  width="9" height="2" rx="1"/></svg>;
    const IcoCheck   = () => <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="0.65" y="0.65" width="4.7" height="4.7" rx="0.7"/><polyline points="1.5,3 3,4.5 5.5,1.5"/><rect x="0.65" y="5.65" width="4.7" height="4.7" rx="0.7"/><rect x="7" y="1.5" width="6" height="1.7" rx="0.8" fill="currentColor" stroke="none"/><rect x="7" y="6.5" width="6" height="1.7" rx="0.8" fill="currentColor" stroke="none"/></svg>;

    const SvgBtn = ({ icon, active, onClick, title }: { icon: React.ReactNode; active?: boolean; onClick: () => void; title: string }) => (
        <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }} title={title} style={btnBase(active)}>
            {icon}
        </button>
    );

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* ── Formatting toolbar — only when text is selected ── */}
            {tb && editMode && hasSelection && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    padding: '5px 8px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(0,0,0,0.5)',
                    overflowX: 'auto',
                    flexShrink: 0,
                    scrollbarWidth: 'none',
                }}>
                    {/* Font family picker */}
                    <div ref={fontRef} style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setFontOpen(v => !v); }}
                            style={{
                                ...btnBase(fontOpen),
                                padding: '0 7px', minWidth: 52, gap: 4,
                                fontFamily: tb.getAttributes('textStyle').fontFamily || 'inherit',
                                fontSize: 11, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                            title="Font family"
                        >
                            <span style={{ maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {(() => {
                                    const cur = tb.getAttributes('textStyle').fontFamily || '';
                                    return FONTS.find(f => f.value === cur)?.label ?? 'Font';
                                })()}
                            </span>
                            <svg width="7" height="5" viewBox="0 0 7 5" fill="currentColor" style={{ flexShrink: 0, opacity: 0.6 }}><path d="M0 0h7L3.5 5z"/></svg>
                        </button>
                        {fontOpen && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 999, marginTop: 4,
                                background: '#18181b', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8, padding: '4px 0', minWidth: 130,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                            }}>
                                {FONTS.map(f => {
                                    const cur = tb.getAttributes('textStyle').fontFamily || '';
                                    const isActive = f.value === cur;
                                    return (
                                        <button
                                            key={f.value}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                if (f.value) {
                                                    tb.chain().focus().setFontFamily(f.value).run();
                                                } else {
                                                    tb.chain().focus().unsetFontFamily().run();
                                                }
                                                setFontOpen(false);
                                            }}
                                            style={{
                                                display: 'block', width: '100%', textAlign: 'left',
                                                padding: '6px 12px', fontFamily: f.value || 'inherit',
                                                fontSize: 12, background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                                color: isActive ? '#fff' : 'rgba(255,255,255,0.72)',
                                                border: 'none', cursor: 'pointer', transition: 'background 0.1s',
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            {f.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <Sep />
                    <SvgBtn icon={<IcoBold />}    active={tb.isActive('bold')}    onClick={() => tb.chain().focus().toggleBold().run()}    title="Bold" />
                    <SvgBtn icon={<IcoItalic />}  active={tb.isActive('italic')}  onClick={() => tb.chain().focus().toggleItalic().run()}  title="Italic" />
                    <SvgBtn icon={<IcoStrike />}  active={tb.isActive('strike')}  onClick={() => tb.chain().focus().toggleStrike().run()}  title="Strikethrough" />
                    <Sep />
                    <SvgBtn icon={<IcoBullet />}  active={tb.isActive('bulletList')}  onClick={() => tb.chain().focus().toggleBulletList().run()}  title="Bullet list" />
                    <SvgBtn icon={<IcoOrdered />} active={tb.isActive('orderedList')} onClick={() => tb.chain().focus().toggleOrderedList().run()} title="Numbered list" />
                    <SvgBtn icon={<IcoCheck />}   active={tb.isActive('taskList')}    onClick={() => tb.chain().focus().toggleTaskList().run()}    title="Task list" />
                    <Sep />
                    <SvgBtn icon={<IcoQuote />}   active={tb.isActive('blockquote')} onClick={() => tb.chain().focus().toggleBlockquote().run()} title="Blockquote" />
                    <SvgBtn icon={<IcoCode />}    active={tb.isActive('codeBlock')}  onClick={() => tb.chain().focus().toggleCodeBlock().run()}  title="Code block" />
                    <SvgBtn icon={<IcoHR />}      active={false}                     onClick={() => tb.chain().focus().setHorizontalRule().run()} title="Divider" />
                    <Sep />
                    <SvgBtn icon={<IcoTable />}   active={tb.isActive('table')}      onClick={() => tb.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()} title="Insert table" />
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {(uploading || dragPos) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700 }}>
                                <svg style={{ width: 13, height: 13, animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                </svg>
                                {uploading ? 'Uploading…' : 'Drop to insert'}
                            </div>
                        )}
                        {onDelete && (
                            <>
                                {(uploading || dragPos) && <Sep />}
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); onDelete(); }}
                                    title="Delete note"
                                    style={{ ...btnBase(), color: 'rgba(239,68,68,0.65)' }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.65)')}
                                ><IcoTrash /></button>
                            </>
                        )}
                    </div>
                </div>
            )}
            {/* ── Editor content ── */}
            <div
                className="rich-editor flex-1 overflow-y-auto overflow-x-hidden ios-editor-scroll relative"
                onDragOver={(e) => { e.preventDefault(); setDragPos({ x: e.clientX, y: e.clientY }); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDragPos(null); }}
                onDrop={() => setDragPos(null)}
            >
                <EditorContent
                    editor={editor}
                    className="h-full"
                    style={{ caretColor: accentColor }}
                />
            </div>
            {/* Drop-position spinner — fixed at cursor */}
            {dragPos && (
                <div style={{ position: 'fixed', left: dragPos.x, top: dragPos.y, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 9999 }}>
                    <svg style={{ width: 28, height: 28, animation: 'spin 0.7s linear infinite', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.4))' }} viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </div>
            )}
        </div>
    );
}
