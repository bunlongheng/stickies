'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TipTapImage from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import { useEffect } from 'react';

/** Convert markdown or raw content to HTML for TipTap. */
function toHtml(content: string): string {
    if (!content.trim()) return '';
    if (/^\s*<[a-zA-Z]/.test(content)) return content; // already HTML
    return marked.parse(content, { async: false }) as string;
}

interface Props {
    noteId: string | null;
    content: string;
    onChange: (html: string) => void;
    onBlur: () => void;
    onUploadImage: (file: File) => Promise<string>;
    accentColor: string;
}

export function RichTextEditor({ noteId, content, onChange, onBlur, onUploadImage, accentColor }: Props) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            TipTapImage.configure({ inline: false, allowBase64: false }),
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
                Promise.all(files.map(f => onUploadImage(f))).then(urls => {
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
        const current = editor.getHTML();
        if (current !== newHtml) {
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
