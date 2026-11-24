<?php

declare(strict_types=1);

namespace Vibuilder\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Vibuilder\Render\Renderer;

final class RendererTest extends TestCase
{
    private static int $n = 0;

    private static function uuid(): string
    {
        return sprintf('00000000-0000-4000-8000-%012d', ++self::$n);
    }

    private static function section(array $children, string $variant = 'default', array $classes = ['services']): array
    {
        return ['version' => 1, 'sections' => [[
            'id' => self::uuid(), 'type' => 'section', 'anchor' => 'section-one', 'classes' => $classes, 'variant' => $variant, 'children' => $children,
        ]]];
    }

    private static function heading(int $level, string $text): array
    {
        return ['id' => self::uuid(), 'type' => 'heading', 'level' => $level, 'text' => $text];
    }

    public function test_section_markup_and_custom_classes(): void
    {
        $html = (new Renderer())->render(self::section([self::heading(2, 'Hi')]));
        $this->assertTrue(str_contains($html, '<section id="section-one" class="vb-section services">'));
        $this->assertTrue(str_contains($html, '<h2 class="vb-heading vb-heading--2">Hi</h2>'));
    }

    public function test_hero_variant_and_h1(): void
    {
        $html = (new Renderer())->render(self::section([self::heading(1, 'Hero')], 'hero'));
        $this->assertTrue(str_contains($html, 'vb-section vb-section--hero'));
        $this->assertTrue(str_contains($html, '<h1 class="vb-heading vb-heading--1">'));
    }

    public function test_escapes_text_and_attributes(): void
    {
        $html = (new Renderer())->render(self::section([self::heading(2, '<script>alert(1)</script>')], 'default', ['bad"class', 'ok']));
        $this->assertFalse(str_contains($html, '<script>'));
        $this->assertFalse(str_contains($html, 'bad"class'));
        $this->assertTrue(str_contains($html, 'class="vb-section ok"'));
    }

    public function test_grid_exposes_columns_as_css_variables(): void
    {
        $grid = ['id' => self::uuid(), 'type' => 'grid', 'classes' => [], 'columns' => ['desktop' => 4, 'tablet' => 2, 'mobile' => 1],
            'cells' => [['id' => self::uuid(), 'children' => [self::heading(3, 'Card')]]]];
        $html = (new Renderer())->render(self::section([$grid]));
        $this->assertTrue(str_contains($html, 'style="--vb-cols-desktop:4;--vb-cols-tablet:2;--vb-cols-mobile:1"'));
        $this->assertTrue(str_contains($html, '<div class="vb-cell">'));
    }

    public function test_empty_and_unresolved_elements_render_nothing(): void
    {
        $els = [
            self::heading(2, '   '),
            ['id' => self::uuid(), 'type' => 'lead', 'text' => ''],
            ['id' => self::uuid(), 'type' => 'button', 'label' => '', 'url' => '/x', 'variant' => 'primary', 'newTab' => false],
        ];
        $grid = ['id' => self::uuid(), 'type' => 'grid', 'classes' => [], 'columns' => ['desktop' => 1, 'tablet' => 1, 'mobile' => 1],
            'cells' => [['id' => self::uuid(), 'children' => [
                ['id' => self::uuid(), 'type' => 'image', 'mediaId' => 99, 'alt' => 'x'],
                ['id' => self::uuid(), 'type' => 'icon', 'name' => 'unknown'],
            ]]]];
        $html = (new Renderer(fn () => null, fn () => null))->render(self::section([...$els, $grid]));
        foreach (['<h2', 'vb-lead', 'vb-button', '<img', 'vb-icon'] as $needle) {
            $this->assertFalse(str_contains($html, $needle), $needle);
        }
    }

    public function test_image_icon_and_button(): void
    {
        $cell = [
            ['id' => self::uuid(), 'type' => 'image', 'mediaId' => 7, 'alt' => 'A "pic"'],
            ['id' => self::uuid(), 'type' => 'icon', 'name' => 'file-text'],
            ['id' => self::uuid(), 'type' => 'button', 'label' => 'Go', 'url' => 'https://example.com', 'variant' => 'secondary', 'newTab' => true],
        ];
        $grid = ['id' => self::uuid(), 'type' => 'grid', 'classes' => [], 'columns' => ['desktop' => 1, 'tablet' => 1, 'mobile' => 1],
            'cells' => [['id' => self::uuid(), 'children' => $cell]]];
        $html = (new Renderer(fn (int $id) => "/media/$id.webp", fn (string $n) => '<svg data-i="'.$n.'"></svg>'))->render(self::section([$grid]));
        $this->assertTrue(str_contains($html, 'src="/media/7.webp" alt="A &quot;pic&quot;" loading="lazy"'));
        $this->assertTrue(str_contains($html, '<span class="vb-icon" aria-hidden="true"><svg data-i="file-text"></svg></span>'));
        $this->assertTrue(str_contains($html, 'class="vb-button vb-button--secondary" href="https://example.com" target="_blank" rel="noopener noreferrer"'));
    }

    public function test_unsafe_button_url_is_dropped(): void
    {
        $btn = ['id' => self::uuid(), 'type' => 'button', 'label' => 'x', 'url' => 'javascript:alert(1)', 'variant' => 'primary', 'newTab' => false];
        $this->assertFalse(str_contains((new Renderer())->render(self::section([$btn])), 'javascript'));
    }

    public function test_rich_text(): void
    {
        $text = ['id' => self::uuid(), 'type' => 'text', 'content' => ['type' => 'doc', 'content' => [
            ['type' => 'paragraph', 'content' => [
                ['type' => 'text', 'text' => 'a<b', 'marks' => [['type' => 'bold']]],
                ['type' => 'text', 'text' => 'link', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'https://x.dev']]]],
                ['type' => 'text', 'text' => 'bad', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'javascript:x']]]],
            ]],
            ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'i']]]]]]],
        ]]];
        $grid = ['id' => self::uuid(), 'type' => 'grid', 'classes' => [], 'columns' => ['desktop' => 1, 'tablet' => 1, 'mobile' => 1],
            'cells' => [['id' => self::uuid(), 'children' => [$text]]]];
        $html = (new Renderer())->render(self::section([$grid]));
        $this->assertTrue(str_contains($html, '<strong>a&lt;b</strong>'));
        $this->assertTrue(str_contains($html, '<a href="https://x.dev" rel="noopener noreferrer">link</a>'));
        $this->assertFalse(str_contains($html, 'javascript'));
        $this->assertTrue(str_contains($html, '<ul><li><p>i</p></li></ul>'));
    }
}
