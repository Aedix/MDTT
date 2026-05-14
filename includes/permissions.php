<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const ROLE_POWER_LEVELS = [
    'user' => 10,
    'supervisor' => 50,
    'admin' => 90,
    'super_admin' => 100,
];

function getRolePowerLevel(?string $role): int
{
    $normalizedRole = strtolower(trim((string) $role));
    return ROLE_POWER_LEVELS[$normalizedRole] ?? 0;
}

function userHasMinimumRole(array $user, string $minimumRole): bool
{
    $userPowerLevel = getRolePowerLevel($user['role'] ?? null);
    $requiredPowerLevel = getRolePowerLevel($minimumRole);

    return $userPowerLevel >= $requiredPowerLevel;
}

function requireMinimumRole(string $minimumRole): array
{
    $user = requireAuthenticatedUser();

    if (!userHasMinimumRole($user, $minimumRole)) {
        http_response_code(403);
        echo 'Accès refusé.';
        exit;
    }

    return $user;
}

function isAdminUser(array $user): bool
{
    return userHasMinimumRole($user, 'admin');
}
