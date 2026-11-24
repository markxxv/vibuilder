import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEditorStore } from '../../resources/js/editor/store.ts';
import { resolveDrop } from '../../resources/js/editor/dnd.ts';

function setup() {
    const store = createEditorStore({ version: 1, sections: [] });
    const s = () => store.getState();
    const a = s().add('', 'section')!;
    const b = s().add('', 'section')!;
    const grid = s().add(a, 'grid')!;
    const lead = s().add(a, 'lead')!;
    const [c1, c2] = (s().nodes[grid] as any).cells as string[];
    const h = s().add(c1, 'heading')!;
    return { s, a, b, grid, lead, c1, c2, h };
}

test('sections reorder only among sections', () => {
    const { s, a, b, h } = setup();
    assert.deepEqual(resolveDrop(s(), a, b), { parentId: '', index: 1 });
    assert.equal(resolveDrop(s(), h, a), null, 'an element cannot target a section');
    assert.equal(resolveDrop(s(), a, h), null, 'a section cannot go inside a cell');
});

test('element dropped on an empty column goes inside it', () => {
    const { s, h, c2 } = setup();
    assert.deepEqual(resolveDrop(s(), h, c2), { parentId: c2, index: 0 });
});

test('type rules: lead cannot enter a cell, grid cannot enter a cell', () => {
    const { s, lead, c1, grid, c2 } = setup();
    assert.equal(resolveDrop(s(), lead, c1), null);
    assert.equal(resolveDrop(s(), grid, c2), null);
});

test('columns reorder within a grid; element before sibling element', () => {
    const { s, c1, c2, h, grid } = setup();
    assert.deepEqual(resolveDrop(s(), c1, c2), { parentId: grid, index: 1 });
    const h2 = s().add(c2, 'heading')!;
    assert.deepEqual(resolveDrop(s(), h, h2), { parentId: c2, index: 0 });
});

test('cannot drop a node onto itself or into its own subtree', () => {
    const { s, a, grid, h } = setup();
    assert.equal(resolveDrop(s(), grid, grid), null);
    assert.equal(resolveDrop(s(), a, h), null);
});

test('applying a drop moves the node and fixes the heading level', () => {
    const { s, h, lead, a } = setup();
    const drop = resolveDrop(s(), h, lead)!;
    s().move(h, drop.parentId, drop.index);
    assert.equal((s().nodes[a] as any).children.includes(h), true);
    assert.equal((s().nodes[h] as any).level, 2);
});
