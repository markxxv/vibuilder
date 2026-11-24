import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ImagePlus, Loader2, Search, Upload, X } from 'lucide-react';
import { ColumnsControl, ELEMENT_LABELS } from './Chrome.tsx';
import { useConfig, useEditor, useEditorStore, useMediaCache, useUi, type MediaItem } from './context.tsx';
import { IconSvg, searchIcons, useIcons } from './icons.tsx';
import type { ButtonNode, HeadingNode, IconNode, ImageNode, SectionNode, GridNode, EditorNode } from './model.ts';
import { uploadImage, UploadError, waitForThumb } from '../upload.ts';

const CLASS_RE = /^[a-z][a-z0-9_-]{0,47}$/;

function TagsInput({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
    const [draft, setDraft] = useState('');
    const add = () => {
        const tag = draft.trim().toLowerCase().replace(/\s+/g, '-');
        if (tag && CLASS_RE.test(tag) && !value.includes(tag) && value.length < 10) onChange([...value, tag]);
        setDraft('');
    };
    const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
        else if (e.key === 'Backspace' && draft === '' && value.length) onChange(value.slice(0, -1));
    };
    return (
        <div className="vbe-tags" aria-label={label}>
            {value.map(t => <span className="vbe-tag" key={t}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter(x => x !== t))}><X size={11} /></button></span>)}
            <input value={draft} placeholder={value.length ? '' : 'e.g. services'} onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} />
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <label className="vbe-field"><span>{label}</span>{children}</label>;
}

/* ------------------------------- inspector ------------------------------- */

export function Inspector() {
    const store = useEditorStore();
    const id = useEditor(s => s.selectedId);
    const node = useEditor(s => (s.selectedId ? s.nodes[s.selectedId] : undefined)) as EditorNode | undefined;
    const openMedia = useUi(s => s.openMedia);
    const openIcons = useUi(s => s.openIcons);
    const inCell = useCellContext(id ?? '');

    if (!id || !node) return <div className="vbe-panel__empty">Select a section, column or element on the page to edit its settings.</div>;
    const patch = (p: Record<string, unknown>, key?: string) => store.getState().patch(id, p as never, key);

    return (
        <div className="vbe-panel__body">
            <h3 className="vbe-panel__title">{ELEMENT_LABELS[node.type]}</h3>

            {node.type === 'section' && (
                <>
                    <Field label="Anchor (id)"><input value={(node as SectionNode).anchor} onChange={e => store.getState().changeAnchor(id, e.target.value)} /></Field>
                    <Field label="CSS classes"><TagsInput label="CSS classes" value={(node as SectionNode).classes} onChange={classes => patch({ classes })} /></Field>
                    <Field label="Variant">
                        <select value={(node as SectionNode).variant} onChange={e => store.getState().changeVariant(id, e.target.value as 'default' | 'hero')}>
                            <option value="default">Default (H2)</option><option value="hero">Hero (H1)</option>
                        </select>
                    </Field>
                </>
            )}

            {node.type === 'grid' && (
                <>
                    <Field label="Columns per row"><ColumnsControl gridId={id} /></Field>
                    <Field label="CSS classes"><TagsInput label="CSS classes" value={(node as GridNode).classes} onChange={classes => patch({ classes })} /></Field>
                </>
            )}

            {node.type === 'heading' && (
                <Field label="Level">
                    {inCell ? (
                        <select value={(node as HeadingNode).level} onChange={e => patch({ level: Number(e.target.value) })}>{[3, 4, 5, 6].map(l => <option key={l} value={l}>H{l}</option>)}</select>
                    ) : <span className="vbe-hint">Set by the section ({(node as HeadingNode).level === 1 ? 'H1 in a hero' : 'H2'})</span>}
                </Field>
            )}

            {node.type === 'button' && (
                <>
                    <Field label="Link (URL)"><input value={(node as ButtonNode).url} placeholder="/page, https://…, #id, mailto:, tel:" onChange={e => patch({ url: e.target.value }, 'url')} /></Field>
                    <Field label="Style">
                        <select value={(node as ButtonNode).variant} onChange={e => patch({ variant: e.target.value })}>
                            <option value="primary">Primary</option><option value="secondary">Secondary</option><option value="link">Link</option>
                        </select>
                    </Field>
                    <label className="vbe-check"><input type="checkbox" checked={(node as ButtonNode).newTab} onChange={e => patch({ newTab: e.target.checked })} />Open in a new tab</label>
                </>
            )}

            {node.type === 'image' && (
                <>
                    <Field label="Alt text"><input value={(node as ImageNode).alt} onChange={e => patch({ alt: e.target.value }, 'alt')} /></Field>
                    <div className="vbe-row">
                        <button type="button" className="vbe-btn" onClick={() => openMedia(id)}><ImagePlus size={14} /> {(node as ImageNode).mediaId ? 'Replace' : 'Choose'} image</button>
                        {(node as ImageNode).mediaId && <button type="button" className="vbe-btn vbe-btn--ghost" onClick={() => patch({ mediaId: null })}>Remove</button>}
                    </div>
                </>
            )}

            {node.type === 'icon' && <button type="button" className="vbe-btn" onClick={() => openIcons(id)}>{(node as IconNode).name ? `Change icon (${(node as IconNode).name})` : 'Choose icon'}</button>}
        </div>
    );
}

function useCellContext(id: string): boolean {
    return useEditor(s => Object.values(s.nodes).some(n => n.type === 'cell' && n.children.includes(id)));
}

