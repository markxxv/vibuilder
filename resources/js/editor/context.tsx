import { createContext, useContext } from 'react';
import { create, useStore } from 'zustand';
import type { EditorNode } from './model.ts';
import type { EditorState, EditorStore } from './store.ts';

export type MediaItem = { id: number; name: string; thumbUrl: string | null; url?: string | null; width: number | null; height: number | null; ready: boolean };

export type EditorConfig = {
    documentId: number;
    title: string;
    backUrl: string;
    csrfToken: string;
    uploadsUrl: string;
    mediaUrl: string;
    iconsUrl: string;
    media: Record<string, MediaItem>;
};

export type Utilities = { save: (document: Record<string, unknown>, revision: string) => Promise<{ ok: boolean; revision?: string; message?: string }> };

export const StoreContext = createContext<EditorStore | null>(null);
export const ConfigContext = createContext<EditorConfig | null>(null);

export const useEditorStore = (): EditorStore => { const s = useContext(StoreContext); if (!s) throw new Error('No editor store'); return s; };
export const useConfig = (): EditorConfig => { const c = useContext(ConfigContext); if (!c) throw new Error('No config'); return c; };
export const useEditor = <T,>(selector: (s: EditorState) => T): T => useStore(useEditorStore(), selector);
export const useNode = <T extends EditorNode>(id: string): T => useEditor(s => s.nodes[id] as T);

/** Right-hand panel and transient UI state. Never part of the document or of history. */
export type PanelState = {
    panel: 'inspector' | 'media' | 'icons';
    targetId: string | null;
    saving: boolean;
    message: string | null;
    openMedia: (targetId: string | null) => void;
    openIcons: (targetId: string) => void;
    closePanel: () => void;
    setSaving: (saving: boolean, message?: string | null) => void;
};
export const useUi = create<PanelState>(set => ({
    panel: 'inspector', targetId: null, saving: false, message: null,
    openMedia: targetId => set({ panel: 'media', targetId }),
    openIcons: targetId => set({ panel: 'icons', targetId }),
    closePanel: () => set({ panel: 'inspector', targetId: null }),
    setSaving: (saving, message = null) => set({ saving, message }),
}));

/** Small cache of media items (id -> item) for previews; filled from the server and from uploads/browsing. */
export const useMediaCache = create<{ items: Record<number, MediaItem>; put: (items: MediaItem[]) => void }>(set => ({
    items: {},
    put: items => set(s => ({ items: { ...s.items, ...Object.fromEntries(items.map(i => [i.id, i])) } })),
}));
