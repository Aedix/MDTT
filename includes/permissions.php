<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

const FALLBACK_ROLE_POWER_LEVELS = [
    'officer' => 10,
    'senior' => 10,
    'user' => 10,
    'sergeant' => 40,
    'lieutenant' => 50,
    'chief' => 80,
    'admin' => 90,
    'super_admin' => 100,
];

const FALLBACK_ROLE_PERMISSIONS = [
    'officer' => ['mdt.access'],
    'senior' => ['mdt.access'],
    'user' => ['mdt.access'],
    'sergeant' => ['mdt.access', 'panel.access', 'accounts.view', 'accounts.activate', 'accounts.deactivate'],
    'lieutenant' => ['mdt.access', 'panel.access', 'accounts.view', 'accounts.activate', 'accounts.deactivate'],
    'chief' => [
        'mdt.access',
        'panel.access',
        'service.full_access',
        'accounts.view',
        'accounts.activate',
        'accounts.deactivate',
        'accounts.change_rank',
        'ranks.view',
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
        'ranks.view',
        'ranks.create',
        'ranks.rename',
        'ranks.move',
        'ranks.delete',
        'roles.view',
        'roles.assign',
        'permissions.view',
    ],
    'super_admin' => ['*'],
];

function normalizeRole(?string $role): string
{
    return strtolower(trim((string) $role));
}

function getRolePowerLevel(?string $role): int
{
    $normalizedRole = normalizeRole($role);

    try {
        $pdo = getDatabaseConnection();
        $statement = $pdo->prepare('SELECT power_level FROM roles WHERE code = :code AND is_active = 1 LIMIT 1');
        $statement->execute(['code' => $normalizedRole]);
        $row = $statement->fetch();

        if ($row) {
            return (int) $row['power_level'];
        }
    } catch (Throwable $exception) {
        // Fallback used before the SQL migration is installed.
    }

    return FALLBACK_ROLE_POWER_LEVELS[$normalizedRole] ?? 0;
}

function getRolePermissions(?string $role): array
{
    $normalizedRole = normalizeRole($role);

    try {
        $pdo = getDatabaseConnection();
        $statement = $pdo->prepare(
            'SELECT p.code
             FROM roles r
             INNER JOIN role_permissions rp ON rp.role_id = r.id
             INNER JOIN permissions p ON p.id = rp.permission_id
             WHERE r.code = :role_code
               AND r.is_active = 1
               AND p.is_active = 1'
        );
        $statement->execute(['role_code' => $normalizedRole]);
        $permissions = $statement->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($permissions)) {
            return array_values(array_unique($permissions));
        }
    } catch (Throwable $exception) {
        // Fallback used before the SQL migration is installed.
    }

    return FALLBACK_ROLE_PERMISSIONS[$normalizedRole] ?? [];
}

function getAllRoles(): array
{
    try {
        $pdo = getDatabaseConnection();
        $statement = $pdo->query('SELECT id, code, label, power_level, is_system, is_active FROM roles ORDER BY power_level ASC, label ASC');
        return $statement->fetchAll();
    } catch (Throwable $exception) {
        return [];
    }
}

function getAllPermissions(): array
{
    try {
        $pdo = getDatabaseConnection();
        $statement = $pdo->query('SELECT id, code, label, description, is_active FROM permissions ORDER BY code ASC');
        return $statement->fetchAll();
    } catch (Throwable $exception) {
        return [];
    }
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
