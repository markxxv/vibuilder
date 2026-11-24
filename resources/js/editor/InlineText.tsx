import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useEditor, useEditorStore } from './context.tsx';

type Props = { nodeId: string; field: string; placeholder: string; multiline?: boolean };

/**
 * A text input disguised as page text. Layout rules that keep it jitter-free:
 *  - a hidden "ghost" copy of the text sizes the box (CSS grid stacking), so there is no JS height measuring;
 *  - the textarea inherits font, spacing and alignment, so focusing never changes the layout;
 *  - it keeps its own text while focused and writes to the store on every keystroke (O(1), coalesced undo);
 *  - nothing here ever scrolls or moves focus.
 */
export const InlineText = memo(function InlineText({ nodeId, field, placeholder, multiline = false }: Props) {
    const store = useEditorStore();
    const value = useEditor(s => String((s.nodes[nodeId] as unknown as Record<string, unknown>)[field] ?? ''));
    const tick = useEditor(s => s.historyTick);
    const [local, setLocal] = useState(value);
    const focused = useRef(false);

    // Undo/redo and external changes: adopt the store value (except while typing, where the local text is the truth).
    useEffect(() => setLocal(value), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (!focused.current) setLocal(value); }, [value]);

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') e.currentTarget.blur();
    };

    return (
        <span className="vbe-inline" data-empty={local === '' || undefined}>
            <span className="vbe-inline__ghost" aria-hidden="true">{local === '' ? placeholder : local}{'\n'}</span>
            <textarea
                className="vbe-inline__input"
                rows={1}
                value={local}
                placeholder={placeholder}
                spellCheck
                onFocus={() => { focused.current = true; store.getState().select(nodeId); }}
                onBlur={() => { focused.current = false; setLocal(String((store.getState().nodes[nodeId] as any)?.[field] ?? '')); }}
                onChange={e => {
                    const text = multiline ? e.target.value : e.target.value.replace(/\n/g, ' ');
                    setLocal(text);
                    store.getState().patch(nodeId, { [field]: text } as never, field);
                }}
                onKeyDown={onKeyDown}
            />
        </span>
    );
});
