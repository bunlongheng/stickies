'use client';

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TipTapImage from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import { useEffect, useRef } from 'react';

/** Convert markdown or raw content to HTML for TipTap. */
function toHtml(content: string): string {
    if (!content.trim()) return '';
    if (/^\s*<[a-zA-Z]/.test(content)) return content;
    return marked.parse(content, { async: false }) as string;
}

/** Compress image before upload: max 1920px wide, JPEG 85% quality. PNG kept if smaller. */
async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 1920;
            let w = img.width, h = img.height;
            if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            canvas.toBlob((blob) => {
                if (!blob) { resolve(file); return; }
                // Use PNG only if it's actually smaller
                if (outType === 'image/png' && blob.size > file.size) { resolve(file); return; }
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, outType === 'image/png' ? '.png' : '.jpg'), { type: outType }));
            }, outType, 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = url;
    });
}

/** Resizable image node view with corner drag handles. */
function ImageNodeView({ node, updateAttributes }: NodeViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const startResize = (e: React.MouseEvent, dir: string) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = node.attrs.width ?? containerRef.current?.querySelector('img')?.offsetWidth ?? 400;
        const onMove = (ev: MouseEvent) => {
            const delta = dir === 'w' || dir === 'sw' || dir === 'nw'
                ? startX - ev.clientX
                : ev.clientX - startX;
            updateAttributes({ width: Math.max(60, Math.round(startW + delta)) });
        };
        const onUp = () => {
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
                        width: node.attrs.width ? `${node.attrs.width}px` : '100%',
                        maxWidth: '100%',
                        display: 'block',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                />
                {/* Corner handles — visible on hover */}
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
    addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
    },
});

interface Props {
    noteId: string | null;
    content: string;
    onChange: (html: string) => void;
    onBlur: () => void;
    onUploadImage: (file: File) => Promise<string>;
    accentColor: string;
}

export function RichTextEditor({ noteId, content, onChange, onBlur, onUploadImage, accentColor }: Props) {
    const uploadAndCompress = async (file: File) => onUploadImage(await compressImage(file));

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            ResizableImage.configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({ placeholder: 'Start typing…' }),
        ],
        content: toHtml(content),
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
        onBlur: () => onBlur(),
        editorProps: {
            handlePaste(view, event) {
                const items = Array.from(event.clipboardData?.items ?? []);
                const imageItems = items.filter(i => i.type.startsWith('image/'));
                if (imageItems.length === 0) return false;
                event.preventDefault();
                const files = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[];
                Promise.all(files.map(f => uploadAndCompress(f))).then(urls => {
                    const { state, dispatch } = view;
                    let tr = state.tr;
                    urls.forEach(url => {
                        const node = state.schema.nodes.image?.create({ src: url, alt: 'image' });
                        if (node) tr = tr.replaceSelectionWith(node);
                    });
                    dispatch(tr);
                }).catch(console.error);
                return true;
            },
            attributes: { class: 'rich-editor-content', spellcheck: 'true' },
        },
    });

    // Re-sync content when switching notes
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        const newHtml = toHtml(content);
        if (editor.getHTML() !== newHtml) {
            editor.commands.setContent(newHtml, { emitUpdate: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noteId]);

    return (
        <EditorContent
            editor={editor}
            className="rich-editor flex-1 overflow-y-auto ios-editor-scroll"
            style={{ caretColor: accentColor }}
        />
    );
}
