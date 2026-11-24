import type { RichDoc } from './model.ts';

/** Mirror of Vibuilder\Schema\DocumentValidator::safeUrl (keep in sync; covered by tests). */
export function isSafeUrl(url: string): boolean {
    if (url === '') return true;
    if (url.length > 2048 || /[\x00-\x20\x7f\\]/.test(url)) return false;
    if (url[0] === '/') return !url.startsWith('//');
    if (url[0] === '#') return true;
    return /^(https?:\/\/[^/]|mailto:|tel:)/i.test(url);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const TAGS: Record<string, string> = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li' };
const MARKS: Record<string, string> = { bold: 'strong', italic: 'em', strike: 's', underline: 'u' };

/** Mirror of Vibuilder\Render\RichText: the editor's static preview must equal the public HTML. */
export function richToHtml(node: RichDoc): string {
    const children = () => (node.content ?? []).map(richToHtml).join('');
    switch (node.type) {
        case 'doc': return children();
        case 'hardBreak': return '<br>';
        case 'paragraph': case 'bulletList': case 'orderedList': case 'listItem': return `<${TAGS[node.type]}>${children()}</${TAGS[node.type]}>`;
        case 'text': {
            let html = esc(node.text ?? '');
            for (const mark of node.marks ?? []) {
                if (MARKS[mark.type]) html = `<${MARKS[mark.type]}>${html}</${MARKS[mark.type]}>`;
                else if (mark.type === 'link') {
                    const href = String(mark.attrs?.href ?? '');
                    if (href && isSafeUrl(href)) html = `<a href="${esc(href)}"${/^https?:\/\//i.test(href) ? ' rel="noopener noreferrer"' : ''}>${html}</a>`;
                }
            }
            return html;
        }
        default: return '';
    }
}

export const isEmptyRich = (doc: RichDoc): boolean => { const html = richToHtml(doc); return html === '' || html === '<p></p>'; };
