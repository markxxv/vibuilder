<?php

declare(strict_types=1);

namespace Vibuilder\Schema;

/**
 * Strict validator for the vibuilder JSON document v1.
 * Framework-free on purpose: it can be tested and reused without Laravel.
 * See docs/elements.md for the contract.
 */
final class DocumentValidator
{
    public const VERSION = 1;
    public const MAX_BYTES = 1048576;
    public const MAX_SECTIONS = 100;
    public const MAX_SECTION_CHILDREN = 50;
    public const MAX_CELLS = 24;
    public const MAX_CELL_CHILDREN = 20;
    public const MAX_CLASSES = 10;
    public const MAX_RICH_DEPTH = 12;

    private const UUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
    private const ANCHOR = '/^[a-z][a-z0-9-]{0,63}$/';
    private const CSS_CLASS = '/^[a-z][a-z0-9_-]{0,47}$/';
    private const ICON = '/^[a-z0-9]+(-[a-z0-9]+)*$/';

    private const SECTION_ELEMENTS = ['heading', 'lead', 'button', 'grid'];
    private const CELL_ELEMENTS = ['heading', 'text', 'image', 'icon', 'button'];
    private const VARIANTS = ['default', 'hero'];
    private const BUTTON_VARIANTS = ['primary', 'secondary', 'link'];
    private const COLUMNS = ['desktop' => [1, 2, 3, 4, 6], 'tablet' => [1, 2, 3, 4], 'mobile' => [1, 2, 3]];
    private const RICH_NODES = ['doc', 'paragraph', 'text', 'bulletList', 'orderedList', 'listItem', 'hardBreak'];
    private const RICH_MARKS = ['bold', 'italic', 'strike', 'underline', 'link'];

    /** @var list<string> */
    private array $errors = [];
    /** @var array<string, true> */
    private array $ids = [];
    /** @var array<string, true> */
    private array $anchors = [];

    /**
     * @param array<string, mixed> $document
     * @return list<string> error messages with JSON paths; empty means valid
     */
    public function validate(array $document): array
    {
        $this->errors = [];
        $this->ids = [];
        $this->anchors = [];

        if (strlen((string) json_encode($document)) > self::MAX_BYTES) {
            return ['document: exceeds 1 MiB'];
        }
        if (($document['version'] ?? null) !== self::VERSION) {
            return ['version: only 1 is supported'];
        }
        $sections = $document['sections'] ?? null;
        if (! is_array($sections) || ! array_is_list($sections)) {
            return ['sections: must be a list'];
        }
        if (count($sections) > self::MAX_SECTIONS) {
            $this->fail('sections', 'at most '.self::MAX_SECTIONS);
        }
        foreach ($sections as $i => $section) {
            $this->section($section, "sections[$i]");
        }

        return $this->errors;
    }

    public function isValid(array $document): bool
    {
        return $this->validate($document) === [];
    }

    private function section(mixed $s, string $path): void
    {
        if (! is_array($s) || ($s['type'] ?? null) !== 'section') {
            $this->fail($path, 'must be a section');
            return;
        }
        $this->id($s, $path);
        $anchor = $s['anchor'] ?? null;
        if (! is_string($anchor) || ! preg_match(self::ANCHOR, $anchor)) {
            $this->fail("$path.anchor", 'invalid anchor');
        } elseif (isset($this->anchors[$anchor])) {
            $this->fail("$path.anchor", 'duplicate anchor');
        } else {
            $this->anchors[$anchor] = true;
        }
        $this->classes($s['classes'] ?? null, "$path.classes");
        $variant = $s['variant'] ?? null;
        if (! in_array($variant, self::VARIANTS, true)) {
            $this->fail("$path.variant", 'must be default or hero');
        }
        $children = $s['children'] ?? null;
        if (! is_array($children) || ! array_is_list($children) || count($children) > self::MAX_SECTION_CHILDREN) {
            $this->fail("$path.children", 'must be a list of at most '.self::MAX_SECTION_CHILDREN);
            return;
        }
        foreach ($children as $i => $el) {
            $this->element($el, "$path.children[$i]", 'section', $variant === 'hero');
        }
    }

    private function element(mixed $el, string $path, string $context, bool $hero = false): void
    {
        $allowed = $context === 'section' ? self::SECTION_ELEMENTS : self::CELL_ELEMENTS;
        $type = is_array($el) ? ($el['type'] ?? null) : null;
        if (! in_array($type, $allowed, true)) {
            $this->fail($path, "type not allowed in $context");
            return;
        }
        $this->id($el, $path);

        match ($type) {
            'heading' => $this->heading($el, $path, $context, $hero),
            'lead' => $this->string($el['text'] ?? null, "$path.text", 500),
            'text' => $this->rich($el['content'] ?? null, "$path.content"),
            'image' => $this->image($el, $path),
            'icon' => $this->icon($el, $path),
            'button' => $this->button($el, $path),
            'grid' => $this->grid($el, $path),
        };
    }

    private function heading(array $el, string $path, string $context, bool $hero): void
    {
        $this->string($el['text'] ?? null, "$path.text", 255);
        $levels = $context === 'section' ? ($hero ? [1] : [2]) : [3, 4, 5, 6];
        if (! in_array($el['level'] ?? null, $levels, true)) {
            $this->fail("$path.level", 'must be one of '.implode(',', $levels));
        }
    }

