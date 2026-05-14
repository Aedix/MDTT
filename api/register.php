<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';

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

$username = trim((string) ($data['username'] ?? ''));
$password = (string) ($data['password'] ?? '');
$passwordConfirm = (string) ($data['password_confirm'] ?? '');
$rankId = (int) ($data['rank_id'] ?? 0);

if (!preg_match('/^[a-zA-Z0-9_.-]{3,32}$/', $username)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username invalide. 3 à 32 caractères : lettres, chiffres, ., _ ou -.']);
    exit;
}

if (strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Password trop court. Minimum : 8 caractères.']);
    exit;
}

if ($password !== $passwordConfirm) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Les passwords ne correspondent pas.']);
    exit;
}

if ($rankId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Grade demandé invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$existingStatement = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
$existingStatement->execute(['username' => $username]);

if ($existingStatement->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Ce username est déjà utilisé.']);
    exit;
}

$rankStatement = $pdo->prepare(
    'SELECT r.name AS rank_name, s.code AS service_code
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
    echo json_encode(['success' => false, 'message' => 'Grade demandé introuvable.']);
    exit;
}

$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$insertStatement = $pdo->prepare(
    'INSERT INTO users (username, password_hash, service, rank_name, role, is_active)
     VALUES (:username, :password_hash, :service, :rank_name, :role, :is_active)'
);

$insertStatement->execute([
    'username' => $username,
    'password_hash' => $passwordHash,
    'service' => $rank['service_code'],
    'rank_name' => $rank['rank_name'],
    'role' => 'user',
    'is_active' => 0,
]);

echo json_encode([
    'success' => true,
    'message' => 'Compte créé. Il doit maintenant être validé par un responsable.',
]);
