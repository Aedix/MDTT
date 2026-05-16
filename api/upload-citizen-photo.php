<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

requireAuthenticatedUser();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode non autorisee.']);
    exit;
}

if (empty($_FILES['photo']) || !is_array($_FILES['photo'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aucune photo envoyee.']);
    exit;
}

$file = $_FILES['photo'];

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Upload impossible.']);
    exit;
}

if ((int) ($file['size'] ?? 0) > 4194304) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Photo trop lourde. Maximum 4 Mo.']);
    exit;
}

$tmpName = (string) ($file['tmp_name'] ?? '');
$originalName = (string) ($file['name'] ?? 'photo');
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];

if (!in_array($extension, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Format refuse. Utilise png, jpg, jpeg ou webp.']);
    exit;
}

if (!@getimagesize($tmpName)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Image invalide.']);
    exit;
}

$uploadRoot = dirname(__DIR__) . '/uploads/citizens';
if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0755, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Dossier upload inaccessible.']);
    exit;
}

$fileName = date('Ymd_His') . '_' . bin2hex(random_bytes(5)) . '.' . $extension;
$targetPath = $uploadRoot . '/' . $fileName;

if (!move_uploaded_file($tmpName, $targetPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Impossible d enregistrer la photo.']);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => '/uploads/citizens/' . $fileName,
], JSON_UNESCAPED_UNICODE);