/* ------------------------------ media browser ------------------------------ */

export function MediaBrowser() {
    const store = useEditorStore();
    const { mediaUrl, uploadsUrl, csrfToken, documentId } = useConfig();
    const targetId = useUi(s => s.targetId);
    const closePanel = useUi(s => s.closePanel);
    const put = useMediaCache(s => s.put);
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<MediaItem[]>([]);
    const [page, setPage] = useState(1);
    const [more, setMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const abort = useRef<AbortController | null>(null);

    // Debounced, cancelable listing: typing in search never stacks requests.
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`${mediaUrl}?search=${encodeURIComponent(search)}&page=${page}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
                const data = (await res.json()) as { items: MediaItem[]; hasMore: boolean };
                put(data.items);
                setItems(prev => (page === 1 ? data.items : [...prev, ...data.items]));
                setMore(data.hasMore);
                setError(null);
            } catch (e) { if ((e as Error).name !== 'AbortError') setError('Could not load the media library.'); }
            setLoading(false);
        }, search ? 250 : 0);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [search, page, mediaUrl, put]);

    const choose = (item: MediaItem) => {
        if (targetId) store.getState().patch<ImageNode>(targetId, { mediaId: item.id });
        closePanel();
    };

    const upload = async (file: File) => {
        setError(null); setProgress(0);
        abort.current = new AbortController();
        try {
            let item = await uploadImage(file, { uploadsUrl: uploadsUrl.replace('{document}', String(documentId)), csrfToken, signal: abort.current.signal, onProgress: (done, total) => setProgress(Math.round((done / total) * 100)) });
            item = await waitForThumb(mediaUrl, item);
            put([item]);
            setItems(prev => [item, ...prev]);
        } catch (e) { setError(e instanceof UploadError ? e.message : 'Upload failed.'); }
        setProgress(null);
    };

    return (
        <div className="vbe-panel__body vbe-media">
            <PanelHeader title="Media library" />
            <div className="vbe-search"><Search size={14} /><input value={search} placeholder="Search images" onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
            <div className="vbe-row">
                <button type="button" className="vbe-btn" disabled={progress !== null} onClick={() => fileInput.current?.click()}><Upload size={14} /> Upload</button>
                {progress !== null && <button type="button" className="vbe-btn vbe-btn--ghost" onClick={() => abort.current?.abort()}>Cancel</button>}
                <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            </div>
            {progress !== null && <div className="vbe-progress" role="progressbar" aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
            {error && <p className="vbe-error" role="alert">{error}</p>}
            <div className="vbe-media__grid">
                {items.map(item => (
                    <button type="button" key={item.id} className="vbe-media__item" title={item.name} onClick={() => choose(item)}>
                        {item.thumbUrl ? <img src={item.thumbUrl} alt="" width={100} height={100} loading="lazy" decoding="async" draggable={false} /> : <Loader2 size={16} className="vbe-spin" />}
                    </button>
                ))}
            </div>
            {!loading && !items.length && !error && <p className="vbe-hint">No images yet. Upload the first one.</p>}
            {more && <button type="button" className="vbe-btn vbe-btn--ghost" disabled={loading} onClick={() => setPage(p => p + 1)}>{loading ? 'Loading…' : 'Load more'}</button>}
        </div>
    );
}

/* ------------------------------- icon picker ------------------------------- */

const ICON_PAGE = 96;

export function IconPicker() {
    const store = useEditorStore();
    const { iconsUrl } = useConfig();
    const targetId = useUi(s => s.targetId);
    const closePanel = useUi(s => s.closePanel);
    const map = useIcons(iconsUrl);
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(ICON_PAGE);
    const result = useMemo(() => (map ? searchIcons(map, query, limit) : null), [map, query, limit]);

    return (
        <div className="vbe-panel__body vbe-icons">
            <PanelHeader title="Icons" />
            <div className="vbe-search"><Search size={14} /><input autoFocus value={query} placeholder="Search icons" onChange={e => { setQuery(e.target.value); setLimit(ICON_PAGE); }} /></div>
            {!result && <p className="vbe-hint"><Loader2 size={14} className="vbe-spin" /> Loading icons…</p>}
            {result && (
                <>
                    <div className="vbe-icons__grid">
                        {result.names.map(name => (
                            <button type="button" key={name} className="vbe-icons__item" title={name}
                                onClick={() => { if (targetId) store.getState().patch<IconNode>(targetId, { name }); closePanel(); }}>
                                <IconSvg node={map![name][0]} />
                            </button>
                        ))}
                    </div>
                    {!result.total && <p className="vbe-hint">No icons match “{query}”.</p>}
                    {result.total > limit && <button type="button" className="vbe-btn vbe-btn--ghost" onClick={() => setLimit(l => l + ICON_PAGE)}>Show more ({result.total - limit})</button>}
                    {targetId && (store.getState().nodes[targetId] as IconNode | undefined)?.name && (
                        <button type="button" className="vbe-btn vbe-btn--ghost" onClick={() => { store.getState().patch<IconNode>(targetId, { name: '' }); closePanel(); }}>Remove icon</button>
                    )}
                </>
            )}
        </div>
    );
}

function PanelHeader({ title }: { title: string }) {
    const closePanel = useUi(s => s.closePanel);
    return <div className="vbe-panel__head"><button type="button" className="vbe-chrome__btn" aria-label="Back to settings" onClick={closePanel}><ArrowLeft size={15} /></button><h3 className="vbe-panel__title">{title}</h3></div>;
}
