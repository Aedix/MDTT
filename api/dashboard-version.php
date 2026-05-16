<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/realtime.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$serviceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');

if ($serviceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service actif introuvable.']);
    exit;
}

$serviceStatement = $pdo->prepare('SELECT id FROM services WHERE code = :code AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['code' => $serviceCode]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

$serviceId = (int) $service['id'];

echo json_encode([
    'success' => true,
    'service_id' => $serviceId,
    'version' => getRealtimeVersion($pdo, $serviceId),
], JSON_UNESCAPED_UNICODE);
