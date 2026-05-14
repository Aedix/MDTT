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

$currentUser = requirePermission('accounts.delete');

$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$userId = (int) ($data['user_id'] ?? 0);

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Compte invalide.']);
    exit;
}

if ((int) $currentUser['id'] === $userId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Impossible de supprimer son propre compte.']);
    exit;
}

$pdo = getDatabaseConnection();

$targetStatement = $pdo->prepare('SELECT id, username, role FROM users WHERE id = :id LIMIT 1');
$targetStatement->execute(['id' => $userId]);
$targetUser = $targetStatement->fetch();

if (!$targetUser) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Compte introuvable.']);
    exit;
}

if (($targetUser['role'] ?? '') === 'super_admin') {
    $countStatement = $pdo->query("SELECT COUNT(*) AS total FROM users WHERE role = 'super_admin'");
    $count = (int) $countStatement->fetch()['total'];

    if ($count <= 1) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Impossible de supprimer le dernier super_admin.']);
        exit;
    }
}

$deleteStatement = $pdo->prepare('DELETE FROM users WHERE id = :id');
$deleteStatement->execute(['id' => $userId]);

echo json_encode([
    'success' => true,
    'message' => 'Compte supprimé.',
]);
