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
- Docs: media and uploads; rendering; architecture, element model, CSS conventions, media and uploads, installation, roadmap.
