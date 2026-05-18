<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sidebarStatusClass(string $status): string
{
    return match ($status) {
        'Disponible' => 'status-available',
        'Patrouille' => 'status-patrol',
        'Intervention' => 'status-intervention',
        'Pause' => 'status-pause',
        'Transport' => 'status-transport',
        'En attente' => 'status-waiting',
        'Indisponible' => 'status-unavailable',
        default => 'status-unassigned',
    };
}

try {
    $user = requireAuthenticatedUser();
    $pdo = getDatabaseConnection();

    $activeServiceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
    $rankFallback = (string) ($user['active_rank_name'] ?? $user['rank_name'] ?? 'Non défini');

    $serviceStatement = $pdo->prepare('SELECT id FROM services WHERE code = :code LIMIT 1');
    $serviceStatement->execute(['code' => $activeServiceCode]);
    $serviceId = (int) ($serviceStatement->fetchColumn() ?: 0);

    if ($serviceId <= 0) {
        respond([
            'success' => true,
            'username' => (string) ($user['username'] ?? ''),
            'label' => $rankFallback,
            'status' => 'Non défini',
            'status_class' => 'status-unassigned',
            'is_on_duty' => false,
        ]);
    }

    $shiftStatement = $pdo->prepare(
        'SELECT id, started_at
         FROM service_shifts
         WHERE user_id = :user_id
           AND service_id = :service_id
           AND ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1'
    );
    $shiftStatement->execute([
        'user_id' => (int) $user['id'],
        'service_id' => $serviceId,
    ]);
    $activeShift = $shiftStatement->fetch() ?: null;

    if (!$activeShift) {
        respond([
            'success' => true,
            'username' => (string) ($user['username'] ?? ''),
            'label' => 'Hors service',
            'status' => 'Hors service',
            'status_class' => 'status-unavailable',
            'is_on_duty' => false,
        ]);
    }

    $assignmentStatement = $pdo->prepare(
        'SELECT du.name, du.status
         FROM dispatch_unit_members dum
         INNER JOIN dispatch_units du ON du.id = dum.unit_id
         WHERE dum.user_id = :user_id
           AND dum.is_active = 1
           AND du.service_id = :service_id
           AND du.is_active = 1
         ORDER BY dum.created_at DESC, du.created_at DESC
         LIMIT 1'
    );
    $assignmentStatement->execute([
        'user_id' => (int) $user['id'],
        'service_id' => $serviceId,
    ]);
    $assignment = $assignmentStatement->fetch() ?: null;

    if ($assignment) {
        $status = (string) ($assignment['status'] ?? 'Non affecté');
        respond([
            'success' => true,
            'username' => (string) ($user['username'] ?? ''),
            'label' => (string) ($assignment['name'] ?? $activeServiceCode) . ' · ' . $status,
            'status' => $status,
            'status_class' => sidebarStatusClass($status),
            'is_on_duty' => true,
        ]);
    }

    respond([
        'success' => true,
        'username' => (string) ($user['username'] ?? ''),
        'label' => 'Non affecté',
        'status' => 'Non affecté',
        'status_class' => 'status-unassigned',
        'is_on_duty' => true,
    ]);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Erreur serveur.'], 500);
}
