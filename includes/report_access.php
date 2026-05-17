<?php

declare(strict_types=1);

require_once __DIR__ . '/permissions.php';

function reportStatusLabel(string $status): string
{
    return match ($status) {
        'draft' => 'Brouillon',
        'submitted' => 'Soumis',
        'pending_validation' => 'En attente de validation',
        'validated' => 'Validé',
        'archived' => 'Archivé',
        'rejected' => 'Rejeté',
        default => $status,
    };
}

function reportTypeLabel(string $type): string
{
    return match ($type) {
        'intervention' => 'Rapport d’intervention',
        'incident' => 'Rapport d’incident',
        'arrestation' => 'Rapport d’arrestation',
        'operation' => 'Rapport d’opération',
        'interne' => 'Rapport interne',
        'renseignement' => 'Rapport de renseignement',
        'patrouille' => 'Compte-rendu de patrouille',
        default => $type,
    };
}

function userActiveServiceCode(array $user): string
{
    return strtoupper(trim((string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT')));
}

function canUserAccessReport(array $user, array $report, PDO $pdo): bool
{
    if (isSuperAdminUser($user)) {
        return true;
    }

    $userId = (int) ($user['id'] ?? 0);
    $serviceCode = userActiveServiceCode($user);

    if ($userId > 0 && (int) ($report['created_by'] ?? 0) === $userId) {
        return true;
    }

    if (strtoupper((string) ($report['service_code'] ?? '')) !== $serviceCode) {
        return false;
    }

    $requiredPower = (int) ($report['minimum_power_level'] ?? 0);
    if ($requiredPower > 0 && getRolePowerLevel($user['role'] ?? null) < $requiredPower) {
        return false;
    }

    $scope = (string) ($report['access_scope'] ?? 'service');

    if ($scope === 'explicit') {
        $statement = $pdo->prepare('SELECT 1 FROM report_allowed_users WHERE report_id = :report_id AND user_id = :user_id LIMIT 1');
        $statement->execute([
            'report_id' => (int) $report['id'],
            'user_id' => $userId,
        ]);
        return (bool) $statement->fetchColumn();
    }

    if ($scope === 'directors') {
        return getRolePowerLevel($user['role'] ?? null) >= getRolePowerLevel('chief');
    }

    if ($scope === 'supervisors') {
        return getRolePowerLevel($user['role'] ?? null) >= getRolePowerLevel('sergeant');
    }

    if ($scope === 'division') {
        // TODO: when user/division membership is implemented, restrict here.
        return true;
    }

    return true;
}

function generateReportNumber(PDO $pdo, string $serviceCode, string $typeCode): string
{
    $prefix = strtoupper($serviceCode) . '-' . strtoupper(substr($typeCode, 0, 3)) . '-' . date('Y') . '-';
    $statement = $pdo->prepare('SELECT COUNT(*) FROM reports WHERE report_number LIKE :prefix');
    $statement->execute(['prefix' => $prefix . '%']);
    $count = (int) $statement->fetchColumn() + 1;
    return $prefix . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
}
