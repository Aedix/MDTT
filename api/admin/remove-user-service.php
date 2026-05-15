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
    echo json_encode(['success' => false, 'message' => 'Seul un super_admin peut retirer des services.']);
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

if ($userId <= 0 || $serviceId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Utilisateur ou service invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$countStatement = $pdo->prepare('SELECT COUNT(*) AS total FROM user_services WHERE user_id = :user_id AND is_active = 1');
$countStatement->execute(['user_id' => $userId]);
$totalServices = (int) $countStatement->fetch()['total'];

if ($totalServices <= 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Impossible de retirer le dernier service actif du compte.']);
    exit;
}

$pdo->beginTransaction();

$removeStatement = $pdo->prepare('UPDATE user_services SET is_active = 0, is_primary = 0 WHERE user_id = :user_id AND service_id = :service_id');
$removeStatement->execute([
    'user_id' => $userId,
    'service_id' => $serviceId,
]);

$primaryStatement = $pdo->prepare('SELECT COUNT(*) AS total FROM user_services WHERE user_id = :user_id AND is_primary = 1 AND is_active = 1');
$primaryStatement->execute(['user_id' => $userId]);
$hasPrimary = (int) $primaryStatement->fetch()['total'];

if ($hasPrimary === 0) {
    $newPrimaryStatement = $pdo->prepare(
        'SELECT us.service_id, s.code AS service_code, r.name AS rank_name
         FROM user_services us
         INNER JOIN services s ON s.id = us.service_id
         LEFT JOIN ranks r ON r.id = us.rank_id
         WHERE us.user_id = :user_id
           AND us.is_active = 1
         ORDER BY s.code ASC
         LIMIT 1'
    );
    $newPrimaryStatement->execute(['user_id' => $userId]);
    $newPrimary = $newPrimaryStatement->fetch();

    if ($newPrimary) {
        $setPrimaryStatement = $pdo->prepare('UPDATE user_services SET is_primary = 1 WHERE user_id = :user_id AND service_id = :service_id');
        $setPrimaryStatement->execute([
            'user_id' => $userId,
            'service_id' => $newPrimary['service_id'],
        ]);

        $updateUserStatement = $pdo->prepare('UPDATE users SET service = :service, rank_name = :rank_name WHERE id = :id');
        $updateUserStatement->execute([
            'service' => $newPrimary['service_code'],
            'rank_name' => $newPrimary['rank_name'] ?? 'En attente',
            'id' => $userId,
        ]);
    }
}

$pdo->commit();

echo json_encode(['success' => true, 'message' => 'Service retire du compte.']);
