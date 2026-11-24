import { memo, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor as useTiptap } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Link2, Strikethrough, Underline as UnderlineIcon, Unlink } from 'lucide-react';
import { useEditor, useEditorStore } from './context.tsx';
import type { RichDoc, TextNode } from './model.ts';
import { isEmptyRich, isSafeUrl, richToHtml } from './richtext.ts';

/**
 * Static HTML (identical to the public render) until the user clicks; only then a Tiptap instance is created.
 * Pages with dozens of text blocks therefore cost one editor at a time and never shift on focus.
 */
export const RichTextView = memo(function RichTextView({ id }: { id: string }) {
    const content = useEditor(s => (s.nodes[id] as TextNode).content);
    const [active, setActive] = useState(false);

    if (active) return <TiptapField id={id} initial={content} onClose={() => setActive(false)} />;

    const html = richToHtml(content);
    return (
        <div className="vb-text vbe-richtext" data-empty={isEmptyRich(content) || undefined} onClick={() => setActive(true)}
            dangerouslySetInnerHTML={{ __html: isEmptyRich(content) ? '<p class="vbe-placeholder-text">Write something…</p>' : html }} />
    );
});

function TiptapField({ id, initial, onClose }: { id: string; initial: RichDoc; onClose: () => void }) {
    const store = useEditorStore();
    const tick = useEditor(s => s.historyTick);
    const raf = useRef(0);

    const editor = useTiptap({
        content: initial,
        autofocus: 'end',
        immediatelyRender: true,
        extensions: [StarterKit.configure({
            heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false,
            link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: null, target: null, class: null } },
        })],
        editorProps: { attributes: { class: 'vbe-prose' }, scrollThreshold: 0, scrollMargin: 0 },
        onUpdate: ({ editor }) => {
            cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(() => store.getState().patch<TextNode>(id, { content: editor.getJSON() as RichDoc }, 'content'));
        },
        onBlur: () => setTimeout(() => { if (!document.activeElement?.closest('.vbe-bubble')) onClose(); }, 0),
    });

    // Undo/redo from the toolbar replaces the editor content with the stored value.
    useEffect(() => {
        if (!editor) return;
        const stored = (store.getState().nodes[id] as TextNode | undefined)?.content;
        if (stored && JSON.stringify(stored) !== JSON.stringify(editor.getJSON())) editor.commands.setContent(stored, { emitUpdate: false });
    }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => () => cancelAnimationFrame(raf.current), []);
    if (!editor) return null;

    const setLink = () => {
        const previous = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Link URL', previous ?? 'https://');
        if (url === null) return;
        if (url === '') editor.chain().focus().unsetLink().run();
        else if (isSafeUrl(url)) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };
    const Btn = ({ on, label, active: a, children }: { on: () => void; label: string; active?: boolean; children: React.ReactNode }) => (
        <button type="button" className="vbe-bubble__btn" aria-label={label} aria-pressed={a} data-active={a || undefined} onMouseDown={e => e.preventDefault()} onClick={on}>{children}</button>
    );

    return (
        <div className="vb-text vbe-richtext" data-editing>
            <BubbleMenu editor={editor} className="vbe-bubble" options={{ placement: 'top' }}>
                <Btn label="Bold" active={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></Btn>
                <Btn label="Italic" active={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></Btn>
                <Btn label="Underline" active={editor.isActive('underline')} on={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={15} /></Btn>
                <Btn label="Strikethrough" active={editor.isActive('strike')} on={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} /></Btn>
                <Btn label="Link" active={editor.isActive('link')} on={setLink}><Link2 size={15} /></Btn>
                {editor.isActive('link') && <Btn label="Remove link" on={() => editor.chain().focus().unsetLink().run()}><Unlink size={15} /></Btn>}
            </BubbleMenu>
            <EditorContent editor={editor} />
        </div>
    );
}
