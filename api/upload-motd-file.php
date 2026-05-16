<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json; charset=utf-8');

$user = requireAuthenticatedUser();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Methode non autorisee.']);
    exit;
}

if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Aucun fichier envoye.']);
    exit;
}

$file = $_FILES['file'];

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Upload impossible.']);
    exit;
}

$maxSize = 6 * 1024 * 1024;
if ((int) ($file['size'] ?? 0) > $maxSize) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Fichier trop lourd. Maximum 6 Mo.']);
    exit;
}

$tmpName = (string) ($file['tmp_name'] ?? '');
$originalName = (string) ($file['name'] ?? 'file');
$extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

$allowed = [
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'pdf' => 'application/pdf',
    'txt' => 'text/plain',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

if (!array_key_exists($extension, $allowed)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Type de fichier refuse.']);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($tmpName) ?: '';

if ($mime !== $allowed[$extension] && !($extension === 'jpg' && $mime === 'image/jpeg')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Type MIME invalide.']);
    exit;
}

$uploadRoot = dirname(__DIR__) . '/uploads/motd';
if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0755, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Dossier upload inaccessible.']);
    exit;
}

$safeBaseName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($originalName, PATHINFO_FILENAME));
$safeBaseName = trim((string) $safeBaseName, '_') ?: 'file';
$fileName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeBaseName . '.' . $extension;
$targetPath = $uploadRoot . '/' . $fileName;

if (!move_uploaded_file($tmpName, $targetPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Impossible d enregistrer le fichier.']);
    exit;
}

$isImage = str_starts_with($mime, 'image/');

if ($isImage) {
    @getimagesize($targetPath) ?: unlink($targetPath);
    if (!file_exists($targetPath)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Image invalide.']);
        exit;
    }
}

echo json_encode([
    'success' => true,
    'url' => '/uploads/motd/' . $fileName,
    'name' => $originalName,
    'mime' => $mime,
    'is_image' => $isImage,
], JSON_UNESCAPED_UNICODE);
