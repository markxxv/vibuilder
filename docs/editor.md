# Editor

Full-screen, standalone page (`GET {prefix}/documents/{document}`), independent of the host admin's layout.
Built with React + Zustand + dnd-kit + Tiptap; shipped prebuilt in `dist/` (hosts need no Node build).

```
┌ toolbar: back · title · desktop/tablet/mobile · status · undo · redo · Save ┐
├────────────────────────────────────────────┬────────────────────────────────┤
│ canvas: the page, rendered with the same   │ panel: Inspector │ Media │ Icons │
│ vb-* markup/CSS as the public site         │ (switches by what you click)    │
└────────────────────────────────────────────┴────────────────────────────────┘
```

## Interaction model

| You do | What happens |
| --- | --- |
| Click text of a heading / lead / button | It is an input styled as the page text; type in place |
| Click a text block | Static HTML becomes a Tiptap editor; select text for the bubble menu (bold, italic, underline, strike, link) |
| Click an image | Media library opens in the right panel (all images of all documents, search, upload) |
| Click an icon | Icon picker opens in the right panel (search over 2100 Lucide icons) |
| Click anything | It is selected: outline + small toolbar (drag handle, duplicate, delete); settings appear in the panel |
| Grid toolbar → Columns | Desktop / tablet / mobile column counts, each independent |
| Hover container → **+** | Add an element allowed in that container |
| Drag handle | Reorder sections, columns and elements; move elements between columns |
| Ctrl/Cmd+Z, +Shift+Z, +S, Delete | Undo, redo, save, delete selection |

Preview width: desktop (never narrower than 1024px), tablet 768px, mobile 390px. Column counts follow the
section's container width, exactly like the public site.

## Smoothness rules (no jumps, no jitter)

These are requirements, not nice-to-haves; the browser test in `tests/e2e` enforces the measurable ones.

1. **Never scroll or move focus programmatically.** Editing, adding, selecting and undoing leave the scroll position alone.
2. **Selection and menus never change layout.** Hover/selection are `outline`s; toolbars, the "+" button and menus are absolutely positioned overlays.
3. **Inline inputs cannot shift the page.** A hidden ghost copy of the text sizes the field (CSS grid stacking), the input inherits all typography, so focusing or typing never resizes anything beyond the text itself, and there is no JS height measuring.
4. **Per-node subscriptions.** The store is normalized (nodes by id). Typing re-renders one component; unchanged nodes stay referentially equal.
5. **One undo step per typing burst** (800 ms coalescing), so undo is predictable.
6. **Lazy rich text.** Static HTML (byte-identical to the PHP renderer) until clicked; only one Tiptap instance exists at a time.
7. **Cheap dragging.** A small chip instead of cloning the dragged subtree, only transforms animate, droppables are measured only while dragging, and only legal targets are offered.
8. **Light media.** The library loads 200×200 WebP thumbnails, 24 at a time, lazily, in fixed-size cells; the canvas uses the `big` WebP, never the original.
9. **Icons load once.** `icons.json` (about 100 KB gzipped) is fetched on first need, the picker renders at most 96 icons at a time.
10. **Stable scroll containers.** `scrollbar-gutter: stable`, `overscroll-behavior: contain`, no layout animations (reduced-motion respected).

Editor-only elements (placeholders, empty-column hints, selection chrome) never appear on the public page.

## Saving

`POST {prefix}/documents/{document}` with `{document, revision}`. The server validates the JSON with
`DocumentValidator`, locks the row, and compares `revision` with the stored content's hash. A mismatch returns
**409** with a clear message and nothing is overwritten (second tab, other editor). Success returns the new revision.
The editor warns before leaving with unsaved changes.

## Code map

| Path | Role |
| --- | --- |
| `resources/js/editor/model.ts` | Normalized tree, factories, pure operations (insert/move/remove/duplicate), JSON round trip |
| `resources/js/editor/store.ts` | Zustand store: selection, device, history with coalescing, dirty tracking |
| `resources/js/editor/dnd.ts` | `resolveDrop`: where a dragged node may land |
| `resources/js/editor/elements.tsx` | Element views and the registry (`VIEWS`) |
| `resources/js/editor/{Canvas,Chrome,InlineText,RichTextView,panels,App}.tsx` | UI |
| `resources/js/editor/richtext.ts` | Client mirror of the PHP rich-text renderer and URL allow-list |
| `resources/js/upload.ts` | Chunked upload client |
| `resources/css/editor-chrome.css` | Editor chrome (`vbe-*`) |
| `src/Http/Controllers/EditorController.php` | Page, save, assets |

## Adding an element type

1. PHP: add the type to `DocumentValidator` (allowed context + rules) and to `Renderer`.
2. `model.ts`: factory in `createNode`, add to `SECTION_CHILDREN` / `CELL_CHILDREN`, extend `fromDocument`/`toDocument` if it nests.
3. `elements.tsx`: a view that renders the same markup as the PHP renderer; register it in `VIEWS`.
4. `panels.tsx`: inspector fields; `Chrome.tsx`: label.
5. Tests on both sides, docs in `elements.md`, rebuild `dist/` (`npm run build`).

## Testing

```bash
npm run typecheck   # TypeScript
npm run test:js     # model, store, dnd, rich text (vs PHP), upload client
npm run test:e2e    # real Chrome: layout shift, scroll, typing, undo, rich text, icons, columns, drag & drop, save
```

`test:e2e` needs Chrome/Chromium (`CHROME_PATH` to override `/usr/bin/google-chrome`).
