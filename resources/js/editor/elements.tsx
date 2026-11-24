import { memo, type ComponentType, type CSSProperties } from 'react';
import { SortableContext, rectSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ImagePlus, Plus, Sparkles } from 'lucide-react';
import { AddMenu, ColumnsPopover, NodeFrame } from './Chrome.tsx';
import { InlineText } from './InlineText.tsx';
import { RichTextView } from './RichTextView.tsx';
import { useConfig, useEditor, useEditorStore, useMediaCache, useUi } from './context.tsx';
import { LucideIcon } from './icons.tsx';
import type { ButtonNode, CellNode, EditorNode, GridNode, HeadingNode, IconNode, ImageNode, SectionNode } from './model.ts';

/** Sortable wiring shared by every draggable node. Only transforms are animated (cheap, no reflow). */
function useSortableNode(id: string, type: string) {
    const s = useSortable({ id, data: { type } });
    const style: CSSProperties = { transform: CSS.Translate.toString(s.transform), transition: s.transition, opacity: s.isDragging ? 0.35 : undefined };
    return { ref: s.setNodeRef, style, over: s.isOver && !s.isDragging, handle: { ref: s.setActivatorNodeRef, ...s.attributes, ...s.listeners } };
}

/* ------------------------------ element views ------------------------------ */
/* Each view renders the SAME markup and vb-* classes as the public renderer. */

const HeadingView = memo(function HeadingView({ id }: { id: string }) {
    const level = useEditor(s => (s.nodes[id] as HeadingNode).level);
    const Tag = `h${level}` as 'h2';
    return <Tag className={`vb-heading vb-heading--${level}`}><InlineText nodeId={id} field="text" placeholder="Heading" /></Tag>;
});

const LeadView = memo(function LeadView({ id }: { id: string }) {
    return <p className="vb-lead"><InlineText nodeId={id} field="text" placeholder="Lead text" multiline /></p>;
});

const ButtonView = memo(function ButtonView({ id }: { id: string }) {
    const variant = useEditor(s => (s.nodes[id] as ButtonNode).variant);
    // A span, not a link: clicking in the editor must never navigate.
    return <span className={`vb-button vb-button--${variant}`}><InlineText nodeId={id} field="label" placeholder="Button" /></span>;
});

const ImageView = memo(function ImageView({ id }: { id: string }) {
    const mediaId = useEditor(s => (s.nodes[id] as ImageNode).mediaId);
    const alt = useEditor(s => (s.nodes[id] as ImageNode).alt);
    const item = useMediaCache(s => (mediaId ? s.items[mediaId] : undefined));
    const openMedia = useUi(s => s.openMedia);
    const src = item?.url ?? item?.thumbUrl;

    return src ? (
        <figure className="vb-image vbe-clickable" onClick={() => openMedia(id)}>
            <img className="vb-image__img" src={src} alt={alt} loading="lazy" decoding="async" draggable={false} />
        </figure>
    ) : (
        <button type="button" className="vbe-placeholder" onClick={() => openMedia(id)}><ImagePlus size={20} />{mediaId ? 'Image is processing…' : 'Choose image'}</button>
    );
});

const IconView = memo(function IconView({ id }: { id: string }) {
    const name = useEditor(s => (s.nodes[id] as IconNode).name);
    const { iconsUrl } = useConfig();
    const openIcons = useUi(s => s.openIcons);

    return name ? (
        <span className="vb-icon vbe-clickable" role="button" tabIndex={0} aria-label={`Icon ${name}`} onClick={() => openIcons(id)}><LucideIcon name={name} url={iconsUrl} /></span>
    ) : (
        <button type="button" className="vbe-placeholder vbe-placeholder--icon" onClick={() => openIcons(id)}><Sparkles size={18} />Icon</button>
    );
});

const CellView = memo(function CellView({ id }: { id: string }) {
    const children = useEditor(s => (s.nodes[id] as CellNode).children);
    return (
        <div className="vb-cell" data-empty={children.length === 0 || undefined}>
            <SortableContext items={children} strategy={verticalListSortingStrategy}>
                {children.map(c => <ElementItem key={c} id={c} />)}
            </SortableContext>
            {children.length === 0 && <div className="vbe-empty">Drop or add an element</div>}
            <AddMenu parentId={id} context="cell" />
        </div>
    );
});

const CellItem = memo(function CellItem({ id }: { id: string }) {
    const sortable = useSortableNode(id, 'cell');
    return <NodeFrame id={id} type="cell" innerRef={sortable.ref} style={sortable.style} over={sortable.over} handle={sortable.handle}><CellView id={id} /></NodeFrame>;
});

const GridView = memo(function GridView({ id }: { id: string }) {
    const store = useEditorStore();
    const cells = useEditor(s => (s.nodes[id] as GridNode).cells);
    const columns = useEditor(s => (s.nodes[id] as GridNode).columns);
    const classes = useEditor(s => (s.nodes[id] as GridNode).classes);
    const vars = { '--vb-cols-desktop': columns.desktop, '--vb-cols-tablet': columns.tablet, '--vb-cols-mobile': columns.mobile } as CSSProperties;

    return (
        <SortableContext items={cells} strategy={rectSortingStrategy}>
            <div className={['vb-grid', ...classes].join(' ')} style={vars}>{cells.map(c => <CellItem key={c} id={c} />)}</div>
            <button type="button" className="vbe-add-column" onClick={() => store.getState().addCell(id)}><Plus size={14} /> Column</button>
        </SortableContext>
    );
});

const VIEWS: Record<string, ComponentType<{ id: string }>> = {
    heading: HeadingView, lead: LeadView, text: RichTextView, image: ImageView, icon: IconView, button: ButtonView, grid: GridView,
};

/** Registry of renderable elements. A new element type = a view here + a factory in model.ts + a schema rule in PHP. */
export const ElementItem = memo(function ElementItem({ id }: { id: string }) {
    const type = useEditor(s => s.nodes[id]?.type);
    const sortable = useSortableNode(id, type ?? 'unknown');
    const View = type ? VIEWS[type] : undefined;
    if (!View) return null;
    return (
        <NodeFrame id={id} type={type!} innerRef={sortable.ref} style={sortable.style} over={sortable.over} handle={sortable.handle}
            extra={type === 'grid' ? <ColumnsPopover gridId={id} /> : undefined}>
            <View id={id} />
        </NodeFrame>
    );
});

export const SectionItem = memo(function SectionItem({ id }: { id: string }) {
    const store = useEditorStore();
    const sortable = useSortableNode(id, 'section');
    const section = useEditor(s => s.nodes[id] as SectionNode);
    const hero = section.variant === 'hero';

    return (
        <NodeFrame id={id} type="section" innerRef={sortable.ref} style={sortable.style} over={sortable.over} handle={sortable.handle}
            extra={<button type="button" className="vbe-chrome__btn" data-active={hero || undefined} onClick={() => store.getState().changeVariant(id, hero ? 'default' : 'hero')}><span className="vbe-chrome__text">Hero</span></button>}>
            <section id={section.anchor} className={['vb-section', hero && 'vb-section--hero', ...section.classes].filter(Boolean).join(' ')}>
                <div className="vb-section__inner">
                    <SortableContext items={section.children} strategy={verticalListSortingStrategy}>
                        {section.children.map(c => <ElementItem key={c} id={c} />)}
                    </SortableContext>
                </div>
            </section>
            <AddMenu parentId={id} context="section" />
        </NodeFrame>
    );
});

export type { EditorNode };
