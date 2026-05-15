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

$currentUser = requirePermission('accounts.change_rank');
$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$userId = (int) ($data['user_id'] ?? 0);
$rankId = (int) ($data['rank_id'] ?? 0);

if ($userId <= 0 || $rankId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Compte ou grade invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$targetStatement = $pdo->prepare('SELECT id, username, service, role FROM users WHERE id = :id LIMIT 1');
$targetStatement->execute(['id' => $userId]);
$targetUser = $targetStatement->fetch();

if (!$targetUser) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Compte introuvable.']);
    exit;
}

$rankStatement = $pdo->prepare(
    'SELECT r.name AS rank_name, r.level AS rank_level, s.code AS service_code
     FROM ranks r
     INNER JOIN services s ON s.id = r.service_id
     WHERE r.id = :rank_id
       AND r.is_active = 1
       AND s.is_active = 1
     LIMIT 1'
);
$rankStatement->execute(['rank_id' => $rankId]);
$rank = $rankStatement->fetch();

if (!$rank) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Grade introuvable.']);
    exit;
}

if (!isSuperAdminUser($currentUser)) {
    if (($currentUser['service'] ?? '') !== $rank['service_code']) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Impossible de gérer un grade hors de votre service.']);
        exit;
    }

    if (($targetUser['service'] ?? '') !== ($currentUser['service'] ?? '')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Impossible de modifier un compte hors de votre service.']);
        exit;
    }

    $currentRolePower = getRolePowerLevel($currentUser['role'] ?? null);
    $newRankLevel = (int) $rank['rank_level'];

    if ($newRankLevel > $currentRolePower) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Impossible de définir un grade au-dessus de votre niveau.']);
        exit;
    }
}

$updateStatement = $pdo->prepare(
    'UPDATE users
     SET service = :service,
         rank_name = :rank_name
     WHERE id = :id'
);
$updateStatement->execute([
    'service' => $rank['service_code'],
    'rank_name' => $rank['rank_name'],
    'id' => $userId,
]);

echo json_encode(['success' => true, 'message' => 'Grade mis à jour.']);
