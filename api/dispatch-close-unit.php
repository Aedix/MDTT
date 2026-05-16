<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/realtime.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode non autorisee.']);
    exit;
}

$user = requireAuthenticatedUser();
$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requete invalide.']);
    exit;
}

$serviceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');
$unitId = (int) ($data['unit_id'] ?? 0);

if ($serviceCode === '' || $unitId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unite invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$unitStatement = $pdo->prepare(
    'SELECT du.id, du.service_id
     FROM dispatch_units du
     INNER JOIN services s ON s.id = du.service_id
     WHERE du.id = :unit_id
       AND s.code = :service_code
       AND du.is_active = 1
     LIMIT 1'
);
$unitStatement->execute(['unit_id' => $unitId, 'service_code' => $serviceCode]);
$unit = $unitStatement->fetch();

if (!$unit) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Unite introuvable.']);
    exit;
}

$serviceId = (int) $unit['service_id'];

$pdo->beginTransaction();

$closeStatement = $pdo->prepare('UPDATE dispatch_units SET is_active = 0, closed_at = NOW() WHERE id = :unit_id');
$closeStatement->execute(['unit_id' => $unitId]);

$membersStatement = $pdo->prepare('UPDATE dispatch_unit_members SET is_active = 0, left_at = NOW() WHERE unit_id = :unit_id AND is_active = 1');
$membersStatement->execute(['unit_id' => $unitId]);

$pdo->commit();

touchRealtimeVersion($pdo, $serviceId);

echo json_encode([
    'success' => true,
    'message' => 'Unite fermee.',
    'version' => getRealtimeVersion($pdo, $serviceId),
]);
