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

$title = trim((string) ($data['title'] ?? ''));
$body = trim((string) ($data['body'] ?? ''));
$serviceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');

if ($serviceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service actif introuvable.']);
    exit;
}

if ($title === '' || mb_strlen($title) > 120) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Titre invalide. Maximum 120 caracteres.']);
    exit;
}

if ($body === '' || mb_strlen($body) > 2000) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Annonce invalide. Maximum 2000 caracteres.']);
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

$statement = $pdo->prepare(
    'INSERT INTO service_motd (service_id, title, body, updated_by)
     VALUES (:service_id, :title, :body, :updated_by)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       body = VALUES(body),
       updated_by = VALUES(updated_by),
       updated_at = CURRENT_TIMESTAMP'
);
$statement->execute([
    'service_id' => (int) $service['id'],
    'title' => $title,
    'body' => $body,
    'updated_by' => (int) $user['id'],
]);

echo json_encode(['success' => true, 'message' => 'Annonce mise a jour.']);
