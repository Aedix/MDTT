<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$action = (string) ($_GET['action'] ?? '');

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function activeServiceCode(array $user): string
{
    return (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
}

function activeServiceId(PDO $pdo, string $serviceCode): ?int
{
    try {
        $statement = $pdo->prepare('SELECT id FROM services WHERE code = :code LIMIT 1');
        $statement->execute(['code' => $serviceCode]);
        $id = $statement->fetchColumn();
        return $id ? (int) $id : null;
    } catch (Throwable $exception) {
        return null;
    }
}

function addExtraLog(PDO $pdo, ?int $serviceId, string $serviceCode, string $targetType, int $targetId, string $action, array $details, int $userId): void
{
    try {
        $statement = $pdo->prepare(
            'INSERT INTO dossier_activity_logs (service_id, service_code, target_type, target_id, action, details, created_by)
             VALUES (:service_id, :service_code, :target_type, :target_id, :action, :details, :created_by)'
        );
        $statement->execute([
            'service_id' => $serviceId,
            'service_code' => $serviceCode,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'action' => $action,
            'details' => json_encode($details, JSON_UNESCAPED_UNICODE),
            'created_by' => $userId ?: null,
        ]);
    } catch (Throwable $exception) {}
}

function sanitizeRichNote(string $html): string
{
    $html = trim($html);
    $html = preg_replace('#<\s*(script|style|iframe|object|embed|link|meta)[^>]*>.*?<\s*/\s*\1\s*>#is', '', $html) ?? '';
    $html = preg_replace('#<\s*(script|style|iframe|object|embed|link|meta)[^>]*/?\s*>#is', '', $html) ?? '';
    $html = preg_replace('/\son[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? '';
    $html = preg_replace('/\s(href|src)\s*=\s*("|\')\s*javascript:[^"\']*("|\')/i', '', $html) ?? '';
    return mb_substr($html, 0, 120000);
}

function serviceUploadRoot(string $serviceCode): array
{
    $serviceFolder = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($serviceCode));
    $root = dirname(__DIR__) . '/uploads/dossiers/' . $serviceFolder;
    if (!is_dir($root) && !mkdir($root, 0755, true)) {
        respond(['success' => false, 'message' => 'Dossier upload inaccessible.'], 500);
    }
    return [$root, '/uploads/dossiers/' . $serviceFolder];
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['success' => false, 'message' => 'Méthode non autorisée.'], 405);
    }

    $serviceCode = activeServiceCode($user);
    $serviceId = activeServiceId($pdo, $serviceCode);
    $userId = (int) ($user['id'] ?? 0);

    if ($action === 'create-note') {
        $data = body();
        $folderId = isset($data['folder_id']) && (int) $data['folder_id'] > 0 ? (int) $data['folder_id'] : null;
        $title = trim((string) ($data['title'] ?? ''));
        $content = sanitizeRichNote((string) ($data['content'] ?? ''));
        $plain = trim(strip_tags($content));

        if ($title === '') {
            respond(['success' => false, 'message' => 'Titre de note obligatoire.'], 400);
        }

        if ($plain === '') {
            respond(['success' => false, 'message' => 'La note ne peut pas être vide.'], 400);
        }

        if ($folderId !== null) {
            $check = $pdo->prepare('SELECT id FROM dossier_folders WHERE id = :id AND service_code = :service_code AND deleted_at IS NULL LIMIT 1');
            $check->execute(['id' => $folderId, 'service_code' => $serviceCode]);
            if (!$check->fetchColumn()) {
                respond(['success' => false, 'message' => 'Dossier destination introuvable.'], 404);
            }
        }

        [$root, $publicRoot] = serviceUploadRoot($serviceCode);
        $safeTitle = preg_replace('/[^a-zA-Z0-9_-]+/', '_', strtolower($title)) ?: 'note';
        $storedName = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '_' . mb_substr($safeTitle, 0, 50) . '.html';
        $targetPath = $root . '/' . $storedName;
        $document = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</title></head><body>' . $content . '</body></html>';
        file_put_contents($targetPath, $document);

        $publicPath = $publicRoot . '/' . $storedName;
        $size = filesize($targetPath) ?: strlen($document);
        $sortStatement = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM dossier_files WHERE service_code = :service_code AND folder_id <=> :folder_id');
        $sortStatement->execute(['service_code' => $serviceCode, 'folder_id' => $folderId]);
        $sortOrder = (int) $sortStatement->fetchColumn();

        $insert = $pdo->prepare(
            'INSERT INTO dossier_files (folder_id, service_id, service_code, owner_user_id, original_name, stored_name, mime_type, extension, size_bytes, file_path, description, confidentiality_level, sort_order)
             VALUES (:folder_id, :service_id, :service_code, :owner_user_id, :original_name, :stored_name, :mime_type, :extension, :size_bytes, :file_path, :description, :confidentiality_level, :sort_order)'
        );
        $insert->execute([
            'folder_id' => $folderId,
            'service_id' => $serviceId,
            'service_code' => $serviceCode,
            'owner_user_id' => $userId ?: null,
            'original_name' => mb_substr($title, 0, 170) . '.html',
            'stored_name' => $storedName,
            'mime_type' => 'text/html',
            'extension' => 'html',
            'size_bytes' => $size,
            'file_path' => $publicPath,
            'description' => 'Note dossier MDT',
            'confidentiality_level' => 'service',
            'sort_order' => $sortOrder,
        ]);

        $fileId = (int) $pdo->lastInsertId();
        addExtraLog($pdo, $serviceId, $serviceCode, 'file', $fileId, 'note_created', ['title' => $title, 'folder_id' => $folderId], $userId);
        respond(['success' => true, 'message' => 'Note créée.', 'file_id' => $fileId], 201);
    }

    if ($action === 'folder-icon') {
        $data = body();
        $folderId = (int) ($data['folder_id'] ?? 0);
        $iconKey = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($data['icon_key'] ?? 'folder')) ?: 'folder';
        $iconPath = trim((string) ($data['icon_path'] ?? ''));

        if ($folderId <= 0) {
            respond(['success' => false, 'message' => 'Dossier invalide.'], 400);
        }

        $check = $pdo->prepare('SELECT id FROM dossier_folders WHERE id = :id AND service_code = :service_code AND deleted_at IS NULL LIMIT 1');
        $check->execute(['id' => $folderId, 'service_code' => $serviceCode]);
        if (!$check->fetchColumn()) {
            respond(['success' => false, 'message' => 'Dossier introuvable.'], 404);
        }

        $allowedPaths = ['', '/assets/icons/folder-default.svg', '/assets/icons/folder-fib.svg', '/assets/icons/folder-crime.svg', '/assets/icons/folder-evidence.svg', '/assets/icons/folder-report.svg', '/assets/icons/folder-archive.svg'];
        if (!in_array($iconPath, $allowedPaths, true)) {
            respond(['success' => false, 'message' => 'Icône non autorisée.'], 400);
        }

        $statement = $pdo->prepare('UPDATE dossier_folders SET icon_key = :icon_key, icon_path = :icon_path, updated_at = NOW() WHERE id = :id AND service_code = :service_code');
        $statement->execute(['icon_key' => $iconKey, 'icon_path' => $iconPath ?: null, 'id' => $folderId, 'service_code' => $serviceCode]);
        addExtraLog($pdo, $serviceId, $serviceCode, 'folder', $folderId, 'folder_icon_updated', ['icon_key' => $iconKey, 'icon_path' => $iconPath], $userId);
        respond(['success' => true, 'message' => 'Icône mise à jour.']);
    }

    respond(['success' => false, 'message' => 'Action extra inconnue.'], 404);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Action dossier impossible.', 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null], 500);
}
