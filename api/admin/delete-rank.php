<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/permissions.php';
require_once __DIR__ . '/../../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

$currentUser = requirePermission('ranks.delete');
$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$rankId = (int) ($data['rank_id'] ?? 0);

if ($rankId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Grade invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$rankStatement = $pdo->prepare(
    'SELECT r.id, s.code AS service_code
     FROM ranks r
     INNER JOIN services s ON s.id = r.service_id
     WHERE r.id = :id
     LIMIT 1'
);
$rankStatement->execute(['id' => $rankId]);
$rank = $rankStatement->fetch();

if (!$rank) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Grade introuvable.']);
    exit;
}

if (!isSuperAdminUser($currentUser) && ($currentUser['service'] ?? '') !== $rank['service_code']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Impossible de supprimer un grade hors de votre service.']);
    exit;
}

$updateStatement = $pdo->prepare('UPDATE ranks SET is_active = 0 WHERE id = :id');
$updateStatement->execute(['id' => $rankId]);

echo json_encode(['success' => true, 'message' => 'Grade désactivé.']);
