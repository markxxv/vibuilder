import { memo, useCallback, useState } from 'react';
import {
    DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCenter, useSensor, useSensors,
    type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ELEMENT_LABELS } from './Chrome.tsx';
import { SectionItem } from './elements.tsx';
import { useEditor, useEditorStore } from './context.tsx';
import { resolveDrop } from './dnd.ts';
import type { Device } from './model.ts';

/** Page width per device. The section is a CSS container, so its real width decides the column counts
 *  (tablet columns from 40rem, desktop from 64rem). Desktop never goes below 1024px, so it always shows desktop
 *  columns; on a small window the canvas scrolls horizontally instead of using CSS zoom (which breaks drag math). */
export const DEVICE_WIDTH: Record<Device, string> = { desktop: 'clamp(1024px, 100%, 1280px)', tablet: '768px', mobile: '390px' };

export const Canvas = memo(function Canvas() {
    const store = useEditorStore();
    const sections = useEditor(s => s.sections);
    const device = useEditor(s => s.device);
    const [dragging, setDragging] = useState<{ id: string; type: string } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // Only offer drop targets that are legal for the dragged node, so the highlight never lies.
    const collision: CollisionDetection = useCallback(args => {
        const tree = store.getState();
        const allowed = args.droppableContainers.filter(c => resolveDrop(tree, String(args.active.id), String(c.id)) !== null);
        return closestCenter({ ...args, droppableContainers: allowed });
    }, [store]);

    const onStart = (e: DragStartEvent) => { setDragging({ id: String(e.active.id), type: String(e.active.data.current?.type ?? '') }); };
    const onEnd = (e: DragEndEvent) => {
        setDragging(null);
        if (!e.over) return;
        const drop = resolveDrop(store.getState(), String(e.active.id), String(e.over.id));
        if (drop) store.getState().move(String(e.active.id), drop.parentId, drop.index);
    };

    return (
        <div className="vbe-canvas" onClick={() => store.getState().select(null)}>
            <div className="vbe-page" style={{ width: DEVICE_WIDTH[device] }}>
                <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}
                    measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }} autoScroll={{ threshold: { x: 0, y: 0.12 }, acceleration: 5 }}>
                    <SortableContext items={sections} strategy={verticalListSortingStrategy}>
                        {sections.map(id => <SectionItem key={id} id={id} />)}
                    </SortableContext>
                    {/* A light chip instead of cloning the dragged subtree: dragging stays smooth on big sections. */}
                    <DragOverlay dropAnimation={null}>{dragging && <div className="vbe-drag-chip">{ELEMENT_LABELS[dragging.type] ?? 'Item'}</div>}</DragOverlay>
                </DndContext>
            </div>
            <button type="button" className="vbe-add-section" onClick={e => { e.stopPropagation(); store.getState().add('', 'section'); }}>
                <Plus size={16} /> Add section
            </button>
        </div>
    );
});
