/**
 * Editor document model. The saved JSON (docs/elements.md) is a nested tree; in the editor it is kept
 * NORMALIZED (a map of nodes by id plus child id lists). That makes every edit O(1), keeps unchanged nodes
 * referentially equal, and lets each element subscribe only to its own node, so typing never re-renders the page.
 */

export type Device = 'desktop' | 'tablet' | 'mobile';
export type Columns = Record<Device, number>;
export type RichDoc = { type: string; content?: RichDoc[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; attrs?: Record<string, unknown> };

export const COLUMN_OPTIONS: Record<Device, number[]> = { desktop: [1, 2, 3, 4, 6], tablet: [1, 2, 3, 4], mobile: [1, 2, 3] };
export const SECTION_CHILDREN = ['heading', 'lead', 'button', 'grid'] as const;
export const CELL_CHILDREN = ['heading', 'text', 'image', 'icon', 'button'] as const;
export type ElementType = 'heading' | 'lead' | 'text' | 'image' | 'icon' | 'button' | 'grid';

type Base = { id: string };
export type HeadingNode = Base & { type: 'heading'; level: number; text: string };
export type LeadNode = Base & { type: 'lead'; text: string };
export type TextNode = Base & { type: 'text'; content: RichDoc };
export type ImageNode = Base & { type: 'image'; mediaId: number | null; alt: string };
export type IconNode = Base & { type: 'icon'; name: string };
export type ButtonNode = Base & { type: 'button'; label: string; url: string; variant: 'primary' | 'secondary' | 'link'; newTab: boolean };
export type GridNode = Base & { type: 'grid'; classes: string[]; columns: Columns; cells: string[] };
export type CellNode = Base & { type: 'cell'; children: string[] };
export type SectionNode = Base & { type: 'section'; anchor: string; classes: string[]; variant: 'default' | 'hero'; children: string[] };
export type EditorNode = HeadingNode | LeadNode | TextNode | ImageNode | IconNode | ButtonNode | GridNode | CellNode | SectionNode;

export type Tree = { nodes: Record<string, EditorNode>; sections: string[] };

/** UUID v4 from getRandomValues: crypto.randomUUID() is missing on plain-http (non-localhost) admin pages. */
export const uid = (): string => {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('').slice(0, n);
export const emptyRich = (): RichDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] });

/* ---------- factories ---------- */

export function createNode(type: ElementType | 'cell' | 'section', options: { level?: number } = {}): EditorNode {
    const id = uid();
    switch (type) {
        case 'heading': return { id, type, level: options.level ?? 2, text: '' };
        case 'lead': return { id, type, text: '' };
        case 'text': return { id, type, content: emptyRich() };
        case 'image': return { id, type, mediaId: null, alt: '' };
        case 'icon': return { id, type, name: '' };
        case 'button': return { id, type, label: '', url: '', variant: 'primary', newTab: false };
        case 'grid': return { id, type, classes: [], columns: { desktop: 3, tablet: 2, mobile: 1 }, cells: [] };
        case 'cell': return { id, type, children: [] };
        case 'section': return { id, type, anchor: `section-${hex(8)}`, classes: [], variant: 'default', children: [] };
    }
}

export const headingLevelFor = (context: 'section' | 'cell', hero: boolean, current = 3): number =>
    context === 'section' ? (hero ? 1 : 2) : Math.min(6, Math.max(3, current));

/* ---------- JSON <-> tree ---------- */

type Json = Record<string, any>;

export function fromDocument(doc: Json): Tree {
    const nodes: Record<string, EditorNode> = {};
    const add = (raw: Json): string => {
        const id = String(raw.id);
        switch (raw.type) {
            case 'section': nodes[id] = { id, type: 'section', anchor: raw.anchor, classes: [...raw.classes], variant: raw.variant, children: raw.children.map(add) }; break;
            case 'grid': nodes[id] = { id, type: 'grid', classes: [...raw.classes], columns: { ...raw.columns }, cells: raw.cells.map((c: Json) => { nodes[c.id] = { id: c.id, type: 'cell', children: c.children.map(add) }; return c.id; }) }; break;
            default: nodes[id] = { ...raw } as EditorNode;
        }
        return id;
    };
    return { nodes, sections: (doc.sections ?? []).map(add) };
}

export function toDocument(tree: Tree): Json {
    const build = (id: string): Json => {
        const n = tree.nodes[id];
        switch (n.type) {
            case 'section': return { ...n, children: n.children.map(build) };
            case 'grid': return { ...n, cells: n.cells.map(cid => ({ id: cid, children: (tree.nodes[cid] as CellNode).children.map(build) })) };
            default: return { ...n };
        }
    };
    return { version: 1, sections: tree.sections.map(build) };
}

/* ---------- pure tree operations (all immutable) ---------- */

export type Parent = { id: string; list: 'sections' | 'children' | 'cells'; index: number };

export function parentOf(tree: Tree, id: string): Parent | null {
    const root = tree.sections.indexOf(id);
    if (root >= 0) return { id: '', list: 'sections', index: root };
    for (const n of Object.values(tree.nodes)) {
        const list = n.type === 'grid' ? n.cells : 'children' in n ? n.children : null;
        const index = list ? list.indexOf(id) : -1;
        if (list && index >= 0) return { id: n.id, list: n.type === 'grid' ? 'cells' : 'children', index };
    }
    return null;
}

export const contextOf = (tree: Tree, parentId: string): 'section' | 'cell' => (tree.nodes[parentId]?.type === 'cell' ? 'cell' : 'section');

