# vibuilder

A simplified "Elementor" for Laravel + Filament: sections, grids, cells and ready-made cards.
Users edit **content and safe options only**; the design stays under the developer's control.

> Status: early development, not published. Install locally (see [docs/installation.md](docs/installation.md)).

## Principles

- **Not a free-form HTML/CSS builder.** Only predefined elements and settings.
- **Everything is interactive in the preview.** Edit text, icons, images and order right on the page.
- **Semantic CSS classes** (`vb-grid`, `vb-card`); Tailwind utilities live only in CSS via `@apply`.
- **Full-screen editor** on a dedicated Filament page, not a form field.
- **Docs are updated in the same commit as the code.**

## Documentation

| File | Topic |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Package layers, data flow, dependencies |
| [docs/elements.md](docs/elements.md) | Document model: section → elements → grid → cells, JSON and rules |
| [docs/css-conventions.md](docs/css-conventions.md) | Class naming and the `@apply` rule |
| [docs/media-and-uploads.md](docs/media-and-uploads.md) | Media library, 400 KB chunked uploads |
| [docs/installation.md](docs/installation.md) | Local install via a path repository |
| [docs/roadmap.md](docs/roadmap.md) | Stages and progress |
| [CHANGELOG.md](CHANGELOG.md) | Change history |
