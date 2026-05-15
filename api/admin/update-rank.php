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

$currentUser = requirePermission('ranks.rename');
$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$rankId = (int) ($data['rank_id'] ?? 0);
$name = trim((string) ($data['name'] ?? ''));
$level = (int) ($data['level'] ?? 0);
$sortOrder = (int) ($data['sort_order'] ?? $level);
$isCommand = !empty($data['is_command']) ? 1 : 0;

if ($rankId <= 0 || $name === '' || $level <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Grade, nom et niveau obligatoires.']);
    exit;
}

$pdo = getDatabaseConnection();

$rankStatement = $pdo->prepare(
    'SELECT r.id, r.name AS old_name, r.service_id, s.code AS service_code
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
    echo json_encode(['success' => false, 'message' => 'Impossible de modifier un grade hors de votre service.']);
    exit;
}

$pdo->beginTransaction();

$updateStatement = $pdo->prepare(
    'UPDATE ranks
     SET name = :name,
         level = :level,
         sort_order = :sort_order,
         is_command = :is_command
     WHERE id = :id'
);
$updateStatement->execute([
    'name' => $name,
    'level' => $level,
    'sort_order' => $sortOrder,
    'is_command' => $isCommand,
    'id' => $rankId,
]);

$userUpdateStatement = $pdo->prepare(
    'UPDATE users
     SET rank_name = :new_name
     WHERE service = :service_code
       AND rank_name = :old_name'
);
$userUpdateStatement->execute([
    'new_name' => $name,
    'service_code' => $rank['service_code'],
    'old_name' => $rank['old_name'],
]);

$pdo->commit();

echo json_encode(['success' => true, 'message' => 'Grade mis à jour.']);
