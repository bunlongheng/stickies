"use client";

import { useEditor, EditorContent, type JSONContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";

export interface RichEditorChange {
    doc: JSONContent;
    text: string;
}

interface RichEditorProps {
    initialDoc?: JSONContent | null;
    initialText?: string;
    placeholder?: string;
    onChange?: (change: RichEditorChange) => void;
    onUploadImage?: (file: File) => Promise<string>;
    autoFocus?: boolean;
    accentColor?: string;
}

// Empty doc helper — ProseMirror requires a doc with at least one block
const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export default function RichEditor({
    initialDoc,
    initialText,
    placeholder,
    onChange,
    onUploadImage,
    autoFocus,
    accentColor,
}: RichEditorProps) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const uploadRef = useRef(onUploadImage);
    uploadRef.current = onUploadImage;

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: { HTMLAttributes: { class: "rich-code-block" } },
            }),
            Image.configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
            Table.configure({ resizable: true, HTMLAttributes: { class: "rich-table" } }),
            TableRow,
            TableHeader,
            TableCell,
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
        ],
        content: initialDoc ?? (initialText ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: initialText }] }] } : EMPTY_DOC),
        autofocus: autoFocus ? "end" : false,
        onUpdate: ({ editor: e }) => {
            const fn = onChangeRef.current;
            if (fn) fn({ doc: e.getJSON(), text: e.getText() });
        },
        editorProps: {
            attributes: {
                class: "rich-editor-prose focus:outline-none",
                spellcheck: "true",
            },
            handlePaste(view, event) {
                // 1) Image paste — upload to gdrive, insert as image node.
                const items = Array.from(event.clipboardData?.items ?? []);
                const imageItem = items.find(i => i.type.startsWith("image/"));
                if (imageItem) {
                    const file = imageItem.getAsFile();
                    if (!file) return false;
                    event.preventDefault();
                    const upload = uploadRef.current;
                    if (!upload) return true;
                    void upload(file)
                        .then(url => {
                            if (!url || typeof url !== "string") throw new Error("Upload returned no URL");
                            const { schema } = view.state;
                            const node = schema.nodes.image.create({ src: url, alt: file.name });
                            const tr = view.state.tr.replaceSelectionWith(node);
                            view.dispatch(tr);
                        })
                        .catch(err => {
                            console.error("[RichEditor paste upload]", err);
                            window.dispatchEvent(new CustomEvent("stickies:upload-error", { detail: { name: file.name, error: err?.message ?? String(err) } }));
                        });
                    return true;
                }

                // 2) Plain-text paste — strip leading whitespace per line (same behaviour as
                //    the plain-text editor's handleEditorPaste). Skip when HTML is present so
                //    pasted rich content keeps its structure.
                const plain = event.clipboardData?.getData("text/plain") ?? "";
                const html = event.clipboardData?.getData("text/html") ?? "";
                if (plain && !html) {
                    const cleaned = plain
                        .replace(/^[•·*]\s*/gm, "")          // drop leading bullets
                        .replace(/^[ \t ​]+/gm, ""); // drop leading whitespace
                    if (cleaned !== plain) {
                        event.preventDefault();
                        view.dispatch(view.state.tr.insertText(cleaned));
                        return true;
                    }
                }

                return false;
            },
            handleDrop(view, event, _slice, moved) {
                if (moved) return false;
                // Accept by MIME (image/*) OR by filename extension (covers .heic, .webp,
                // pasted-from-clipboard files where the OS didn't set a type, etc.).
                const isImageFile = (f: File) =>
                    f.type.startsWith("image/") ||
                    /\.(heic|heif|webp|avif|png|jpg|jpeg|gif|svg|bmp|tiff?|ico|jfif)$/i.test(f.name);
                const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
                if (files.length === 0) return false;
                event.preventDefault();
                const upload = uploadRef.current;
                if (!upload) return true;
                const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
                // Per-file upload so a single failure doesn't tank the whole batch.
                files.forEach((file) => {
                    void upload(file)
                        .then(url => {
                            if (!url || typeof url !== "string") throw new Error("Upload returned no URL");
                            const { schema } = view.state;
                            const node = schema.nodes.image.create({ src: url, alt: file.name });
                            const tr = coords ? view.state.tr.insert(coords.pos, node) : view.state.tr.replaceSelectionWith(node);
                            view.dispatch(tr);
                        })
                        .catch(err => {
                            console.error("[RichEditor drop upload]", err);
                            window.dispatchEvent(new CustomEvent("stickies:upload-error", { detail: { name: file.name, error: err?.message ?? String(err) } }));
                        });
                });
                return true;
            },
        },
    });

    // Apply external doc changes (e.g. Pusher sync, async note fetch) without
    // clobbering in-progress edits. The "focused" guard is only honoured when the
    // editor already has user content — otherwise an autoFocus'd new mount with an
    // empty doc would refuse to load the late-arriving initialDoc.
    useEffect(() => {
        if (!editor || !initialDoc) return;
        const current = editor.getJSON();
        if (JSON.stringify(current) === JSON.stringify(initialDoc)) return;
        const isEditorEmpty = !current.content?.length ||
            (current.content.length === 1 &&
             current.content[0].type === "paragraph" &&
             !current.content[0].content?.length);
        if (editor.isFocused && !isEditorEmpty) return;
        editor.commands.setContent(initialDoc, false);
    }, [editor, initialDoc]);

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {editor && <Toolbar editor={editor} onUploadImage={onUploadImage} />}
            {/* Reduced left/right padding (px-3) and top/bottom (py-2.5) — Bunlong wanted
              * "remove beginning spaces" and tighter overall density. */}
            <div className="rich-editor-root flex-1 min-h-0 overflow-y-auto px-3 py-2.5" style={accentColor ? { caretColor: accentColor } : undefined}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

