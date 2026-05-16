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
$name = trim((string) ($data['name'] ?? ''));
$status = trim((string) ($data['status'] ?? 'Disponible'));
$comment = trim((string) ($data['comment'] ?? ''));
$divisionId = (int) ($data['division_id'] ?? 0);
$ppaLevel = trim((string) ($data['ppa_level'] ?? 'PPA I'));
$memberIds = $data['member_ids'] ?? [];

if ($serviceCode === '' || $unitId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unite ou service invalide.']);
    exit;
}

if ($name === '' || mb_strlen($name) > 80 || $status === '' || mb_strlen($status) > 80) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nom ou statut invalide.']);
    exit;
}

if (mb_strlen($comment) > 160) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Commentaire trop long.']);
    exit;
}

$allowedStatuses = ['Disponible', 'Non affecté', 'Patrouille', 'Intervention', 'Pause', 'Transport', 'En attente', 'Indisponible'];
if (!in_array($status, $allowedStatuses, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Statut invalide.']);
    exit;
}

$allowedPpa = ['PPA I', 'PPA II', 'PPA III', 'PPA IV'];
if (!in_array($ppaLevel, $allowedPpa, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'PPA invalide.']);
    exit;
}

if (!is_array($memberIds)) {
    $memberIds = [];
}
$memberIds = array_values(array_unique(array_filter(array_map('intval', $memberIds), static fn (int $id): bool => $id > 0)));

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

if ($divisionId > 0) {
    $divisionStatement = $pdo->prepare('SELECT id FROM divisions WHERE id = :id AND service_id = :service_id AND is_active = 1 LIMIT 1');
    $divisionStatement->execute(['id' => $divisionId, 'service_id' => $serviceId]);
    if (!$divisionStatement->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Division invalide.']);
        exit;
    }
} else {
    $divisionId = null;
}

$activeMemberIds = [];
if (!empty($memberIds)) {
    $placeholders = implode(',', array_fill(0, count($memberIds), '?'));
    $activeMembersStatement = $pdo->prepare(
        "SELECT DISTINCT ss.user_id
         FROM service_shifts ss
         WHERE ss.service_id = ?
           AND ss.ended_at IS NULL
           AND ss.user_id IN ($placeholders)"
    );
    $activeMembersStatement->execute(array_merge([$serviceId], $memberIds));
    $activeMemberIds = array_map('intval', $activeMembersStatement->fetchAll(PDO::FETCH_COLUMN));
}

if (empty($activeMemberIds)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Une unite doit contenir au moins un agent en service.']);
    exit;
}

$pdo->beginTransaction();

$updateStatement = $pdo->prepare(
    'UPDATE dispatch_units
     SET division_id = :division_id,
         name = :name,
         status = :status,
         comment = :comment,
         ppa_level = :ppa_level
     WHERE id = :unit_id'
);
$updateStatement->execute([
    'division_id' => $divisionId,
    'name' => $name,
    'status' => $status,
    'comment' => $comment !== '' ? $comment : null,
    'ppa_level' => $ppaLevel,
    'unit_id' => $unitId,
]);

$deactivateStatement = $pdo->prepare('UPDATE dispatch_unit_members SET is_active = 0, left_at = NOW() WHERE unit_id = :unit_id AND is_active = 1');
$deactivateStatement->execute(['unit_id' => $unitId]);

$memberStatement = $pdo->prepare(
    'INSERT INTO dispatch_unit_members (unit_id, user_id, is_active)
     VALUES (:unit_id, :user_id, 1)'
);
foreach ($activeMemberIds as $memberId) {
    $memberStatement->execute([
        'unit_id' => $unitId,
        'user_id' => $memberId,
    ]);
}

$pdo->commit();

touchRealtimeVersion($pdo, $serviceId);

echo json_encode([
    'success' => true,
    'message' => 'Unite mise a jour.',
    'version' => getRealtimeVersion($pdo, $serviceId),
]);
