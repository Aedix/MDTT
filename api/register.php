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
$serviceId = (int) ($data['service_id'] ?? 0);

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

if ($serviceId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service demandé invalide.']);
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

$serviceStatement = $pdo->prepare('SELECT code FROM services WHERE id = :service_id AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['service_id' => $serviceId]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service demandé introuvable.']);
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
    'service' => $service['code'],
    'rank_name' => 'En attente',
    'role' => 'user',
    'is_active' => 0,
]);

echo json_encode([
    'success' => true,
    'message' => 'Compte créé. Un responsable devra valider le compte et attribuer le grade.',
]);
