import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { isSafeUrl, richToHtml } from '../../resources/js/editor/richtext.ts';

const doc = {
    type: 'doc', content: [
        { type: 'paragraph', content: [
            { type: 'text', text: 'a<b & "q"', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'hardBreak' },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://x.dev/?a=1&b=2' } }] },
            { type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
        ] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: "it's" }] }] }] },
    ],
};

test('client rich text HTML is byte-identical to the PHP renderer', () => {
    const php = `require '${process.cwd()}/src/Schema/DocumentValidator.php'; require '${process.cwd()}/src/Render/RichText.php'; echo Vibuilder\\Render\\RichText::render(json_decode(file_get_contents('php://stdin'), true));`;
    const out = execFileSync('php', ['-r', php], { input: JSON.stringify(doc) }).toString();
    assert.equal(richToHtml(doc), out);
});

test('client URL check matches the server allow-list', () => {
    for (const bad of ['javascript:alert(1)', '//evil.com', 'data:text/html,x', '/a b', '/a\\b']) assert.equal(isSafeUrl(bad), false, bad);
    for (const ok of ['', '/ru/about', '#faq', 'https://example.com/x', 'mailto:a@b.c', 'tel:+34600']) assert.equal(isSafeUrl(ok), true, ok);
});
