import '../../css/editor.css';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ConfigContext, StoreContext, useMediaCache, useUi, type EditorConfig, type Utilities } from './context.tsx';
import { createEditorStore } from './store.ts';

type MountOptions = {
    host: HTMLElement;
    props: EditorConfig & { document: Record<string, unknown>; revision: string };
    utilities: Utilities;
};

/** Mounts the full-screen editor into `host`. Returns a handle to unmount it. */
export function mount({ host, props, utilities }: MountOptions) {
    const store = createEditorStore(props.document, props.revision);
    useMediaCache.getState().put(Object.values(props.media ?? {}));
    useUi.getState().closePanel();
    const root = createRoot(host);
    root.render(
        <StoreContext.Provider value={store}>
            <ConfigContext.Provider value={props}>
                <App utilities={utilities} />
            </ConfigContext.Provider>
        </StoreContext.Provider>,
    );

    return { destroy: () => root.unmount(), store };
}

(globalThis as { Vibuilder?: unknown }).Vibuilder = { mount };
