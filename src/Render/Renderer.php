<?php

declare(strict_types=1);

namespace Vibuilder\Render;

use Closure;
use Vibuilder\Schema\DocumentValidator;

/**
 * Renders a validated document to HTML using semantic `vb-*` classes only.
 * Framework-free: media and icons are resolved through injected callables.
 *
 *  - mediaUrl: fn (int $mediaId): ?string  (public URL, null if missing)
 *  - icon:     fn (string $name): ?string  (trusted inline SVG, null if unknown)
 */
final class Renderer
{
    public function __construct(
        private readonly ?Closure $mediaUrl = null,
        private readonly ?Closure $icon = null,
    ) {
    }

    public function render(array $document): string
    {
        return implode("\n", array_map(fn ($s) => $this->section($s), $document['sections'] ?? []));
    }

    private function section(array $s): string
    {
        $class = $this->classes(['vb-section', ($s['variant'] ?? 'default') === 'hero' ? 'vb-section--hero' : null], $s['classes'] ?? []);
        $body = implode("\n", array_map(fn ($el) => $this->element($el), $s['children'] ?? []));

        return '<section id="'.$this->e((string) $s['anchor']).'" class="'.$class.'"><div class="vb-section__inner">'."\n$body\n</div></section>";
    }

    private function element(array $el): string
    {
        return match ($el['type'] ?? null) {
            'heading' => $this->heading($el),
            'lead' => $this->lead($el),
            'text' => $this->text($el),
            'image' => $this->image($el),
            'icon' => $this->iconEl($el),
            'button' => $this->button($el),
            'grid' => $this->grid($el),
            default => '',
        };
    }

    private function heading(array $el): string
    {
        $text = trim((string) ($el['text'] ?? ''));
        if ($text === '') {
            return '';
        }
        $level = max(1, min(6, (int) ($el['level'] ?? 2)));

        return "<h$level class=\"vb-heading vb-heading--$level\">".$this->e($text)."</h$level>";
    }

    private function lead(array $el): string
    {
        $text = trim((string) ($el['text'] ?? ''));

        return $text === '' ? '' : '<p class="vb-lead">'.$this->e($text).'</p>';
    }

    private function text(array $el): string
    {
        $html = RichText::render($el['content'] ?? []);

        return $html === '' || $html === '<p></p>' ? '' : '<div class="vb-text">'.$html.'</div>';
    }

    private function image(array $el): string
    {
        $id = $el['mediaId'] ?? null;
        $url = is_int($id) && $this->mediaUrl ? ($this->mediaUrl)($id) : null;
        if (! $url || ! DocumentValidator::safeUrl($url)) {
            return '';
        }

        return '<figure class="vb-image"><img class="vb-image__img" src="'.$this->e($url).'" alt="'.$this->e((string) ($el['alt'] ?? '')).'" loading="lazy" decoding="async"></figure>';
    }

    private function iconEl(array $el): string
    {
        $name = (string) ($el['name'] ?? '');
        $svg = $name !== '' && $this->icon ? ($this->icon)($name) : null;

        return $svg ? '<span class="vb-icon" aria-hidden="true">'.$svg.'</span>' : '';
    }

    private function button(array $el): string
    {
        $label = trim((string) ($el['label'] ?? ''));
        $url = (string) ($el['url'] ?? '');
        if ($label === '' || $url === '' || ! DocumentValidator::safeUrl($url)) {
            return '';
        }
        $variant = in_array($el['variant'] ?? null, ['primary', 'secondary', 'link'], true) ? $el['variant'] : 'primary';
        $attrs = ! empty($el['newTab']) ? ' target="_blank" rel="noopener noreferrer"' : RichText::linkAttrs($url);

        return '<a class="vb-button vb-button--'.$variant.'" href="'.$this->e($url).'"'.$attrs.'>'.$this->e($label).'</a>';
    }

    private function grid(array $el): string
    {
        $c = $el['columns'] ?? [];
        $style = sprintf('--vb-cols-desktop:%d;--vb-cols-tablet:%d;--vb-cols-mobile:%d', (int) ($c['desktop'] ?? 3), (int) ($c['tablet'] ?? 2), (int) ($c['mobile'] ?? 1));
        $cells = array_map(function (array $cell): string {
            $inner = implode("\n", array_map(fn ($child) => $this->element($child), $cell['children'] ?? []));

            return "<div class=\"vb-cell\">\n$inner\n</div>";
        }, $el['cells'] ?? []);

        return '<div class="'.$this->classes(['vb-grid'], $el['classes'] ?? '').'" style="'.$style.'">'."\n".implode("\n", $cells)."\n</div>";
    }

    /** @param list<?string> $base @param mixed $extra */
    private function classes(array $base, mixed $extra): string
    {
        $extra = is_array($extra) ? array_filter($extra, fn ($c) => is_string($c) && preg_match('/^[a-z][a-z0-9_-]{0,47}$/', $c)) : [];

        return $this->e(implode(' ', [...array_filter($base), ...$extra]));
    }

    private function e(string $v): string
    {
        return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
