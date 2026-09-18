"use client";

import { useEditor, EditorContent, type JSONContent, type Editor, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
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
import { stripPlaceholderImages, isImageFile, dragHasFiles } from "@/lib/editor-ui";

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

/**
 * Image NodeView with a drag-resize corner handle.
 *
 * - Click the image: TipTap selects it (ProseMirror-selectednode class fires,
 *   CSS highlights with the note's accent color, handle becomes visible).
 * - Drag the bottom-right handle to resize. Aspect ratio is preserved
 *   automatically because we only set width (height auto-scales).
 * - Width persists as a px number on the node, so it survives save/load.
 */
function ResizableImageNode(props: ReactNodeViewProps) {
    const { node, updateAttributes, selected } = props;
    const attrs = node.attrs as { src: string; alt?: string; width?: string | null };
    const imgRef = useRef<HTMLImageElement | null>(null);
    const draftRef = useRef<number | null>(null);
    const [draftWidth, setDraftWidth] = useState<number | null>(null);

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const img = imgRef.current;
        if (!img) return;
        const startX = e.clientX;
        const startWidth = img.clientWidth;
        const onMove = (ev: MouseEvent) => {
            const w = Math.max(80, Math.min(2000, Math.round(startWidth + (ev.clientX - startX))));
            draftRef.current = w;
            setDraftWidth(w);
        };
        const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            const finalW = draftRef.current;
            draftRef.current = null;
            setDraftWidth(null);
            // Commit happens outside any setState callback to avoid the React
            // "Cannot update a component while rendering" warning.
            if (finalW !== null) updateAttributes({ width: `${finalW}` });
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    // Show placeholder spinner UI for in-flight uploads (src startsWith "placeholder://").
    const isPlaceholder = typeof attrs.src === "string" && attrs.src.startsWith("placeholder://");
    const renderedWidth = draftWidth !== null
        ? `${draftWidth}px`
        : attrs.width
            ? (/\d$/.test(attrs.width) ? `${attrs.width}px` : attrs.width)
            : undefined;

    return (
        <NodeViewWrapper
            as="div"
            className={`resizable-image-wrapper ${selected ? "is-selected" : ""}`}
            style={{ display: "inline-block", position: "relative", maxWidth: "100%" }}
        >
            <img
                ref={imgRef}
                src={isPlaceholder ? undefined : attrs.src}
                alt={attrs.alt ?? ""}
                data-placeholder={isPlaceholder ? "1" : undefined}
                style={renderedWidth ? { width: renderedWidth, maxWidth: "100%", height: "auto" } : { maxWidth: "100%", height: "auto" }}
                draggable={false}
            />
            {/* Bottom-right drag handle — only visible when image is selected.
              * Uses note accent color via --rich-accent. */}
            {selected && !isPlaceholder && (
                <div
                    className="resize-handle"
                    onMouseDown={onMouseDown}
                    title="Drag to resize"
                />
            )}
        </NodeViewWrapper>
    );
}

/**
 * Insert an image node at the given position (or selection) as a "placeholder://"
 * src, kick off the upload, and replace the placeholder's src with the real URL
 * when the upload resolves. CSS in app/globals.css styles placeholder:// images
 * as a dashed-border spinner so the user gets immediate visual feedback that
 * "an image is going here".
 */
let uploadCounter = 0;
function insertWithPlaceholder(
    view: EditorView,
    file: File,
    upload: (f: File) => Promise<string>,
    atPos?: number,
): void {
    const id = `${++uploadCounter}-${Date.now()}`;
    const placeholderSrc = `placeholder://${id}`;
    const { schema } = view.state;
    const node = schema.nodes.image.create({ src: placeholderSrc, alt: `Uploading ${file.name}...` });

    const insertTr =
        atPos !== undefined
            ? view.state.tr.insert(atPos, node)
            : view.state.tr.replaceSelectionWith(node);
    view.dispatch(insertTr);

    const findPlaceholder = (): number => {
        let found = -1;
        view.state.doc.descendants((n, pos) => {
            if (n.type.name === "image" && (n.attrs as any).src === placeholderSrc) {
                found = pos;
                return false;
            }
            return found === -1;
        });
        return found;
    };

    void upload(file)
        .then((url) => {
            if (!url || typeof url !== "string") throw new Error("Upload returned no URL");
            const pos = findPlaceholder();
            if (pos === -1) return; // user removed it before upload finished
            const real = schema.nodes.image.create({ src: url, alt: file.name });
            view.dispatch(view.state.tr.replaceWith(pos, pos + 1, real));
        })
        .catch((err: unknown) => {
            console.error("[RichEditor upload]", err);
            const pos = findPlaceholder();
            if (pos !== -1) view.dispatch(view.state.tr.delete(pos, pos + 1));
            window.dispatchEvent(
                new CustomEvent("stickies:upload-error", {
                    detail: { name: file.name, error: (err as any)?.message ?? String(err) },
                }),
            );
        });
}

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
            // Image with a `width` attribute (px) + custom NodeView that adds a
            // bottom-right drag handle for resize. Aspect ratio is preserved (we only
            // track horizontal drag, height auto-scales via CSS). Width persists on
            // the node so it round-trips through save/load.
            Image.extend({
                addAttributes() {
                    const parent = (this as any).parent?.() ?? {};
                    return {
                        ...parent,
                        width: {
                            default: null,
                            parseHTML: (el: HTMLElement) => el.getAttribute("width") ?? el.style.width ?? null,
                            renderHTML: (attrs: { width?: string | null }) =>
                                attrs.width ? { width: String(attrs.width) } : {},
                        },
                    };
                },
                addNodeView() {
                    return ReactNodeViewRenderer(ResizableImageNode);
                },
            }).configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } }),
            Table.configure({ resizable: true, HTMLAttributes: { class: "rich-table" } }),
            TableRow,
            TableHeader,
            TableCell,
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
        ],
        content: (initialDoc && stripPlaceholderImages(initialDoc)) ?? (initialText ? { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: initialText }] }] } : EMPTY_DOC),
        autofocus: autoFocus ? "end" : false,
        onUpdate: ({ editor: e }) => {
            const fn = onChangeRef.current;
            if (fn) fn({ doc: stripPlaceholderImages(e.getJSON()), text: e.getText() });
        },
        editorProps: {
            attributes: {
                class: "rich-editor-prose focus:outline-none",
                spellcheck: "true",
            },
            handlePaste(view, event) {
                // 1) Image paste — insert a placeholder, upload, then swap to the real URL.
                const items = Array.from(event.clipboardData?.items ?? []);
                const imageItem = items.find(i => i.type.startsWith("image/"));
                if (imageItem) {
                    const file = imageItem.getAsFile();
                    if (!file) return false;
                    event.preventDefault();
                    const upload = uploadRef.current;
                    if (!upload) return true;
                    insertWithPlaceholder(view, file, upload);
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
            // External file drops are handled at the editor-container level (see the
            // drag handlers on the wrapper below) so the WHOLE editor body is a drop
            // target — ProseMirror's own handleDrop only fires over the text content,
            // which is tiny for short notes. Internal node moves fall through to PM.
        },
    });

    // ── Drag-and-drop over the whole editor body ──────────────────────────────
    // dragActive drives the "drop here" overlay. dragDepthRef counts enter/leave
    // so moving across child elements doesn't flicker the overlay off.
    const [dragActive, setDragActive] = useState(false);
    const dragDepthRef = useRef(0);

    const onDragEnter = (e: React.DragEvent) => {
        if (!dragHasFiles(e.dataTransfer)) return;
        e.preventDefault();
        dragDepthRef.current += 1;
        setDragActive(true);
    };
    const onDragOver = (e: React.DragEvent) => {
        if (!dragHasFiles(e.dataTransfer)) return;
        e.preventDefault(); // required so the browser fires `drop`
        e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: React.DragEvent) => {
        if (!dragHasFiles(e.dataTransfer)) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragActive(false);
    };
    const onDrop = (e: React.DragEvent) => {
        if (!dragHasFiles(e.dataTransfer)) return;
        e.preventDefault();
        dragDepthRef.current = 0;
        setDragActive(false);
        if (!editor || editor.isDestroyed) return;
        const upload = uploadRef.current;
        if (!upload) return;
        const files = Array.from(e.dataTransfer.files).filter(isImageFile);
        if (files.length === 0) return;
        const view = editor.view;
        // Drop at the caret nearest the cursor; fall back to the end of the doc
        // when the drop lands in the empty padding below the content.
        const coords = view.posAtCoords({ left: e.clientX, top: e.clientY });
        const pos = coords?.pos ?? Math.max(0, view.state.doc.content.size - 1);
        files.forEach((file) => insertWithPlaceholder(view, file, upload, pos));
    };

    // Apply external doc changes (e.g. Pusher sync, async note fetch) without
    // clobbering in-progress edits. The "focused" guard is only honoured when the
    // editor already has user content — otherwise an autoFocus'd new mount with an
    // empty doc would refuse to load the late-arriving initialDoc.
    useEffect(() => {
        if (!editor || !initialDoc) return;
        const cleanDoc = stripPlaceholderImages(initialDoc);
        const current = editor.getJSON();
        if (JSON.stringify(current) === JSON.stringify(cleanDoc)) return;
        const isEditorEmpty = !current.content?.length ||
            (current.content.length === 1 &&
             current.content[0].type === "paragraph" &&
             !current.content[0].content?.length);
        if (editor.isFocused && !isEditorEmpty) return;
        // Defer to a task: TipTap's setContent triggers flushSync internally,
        // which React forbids during another component's render commit phase.
        let cancelled = false;
        const id = setTimeout(() => {
            if (cancelled || editor.isDestroyed) return;
            editor.commands.setContent(cleanDoc, false);
        }, 0);
        return () => { cancelled = true; clearTimeout(id); };
    }, [editor, initialDoc]);

    // Auto-fit: shrink the prose font so the widest line fits the editor width
    // without wrapping. Lets pasted ASCII tables / wide monospace content fit on
    // screen without the user having to zoom the browser out. Only shrinks below
    // the 8px base (never grows); normal notes stay at 8px.
    useEffect(() => {
        if (!editor) return;
        // Measure at REF, then size the font so the widest line ~fills the editor
        // width, clamped to [MIN, MAX]: grows to use the available space (no more
        // tiny text sitting in white space) and only shrinks for genuinely wide
        // tables, never below a readable floor.
        const REF = 12, MIN = 9, MAX = 15;
        const proseEl = editor.view.dom as HTMLElement;
        const measure = document.createElement("div");
        measure.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;display:inline-block;width:auto;max-width:none;";
        document.body.appendChild(measure);
        let timer: ReturnType<typeof setTimeout> | null = null, lastPx = -1;
        const fit = () => {
            timer = null;
            if (editor.isDestroyed) return;
            const avail = proseEl.clientWidth - 4;
            if (avail <= 0) return; // not laid out yet; a later tick will retry
            // Measure the widest rendered line at REF size. Lines are separated by
            // <br>, so text-splitting under-counts; render each block's HTML into an
            // offscreen inline-block with white-space:pre and take the widest. Font
            // is set explicitly (the measurer is outside .rich-editor-prose).
            const cs = getComputedStyle(proseEl);
            measure.style.fontFamily = cs.fontFamily;
            measure.style.fontWeight = cs.fontWeight;
            measure.style.fontSize = `${REF}px`;
            let natural = 0;
            for (const el of Array.from(proseEl.children) as HTMLElement[]) {
                measure.innerHTML = el.innerHTML;
                if (measure.offsetWidth > natural) natural = measure.offsetWidth;
            }
            measure.innerHTML = "";
            if (natural <= 0) return; // content not in the DOM yet; retry on next tick
            // Font that makes the widest line span the available width, clamped.
            const px = Math.max(MIN, Math.min(MAX, Math.round((REF * avail) / natural)));
            if (px === lastPx) return; // no change; also breaks any ResizeObserver loop
            lastPx = px;
            proseEl.style.setProperty("--rich-prose-font", `${px}px`);
        };
        // setTimeout (not requestAnimationFrame) so the fit still runs when the
        // tab is backgrounded — rAF is paused in hidden tabs, which would leave a
        // note that loaded while hidden un-fitted until the next interaction.
        const schedule = () => { if (!timer) timer = setTimeout(fit, 60); };
        // ResizeObserver catches BOTH container resizes and the async content load
        // (loaded notes apply their doc via setContent(false), which fires no
        // "update" event but does change the editor's size).
        const ro = new ResizeObserver(schedule);
        ro.observe(proseEl);
        editor.on("update", schedule);
        window.addEventListener("resize", schedule); // orientation / split-view changes
        schedule();
        return () => {
            editor.off("update", schedule);
            ro.disconnect();
            window.removeEventListener("resize", schedule);
            if (timer) clearTimeout(timer);
            measure.remove();
        };
    }, [editor]);

    return (
        <div
            className="relative flex flex-col flex-1 min-h-0"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {editor && <Toolbar editor={editor} onUploadImage={onUploadImage} />}
            {/* Drop indicator — covers the whole editor body so you can let go
                anywhere. pointer-events-none keeps drag events flowing to the wrapper. */}
            {dragActive && (
                <div
                    className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                    style={{ background: "rgba(37,99,235,0.10)", border: `2px dashed ${accentColor || "#2563eb"}`, borderRadius: 8 }}
                >
                    <div
                        className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-lg"
                        style={{ background: accentColor || "#2563eb", color: "#fff" }}
                    >
                        <span style={{ fontSize: 16 }}>↓</span> Drop image to add
                    </div>
                </div>
            )}
            <div
                className="rich-editor-root flex-1 min-h-0 overflow-y-auto px-3 py-2.5"
                style={{
                    // Caret stays dark on the white editor surface (accent color caret
                    // would blend on yellow / light notes). Accent goes to the click-
                    // highlight + handle via the CSS variable below.
                    caretColor: "#1a1a1a",
                    cursor: "text",
                    ...(accentColor ? { ["--rich-accent" as any]: accentColor } : {}),
                }}
                onMouseDown={(e) => {
                    // Clicking in the padding or empty area below the last line
                    // should focus the editor and place the caret at the end —
                    // contentEditable only catches clicks landing on the
                    // ProseMirror node itself, so we forward padding clicks here.
                    if (e.target === e.currentTarget && editor && !editor.isDestroyed) {
                        e.preventDefault();
                        editor.commands.focus("end");
                    }
                }}
            >
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
        <div
            className="flex items-center gap-0.5 flex-nowrap overflow-x-auto px-3 py-1.5 border-b border-black/[0.08] bg-white flex-shrink-0"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
            <button type="button" title="Bold (⌘B)" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><span style={{ fontWeight: 900 }}>B</span></button>
            <button type="button" title="Italic (⌘I)" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><span style={{ fontStyle: "italic" }}>I</span></button>
            <button type="button" title="Inline code" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>{"<>"}</button>
            <span className="hidden sm:inline-block w-px h-4 bg-black/10 mx-1" />
            <button type="button" title="Heading 1" className={`hidden sm:inline-flex ${btn(editor.isActive("heading", { level: 1 }))}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
            <button type="button" title="Heading 2" className={`hidden sm:inline-flex ${btn(editor.isActive("heading", { level: 2 }))}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
            <button type="button" title="Heading 3" className={`hidden sm:inline-flex ${btn(editor.isActive("heading", { level: 3 }))}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
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
