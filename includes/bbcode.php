<?php

declare(strict_types=1);

function isSafeMdtContentUrl(string $url): bool
{
    $decoded = html_entity_decode($url, ENT_QUOTES, 'UTF-8');

    if (filter_var($decoded, FILTER_VALIDATE_URL) && preg_match('/^https?:\/\//i', $decoded)) {
        return true;
    }

    return (bool) preg_match('/^\/uploads\/motd\/[a-zA-Z0-9_\-\.\/]+$/', $decoded);
}

function escapeMdtContentUrl(string $url): string
{
    return htmlspecialchars(html_entity_decode($url, ENT_QUOTES, 'UTF-8'), ENT_QUOTES, 'UTF-8');
}

function normalizeMdtCssColor(string $color): ?string
{
    $decoded = trim(html_entity_decode($color, ENT_QUOTES, 'UTF-8'));
    $decoded = preg_replace('/\s+/', ' ', $decoded) ?? $decoded;

    if (preg_match('/^#[0-9a-fA-F]{3,8}$/', $decoded)) {
        return $decoded;
    }

    if (preg_match('/^[a-zA-Z]+$/', $decoded)) {
        return $decoded;
    }

    if (preg_match('/^rgba?\(\s*\d{1,3}\s*(?:,|\s)\s*\d{1,3}\s*(?:,|\s)\s*\d{1,3}(?:\s*(?:,|\/)\s*(?:0|1|0?\.\d+))?\s*\)$/i', $decoded)) {
        return $decoded;
    }

    return null;
}

function renderBbCode(string $input): string
{
    $safe = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');

    $replacements = [
        '/\[b\](.*?)\[\/b\]/is' => '<strong>$1</strong>',
        '/\[i\](.*?)\[\/i\]/is' => '<em>$1</em>',
        '/\[u\](.*?)\[\/u\]/is' => '<u>$1</u>',
        '/\[s\](.*?)\[\/s\]/is' => '<s>$1</s>',
        '/\[mark\](.*?)\[\/mark\]/is' => '<mark>$1</mark>',
        '/\[h1\](.*?)\[\/h1\]/is' => '<h3>$1</h3>',
        '/\[h2\](.*?)\[\/h2\]/is' => '<h4>$1</h4>',
        '/\[quote\](.*?)\[\/quote\]/is' => '<blockquote>$1</blockquote>',
        '/\[code\](.*?)\[\/code\]/is' => '<pre><code>$1</code></pre>',
        '/\[list\](.*?)\[\/list\]/is' => '<ul>$1</ul>',
        '/\[\*\](.*?)(?=\[\*\]|\[\/list\]|$)/is' => '<li>$1</li>',
    ];

    foreach ($replacements as $pattern => $replacement) {
        $safe = preg_replace($pattern, $replacement, $safe) ?? $safe;
    }

    $safe = preg_replace_callback('/\[color=([^\]\r\n]+)\](.*?)\[\/color\]/is', static function (array $matches): string {
        $color = normalizeMdtCssColor($matches[1]);
        if ($color === null) {
            return $matches[2];
        }

        return '<span style="color:' . htmlspecialchars($color, ENT_QUOTES, 'UTF-8') . '">' . $matches[2] . '</span>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[highlight=([^\]\r\n]+)\](.*?)\[\/highlight\]/is', static function (array $matches): string {
        $color = normalizeMdtCssColor($matches[1]);
        if ($color === null) {
            return $matches[2];
        }

        return '<span style="background-color:' . htmlspecialchars($color, ENT_QUOTES, 'UTF-8') . '; padding:1px 4px; border-radius:4px;">' . $matches[2] . '</span>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[font=([a-zA-Z0-9\s,\-]+)\](.*?)\[\/font\]/is', static function (array $matches): string {
        $font = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        return '<span style="font-family:' . $font . '">' . $matches[2] . '</span>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[url\]((?:https?:\/\/[^\s\[]+)|(?:\/uploads\/motd\/[a-zA-Z0-9_\-\.\/]+))\[\/url\]/i', static function (array $matches): string {
        if (!isSafeMdtContentUrl($matches[1])) {
            return $matches[0];
        }
        $escapedUrl = escapeMdtContentUrl($matches[1]);
        return '<a href="' . $escapedUrl . '" target="_blank" rel="noopener noreferrer">' . $escapedUrl . '</a>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[url=((?:https?:\/\/[^\s\]]+)|(?:\/uploads\/motd\/[a-zA-Z0-9_\-\.\/]+))\](.*?)\[\/url\]/i', static function (array $matches): string {
        if (!isSafeMdtContentUrl($matches[1])) {
            return $matches[0];
        }
        $escapedUrl = escapeMdtContentUrl($matches[1]);
        return '<a href="' . $escapedUrl . '" target="_blank" rel="noopener noreferrer">' . $matches[2] . '</a>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[img\]((?:https?:\/\/[^\s\[]+)|(?:\/uploads\/motd\/[a-zA-Z0-9_\-\.\/]+))\[\/img\]/i', static function (array $matches): string {
        if (!isSafeMdtContentUrl($matches[1])) {
            return $matches[0];
        }
        $escapedUrl = escapeMdtContentUrl($matches[1]);
        return '<img class="bbcode-image" src="' . $escapedUrl . '" alt="Image annonce" loading="lazy" />';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[file=((?:https?:\/\/[^\s\]]+)|(?:\/uploads\/motd\/[a-zA-Z0-9_\-\.\/]+))\](.*?)\[\/file\]/i', static function (array $matches): string {
        if (!isSafeMdtContentUrl($matches[1])) {
            return $matches[0];
        }
        $escapedUrl = escapeMdtContentUrl($matches[1]);
        return '<a class="bbcode-file" href="' . $escapedUrl . '" target="_blank" rel="noopener noreferrer">' . $matches[2] . '</a>';
    }, $safe) ?? $safe;

    return nl2br($safe);
}
