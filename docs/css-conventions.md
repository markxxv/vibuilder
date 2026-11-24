# CSS conventions

## The rule

In HTML/Blade/JSX use **semantic classes only**. Tailwind utilities are written in CSS via `@apply`.

```html
<!-- don't -->
<div class="grid grid-cols-2 gap-6">

<!-- do -->
<div class="vb-grid">
```

```css
.vb-grid {
    @apply grid gap-6;
    grid-template-columns: repeat(var(--vb-cols-mobile), minmax(0, 1fr));
}
```

## Naming

- Everything owned by the package is prefixed `vb-`: `vb-section`, `vb-grid`, `vb-cell`, `vb-heading`, `vb-button`.
- Variants use a `--` modifier: `vb-section--hero`, `vb-button--primary`.
- Editor-only classes (outlines, handles, panels) use the `vbe-` prefix: `vbe-toolbar`, `vbe-handle`. They never reach the frontend.
- The host adds its own section classes through the tags input (`services`, `faq`) and writes the styles for them.

## Responsiveness

Column counts are passed as CSS variables `--vb-cols-desktop|tablet|mobile` (values validated by PHP). Breakpoints use
container queries so the editor preview matches the frontend regardless of the admin window width.

## Isolation

- No global selectors on `h1, p, a, button`: every rule lives under `.vb-*`.
- One shared stylesheet for the preview and the public page; editor-only rules live separately (`vbe-*`).

## Stylesheet

`resources/css/vibuilder.css` is the single public stylesheet. Import it in the host's Tailwind entry so `@apply` resolves:

```css
@import "tailwindcss";
@import "../../vendor/markxxv/vibuilder/resources/css/vibuilder.css";
```

(or `php artisan vendor:publish --tag=vibuilder-css`). Verified to compile with Tailwind CSS 4.

## Theming

Hosts override custom properties, not the package rules:

| Variable | Default | Purpose |
| --- | --- | --- |
| `--vb-gap` | `1.5rem` | grid gap |
| `--vb-section-space` | `4rem` | vertical section padding |
| `--vb-max-width` | `72rem` | content width |
| `--vb-radius` | `1rem` | image radius |
| `--vb-color-text`, `--vb-color-muted` | grays | text colors |
| `--vb-color-accent`, `--vb-color-accent-text` | red / white | buttons, links, icons |
| `--vb-color-surface` | `#f3f4f6` | secondary button background |

## Breakpoints

The grid switches by **container width** of `.vb-section` (`vb` container): tablet columns from 40rem, desktop from 64rem.
