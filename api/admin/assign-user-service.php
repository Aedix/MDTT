<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/permissions.php';
require_once __DIR__ . '/../../includes/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode non autorisee.']);
    exit;
}

$currentUser = requireAuthenticatedUser();

if (!isSuperAdminUser($currentUser)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Seul un super_admin peut affecter des services.']);
    exit;
}

$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requete invalide.']);
    exit;
}

$userId = (int) ($data['user_id'] ?? 0);
$serviceId = (int) ($data['service_id'] ?? 0);
$rankId = (int) ($data['rank_id'] ?? 0);
$isPrimary = !empty($data['is_primary']) ? 1 : 0;

if ($userId <= 0 || $serviceId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Utilisateur ou service invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$userStatement = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
$userStatement->execute(['id' => $userId]);

if (!$userStatement->fetch()) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Utilisateur introuvable.']);
    exit;
}

$serviceStatement = $pdo->prepare('SELECT id, code FROM services WHERE id = :id AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['id' => $serviceId]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

$rank = null;

if ($rankId > 0) {
    $rankStatement = $pdo->prepare(
        'SELECT id, name
         FROM ranks
         WHERE id = :rank_id
           AND service_id = :service_id
           AND is_active = 1
         LIMIT 1'
    );
    $rankStatement->execute([
        'rank_id' => $rankId,
        'service_id' => $serviceId,
    ]);
    $rank = $rankStatement->fetch();

    if (!$rank) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Grade invalide pour ce service.']);
        exit;
    }
}

$pdo->beginTransaction();

if ($isPrimary === 1) {
    $clearPrimary = $pdo->prepare('UPDATE user_services SET is_primary = 0 WHERE user_id = :user_id');
    $clearPrimary->execute(['user_id' => $userId]);
}

$upsertStatement = $pdo->prepare(
    'INSERT INTO user_services (user_id, service_id, rank_id, is_primary, is_active)
     VALUES (:user_id, :service_id, :rank_id, :is_primary, 1)
     ON DUPLICATE KEY UPDATE
       rank_id = VALUES(rank_id),
       is_primary = VALUES(is_primary),
       is_active = 1'
);
$upsertStatement->execute([
    'user_id' => $userId,
    'service_id' => $serviceId,
    'rank_id' => $rankId > 0 ? $rankId : null,
    'is_primary' => $isPrimary,
]);

$hasPrimaryStatement = $pdo->prepare('SELECT COUNT(*) AS total FROM user_services WHERE user_id = :user_id AND is_primary = 1 AND is_active = 1');
$hasPrimaryStatement->execute(['user_id' => $userId]);
$hasPrimary = (int) $hasPrimaryStatement->fetch()['total'];

if ($hasPrimary === 0) {
    $setPrimaryStatement = $pdo->prepare('UPDATE user_services SET is_primary = 1 WHERE user_id = :user_id AND service_id = :service_id');
    $setPrimaryStatement->execute([
        'user_id' => $userId,
        'service_id' => $serviceId,
    ]);
    $isPrimary = 1;
}

if ($isPrimary === 1) {
    $updateUserStatement = $pdo->prepare('UPDATE users SET service = :service, rank_name = :rank_name WHERE id = :id');
    $updateUserStatement->execute([
        'service' => $service['code'],
        'rank_name' => $rank['name'] ?? 'En attente',
        'id' => $userId,
    ]);
}

$pdo->commit();

echo json_encode(['success' => true, 'message' => 'Service affecte au compte.']);
