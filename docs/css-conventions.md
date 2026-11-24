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
