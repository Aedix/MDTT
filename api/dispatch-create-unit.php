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

$serviceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');
$name = trim((string) ($data['name'] ?? ''));
$status = trim((string) ($data['status'] ?? 'Disponible'));
$divisionId = (int) ($data['division_id'] ?? 0);
$ppaLevel = trim((string) ($data['ppa_level'] ?? 'PPA I'));
$memberIds = $data['member_ids'] ?? [];

if ($serviceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service actif introuvable.']);
    exit;
}

if ($name === '' || mb_strlen($name) > 80) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nom d unite invalide.']);
    exit;
}

if ($status === '' || mb_strlen($status) > 80) {
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

$memberIds = array_values(array_unique(array_map('intval', $memberIds)));
$memberIds = array_filter($memberIds, static fn (int $id): bool => $id > 0);

$pdo = getDatabaseConnection();

$serviceStatement = $pdo->prepare('SELECT id FROM services WHERE code = :code AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['code' => $serviceCode]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

$serviceId = (int) $service['id'];

if ($divisionId > 0) {
    $divisionStatement = $pdo->prepare('SELECT id FROM divisions WHERE id = :id AND service_id = :service_id AND is_active = 1 LIMIT 1');
    $divisionStatement->execute(['id' => $divisionId, 'service_id' => $serviceId]);
    if (!$divisionStatement->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Division invalide pour ce service.']);
        exit;
    }
} else {
    $divisionId = null;
}

if (empty($memberIds)) {
    $memberIds = [(int) $user['id']];
}

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

if (empty($activeMemberIds)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aucun agent selectionne n est en service.']);
    exit;
}

$pdo->beginTransaction();

$unitStatement = $pdo->prepare(
    'INSERT INTO dispatch_units (service_id, division_id, name, status, ppa_level, created_by)
     VALUES (:service_id, :division_id, :name, :status, :ppa_level, :created_by)'
);
$unitStatement->execute([
    'service_id' => $serviceId,
    'division_id' => $divisionId,
    'name' => $name,
    'status' => $status,
    'ppa_level' => $ppaLevel,
    'created_by' => (int) $user['id'],
]);

$unitId = (int) $pdo->lastInsertId();
$memberStatement = $pdo->prepare('INSERT INTO dispatch_unit_members (unit_id, user_id) VALUES (:unit_id, :user_id)');

foreach ($activeMemberIds as $memberId) {
    $memberStatement->execute([
        'unit_id' => $unitId,
        'user_id' => $memberId,
    ]);
}

$pdo->commit();

echo json_encode(['success' => true, 'message' => 'Unite creee.']);
