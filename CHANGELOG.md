# Changelog

## Unreleased

### Added
- Composer package skeleton, service provider, config, `vb_documents` migration.
- Document schema v1 (`Vibuilder\Schema\DocumentValidator`): sections, grid, cells, elements heading/lead/text/image/icon/button.
- `Renderer` and `RichText`: escaped, allow-listed HTML with semantic `vb-*` classes; media and icon resolvers.
- `resources/css/vibuilder.css` (Tailwind 4 `@apply`, container-query grid, `--vb-*` theming) and `<x-vibuilder::document>` component.
- Media API (library across all documents, resumable 400 KB chunked upload, finalize), `ChunkStore`, `ImageInspector`, `vibuilder:purge-uploads`.
- Light conversions: `thumb` 200×200 1:1 WebP q75 (immediate), `big` WebP on the queue.
- `resources/js/upload.ts`: sequential, resumable, retrying upload client with tests (`npm run test:js`).
- Full-screen editor (React, Zustand, dnd-kit, Tiptap): inline text, lazy rich text with bubble menu, media browser, icon picker (Lucide, lazy `icons.json`), per-device columns popover, drag & drop, undo/redo with coalescing, inspector (anchor, classes tags input, variant, URL, alt).
- `EditorController` (page, save with SHA-256 revision check and 409 on conflict, static assets), `HasVibuilder` trait, `vibuilder::editor` view; prebuilt `dist/`.
- Tests: editor model/store/dnd/rich-text (cross-checked against PHP), and a real-Chrome e2e suite (layout shift, scroll stability, typing, undo, drag & drop, save).
- Fix: node ids no longer rely on `crypto.randomUUID` (missing on plain-http admin pages).
- Docs: editor; media and uploads; rendering; architecture, element model, CSS conventions, media and uploads, installation, roadmap.
