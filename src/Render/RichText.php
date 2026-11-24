<?php

declare(strict_types=1);

namespace Vibuilder\Render;

use Vibuilder\Schema\DocumentValidator;

/** Renders a validated Tiptap JSON document to escaped, allow-listed HTML. */
final class RichText
{
    private const TAGS = ['paragraph' => 'p', 'bulletList' => 'ul', 'orderedList' => 'ol', 'listItem' => 'li'];
    private const MARKS = ['bold' => 'strong', 'italic' => 'em', 'strike' => 's', 'underline' => 'u'];

    public static function render(array $node): string
    {
        return match ($node['type'] ?? null) {
            'doc' => self::children($node),
            'text' => self::text($node),
            'hardBreak' => '<br>',
            'paragraph', 'bulletList', 'orderedList', 'listItem' => self::block($node),
            default => '',
        };
    }

    private static function children(array $node): string
    {
        return implode('', array_map(fn ($c) => is_array($c) ? self::render($c) : '', $node['content'] ?? []));
    }

    private static function block(array $node): string
    {
        $tag = self::TAGS[$node['type']];

        return "<$tag>".self::children($node)."</$tag>";
    }

    private static function text(array $node): string
    {
        $html = htmlspecialchars((string) ($node['text'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        foreach ($node['marks'] ?? [] as $mark) {
            $type = $mark['type'] ?? null;
            if (isset(self::MARKS[$type])) {
                $tag = self::MARKS[$type];
                $html = "<$tag>$html</$tag>";
            } elseif ($type === 'link') {
                $href = (string) ($mark['attrs']['href'] ?? '');
                if ($href !== '' && DocumentValidator::safeUrl($href)) {
                    $html = '<a href="'.self::e($href).'"'.self::linkAttrs($href).'>'.$html.'</a>';
                }
            }
        }

        return $html;
    }

    public static function linkAttrs(string $href): string
    {
        return preg_match('#^https?://#i', $href) ? ' rel="noopener noreferrer"' : '';
    }

    private static function e(string $v): string
    {
        return htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