    private function image(array $el, string $path): void
    {
        $media = $el['mediaId'] ?? null;
        if ($media !== null && (! is_int($media) || $media < 1)) {
            $this->fail("$path.mediaId", 'must be a positive integer or null');
        }
        $this->string($el['alt'] ?? null, "$path.alt", 255);
    }

    private function icon(array $el, string $path): void
    {
        $name = $el['name'] ?? null;
        if (! is_string($name) || ($name !== '' && (strlen($name) > 100 || ! preg_match(self::ICON, $name)))) {
            $this->fail("$path.name", 'invalid icon name');
        }
    }

    private function button(array $el, string $path): void
    {
        $this->string($el['label'] ?? null, "$path.label", 120);
        if (! is_string($el['url'] ?? null) || ! self::safeUrl($el['url'])) {
            $this->fail("$path.url", 'unsafe or invalid url');
        }
        if (! in_array($el['variant'] ?? null, self::BUTTON_VARIANTS, true)) {
            $this->fail("$path.variant", 'must be primary, secondary or link');
        }
        if (! is_bool($el['newTab'] ?? null)) {
            $this->fail("$path.newTab", 'must be boolean');
        }
    }

    private function grid(array $el, string $path): void
    {
        $this->classes($el['classes'] ?? null, "$path.classes");
        $columns = $el['columns'] ?? null;
        foreach (self::COLUMNS as $device => $values) {
            if (! is_array($columns) || ! in_array($columns[$device] ?? null, $values, true)) {
                $this->fail("$path.columns.$device", 'must be one of '.implode(',', $values));
            }
        }
        $cells = $el['cells'] ?? null;
        if (! is_array($cells) || ! array_is_list($cells) || count($cells) > self::MAX_CELLS) {
            $this->fail("$path.cells", 'must be a list of at most '.self::MAX_CELLS);
            return;
        }
        foreach ($cells as $i => $cell) {
            $cp = "$path.cells[$i]";
            if (! is_array($cell)) {
                $this->fail($cp, 'must be an object');
                continue;
            }
            $this->id($cell, $cp);
            $children = $cell['children'] ?? null;
            if (! is_array($children) || ! array_is_list($children) || count($children) > self::MAX_CELL_CHILDREN) {
                $this->fail("$cp.children", 'must be a list of at most '.self::MAX_CELL_CHILDREN);
                continue;
            }
            foreach ($children as $j => $child) {
                $this->element($child, "$cp.children[$j]", 'cell');
            }
        }
    }

    private function rich(mixed $node, string $path, int $depth = 1): void
    {
        if ($depth > self::MAX_RICH_DEPTH) {
            $this->fail($path, 'too deep');
            return;
        }
        if (! is_array($node) || ! in_array($node['type'] ?? null, self::RICH_NODES, true)) {
            $this->fail($path, 'unsupported rich text node');
            return;
        }
        if (($node['type'] === 'text') && ! is_string($node['text'] ?? null)) {
            $this->fail("$path.text", 'must be string');
        }
        foreach ($node['marks'] ?? [] as $i => $mark) {
            $type = is_array($mark) ? ($mark['type'] ?? null) : null;
            if (! in_array($type, self::RICH_MARKS, true)) {
                $this->fail("$path.marks[$i]", 'unsupported mark');
            } elseif ($type === 'link' && ! self::safeUrl((string) ($mark['attrs']['href'] ?? ''))) {
                $this->fail("$path.marks[$i].attrs.href", 'unsafe url');
            }
        }
        foreach ($node['content'] ?? [] as $i => $child) {
            $this->rich($child, "$path.content[$i]", $depth + 1);
        }
    }

    public static function safeUrl(string $url): bool
    {
        if ($url === '') {
            return true;
        }
        if (strlen($url) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $url)) {
            return false;
        }
        if ($url[0] === '/') {
            return ! str_starts_with($url, '//');
        }
        if ($url[0] === '#') {
            return true;
        }

        return (bool) preg_match('#^(https?://[^/]|mailto:|tel:)#i', $url);
    }

    private function id(array $el, string $path): void
    {
        $id = $el['id'] ?? null;
        if (! is_string($id) || ! preg_match(self::UUID, $id)) {
            $this->fail("$path.id", 'must be a uuid');
        } elseif (isset($this->ids[strtolower($id)])) {
            $this->fail("$path.id", 'duplicate id');
        } else {
            $this->ids[strtolower($id)] = true;
        }
    }

    private function classes(mixed $classes, string $path): void
    {
        if (! is_array($classes) || ! array_is_list($classes) || count($classes) > self::MAX_CLASSES) {
            $this->fail($path, 'must be a list of at most '.self::MAX_CLASSES);
            return;
        }
        foreach ($classes as $i => $class) {
            if (! is_string($class) || ! preg_match(self::CSS_CLASS, $class)) {
                $this->fail("$path[$i]", 'invalid class name');
            }
        }
    }

    private function string(mixed $value, string $path, int $max): void
    {
        if (! is_string($value) || mb_strlen($value) > $max) {
            $this->fail($path, "must be a string up to $max chars");
        }
    }

    private function fail(string $path, string $message): void
    {
        $this->errors[] = "$path: $message";
    }
}
