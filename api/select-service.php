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
$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requete invalide.']);
    exit;
}

$serviceId = (int) ($data['service_id'] ?? 0);

if ($serviceId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$statement = $pdo->prepare(
    'SELECT us.service_id, s.code AS service_code, s.name AS service_name, s.logo_path, r.name AS rank_name
     FROM user_services us
     INNER JOIN services s ON s.id = us.service_id
     LEFT JOIN ranks r ON r.id = us.rank_id
     WHERE us.user_id = :user_id
       AND us.service_id = :service_id
       AND us.is_active = 1
       AND s.is_active = 1
     LIMIT 1'
);
$statement->execute([
    'user_id' => (int) $user['id'],
    'service_id' => $serviceId,
]);
$service = $statement->fetch();

if (!$service) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Service non affecte.']);
    exit;
}

updateActiveServiceSession($service);

echo json_encode([
    'success' => true,
    'message' => 'Service selectionne.',
    'redirect' => '/dashboard.php',
]);
