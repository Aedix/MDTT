<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode non autorisee.']);
    exit;
}

$user = requireAuthenticatedUser();
$serviceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');

if ($serviceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service actif introuvable.']);
    exit;
}

$pdo = getDatabaseConnection();

$serviceStatement = $pdo->prepare('SELECT id FROM services WHERE code = :code AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['code' => $serviceCode]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

$activeStatement = $pdo->prepare(
    'SELECT id, started_at
     FROM service_shifts
     WHERE user_id = :user_id
       AND service_id = :service_id
       AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1'
);
$activeStatement->execute([
    'user_id' => (int) $user['id'],
    'service_id' => (int) $service['id'],
]);
$activeShift = $activeStatement->fetch();

if ($activeShift) {
    $startedAt = new DateTime((string) $activeShift['started_at']);
    $now = new DateTime();
    $totalSeconds = max(0, $now->getTimestamp() - $startedAt->getTimestamp());

    $endStatement = $pdo->prepare(
        'UPDATE service_shifts
         SET ended_at = NOW(),
             total_seconds = :total_seconds,
             status = :status
         WHERE id = :id'
    );
    $endStatement->execute([
        'total_seconds' => $totalSeconds,
        'status' => 'ended',
        'id' => (int) $activeShift['id'],
    ]);

    echo json_encode(['success' => true, 'message' => 'Fin de service enregistrée.', 'is_on_duty' => false]);
    exit;
}

$insertStatement = $pdo->prepare(
    'INSERT INTO service_shifts (user_id, service_id, started_at, status)
     VALUES (:user_id, :service_id, NOW(), :status)'
);
$insertStatement->execute([
    'user_id' => (int) $user['id'],
    'service_id' => (int) $service['id'],
    'status' => 'on_duty',
]);

echo json_encode(['success' => true, 'message' => 'Prise de service enregistrée.', 'is_on_duty' => true]);
