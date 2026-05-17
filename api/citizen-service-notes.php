<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$method = $_SERVER['REQUEST_METHOD'];
$serviceCode = strtoupper(trim((string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT')));

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function readBody(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

try {
    if ($serviceCode === '') {
        respond(['success' => false, 'message' => 'Service actif introuvable.'], 400);
    }

    if ($method === 'GET') {
        $citizenId = (int) ($_GET['citizen_id'] ?? 0);
        if ($citizenId <= 0) {
            respond(['success' => false, 'message' => 'Citoyen invalide.'], 400);
        }

        $statement = $pdo->prepare(
            'SELECT notes, updated_at
             FROM citizen_service_notes
             WHERE citizen_id = :citizen_id AND service_code = :service_code
             LIMIT 1'
        );
        $statement->execute([
            'citizen_id' => $citizenId,
            'service_code' => $serviceCode,
        ]);
        $row = $statement->fetch();

        respond([
            'success' => true,
            'service_code' => $serviceCode,
            'notes' => $row['notes'] ?? '',
            'updated_at' => $row['updated_at'] ?? null,
        ]);
    }

    if ($method === 'POST') {
        $data = readBody();
        $citizenId = (int) ($data['citizen_id'] ?? 0);
        $notes = trim((string) ($data['notes'] ?? ''));

        if ($citizenId <= 0) {
            respond(['success' => false, 'message' => 'Citoyen invalide.'], 400);
        }

        $check = $pdo->prepare('SELECT id FROM citizens WHERE id = :id LIMIT 1');
        $check->execute(['id' => $citizenId]);
        if (!$check->fetchColumn()) {
            respond(['success' => false, 'message' => 'Citoyen introuvable.'], 404);
        }

        $statement = $pdo->prepare(
            'INSERT INTO citizen_service_notes (citizen_id, service_code, notes, created_by, updated_by)
             VALUES (:citizen_id, :service_code, :notes, :created_by, :updated_by)
             ON DUPLICATE KEY UPDATE notes = VALUES(notes), updated_by = VALUES(updated_by)'
        );
        $statement->execute([
            'citizen_id' => $citizenId,
            'service_code' => $serviceCode,
            'notes' => $notes === '' ? null : $notes,
            'created_by' => (int) $user['id'],
            'updated_by' => (int) $user['id'],
        ]);

        respond(['success' => true, 'message' => 'Note interne service sauvegardée.']);
    }

    respond(['success' => false, 'message' => 'Méthode non autorisée.'], 405);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Erreur serveur: ' . $exception->getMessage()], 500);
}
