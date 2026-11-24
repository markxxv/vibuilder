# CSS-конвенции

## Правило

В HTML/Blade/JSX — **только семантические классы**. Tailwind-утилиты пишутся в CSS через `@apply`.

```html
<!-- нельзя -->
<div class="grid grid-cols-2 gap-6">

<!-- можно -->
<div class="vb-grid">
```

```css
.vb-grid {
    @apply grid gap-6;
    grid-template-columns: repeat(var(--vb-cols-mobile), minmax(0, 1fr));
}
```

## Именование

- Префикс `vb-` у всего, что принадлежит пакету: `vb-section`, `vb-grid`, `vb-cell`, `vb-heading`, `vb-button`.
- Варианты: `vb-section--hero`, `vb-button--primary` (модификатор через `--`).
- Классы редактора (рамки, handles, панели) — префикс `vbe-`: `vbe-toolbar`, `vbe-handle`. На фронт не попадают.
- Хост добавляет свои классы секции через tags input (`services`, `faq`), стили для них пишет сам.

## Адаптивность

Число колонок передаётся CSS-переменными `--vb-cols-desktop|tablet|mobile` (значения валидирует PHP). Брейкпоинты —
container queries, чтобы preview в редакторе совпадал с фронтом независимо от ширины админки.

## Изоляция

- Никаких глобальных селекторов на `h1, p, a, button`: все правила под `.vb-*`.
- Один общий CSS для preview и публичной страницы, редакторские правила отдельно (`vbe-*`).
