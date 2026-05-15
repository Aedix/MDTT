<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$username = trim((string) ($data['username'] ?? ''));
$password = (string) ($data['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username et password obligatoires.']);
    exit;
}

$tableName = DB_USERS_TABLE;

if (!preg_match('/^[a-zA-Z0-9_]+$/', $tableName)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Configuration invalide.']);
    exit;
}

$pdo = getDatabaseConnection();

$sql = "SELECT id, username, password_hash, service, rank_name, role, is_active FROM `$tableName` WHERE username = :username LIMIT 1";
$statement = $pdo->prepare($sql);
$statement->execute(['username' => $username]);
$user = $statement->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Identifiants incorrects.']);
    exit;
}

if ((int) $user['is_active'] !== 1) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Compte désactivé ou en attente de validation.']);
    exit;
}

setAuthenticatedUser($user);

try {
    $servicesStatement = $pdo->prepare(
        'SELECT us.service_id, s.code AS service_code, s.name AS service_name, s.logo_path, r.name AS rank_name
         FROM user_services us
         INNER JOIN services s ON s.id = us.service_id
         LEFT JOIN ranks r ON r.id = us.rank_id
         WHERE us.user_id = :user_id
           AND us.is_active = 1
           AND s.is_active = 1
         ORDER BY us.is_primary DESC, s.code ASC'
    );
    $servicesStatement->execute(['user_id' => (int) $user['id']]);
    $assignedServices = $servicesStatement->fetchAll();

    if (count($assignedServices) === 1) {
        updateActiveServiceSession($assignedServices[0]);
        $redirect = '/dashboard.php';
    } else {
        $redirect = '/choose-service.php';
    }
} catch (Throwable $exception) {
    $redirect = '/dashboard.php';
}

echo json_encode([
    'success' => true,
    'message' => 'Connexion réussie.',
    'redirect' => $redirect,
    'user' => [
        'id' => (int) $user['id'],
        'username' => $user['username'],
        'service' => $user['service'] ?? null,
        'rank_name' => $user['rank_name'] ?? null,
        'role' => $user['role'] ?? 'user',
    ],
]);
