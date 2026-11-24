import { canContain, parentOf, type Tree } from './model.ts';

/** Where a dragged node lands when dropped on `overId`; null if the drop is not allowed. Pure and tested. */
export function resolveDrop(tree: Tree, activeId: string, overId: string): { parentId: string; index: number } | null {
    if (activeId === overId) return null;
    const active = tree.nodes[activeId];
    const over = tree.nodes[overId];
    if (!active || !over) return null;

    // Elements dropped on a column go into that column (at the end); columns themselves reorder.
    if (over.type === 'cell' && active.type !== 'cell') {
        return canContain(over, active) ? { parentId: over.id, index: over.children.length } : null;
    }
    const target = parentOf(tree, overId);
    if (!target) return null;
    const parent = target.id === '' ? undefined : tree.nodes[target.id];
    if (!canContain(parent, active)) return null;
    // Never drop a node into its own subtree.
    for (let p = parent; p; p = (() => { const pp = parentOf(tree, p.id); return pp && pp.id !== '' ? tree.nodes[pp.id] : undefined; })()) {
        if (p.id === activeId) return null;
    }

    return { parentId: target.id, index: target.index };
}
