<?php

declare(strict_types=1);

require_once __DIR__ . '/permissions.php';

function reportStatusLabel(string $status): string
{
    return match ($status) {
        'draft' => 'Brouillon',
        'submitted' => 'Soumis',
        'review' => 'En révision CS',
        'validated' => 'Validé',
        'archived' => 'Archivé',
        'rejected' => 'Rejeté',
        default => $status,
    };
}

function reportClassificationLabel(string $classification): string
{
    return match ($classification) {
        'unclassified' => 'Non classifié',
        'internal' => 'Interne service',
        'confidential' => 'Confidentiel',
        'restricted_cs' => 'Restreint Command Staff',
        'declassified' => 'Déclassifié',
        default => $classification,
    };
}

function reportTypeLabel(string $type): string
{
    return match ($type) {
        'intervention' => 'Rapport d’intervention',
        'incident' => 'Rapport d’incident',
        'arrestation' => 'Rapport d’arrestation',
        'arrestation_dossier' => 'Dossier d’arrestation',
        'operation' => 'Rapport d’opération',
        'interne' => 'Rapport interne',
        'renseignement' => 'Rapport de renseignement',
        'patrouille' => 'Compte-rendu de patrouille',
        default => $type,
    };
}

function reportAccessLabel(string $scope): string
{
    return match ($scope) {
        'service' => 'Service actif uniquement',
        'interservice' => 'Interservice',
        'division' => 'Division',
        'supervisors' => 'Supervisor minimum',
        'directors' => 'Director uniquement',
        'explicit' => 'Agents autorisés uniquement',
        default => $scope,
    };
}

function userActiveServiceCode(array $user): string
{
    return strtoupper(trim((string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT')));
}

function userCanManageRestrictedReports(array $user): bool
{
    return isSuperAdminUser($user)
        || userHasPermission($user, '*')
        || userHasPermission($user, 'reports.status.update')
        || userHasMinimumRole($user, 'chief')
        || str_contains(strtolower((string) ($user['active_rank_name'] ?? $user['rank_name'] ?? '')), 'director')
        || str_contains(strtolower((string) ($user['active_rank_name'] ?? $user['rank_name'] ?? '')), 'command staff');
}

function canUserAccessReport(array $user, array $report, PDO $pdo): bool
{
    if (isSuperAdminUser($user)) {
        return true;
    }

    $userId = (int) ($user['id'] ?? 0);
    $serviceCode = userActiveServiceCode($user);
    $scope = (string) ($report['access_scope'] ?? 'service');
    $ownerService = strtoupper((string) ($report['service_code'] ?? ''));
    $sameService = $ownerService === $serviceCode;
    $classification = (string) ($report['classification_level'] ?? 'internal');
    $commandStaff = userCanManageRestrictedReports($user);

    if ($classification === 'restricted_cs' && !$commandStaff) {
        return false;
    }

    if ($classification === 'confidential' && !$sameService && !$commandStaff) {
        return false;
    }

    if ($classification === 'internal' && !$sameService) {
        return false;
    }

    if ($userId > 0 && (int) ($report['created_by'] ?? 0) === $userId && $classification !== 'restricted_cs') {
        return true;
    }

    if ($scope !== 'interservice' && !$sameService) {
        return false;
    }

    if ($scope === 'explicit') {
        $statement = $pdo->prepare('SELECT 1 FROM report_allowed_users WHERE report_id = :report_id AND user_id = :user_id LIMIT 1');
        $statement->execute([
            'report_id' => (int) $report['id'],
            'user_id' => $userId,
        ]);
        return (bool) $statement->fetchColumn();
    }

    if ($scope === 'directors') {
        return $commandStaff;
    }

    if ($scope === 'supervisors') {
        return getRolePowerLevel($user['role'] ?? null) >= getRolePowerLevel('sergeant');
    }

    if ($scope === 'division') {
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
