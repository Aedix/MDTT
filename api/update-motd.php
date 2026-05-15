<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode non autorisee.']);
    exit;
}

$user = requirePermission('service.motd.update');
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

if ($title === '' || mb_strlen($title) > 160) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Titre invalide. Maximum 160 caracteres.']);
    exit;
}

if ($body === '' || mb_strlen($body) > 1200) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Annonce invalide. Maximum 1200 caracteres.']);
    exit;
}

$pdo = getDatabaseConnection();
$statement = $pdo->prepare(
    'UPDATE services
     SET motd_title = :title,
         motd_body = :body,
         motd_updated_at = NOW(),
         motd_updated_by = :user_id
     WHERE code = :service_code
       AND is_active = 1'
);
$statement->execute([
    'title' => $title,
    'body' => $body,
    'user_id' => (int) $user['id'],
    'service_code' => $serviceCode,
]);

echo json_encode(['success' => true, 'message' => 'Annonce mise a jour.']);
