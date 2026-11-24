import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { createEditorStore } from '../../resources/js/editor/store.ts';
import { fromDocument, toDocument, type HeadingNode } from '../../resources/js/editor/model.ts';

const empty = () => ({ version: 1, sections: [] });

function sampleStore() {
    let t = 0;
    const store = createEditorStore(empty(), 'r0', () => t);
    const s = () => store.getState();
    const advance = (ms: number) => { t += ms; };
    const section = s().add('', 'section')!;
    const heading = s().add(section, 'heading')!;
    const grid = s().add(section, 'grid')!;
    return { store, s, advance, section, heading, grid };
}

test('new grid has three cells; headings get the right level per context', () => {
    const { s, grid, heading } = sampleStore();
    assert.equal((s().nodes[grid] as any).cells.length, 3);
    assert.equal((s().nodes[heading] as HeadingNode).level, 2);
    const cell = (s().nodes[grid] as any).cells[0];
    const h3 = s().add(cell, 'heading')!;
    assert.equal((s().nodes[h3] as HeadingNode).level, 3);
});

test('typing is coalesced into one undo step; undo/redo restore state', () => {
    const { s, advance, heading } = sampleStore();
    const stepsBefore = s().past.length;
    for (const text of ['H', 'He', 'Hel', 'Hello']) { s().patch(heading, { text }, 'text'); advance(100); }
    assert.equal(s().past.length, stepsBefore + 1);
    s().undo();
    assert.equal((s().nodes[heading] as HeadingNode).text, '');
    s().redo();
    assert.equal((s().nodes[heading] as HeadingNode).text, 'Hello');
    advance(2000);
    s().patch(heading, { text: 'Hello!' }, 'text');
    assert.equal(s().past.length, stepsBefore + 2);
});

test('edits keep unchanged nodes referentially equal (fine-grained re-render)', () => {
    const { s, heading, grid } = sampleStore();
    const gridBefore = s().nodes[grid];
    s().patch(heading, { text: 'x' });
    assert.equal(s().nodes[grid], gridBefore);
});

test('moves between cells, rejects invalid parents, adjusts heading level', () => {
    const { s, section, heading, grid } = sampleStore();
    const [c1] = (s().nodes[grid] as any).cells;
    s().move(heading, c1, 0);
    assert.deepEqual((s().nodes[c1] as any).children, [heading]);
    assert.equal((s().nodes[heading] as HeadingNode).level, 3);
    const lead = s().add(section, 'lead')!;
    s().move(lead, c1, 0); // lead is not allowed in a cell
    assert.equal((s().nodes[c1] as any).children.length, 1);
});

test('duplicate creates unique ids and anchors; remove deletes the whole subtree', () => {
    const { s, section } = sampleStore();
    const before = Object.keys(s().nodes).length;
    s().duplicate(section);
    assert.equal(s().sections.length, 2);
    const [a, b] = s().sections.map(id => s().nodes[id] as any);
    assert.notEqual(a.anchor, b.anchor);
    const ids = Object.keys(s().nodes);
    assert.equal(ids.length, before * 2);
    assert.equal(new Set(ids).size, ids.length);
    s().remove(b.id);
    assert.equal(Object.keys(s().nodes).length, before);
    assert.equal(s().sections.length, 1);
});

test('hero variant switches section heading to H1 and back', () => {
    const { s, section, heading } = sampleStore();
    s().changeVariant(section, 'hero');
    assert.equal((s().nodes[heading] as HeadingNode).level, 1);
    s().changeVariant(section, 'default');
    assert.equal((s().nodes[heading] as HeadingNode).level, 2);
});

test('dirty tracking: undo back to the saved state is clean', () => {
    const { s, heading } = sampleStore();
    s().markSaved('r1');
    assert.equal(s().isDirty(), false);
    s().patch(heading, { text: 'a' });
    assert.equal(s().isDirty(), true);
    s().undo();
    assert.equal(s().isDirty(), false);
});

test('anchors are normalized and unique', () => {
    const { s, section } = sampleStore();
    s().duplicate(section);
    const [, second] = s().sections;
    s().changeAnchor(second, 'My Section!!');
    assert.equal((s().nodes[second] as any).anchor, 'my-section');
    s().changeAnchor(s().sections[0], 'my-section');
    assert.equal((s().nodes[s().sections[0]] as any).anchor, 'my-section-2');
});

test('document round trip is stable and accepted by the PHP validator', () => {
    const { s, section, grid } = sampleStore();
    const cell = (s().nodes[grid] as any).cells[0];
    s().patch(s().nodes[section].type === 'section' ? (s().nodes[section] as any).children[0] : '', { text: 'Title' });
    for (const type of ['heading', 'text', 'image', 'icon', 'button'] as const) s().add(cell, type);
    s().add(section, 'lead');
    s().patch((s().nodes[section] as any).children.at(-1), { text: 'Lead' });
    const doc = s().document();
    assert.deepEqual(toDocument(fromDocument(doc)), doc);

    const php = `<?php require '${process.cwd()}/src/Schema/DocumentValidator.php'; $d = json_decode(file_get_contents('php://stdin'), true); echo json_encode((new Vibuilder\\Schema\\DocumentValidator())->validate($d));`;
    const out = execFileSync('php', ['-r', php.replace('<?php ', '')], { input: JSON.stringify(doc) }).toString();
    assert.equal(out, '[]', out);
});
