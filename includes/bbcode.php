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
        '/\[quote\](.*?)\[\/quote\]/is' => '<blockquote>$1</blockquote>',
        '/\[code\](.*?)\[\/code\]/is' => '<pre><code>$1</code></pre>',
        '/\[list\](.*?)\[\/list\]/is' => '<ul>$1</ul>',
        '/\[\*\](.*?)(?=\[\*\]|\[\/list\]|$)/is' => '<li>$1</li>',
    ];

    foreach ($replacements as $pattern => $replacement) {
        $safe = preg_replace($pattern, $replacement, $safe) ?? $safe;
    }

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

    return nl2br($safe);
}
