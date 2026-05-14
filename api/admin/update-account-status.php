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

$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$userId = (int) ($data['user_id'] ?? 0);
$isActive = (int) ($data['is_active'] ?? -1);

if ($userId <= 0 || !in_array($isActive, [0, 1], true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Données invalides.']);
    exit;
}

$permission = $isActive === 1 ? 'accounts.activate' : 'accounts.deactivate';
$currentUser = requirePermission($permission);

if ((int) $currentUser['id'] === $userId && $isActive === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Impossible de désactiver son propre compte.']);
    exit;
}

$pdo = getDatabaseConnection();
$statement = $pdo->prepare('UPDATE users SET is_active = :is_active WHERE id = :id');
$statement->execute([
    'is_active' => $isActive,
    'id' => $userId,
]);

echo json_encode([
    'success' => true,
    'message' => $isActive === 1 ? 'Compte activé.' : 'Compte désactivé.',
]);
