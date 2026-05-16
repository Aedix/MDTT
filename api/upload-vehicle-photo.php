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
$error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

if ($error !== UPLOAD_ERR_OK) {
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'Photo trop lourde pour la configuration serveur.',
        UPLOAD_ERR_FORM_SIZE => 'Photo trop lourde pour le formulaire.',
        UPLOAD_ERR_PARTIAL => 'Upload incomplet.',
        UPLOAD_ERR_NO_FILE => 'Aucune photo envoyee.',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire serveur manquant.',
        UPLOAD_ERR_CANT_WRITE => 'Impossible d ecrire le fichier sur le serveur.',
        UPLOAD_ERR_EXTENSION => 'Upload bloque par une extension serveur.',
    ];
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $messages[$error] ?? 'Upload impossible.']);
    exit;
}

$maxSize = 4 * 1024 * 1024;
if ((int) ($file['size'] ?? 0) > $maxSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Photo trop lourde. Maximum 4 Mo.']);
    exit;
}

$tmpName = (string) ($file['tmp_name'] ?? '');
$originalName = (string) ($file['name'] ?? 'vehicle');
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

$uploadRoot = dirname(__DIR__) . '/uploads/vehicles';
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
    'path' => '/uploads/vehicles/' . $fileName,
], JSON_UNESCAPED_UNICODE);
