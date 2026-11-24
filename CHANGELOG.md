# Changelog

## Unreleased

### Added
- Composer package skeleton, service provider, config, `vb_documents` migration.
- Document schema v1 (`Vibuilder\Schema\DocumentValidator`): sections, grid, cells, elements heading/lead/text/image/icon/button.
- `Renderer` and `RichText`: escaped, allow-listed HTML with semantic `vb-*` classes; media and icon resolvers.
- `resources/css/vibuilder.css` (Tailwind 4 `@apply`, container-query grid, `--vb-*` theming) and `<x-vibuilder::document>` component.
- Docs: rendering; architecture, element model, CSS conventions, media and uploads, installation, roadmap.
