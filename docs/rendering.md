# Rendering

`Vibuilder\Render\Renderer` turns a document array into HTML. It is framework-free, escapes every value, and emits
only semantic `vb-*` classes. The public site needs no JavaScript from the package.

## Usage

```blade
<x-vibuilder::document :content="$document" />   {{-- Document model or decoded JSON array --}}
```

```php
app(\Vibuilder\Render\Renderer::class)->render($document->content);
```

## Markup

```html
<section id="section-a1b2c3d4" class="vb-section vb-section--hero services">
  <div class="vb-section__inner">
    <h1 class="vb-heading vb-heading--1">…</h1>
    <p class="vb-lead">…</p>
    <div class="vb-grid" style="--vb-cols-desktop:3;--vb-cols-tablet:2;--vb-cols-mobile:1">
      <div class="vb-cell">
        <span class="vb-icon" aria-hidden="true"><svg>…</svg></span>
        <h3 class="vb-heading vb-heading--3">…</h3>
        <div class="vb-text"><p>…</p></div>
        <figure class="vb-image"><img class="vb-image__img" loading="lazy" …></figure>
        <a class="vb-button vb-button--primary" href="…">…</a>
      </div>
    </div>
  </div>
</section>
```

## Rules

- **Empty means absent.** Empty headings, leads, texts, buttons without label/url, images without a resolvable media
  id and unknown icons render nothing: no placeholders, no empty boxes on the public page.
- **URLs are re-checked at output** with the same allow-list as the validator; unsafe links are dropped.
- **Extra classes** from the tags input are re-validated and appended after the package classes.
- **External links** (`http(s)`) get `rel="noopener noreferrer"`; `newTab` adds `target="_blank"`.

## Resolvers

The renderer receives two callables, so the core stays independent of Laravel:

| Resolver | Default (service provider) |
| --- | --- |
| `mediaUrl(int $id): ?string` | Media Library: `big` conversion URL, falls back to the original |
| `icon(string $name): ?string` | `svg('lucide-<name>')` from Blade Icons; `null` if not installed |

For server-side Lucide icons install a Blade Icons set, e.g. `composer require mallardduck/blade-lucide-icons`.

## Styles

Publish or import `resources/css/vibuilder.css` (see [css-conventions.md](css-conventions.md)).
