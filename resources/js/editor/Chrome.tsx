import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy, GripVertical, Monitor, Plus, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useEditor, useEditorStore } from './context.tsx';
import { CELL_CHILDREN, COLUMN_OPTIONS, SECTION_CHILDREN, type Device, type ElementType, type GridNode } from './model.ts';

export const DEVICE_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone } as const;
export const ELEMENT_LABELS: Record<string, string> = {
    section: 'Section', grid: 'Grid', cell: 'Column', heading: 'Heading', lead: 'Lead text', text: 'Text', image: 'Image', icon: 'Icon', button: 'Button',
};

type HandleProps = Record<string, unknown>;

/**
 * Selection chrome. Everything is positioned absolutely or drawn as an outline, so selecting, hovering or
 * opening a menu never changes the size or position of page content (no layout shift, no scroll jumps).
 */
export const NodeFrame = memo(function NodeFrame({ id, type, handle, extra, children, className = '', innerRef, style, over }: {
    id: string; type: string; handle?: HandleProps; extra?: ReactNode; children: ReactNode; className?: string;
    innerRef?: (el: HTMLElement | null) => void; style?: React.CSSProperties; over?: boolean;
}) {
    const store = useEditorStore();
    const selected = useEditor(s => s.selectedId === id);

    return (
        <div ref={innerRef} style={style} className={`vbe-node vbe-node--${type} ${className}`} data-selected={selected || undefined} data-over={over || undefined}
            onClick={e => { e.stopPropagation(); if (!selected) store.getState().select(id); }}>
            {children}
            {selected && (
                <div className="vbe-chrome" onClick={e => e.stopPropagation()}>
                    {handle && <button type="button" className="vbe-chrome__btn vbe-chrome__drag" aria-label={`Move ${ELEMENT_LABELS[type]}`} {...handle}><GripVertical size={14} /></button>}
                    <span className="vbe-chrome__label">{ELEMENT_LABELS[type]}</span>
                    {extra}
                    <button type="button" className="vbe-chrome__btn" aria-label="Duplicate" onClick={() => store.getState().duplicate(id)}><Copy size={14} /></button>
                    <button type="button" className="vbe-chrome__btn vbe-chrome__btn--danger" aria-label="Delete" onClick={() => store.getState().remove(id)}><Trash2 size={14} /></button>
                </div>
            )}
        </div>
    );
});

/** "+" that floats on the bottom edge of a container (zero layout impact) and opens a menu of allowed elements. */
export function AddMenu({ parentId, context, labels }: { parentId: string; context: 'section' | 'cell'; labels?: Partial<Record<string, string>> }) {
    const store = useEditorStore();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const types = (context === 'section' ? SECTION_CHILDREN : CELL_CHILDREN) as readonly ElementType[];

    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    return (
        <div className="vbe-add" ref={ref} data-open={open || undefined} onClick={e => e.stopPropagation()}>
            <button type="button" className="vbe-add__btn" aria-label="Add element" aria-expanded={open} onClick={() => setOpen(v => !v)}><Plus size={14} /></button>
            {open && (
                <div className="vbe-menu" role="menu">
                    {types.map(t => (
                        <button key={t} type="button" role="menuitem" className="vbe-menu__item"
                            onClick={() => { store.getState().add(parentId, t); setOpen(false); }}>{labels?.[t] ?? ELEMENT_LABELS[t]}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Columns per row, separately for desktop / tablet / mobile. Opens inside the grid toolbar. */
export function ColumnsControl({ gridId }: { gridId: string }) {
    const store = useEditorStore();
    const columns = useEditor(s => (s.nodes[gridId] as GridNode).columns);

    return (
        <div className="vbe-columns">
            {(Object.keys(COLUMN_OPTIONS) as Device[]).map(device => {
                const Icon = DEVICE_ICONS[device];
                return (
                    <div className="vbe-columns__row" key={device}>
                        <span className="vbe-columns__device" title={device}><Icon size={15} /></span>
                        {COLUMN_OPTIONS[device].map(n => (
                            <button key={n} type="button" className="vbe-columns__opt" data-active={columns[device] === n || undefined} aria-label={`${device}: ${n} columns`}
                                onClick={() => store.getState().patch<GridNode>(gridId, { columns: { ...columns, [device]: n } })}>{n}</button>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

export function ColumnsPopover({ gridId }: { gridId: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [open]);

    return (
        <span className="vbe-popover-anchor" ref={ref}>
            <button type="button" className="vbe-chrome__btn" data-active={open || undefined} aria-label="Columns" aria-expanded={open} onClick={() => setOpen(v => !v)}>
                <span className="vbe-chrome__text">Columns</span>
            </button>
            {open && <div className="vbe-popover"><ColumnsControl gridId={gridId} /></div>}
        </span>
    );
}
