<?php

declare(strict_types=1);

function mdtRichEscape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function mdtRichAllowedSpanClasses(): array
{
    return [
        'mdt-rich-color-red',
        'mdt-rich-color-orange',
        'mdt-rich-color-yellow',
        'mdt-rich-color-green',
        'mdt-rich-color-blue',
        'mdt-rich-color-purple',
        'mdt-rich-highlight-yellow',
        'mdt-rich-highlight-green',
        'mdt-rich-highlight-blue',
        'mdt-rich-highlight-red',
        'mdt-rich-classified',
        'mdt-rich-redacted',
    ];
}

function mdtRichHasHtml(string $value): bool
{
    return preg_match('/<\/?(p|b|strong|i|em|u|s|ul|ol|li|br|span)\b/i', $value) === 1;
}

function mdtRichHasBbCode(string $value): bool
{
    return preg_match('/\[(b|strong|i|em|u|s|strike|br|list|list=1|ul|ol|\*|color|highlight|mark|bg|classified|secret|redacted)\b/i', $value) === 1;
}

function mdtRichBbClass(string $type, string $value): ?string
{
    $normalized = mb_strtolower(trim($value));
    $colors = [
        'red' => 'mdt-rich-color-red',
        'rouge' => 'mdt-rich-color-red',
        'orange' => 'mdt-rich-color-orange',
        'yellow' => 'mdt-rich-color-yellow',
        'jaune' => 'mdt-rich-color-yellow',
        'green' => 'mdt-rich-color-green',
        'vert' => 'mdt-rich-color-green',
        'blue' => 'mdt-rich-color-blue',
        'bleu' => 'mdt-rich-color-blue',
        'purple' => 'mdt-rich-color-purple',
        'violet' => 'mdt-rich-color-purple',
    ];
    $highlights = [
        'yellow' => 'mdt-rich-highlight-yellow',
        'jaune' => 'mdt-rich-highlight-yellow',
        'green' => 'mdt-rich-highlight-green',
        'vert' => 'mdt-rich-highlight-green',
        'blue' => 'mdt-rich-highlight-blue',
        'bleu' => 'mdt-rich-highlight-blue',
        'red' => 'mdt-rich-highlight-red',
        'rouge' => 'mdt-rich-highlight-red',
    ];

    return $type === 'highlight' ? ($highlights[$normalized] ?? null) : ($colors[$normalized] ?? null);
}

function mdtRichConvertList(string $html, string $pattern, string $tag): string
{
    return preg_replace_callback($pattern, static function (array $matches) use ($tag): string {
        $items = preg_split('/\[\*\]/i', (string) $matches[1]);
        $items = array_values(array_filter(array_map('trim', $items), static fn (string $item): bool => $item !== ''));
        if (!$items) return '';
        return '<' . $tag . '>' . implode('', array_map(static fn (string $item): string => '<li>' . $item . '</li>', $items)) . '</' . $tag . '>';
    }, $html) ?? $html;
}

