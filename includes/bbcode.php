<?php

declare(strict_types=1);

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

    $safe = preg_replace_callback('/\[color=(#[0-9a-fA-F]{3,6}|[a-zA-Z]+|rgb\([0-9,\s]+\))\](.*?)\[\/color\]/is', static function (array $matches): string {
        $color = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        return '<span style="color:' . $color . '">' . $matches[2] . '</span>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[highlight=(#[0-9a-fA-F]{3,6}|[a-zA-Z]+|rgb\([0-9,\s]+\))\](.*?)\[\/highlight\]/is', static function (array $matches): string {
        $color = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        return '<span style="background-color:' . $color . '; color:#111827; padding:1px 4px; border-radius:4px;">' . $matches[2] . '</span>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[font=([a-zA-Z0-9\s,\-]+)\](.*?)\[\/font\]/is', static function (array $matches): string {
        $font = htmlspecialchars($matches[1], ENT_QUOTES, 'UTF-8');
        return '<span style="font-family:' . $font . '">' . $matches[2] . '</span>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[url\](https?:\/\/[^\s\[]+)\[\/url\]/i', static function (array $matches): string {
        $url = filter_var(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'), FILTER_VALIDATE_URL);
        if (!$url) {
            return $matches[0];
        }
        $escapedUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        return '<a href="' . $escapedUrl . '" target="_blank" rel="noopener noreferrer">' . $escapedUrl . '</a>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[url=(https?:\/\/[^\s\]]+)\](.*?)\[\/url\]/i', static function (array $matches): string {
        $url = filter_var(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'), FILTER_VALIDATE_URL);
        if (!$url) {
            return $matches[0];
        }
        $escapedUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        return '<a href="' . $escapedUrl . '" target="_blank" rel="noopener noreferrer">' . $matches[2] . '</a>';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[img\](https?:\/\/[^\s\[]+)\[\/img\]/i', static function (array $matches): string {
        $url = filter_var(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'), FILTER_VALIDATE_URL);
        if (!$url) {
            return $matches[0];
        }
        $escapedUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        return '<img class="bbcode-image" src="' . $escapedUrl . '" alt="Image annonce" loading="lazy" />';
    }, $safe) ?? $safe;

    $safe = preg_replace_callback('/\[file=(https?:\/\/[^\s\]]+)\](.*?)\[\/file\]/i', static function (array $matches): string {
        $url = filter_var(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'), FILTER_VALIDATE_URL);
        if (!$url) {
            return $matches[0];
        }
        $escapedUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        return '<a class="bbcode-file" href="' . $escapedUrl . '" target="_blank" rel="noopener noreferrer">' . $matches[2] . '</a>';
    }, $safe) ?? $safe;

    return nl2br($safe);
}
