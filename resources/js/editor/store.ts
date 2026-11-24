import { createStore, type StoreApi } from 'zustand/vanilla';
import {
    createNode, duplicateNode, fromDocument, insertNode, moveNode, removeNode, setVariant, toDocument, uniqueAnchor, updateNode,
    type Device, type EditorNode, type ElementType, type SectionNode, type Tree,
} from './model.ts';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 800;

export type EditorState = Tree & {
    selectedId: string | null;
    device: Device;
    past: Tree[];
    future: Tree[];
    /** Bumped on undo/redo so inline inputs re-sync from the store (they own their text while focused). */
    historyTick: number;
    savedTree: Tree;
    revision: string;
    lastKey: string | null;
    lastAt: number;
    select: (id: string | null) => void;
    setDevice: (device: Device) => void;
    patch: <T extends EditorNode>(id: string, patch: Partial<T>, coalesceKey?: string) => void;
    add: (parentId: string, type: ElementType | 'section', index?: number) => string | null;
    addCell: (gridId: string, index?: number) => string | null;
    insert: (parentId: string, node: EditorNode, index?: number, extra?: EditorNode[]) => void;
    remove: (id: string) => void;
    move: (id: string, toParentId: string, toIndex: number) => void;
    duplicate: (id: string) => void;
    changeVariant: (sectionId: string, variant: 'default' | 'hero') => void;
    changeAnchor: (sectionId: string, anchor: string) => void;
    undo: () => void;
    redo: () => void;
    markSaved: (revision: string) => void;
    isDirty: () => boolean;
    document: () => Record<string, any>;
};

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(document: Record<string, any>, revision = '', now: () => number = Date.now): EditorStore {
    const initial = fromDocument(document);

    return createStore<EditorState>((set, get) => {
        const tree = (): Tree => ({ nodes: get().nodes, sections: get().sections });

        /** Applies a new tree and records history. Same coalesceKey within 800 ms = one undo step (typing bursts). */
        const commit = (next: Tree, key: string | null = null, selectedId?: string | null) => {
            const s = get();
            if (next.nodes === s.nodes && next.sections === s.sections) return;
            const t = now();
            const coalesce = key !== null && key === s.lastKey && t - s.lastAt < COALESCE_MS;
            set({
                nodes: next.nodes,
                sections: next.sections,
                past: coalesce ? s.past : [...s.past, tree()].slice(-HISTORY_LIMIT),
                future: [],
                lastKey: key,
                lastAt: t,
                ...(selectedId !== undefined ? { selectedId } : {}),
            });
        };

        return {
            ...initial,
            selectedId: null,
            device: 'desktop',
            past: [],
            future: [],
            historyTick: 0,
            savedTree: initial,
            revision,
            lastKey: null,
            lastAt: 0,

            select: id => set({ selectedId: id }),
            setDevice: device => set({ device }),
            patch: (id, patch, key) => commit(updateNode(tree(), id, patch as any), key ? `${id}:${key}` : null),

            add: (parentId, type, index) => {
                const t = tree();
                const parent = parentId ? t.nodes[parentId] : undefined;
                const level = parent?.type === 'cell' ? 3 : parent?.type === 'section' && parent.variant === 'hero' ? 1 : 2;
                const node = createNode(type, { level });
                const extra: EditorNode[] = [];
                if (node.type === 'grid') {
                    // A new grid starts with three empty cells so it is visible and droppable.
                    for (let i = 0; i < 3; i++) { const c = createNode('cell'); extra.push(c); (node as any).cells.push(c.id); }
                }
                const next = insertNode(t, parentId, node, index, extra);
                if (next === t) return null;
                commit(next, null, node.id);
                return node.id;
            },
            addCell: (gridId, index) => {
                const cell = createNode('cell');
                const next = insertNode(tree(), gridId, cell, index);
                commit(next, null);
                return cell.id;
            },
            insert: (parentId, node, index, extra) => commit(insertNode(tree(), parentId, node, index, extra), null, node.id),
            remove: id => {
                const next = removeNode(tree(), id);
                commit(next, null, get().selectedId === id ? null : undefined);
            },
            move: (id, toParentId, toIndex) => commit(moveNode(tree(), id, toParentId, toIndex), null),
            duplicate: id => {
                const result = duplicateNode(tree(), id);
                if (result) commit(result.tree, null, result.newId);
            },
            changeVariant: (sectionId, variant) => commit(setVariant(tree(), sectionId, variant), null),
            changeAnchor: (sectionId, anchor) => {
                const clean = anchor.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').replace(/-+$/, '').slice(0, 64);
                if (!clean) return;
                commit(updateNode<SectionNode>(tree(), sectionId, { anchor: uniqueAnchor(tree(), clean, sectionId) }), `${sectionId}:anchor`);
            },

            undo: () => {
                const s = get();
                const previous = s.past.at(-1);
                if (!previous) return;
                set({ ...previous, past: s.past.slice(0, -1), future: [tree(), ...s.future], historyTick: s.historyTick + 1, lastKey: null });
            },
            redo: () => {
                const s = get();
                const next = s.future[0];
                if (!next) return;
                set({ ...next, past: [...s.past, tree()], future: s.future.slice(1), historyTick: s.historyTick + 1, lastKey: null });
            },

            markSaved: revision => set({ savedTree: tree(), revision }),
            isDirty: () => get().nodes !== get().savedTree.nodes || get().sections !== get().savedTree.sections,
            document: () => toDocument(tree()),
        };
    });
}
