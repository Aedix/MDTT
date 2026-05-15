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

$currentUser = requirePermission('ranks.create');
$data = json_decode(file_get_contents('php://input') ?: '', true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Requête invalide.']);
    exit;
}

$serviceId = (int) ($data['service_id'] ?? 0);
$name = trim((string) ($data['name'] ?? ''));
$level = (int) ($data['level'] ?? 0);
$sortOrder = (int) ($data['sort_order'] ?? $level);
$isCommand = !empty($data['is_command']) ? 1 : 0;

if ($serviceId <= 0 || $name === '' || $level <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service, nom et niveau obligatoires.']);
    exit;
}

$pdo = getDatabaseConnection();

$serviceStatement = $pdo->prepare('SELECT id, code FROM services WHERE id = :id AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['id' => $serviceId]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

if (!isSuperAdminUser($currentUser) && ($currentUser['service'] ?? '') !== $service['code']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Impossible de créer un grade hors de votre service.']);
    exit;
}

$code = strtolower($name);
$code = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $code) ?: $code;
$code = preg_replace('/[^a-z0-9]+/', '_', $code);
$code = trim((string) $code, '_');

if ($code === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nom de grade invalide.']);
    exit;
}

$insertStatement = $pdo->prepare(
    'INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
     VALUES (:service_id, :code, :name, :level, :sort_order, :is_command, 1)'
);

try {
    $insertStatement->execute([
        'service_id' => $serviceId,
        'code' => $code,
        'name' => $name,
        'level' => $level,
        'sort_order' => $sortOrder,
        'is_command' => $isCommand,
    ]);
} catch (PDOException $exception) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Un grade avec ce code existe déjà dans ce service.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Grade créé.']);
