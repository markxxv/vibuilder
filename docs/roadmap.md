# Roadmap

| Stage | Scope | Status |
| --- | --- | --- |
| 0 | Package skeleton, docs | ✅ |
| 1 | PHP core: document schema, `vb_documents` model, revisions | 🟡 schema done; revisions and saving pending |
| 2 | Renderer (PHP, CSS via `@apply`) | ✅ |
| 2b | Media API, chunked upload client, light 1:1 thumbnails | ✅ |
| 3 | Standalone full-screen editor page, save with revision check, `HasVibuilder` trait | ✅ (PHP side not run against a live Laravel yet) |
| 4 | Editor: element registry, drag & drop, inline editing, Tiptap bubble menu, Lucide picker, media browser, per-device columns | ✅ browser-tested; see [editor.md](editor.md) |
| 5 | Card templates (insert into a cell) | ⬜ |
| 6 | Drafts/publishing, public release | ⬜ |

## Next

- Run the PHP side against a live Laravel app (`composer update && composer test`, open the editor, upload an image).
- Stage 5: card templates; media: delete/rename, drag-and-drop file onto an image placeholder.
- Live cross-container drag preview (today an element lands on drop, with a highlighted target).
- Optional Filament integration (resource page trait) if the plain action link is not enough.

## Open questions

- Whether a `text` element is needed at section level (currently cells only).
- The list of ready-made cards for the first version.
