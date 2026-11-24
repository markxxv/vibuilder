import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const results = []; const check = (name, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
await page.setRequestInterception(true);
page.on('request', req => {
    const url = new URL(req.url());
    if (url.pathname === '/page.html') return req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'tests/e2e/page.html')) });
    if (url.pathname.startsWith('/dist/')) { const f = DIST + url.pathname.slice(5); const type = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'application/json'; return fs.existsSync(f) ? req.respond({ status: 200, contentType: type, body: fs.readFileSync(f) }) : req.respond({ status: 404, body: '' }); }
    req.respond({ status: 404, contentType: 'application/json', body: '{}' });
});
await page.goto('http://vb.test/page.html');
await page.waitForSelector('.vbe-root');

const state = () => page.evaluate(() => { const s = window.__store.getState(); return { sections: s.sections.length, past: s.past.length, dirty: s.isDirty(), selected: s.selectedId }; });
const cols = () => page.evaluate(() => getComputedStyle(document.querySelector('.vb-grid')).gridTemplateColumns.split(' ').length);
const scrollTop = () => page.evaluate(() => document.querySelector('.vbe-canvas').scrollTop);
const rects = () => page.evaluate(() => [...document.querySelectorAll('.vb-heading, .vb-lead, .vb-cell')].map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.top * 10) / 10, Math.round(r.height * 10) / 10]; }));

check('mounts with 4 sections', (await state()).sections === 4);

// responsive columns follow the preview device
const desktopCols = await cols();
await page.click('[aria-label=tablet]'); const tabletCols = await cols();
await page.click('[aria-label=mobile]'); const mobileCols = await cols();
await page.click('[aria-label=desktop]');
check('columns per device', desktopCols === 3 && tabletCols === 2 && mobileCols === 1, `${desktopCols}/${tabletCols}/${mobileCols}`);

// selecting/focusing causes zero layout shift
const before = await rects();
await page.click('.vb-cell .vb-heading textarea');
const afterFocus = await rects();
check('focus + selection: no layout shift', JSON.stringify(before) === JSON.stringify(afterFocus));
await page.screenshot({ path: path.join('/tmp', 'vb-shot-selected.png') });

// typing: store updated, one undo step, no scroll movement, ghost sizing keeps textarea exact
await page.evaluate(() => { document.querySelector('.vbe-canvas').scrollTop = 500; });
const scrollBefore = await scrollTop();
const target = (await page.$$('.vb-cell .vb-heading textarea'))[4];
await target.click();
const pastBefore = (await state()).past;
await page.keyboard.type('A fairly long heading that must wrap over several lines without any jumpy resizing', { delay: 5 });
const fit = await target.evaluate(t => t.scrollHeight <= t.clientHeight + 1);
check('typing keeps scroll position', (await scrollTop()) === scrollBefore, `${scrollBefore} -> ${await scrollTop()}`);
check('textarea auto-fits text (no inner scroll)', fit);
check('typing burst = single undo step', (await state()).past === pastBefore + 1, `${pastBefore} -> ${(await state()).past}`);
await page.keyboard.press('Escape');
await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
await page.waitForFunction(() => document.querySelectorAll('.vb-cell .vb-heading textarea')[4].value.length < 20, { timeout: 2000 }).catch(() => {});
const undone = await target.evaluate(t => t.value);
check('undo restores previous text in the input', undone === 'Housing' || undone === 'Taxes' || undone.length < 20, undone);

// rich text: static until clicked, then Tiptap; edits reach the store
await page.evaluate(() => { document.querySelector('.vbe-canvas').scrollTop = 0; });
const staticText = await page.$('.vbe-richtext:not([data-editing])');
check('rich text starts static (no editor instance)', (await page.$$('.ProseMirror')).length === 0 && !!staticText);
await staticText.click();
await page.waitForSelector('.ProseMirror');
await page.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror'));
await page.keyboard.type(' Extra');
await page.waitForFunction(() => JSON.stringify(window.__store.getState().document()).includes('Extra'), { timeout: 2000 }).catch(() => {});
check('rich text edit reaches the store', await page.evaluate(() => JSON.stringify(window.__store.getState().document()).includes('Extra')));
await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
await new Promise(r => setTimeout(r, 500));
check('bubble menu appears on selection', !!(await page.$('.vbe-bubble')));
await page.screenshot({ path: path.join('/tmp', 'vb-shot-richtext.png') });
await page.mouse.click(1000, 30); // click empty toolbar area: closes the editor

