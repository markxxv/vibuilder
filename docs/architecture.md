# Architecture

## Layers

```
┌──────────────────────────────────────────────┐
│ Filament: BuilderPage (full-screen editor)     │  Stage 3
├──────────────────────────────────────────────┤
│ React editor (element registry, dnd-kit,       │  Stage 4
│ Tiptap, Lucide picker, media browser)          │
├──────────────────────────────────────────────┤
│ PHP core: DocumentValidator, Renderer, Blade   │  Stage 1–2
├──────────────────────────────────────────────┤
│ Storage: vb_documents (JSON) + Media Library   │  Stage 1–2
└──────────────────────────────────────────────┘
```

The public site uses only the PHP core and Blade. React, Tiptap and dnd-kit are never loaded on the frontend.

## Decisions

| Decision | Why |
| --- | --- |
| Standalone package, not tied to any project | No references to a site's models, slugs, forms or copy |
| Own `vb_documents` table with a morph to any model | The host model needs no JSON column or migrations of its own |
| `spatie/laravel-medialibrary` in `require` | Media library, conversions and the API are built on it |
| Document is JSON v1, backend is the source of truth | Client-side checks are for UX only |
| `revision` (SHA-256) with row locking | Prevents overwrites when two tabs are open |
| Elements are registered in a registry | A new element is a PHP class plus a TS component, no core changes |
| Full-screen editor instead of a Filament field | More comfortable, and the preview matches the public render |
| Schema core has no Laravel dependency | Fast, independent tests |

## What the package does NOT do

- It does not store pages, SEO, languages or URLs: that is the host's job.
- It does not render the site header or footer.
- It does not allow arbitrary HTML, CSS, utility classes or SVG.
