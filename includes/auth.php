<?php

declare(strict_types=1);

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

function setAuthenticatedUser(array $user): void
{
    startSecureSession();
    session_regenerate_id(true);

    $_SESSION['user'] = [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'service' => $user['service'] ?? null,
        'rank_name' => $user['rank_name'] ?? null,
        'role' => $user['role'] ?? 'user',
    ];
}

function getAuthenticatedUser(): ?array
{
    startSecureSession();
    return $_SESSION['user'] ?? null;
}

function logoutAuthenticatedUser(): void
{
    startSecureSession();
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();
}

function requireAuthenticatedUser(): array
{
    $user = getAuthenticatedUser();

    if (!$user) {
        header('Location: /index.html');
        exit;
    }

    return $user;
}
