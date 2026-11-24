<?php

declare(strict_types=1);

namespace Vibuilder\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Vibuilder\Schema\DocumentValidator;

final class DocumentValidatorTest extends TestCase
{
    private static int $n = 0;

    private static function uuid(): string
    {
        return sprintf('00000000-0000-4000-8000-%012d', ++self::$n);
    }

    private static function doc(array $children = [], string $variant = 'default', ?string $anchor = null): array
    {
        return ['version' => 1, 'sections' => [[
            'id' => self::uuid(), 'type' => 'section', 'anchor' => $anchor ?? 'section-'.self::$n,
            'classes' => ['services'], 'variant' => $variant, 'children' => $children,
        ]]];
    }

    private static function grid(array $cellChildren, array $columns = ['desktop' => 3, 'tablet' => 2, 'mobile' => 1]): array
    {
        return ['id' => self::uuid(), 'type' => 'grid', 'classes' => [], 'columns' => $columns,
            'cells' => [['id' => self::uuid(), 'children' => $cellChildren]]];
    }

    public function test_valid_document(): void
    {
        $doc = self::doc([
            ['id' => self::uuid(), 'type' => 'heading', 'level' => 2, 'text' => 'Title'],
            ['id' => self::uuid(), 'type' => 'lead', 'text' => 'Lead'],
            self::grid([
                ['id' => self::uuid(), 'type' => 'icon', 'name' => 'file-text'],
                ['id' => self::uuid(), 'type' => 'heading', 'level' => 3, 'text' => 'Card'],
                ['id' => self::uuid(), 'type' => 'text', 'content' => ['type' => 'doc', 'content' => [['type' => 'paragraph']]]],
                ['id' => self::uuid(), 'type' => 'image', 'mediaId' => null, 'alt' => ''],
                ['id' => self::uuid(), 'type' => 'button', 'label' => 'Go', 'url' => '/about', 'variant' => 'primary', 'newTab' => false],
            ]),
        ]);
        $this->assertSame([], (new DocumentValidator())->validate($doc));
    }

    public function test_hero_requires_h1_and_default_requires_h2(): void
    {
        $h1 = ['id' => self::uuid(), 'type' => 'heading', 'level' => 1, 'text' => 'Hero'];
        $this->assertTrue((new DocumentValidator())->isValid(self::doc([$h1], 'hero')));
        $this->assertFalse((new DocumentValidator())->isValid(self::doc([$h1], 'default')));
    }

    public function test_cell_headings_start_at_h3(): void
    {
        $h2 = ['id' => self::uuid(), 'type' => 'heading', 'level' => 2, 'text' => 'No'];
        $this->assertFalse((new DocumentValidator())->isValid(self::doc([self::grid([$h2])])));
    }

    public function test_invalid_columns_and_types(): void
    {
        $this->assertFalse((new DocumentValidator())->isValid(self::doc([self::grid([], ['desktop' => 5, 'tablet' => 2, 'mobile' => 1])])));
        $text = ['id' => self::uuid(), 'type' => 'text', 'content' => ['type' => 'doc']];
        $this->assertFalse((new DocumentValidator())->isValid(self::doc([$text])), 'text is not allowed at section level');
    }

    public function test_unsafe_urls_rejected(): void
    {
        foreach (['javascript:alert(1)', '//evil.com', 'data:text/html,x', '/a b', "/a\\b"] as $url) {
            $this->assertFalse(DocumentValidator::safeUrl($url), $url);
        }
        foreach (['', '/ru/about', '#faq', 'https://example.com/x', 'mailto:a@b.c', 'tel:+34600'] as $url) {
            $this->assertTrue(DocumentValidator::safeUrl($url), $url);
        }
    }

    public function test_duplicate_ids_and_anchors(): void
    {
        $doc = self::doc([]);
        $doc['sections'][] = $doc['sections'][0];
        $errors = (new DocumentValidator())->validate($doc);
        $this->assertNotEmpty(array_filter($errors, fn ($e) => str_contains($e, 'duplicate id')));
        $this->assertNotEmpty(array_filter($errors, fn ($e) => str_contains($e, 'duplicate anchor')));
    }

    public function test_rich_text_rejects_unknown_nodes_and_marks(): void
    {
        $bad = ['id' => self::uuid(), 'type' => 'text', 'content' => ['type' => 'doc', 'content' => [['type' => 'script']]]];
        $this->assertFalse((new DocumentValidator())->isValid(self::doc([self::grid([$bad])])));
        $badMark = ['id' => self::uuid(), 'type' => 'text', 'content' => ['type' => 'doc', 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'x', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'javascript:x']]]]]],
        ]]];
        $this->assertFalse((new DocumentValidator())->isValid(self::doc([self::grid([$badMark])])));
    }

    public function test_unsupported_version(): void
    {
        $this->assertFalse((new DocumentValidator())->isValid(['version' => 2, 'sections' => []]));
    }
}