function mdtRichBbCodeToHtml(string $value): string
{
    $html = mdtRichEscape($value);

    $html = preg_replace('/\[b\]([\s\S]*?)\[\/b\]/i', '<strong>$1</strong>', $html) ?? $html;
    $html = preg_replace('/\[strong\]([\s\S]*?)\[\/strong\]/i', '<strong>$1</strong>', $html) ?? $html;
    $html = preg_replace('/\[i\]([\s\S]*?)\[\/i\]/i', '<em>$1</em>', $html) ?? $html;
    $html = preg_replace('/\[em\]([\s\S]*?)\[\/em\]/i', '<em>$1</em>', $html) ?? $html;
    $html = preg_replace('/\[u\]([\s\S]*?)\[\/u\]/i', '<u>$1</u>', $html) ?? $html;
    $html = preg_replace('/\[s\]([\s\S]*?)\[\/s\]/i', '<s>$1</s>', $html) ?? $html;
    $html = preg_replace('/\[strike\]([\s\S]*?)\[\/strike\]/i', '<s>$1</s>', $html) ?? $html;
    $html = preg_replace('/\[(classified|secret|redacted)\]([\s\S]*?)\[\/\1\]/i', '<span class="mdt-rich-classified">$2</span>', $html) ?? $html;
    $html = preg_replace('/\[br\s*\/\]/i', '<br>', $html) ?? $html;
    $html = preg_replace('/\[br\]/i', '<br>', $html) ?? $html;

    $html = preg_replace_callback('/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/i', static function (array $matches): string {
        $class = mdtRichBbClass('color', (string) $matches[1]);
        return $class ? '<span class="' . $class . '">' . $matches[2] . '</span>' : (string) $matches[2];
    }, $html) ?? $html;

    $html = preg_replace_callback('/\[(highlight|mark|bg)=([^\]]+)\]([\s\S]*?)\[\/\1\]/i', static function (array $matches): string {
        $class = mdtRichBbClass('highlight', (string) $matches[2]);
        return $class ? '<span class="' . $class . '">' . $matches[3] . '</span>' : (string) $matches[3];
    }, $html) ?? $html;

    $html = mdtRichConvertList($html, '/\[list=1\]([\s\S]*?)\[\/list\]/i', 'ol');
    $html = mdtRichConvertList($html, '/\[ol\]([\s\S]*?)\[\/ol\]/i', 'ol');
    $html = mdtRichConvertList($html, '/\[list\]([\s\S]*?)\[\/list\]/i', 'ul');
    $html = mdtRichConvertList($html, '/\[ul\]([\s\S]*?)\[\/ul\]/i', 'ul');

    return $html;
}

function mdtRichPlainTextToHtml(string $value): string
{
    $blocks = preg_split('/\n{2,}/', trim($value));
    $blocks = array_values(array_filter(array_map('trim', $blocks), static fn (string $block): bool => $block !== ''));
    return implode('', array_map(static fn (string $block): string => '<p>' . str_replace("\n", '<br>', mdtRichEscape($block)) . '</p>', $blocks));
}

function mdtRichSanitizeHtml(string $html): string
{
    $html = strip_tags($html, '<p><strong><b><em><i><u><s><ul><ol><li><br><span>');
    $html = preg_replace_callback('/<span\b([^>]*)>/i', static function (array $matches): string {
        $attrs = (string) ($matches[1] ?? '');
        if (!preg_match('/class\s*=\s*(["\'])(.*?)\1/i', $attrs, $classMatches)) return '<span>';
        $allowed = mdtRichAllowedSpanClasses();
        $classes = preg_split('/\s+/', trim((string) $classMatches[2]));
        $classes = array_values(array_unique(array_filter($classes, static fn (string $class): bool => in_array($class, $allowed, true))));
        $classes = array_map(static fn (string $class): string => $class === 'mdt-rich-redacted' ? 'mdt-rich-classified' : $class, $classes);
        return $classes ? '<span class="' . implode(' ', array_unique($classes)) . '">' : '<span>';
    }, $html) ?? $html;

    $html = preg_replace('/<(?!span\b)([a-z][a-z0-9]*)\b[^>]*>/i', '<$1>', $html) ?? $html;
    $html = preg_replace('/<\s*\/\s*([a-z][a-z0-9]*)\s*>/i', '</$1>', $html) ?? $html;
    $html = preg_replace('/<br\s*>/i', '<br>', $html) ?? $html;
    $html = preg_replace('/<b>/i', '<strong>', $html) ?? $html;
    $html = preg_replace('/<\/b>/i', '</strong>', $html) ?? $html;
    $html = preg_replace('/<i>/i', '<em>', $html) ?? $html;
    $html = preg_replace('/<\/i>/i', '</em>', $html) ?? $html;
    $html = preg_replace('/<span>\s*<\/span>/i', '', $html) ?? $html;
    return trim($html);
}

function mdtNormalizeRichText(?string $value): ?string
{
    $raw = trim((string) $value);
    if ($raw === '') return null;
    if (mdtRichHasHtml($raw)) return mdtRichSanitizeHtml($raw);
    if (mdtRichHasBbCode($raw)) return mdtRichSanitizeHtml(mdtRichBbCodeToHtml($raw));
    return mdtRichSanitizeHtml(mdtRichPlainTextToHtml($raw));
}

function mdtRichToPlainText(?string $value): ?string
{
    $html = mdtNormalizeRichText($value);
    if ($html === null) return null;
    $text = trim(html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $html)), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    return $text === '' ? null : $text;
}
