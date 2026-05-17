<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/permissions.php';

header('Content-Type: application/json; charset=utf-8');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function canRemoveReportAsSuperAdmin(array $user): bool
{
    $role = strtolower(trim((string) ($user['role'] ?? '')));
    $role = str_replace(['-', ' '], '_', $role);

    return in_array($role, ['super_admin', 'superadmin'], true) || userHasPermission($user, '*');
}

try {
    $canRemove = canRemoveReportAsSuperAdmin($user);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        jsonResponse([
            'success' => true,
            'can_remove_reports' => $canRemove,
            'role' => $user['role'] ?? null,
        ]);
    }

    if (!$canRemove) {
        jsonResponse(['success' => false, 'message' => 'Action réservée aux superadmins.'], 403);
    }

    $data = json_decode(file_get_contents('php://input') ?: '', true);
    $reportId = (int) (($data['id'] ?? 0));

    if ($reportId <= 0) {
        jsonResponse(['success' => false, 'message' => 'Rapport invalide.'], 400);
    }

    $lookup = $pdo->prepare('SELECT id, report_number, title FROM reports WHERE id = ? LIMIT 1');
    $lookup->execute([$reportId]);
    $report = $lookup->fetch();

    if (!$report) {
        jsonResponse(['success' => false, 'message' => 'Rapport introuvable.'], 404);
    }

    $statement = $pdo->prepare('DELETE FROM reports WHERE id = ? LIMIT 1');
    $statement->execute([$reportId]);

    jsonResponse(['success' => true, 'message' => 'Rapport supprimé.']);
} catch (Throwable $exception) {
    jsonResponse(['success' => false, 'message' => 'Erreur serveur: ' . $exception->getMessage()], 500);
}