export function canContain(parent: EditorNode | undefined, child: EditorNode): boolean {
    if (!parent) return child.type === 'section';
    if (parent.type === 'section') return (SECTION_CHILDREN as readonly string[]).includes(child.type);
    if (parent.type === 'cell') return (CELL_CHILDREN as readonly string[]).includes(child.type);
    if (parent.type === 'grid') return child.type === 'cell';
    return false;
}

export function updateNode<T extends EditorNode>(tree: Tree, id: string, patch: Partial<T>): Tree {
    return { ...tree, nodes: { ...tree.nodes, [id]: { ...tree.nodes[id], ...patch } as EditorNode } };
}

function withList(tree: Tree, parent: Parent | { id: ''; list: 'sections' }, fn: (list: string[]) => string[]): Tree {
    if (parent.id === '') return { ...tree, sections: fn(tree.sections) };
    const node = tree.nodes[parent.id] as any;
    const key = node.type === 'grid' ? 'cells' : 'children';
    return { ...tree, nodes: { ...tree.nodes, [parent.id]: { ...node, [key]: fn(node[key]) } } };
}

/** Inserts already-created nodes (a subtree map) under a parent. Adjusts heading levels to the new context. */
export function insertNode(tree: Tree, parentId: string, node: EditorNode, index?: number, extra: EditorNode[] = []): Tree {
    const parent = parentId === '' ? undefined : tree.nodes[parentId];
    if (!canContain(parent, node)) return tree;
    let next: Tree = { ...tree, nodes: { ...tree.nodes, [node.id]: node } };
    for (const e of extra) next.nodes[e.id] = e;
    next = { ...next, nodes: { ...next.nodes } };
    next = withList(next, { id: parentId as '', list: 'sections' } as any, list => {
        const copy = [...list];
        copy.splice(index ?? copy.length, 0, node.id);
        return copy;
    });
    return node.type === 'heading' && parentId ? fixHeading(next, node.id, parentId) : next;
}

function fixHeading(tree: Tree, headingId: string, parentId: string): Tree {
    const h = tree.nodes[headingId] as HeadingNode;
    const parent = tree.nodes[parentId];
    const level = headingLevelFor(contextOf(tree, parentId), parent.type === 'section' && parent.variant === 'hero', h.level);
    return level === h.level ? tree : updateNode<HeadingNode>(tree, headingId, { level });
}

export function removeNode(tree: Tree, id: string): Tree {
    const p = parentOf(tree, id);
    if (!p) return tree;
    const drop = new Set<string>();
    const walk = (nid: string) => { drop.add(nid); const n = tree.nodes[nid]; (n.type === 'grid' ? n.cells : 'children' in n ? n.children : []).forEach(walk); };
    walk(id);
    let next = withList(tree, p, list => list.filter(x => x !== id));
    const nodes = { ...next.nodes };
    drop.forEach(d => delete nodes[d]);
    return { ...next, nodes };
}

export function moveNode(tree: Tree, id: string, toParentId: string, toIndex: number): Tree {
    const from = parentOf(tree, id);
    const node = tree.nodes[id];
    const parent = toParentId === '' ? undefined : tree.nodes[toParentId];
    if (!from || !canContain(parent, node)) return tree;
    if (from.id === toParentId) {
        let next = withList(tree, from, list => {
            const copy = list.filter(x => x !== id);
            copy.splice(Math.min(toIndex, copy.length), 0, id);
            return copy;
        });
        return next;
    }
    let next = withList(tree, from, list => list.filter(x => x !== id));
    next = withList(next, { id: toParentId as '', list: 'sections' } as any, list => {
        const copy = [...list];
        copy.splice(Math.min(toIndex, copy.length), 0, id);
        return copy;
    });
    return node.type === 'heading' && toParentId ? fixHeading(next, id, toParentId) : next;
}

/** Deep copy with fresh ids (and a fresh unique anchor for sections), inserted right after the original. */
export function duplicateNode(tree: Tree, id: string): { tree: Tree; newId: string } | null {
    const p = parentOf(tree, id);
    if (!p) return null;
    const copies: Record<string, EditorNode> = {};
    const clone = (nid: string): string => {
        const n = structuredClone(tree.nodes[nid]);
        const fresh = uid();
        n.id = fresh;
        if (n.type === 'section') { n.anchor = `section-${hex(8)}`; n.children = n.children.map(clone); }
        else if (n.type === 'grid') n.cells = n.cells.map(clone);
        else if (n.type === 'cell') n.children = n.children.map(clone);
        copies[fresh] = n;
        return fresh;
    };
    const newId = clone(id);
    let next: Tree = { ...tree, nodes: { ...tree.nodes, ...copies } };
    next = withList(next, p, list => { const copy = [...list]; copy.splice(p.index + 1, 0, newId); return copy; });
    return { tree: next, newId };
}

export function setVariant(tree: Tree, sectionId: string, variant: 'default' | 'hero'): Tree {
    let next = updateNode<SectionNode>(tree, sectionId, { variant });
    for (const cid of (next.nodes[sectionId] as SectionNode).children) {
        if (next.nodes[cid].type === 'heading') next = updateNode<HeadingNode>(next, cid, { level: variant === 'hero' ? 1 : 2 });
    }
    return next;
}

export function uniqueAnchor(tree: Tree, wanted: string, selfId: string): string {
    const taken = new Set(Object.values(tree.nodes).filter(n => n.type === 'section' && n.id !== selfId).map(n => (n as SectionNode).anchor));
    let candidate = wanted, i = 2;
    while (taken.has(candidate)) candidate = `${wanted}-${i++}`;
    return candidate;
}
