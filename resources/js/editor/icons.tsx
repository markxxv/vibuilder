import { createElement, memo, useEffect, useState } from 'react';

export type IconNode = [string, Record<string, string>][];
type IconMap = Record<string, [IconNode, string[]?]>;

let promise: Promise<IconMap> | null = null;
let loaded: IconMap | null = null;

/** One cached request for all Lucide icon data (dist/icons.json), only when an icon is first needed. */
export function loadIcons(url: string): Promise<IconMap> {
    promise ??= fetch(url, { headers: { Accept: 'application/json' } })
        .then(r => { if (!r.ok) throw new Error('icons'); return r.json() as Promise<IconMap>; })
        .then(map => (loaded = map))
        .catch(() => { promise = null; return {} as IconMap; });
    return promise;
}

export function useIcons(url: string): IconMap | null {
    const [map, setMap] = useState<IconMap | null>(loaded);
    useEffect(() => { if (!loaded) loadIcons(url).then(setMap); }, [url]);
    return map;
}

export const IconSvg = memo(function IconSvg({ node }: { node: IconNode }) {
    return createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        node.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs })));
});

export function LucideIcon({ name, url }: { name: string; url: string }) {
    const map = useIcons(url);
    const entry = map?.[name];
    return entry ? <IconSvg node={entry[0]} /> : null;
}

/** Search by name and aliases, capped so the picker never renders thousands of SVGs at once. */
export function searchIcons(map: IconMap, query: string, limit: number): { names: string[]; total: number } {
    const q = query.trim().toLowerCase().replace(/\s+/g, '-');
    const all = Object.keys(map);
    const hits = q === '' ? all : all.filter(n => n.includes(q) || map[n][1]?.some(a => a.includes(q)));
    hits.sort((a, b) => Number(!a.startsWith(q)) - Number(!b.startsWith(q)) || a.length - b.length || a.localeCompare(b));

    return { names: hits.slice(0, limit), total: hits.length };
}