// ── Toolbar ────────────────────────────────────────────────────────────────
function Toolbar({ editor, onUploadImage }: { editor: Editor; onUploadImage?: (file: File) => Promise<string> }) {
    const [, setTick] = useState(0);
    // Force re-render on selection/transaction so active-state highlights update.
    useEffect(() => {
        const onUpdate = () => setTick(t => t + 1);
        editor.on("selectionUpdate", onUpdate);
        editor.on("transaction", onUpdate);
        return () => { editor.off("selectionUpdate", onUpdate); editor.off("transaction", onUpdate); };
    }, [editor]);

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const handleFile = async (file: File) => {
        if (!onUploadImage) return;
        try {
            const url = await onUploadImage(file);
            if (!url || typeof url !== "string") throw new Error("Upload returned no URL");
            editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        } catch (err: any) {
            console.error("[RichEditor toolbar upload]", err);
            window.dispatchEvent(new CustomEvent("stickies:upload-error", { detail: { name: file.name, error: err?.message ?? String(err) } }));
        }
    };

    const btn = (active: boolean) =>
        `px-2 py-1.5 text-[11px] font-bold transition rounded ${active ? "bg-black/10 text-black" : "text-zinc-600 hover:text-black hover:bg-black/5"}`;

    return (
        <div className="flex items-center gap-0.5 flex-wrap px-3 py-1.5 border-b border-black/[0.08] bg-white flex-shrink-0">
            <button type="button" title="Bold (⌘B)" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><span style={{ fontWeight: 900 }}>B</span></button>
            <button type="button" title="Italic (⌘I)" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><span style={{ fontStyle: "italic" }}>I</span></button>
            <button type="button" title="Inline code" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>{"<>"}</button>
            <span className="w-px h-4 bg-black/10 mx-1" />
            <button type="button" title="Heading 1" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button type="button" title="Heading 2" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button type="button" title="Heading 3" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
            <span className="w-px h-4 bg-black/10 mx-1" />
            <button type="button" title="Bulleted list" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>•</button>
            <button type="button" title="Numbered list" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</button>
            <button type="button" title="Task list" className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()}>☐</button>
            <button type="button" title="Quote" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>"</button>
            <button type="button" title="Code block" className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"{}"}</button>
            <span className="w-px h-4 bg-black/10 mx-1" />
            <button type="button" title="Link" className={btn(editor.isActive("link"))} onClick={() => {
                const prev = editor.getAttributes("link").href as string | undefined;
                const url = window.prompt("URL", prev ?? "https://");
                if (url === null) return;
                if (url === "") editor.chain().focus().unsetLink().run();
                else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }}>🔗</button>
            <button type="button" title="Insert table" className={btn(false)} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>⊞</button>
            <button type="button" title="Insert image" className={btn(false)} onClick={() => fileInputRef.current?.click()}>🖼</button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
            <span className="w-px h-4 bg-black/10 mx-1" />
            <button type="button" title="Undo (⌘Z)" className={btn(false)} disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>↶</button>
            <button type="button" title="Redo (⌘⇧Z)" className={btn(false)} disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>↷</button>
        </div>
    );
}
