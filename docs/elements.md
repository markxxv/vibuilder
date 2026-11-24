# Document model (v1)

```
Document
└─ Section            (id, anchor, classes[], variant)
   ├─ heading         H2 (H1 in hero)
   ├─ lead            subtitle / lead text
   ├─ button          button or link
   └─ grid            (columns: desktop/tablet/mobile)
      └─ Cell         grid column
         ├─ heading   H3–H6
         ├─ text      Tiptap rich text
         ├─ image     media library reference
         ├─ icon      Lucide
         └─ button    button or link
```

Elements inside a section sit **on the same level** and can be freely reordered. Ready-made cards (templates) are
presets that insert a set of elements into a cell; there is no separate "card" type in the JSON.

## Section

| Field | Type | Rules |
| --- | --- | --- |
| `id` | uuid | unique within the document |
| `type` | `"section"` | |
| `anchor` | string | auto (`section-xxxxxxxx`), editable; `^[a-z][a-z0-9-]{0,63}$`, unique within the document |
| `classes` | string[] | tags input, up to 10; `^[a-z][a-z0-9_-]{0,47}$`; semantic names, not utilities |
| `variant` | `default` \| `hero` | in `hero` the section heading is an H1 |
| `children` | element[] | `heading`, `lead`, `button`, `grid`; up to 50 |

The schema requires H1 only in a `hero` section and H2 elsewhere. That a page has a single H1 is checked by the
renderer, not the schema.

## Grid

| Field | Rules |
| --- | --- |
| `columns.desktop` | 1, 2, 3, 4, 6 |
| `columns.tablet` | 1, 2, 3, 4 |
| `columns.mobile` | 1, 2, 3 |
| `classes` | same as for a section |
| `cells` | up to 24 cells, each `{id, children[]}`, up to 20 elements per cell |

Columns are set independently for the three devices; the mobile value is not tied to desktop.

## Elements

| `type` | Where | Fields |
| --- | --- | --- |
| `heading` | section: level 2 (1 in hero); cell: 3–6 | `level`, `text` ≤ 255 |
| `lead` | section | `text` ≤ 500 |
| `text` | cell | `content`: Tiptap JSON |
| `image` | cell | `mediaId` (media library id or `null`), `alt` ≤ 255 |
| `icon` | cell | `name`: Lucide icon in kebab-case, or `""` |
| `button` | section, cell | `label` ≤ 120, `url`, `variant` (`primary`/`secondary`/`link`), `newTab` |

### Tiptap

Nodes: `doc`, `paragraph`, `text`, `bulletList`, `orderedList`, `listItem`, `hardBreak`. Marks: `bold`, `italic`,
`strike`, `underline`, `link`. Depth up to 12. HTML is never stored.

### URLs

Allowed: `http(s)://`, a path with a single leading `/`, `#fragment`, `mailto:`, `tel:`. Rejected: `//host`, spaces,
backslashes, control characters, `javascript:`, `data:`. Length up to 2048.

## Limits

Version 1, up to 100 sections, ids unique across the whole document, JSON up to 1 MiB.

## Example

```json
{
  "version": 1,
  "sections": [{
    "id": "8aa9d7bf-f34c-4c19-9c84-5bca5929cbc4",
    "type": "section",
    "anchor": "section-a1b2c3d4",
    "classes": ["services"],
    "variant": "default",
    "children": [
      {"id": "11111111-1111-4111-8111-111111111111", "type": "heading", "level": 2, "text": "Our services"},
      {"id": "22222222-2222-4222-8222-222222222222", "type": "lead", "text": "The short version"},
      {"id": "33333333-3333-4333-8333-333333333333", "type": "grid",
       "columns": {"desktop": 3, "tablet": 2, "mobile": 1}, "classes": [],
       "cells": [{"id": "44444444-4444-4444-8444-444444444444", "children": [
         {"id": "55555555-5555-4555-8555-555555555555", "type": "icon", "name": "file-text"},
         {"id": "66666666-6666-4666-8666-666666666666", "type": "heading", "level": 3, "text": "Documents"}
       ]}]}
    ]
  }]
}
```
