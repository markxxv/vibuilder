import { useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, Redo2, Save, Undo2 } from 'lucide-react';
import { Canvas } from './Canvas.tsx';
import { DEVICE_ICONS } from './Chrome.tsx';
import { IconPicker, Inspector, MediaBrowser } from './panels.tsx';
import { useConfig, useEditor, useEditorStore, useUi, type Utilities } from './context.tsx';
import type { Device } from './model.ts';

export function App({ utilities }: { utilities: Utilities }) {
    const store = useEditorStore();
    const config = useConfig();
    const { panel, saving, message, setSaving } = useUi();
    const device = useEditor(s => s.device);
    const dirty = useEditor(s => s.nodes !== s.savedTree.nodes || s.sections !== s.savedTree.sections);
    const canUndo = useEditor(s => s.past.length > 0);
    const canRedo = useEditor(s => s.future.length > 0);

    const save = useCallback(async () => {
        const s = store.getState();
        if (useUi.getState().saving || !s.isDirty()) return;
        setSaving(true);
        try {
            const result = await utilities.save(s.document(), s.revision);
            if (result.ok) { store.getState().markSaved(result.revision ?? s.revision); setSaving(false); }
            else setSaving(false, result.message ?? 'Could not save.');
        } catch { setSaving(false, 'Could not save. Check your connection and try again.'); }
    }, [store, utilities, setSaving]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            const editing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
            if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
            else if (mod && !editing && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.getState().redo() : store.getState().undo(); }
            else if (mod && !editing && e.key.toLowerCase() === 'y') { e.preventDefault(); store.getState().redo(); }
            else if (!editing && (e.key === 'Delete' || e.key === 'Backspace') && store.getState().selectedId) { e.preventDefault(); store.getState().remove(store.getState().selectedId!); }
        };
        const beforeUnload = (e: BeforeUnloadEvent) => { if (store.getState().isDirty()) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('keydown', onKey);
        window.addEventListener('beforeunload', beforeUnload);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', beforeUnload); };
    }, [store, save]);

    return (
        <div className="vbe-root">
            <header className="vbe-toolbar">
                <a className="vbe-toolbar__back" href={config.backUrl}><ArrowLeft size={16} /> Back</a>
                <strong className="vbe-toolbar__title">{config.title}</strong>
                <div className="vbe-toolbar__devices" role="group" aria-label="Preview width">
                    {(Object.keys(DEVICE_ICONS) as Device[]).map(d => {
                        const Icon = DEVICE_ICONS[d];
                        return <button key={d} type="button" className="vbe-toolbar__btn" aria-label={d} aria-pressed={device === d} data-active={device === d || undefined} onClick={() => store.getState().setDevice(d)}><Icon size={16} /></button>;
                    })}
                </div>
                <div className="vbe-toolbar__spacer" />
                <span className="vbe-toolbar__status" role="status" aria-live="polite" data-error={message ? true : undefined}>{message ?? (saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved')}</span>
                <button type="button" className="vbe-toolbar__btn" aria-label="Undo" disabled={!canUndo} onClick={() => store.getState().undo()}><Undo2 size={16} /></button>
                <button type="button" className="vbe-toolbar__btn" aria-label="Redo" disabled={!canRedo} onClick={() => store.getState().redo()}><Redo2 size={16} /></button>
                <button type="button" className="vbe-save" disabled={!dirty || saving} onClick={save}>{saving ? <Loader2 size={15} className="vbe-spin" /> : <Save size={15} />} Save</button>
            </header>
            <Canvas />
            <aside className="vbe-panel" aria-label="Settings">
                {panel === 'media' ? <MediaBrowser /> : panel === 'icons' ? <IconPicker /> : <Inspector />}
            </aside>
        </div>
    );
}
