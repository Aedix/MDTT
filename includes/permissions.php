<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';

const ROLE_POWER_LEVELS = [
    'officer' => 10,
    'senior' => 10,
    'user' => 10,
    'sergeant' => 40,
    'lieutenant' => 50,
    'chief' => 80,
    'admin' => 90,
    'super_admin' => 100,
];

const ROLE_PERMISSIONS = [
    'officer' => [
        'mdt.access',
    ],
    'senior' => [
        'mdt.access',
    ],
    'user' => [
        'mdt.access',
    ],
    'sergeant' => [
        'mdt.access',
        'panel.access',
        'accounts.view',
        'accounts.activate',
        'accounts.deactivate',
    ],
    'lieutenant' => [
        'mdt.access',
        'panel.access',
        'accounts.view',
        'accounts.activate',
        'accounts.deactivate',
    ],
    'chief' => [
        'mdt.access',
        'panel.access',
        'service.full_access',
        'accounts.view',
        'accounts.activate',
        'accounts.deactivate',
        'accounts.change_rank',
        'ranks.create',
        'ranks.rename',
        'ranks.move',
        'ranks.delete',
    ],
    'admin' => [
        'mdt.access',
        'panel.access',
        'service.full_access',
        'accounts.view',
        'accounts.activate',
        'accounts.deactivate',
        'accounts.change_rank',
        'accounts.reset_password',
        'ranks.create',
        'ranks.rename',
        'ranks.move',
        'ranks.delete',
        'roles.assign',
    ],
    'super_admin' => [
        '*',
    ],
];

function normalizeRole(?string $role): string
{
    return strtolower(trim((string) $role));
}

function getRolePowerLevel(?string $role): int
{
    $normalizedRole = normalizeRole($role);
    return ROLE_POWER_LEVELS[$normalizedRole] ?? 0;
}

function getRolePermissions(?string $role): array
{
    $normalizedRole = normalizeRole($role);
    return ROLE_PERMISSIONS[$normalizedRole] ?? [];
}

function userHasMinimumRole(array $user, string $minimumRole): bool
{
    $userPowerLevel = getRolePowerLevel($user['role'] ?? null);
    $requiredPowerLevel = getRolePowerLevel($minimumRole);

    return $userPowerLevel >= $requiredPowerLevel;
}

function userHasPermission(array $user, string $permission): bool
{
    $permissions = getRolePermissions($user['role'] ?? null);

    return in_array('*', $permissions, true) || in_array($permission, $permissions, true);
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

function requirePermission(string $permission): array
{
    $user = requireAuthenticatedUser();

    if (!userHasPermission($user, $permission)) {
        http_response_code(403);
        echo 'Accès refusé.';
        exit;
    }

    return $user;
}

function canOpenManagementPanel(array $user): bool
{
    return userHasPermission($user, 'panel.access');
}

function isSystemAdminUser(array $user): bool
{
    return userHasPermission($user, 'accounts.reset_password');
}
