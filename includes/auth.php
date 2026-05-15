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
        'active_service_id' => $user['active_service_id'] ?? null,
        'active_service_code' => $user['active_service_code'] ?? ($user['service'] ?? null),
        'active_service_name' => $user['active_service_name'] ?? null,
        'active_service_logo' => $user['active_service_logo'] ?? null,
        'active_rank_name' => $user['active_rank_name'] ?? ($user['rank_name'] ?? null),
    ];
}

function updateActiveServiceSession(array $service): void
{
    startSecureSession();

    if (!isset($_SESSION['user'])) {
        return;
    }

    $_SESSION['user']['active_service_id'] = (int) $service['service_id'];
    $_SESSION['user']['active_service_code'] = $service['service_code'];
    $_SESSION['user']['active_service_name'] = $service['service_name'];
    $_SESSION['user']['active_service_logo'] = $service['logo_path'] ?? null;
    $_SESSION['user']['active_rank_name'] = $service['rank_name'] ?? null;
    $_SESSION['user']['service'] = $service['service_code'];
    $_SESSION['user']['rank_name'] = $service['rank_name'] ?? null;
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