// icon picker: lazy data, capped rendering, search
await page.click('.vb-icon');
await page.waitForSelector('.vbe-icons__item');
const iconCount = (await page.$$('.vbe-icons__item')).length;
await page.type('.vbe-icons input', 'house');
await new Promise(r => setTimeout(r, 200));
const houseCount = (await page.$$('.vbe-icons__item')).length;
check('icon picker capped and searchable', iconCount === 96 && houseCount > 0 && houseCount < 96, `${iconCount} -> ${houseCount}`);
await (await page.$('.vbe-icons__item')).click();
check('picking an icon updates the node', await page.evaluate(() => JSON.stringify(window.__store.getState().document()).includes('"house"') || JSON.stringify(window.__store.getState().document()).match(/"name":"[a-z-]*house[a-z-]*"/) !== null));

// add menu and structure edits
const sectionsBefore = (await state()).sections;
await page.hover('.vbe-node--section');
await page.click('.vbe-node--section > .vbe-add .vbe-add__btn');
await page.waitForSelector('.vbe-menu');
await (await page.$$('.vbe-menu__item'))[1].click(); // Lead
check('add element via menu', await page.evaluate(() => document.querySelectorAll('.vb-lead').length) === 5);

// column switcher opens inside the grid chrome
await page.click('.vbe-node--grid .vb-cell textarea');
await page.evaluate(() => window.__store.getState().select(window.__store.getState().nodes[window.__store.getState().sections[0]].children[2]));
await page.waitForSelector('.vbe-chrome');
await page.evaluate(() => [...document.querySelectorAll('.vbe-chrome__text')].find(e => e.textContent === 'Columns').click());
await page.waitForSelector('.vbe-columns');
check('column popover shows three device rows', (await page.$$('.vbe-popover .vbe-columns__row')).length === 3);
await page.screenshot({ path: path.join('/tmp', 'vb-shot-columns.png') });
await page.evaluate(() => [...document.querySelectorAll('.vbe-columns__row')][0].querySelectorAll('button')[3].click()); // desktop: 4
check('desktop columns -> 4 only for that grid', await page.evaluate(() => getComputedStyle(document.querySelectorAll('.vb-grid')[0]).gridTemplateColumns.split(' ').length) === 4);

// drag a section with the real pointer (grids removed so every section is on screen)
await page.evaluate(() => { const s = window.__store.getState(); Object.values(s.nodes).filter(n => n.type === 'grid').forEach(g => window.__store.getState().remove(g.id)); });
await page.setViewport({ width: 1440, height: 1400 });
await page.evaluate(() => { document.querySelector('.vbe-canvas').scrollTop = 0; window.__store.getState().select(window.__store.getState().sections[1]); });
await page.waitForSelector('.vbe-node--section[data-selected] .vbe-chrome__drag');
const handle = await (await page.$('.vbe-node--section[data-selected] .vbe-chrome__drag')).boundingBox();
const firstSection = await (await page.$('.vbe-node--section')).boundingBox();
const order = () => page.evaluate(() => window.__store.getState().sections.map(id => window.__store.getState().nodes[id].anchor));
const orderBefore = await order();
await page.mouse.move(handle.x + 8, handle.y + 8); await page.mouse.down();
await page.mouse.move(handle.x + 8, handle.y - 40, { steps: 6 });
await page.mouse.move(firstSection.x + 200, firstSection.y + 60, { steps: 12 });
await page.mouse.up();
await new Promise(r => setTimeout(r, 200));
const orderAfter = await order();
check('drag & drop reorders sections', orderBefore[0] !== orderAfter[0] || orderBefore.join() !== orderAfter.join(), `${orderBefore} -> ${orderAfter}`);

// save
await page.click('.vbe-save');
await new Promise(r => setTimeout(r, 100));
check('save sends the document and clears dirty state', (await page.evaluate(() => window.__saved.length)) === 1 && !(await state()).dirty);

check('no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
