// Builds dist/icons.json: { "<kebab-name>": [nodes, aliases?] } from the installed lucide-react icon modules.
// Loaded lazily by the editor (one cached request) so the editor bundle stays small.
import { readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.resolve('node_modules/lucide-react/dist/esm/icons');
const out = {};
for (const file of (await readdir(dir)).filter(f => f.endsWith('.mjs'))) {
    const { __iconData: d } = await import(pathToFileURL(path.join(dir, file)).href);
    if (!d?.name) continue;
    const nodes = d.node.map(([tag, attrs]) => { const { key, ...rest } = attrs; return [tag, rest]; });
    out[d.name] = d.aliases?.length ? [nodes, d.aliases] : [nodes];
}
await writeFile('dist/icons.json', JSON.stringify(out));
console.log(`icons: ${Object.keys(out).length}`);
