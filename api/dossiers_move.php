<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();

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

function addMoveLog(PDO $pdo, ?int $serviceId, string $serviceCode, string $targetType, int $targetId, ?int $targetFolderId, int $userId): void
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
            'action' => $targetType === 'folder' ? 'folder_moved' : 'file_moved',
            'details' => json_encode(['target_folder_id' => $targetFolderId], JSON_UNESCAPED_UNICODE),
            'created_by' => $userId ?: null,
        ]);
    } catch (Throwable $exception) {}
}

function fetchFolder(PDO $pdo, int $id, string $serviceCode): ?array
{
    $statement = $pdo->prepare('SELECT id, parent_id, service_code, deleted_at FROM dossier_folders WHERE id = :id AND service_code = :service_code LIMIT 1');
    $statement->execute(['id' => $id, 'service_code' => $serviceCode]);
    $folder = $statement->fetch();
    return $folder ?: null;
}

function isDescendantFolder(PDO $pdo, int $sourceFolderId, int $targetFolderId, string $serviceCode): bool
{
    $currentId = $targetFolderId;
    $guard = 0;

    while ($currentId > 0 && $guard < 40) {
        $guard++;
        if ($currentId === $sourceFolderId) return true;

        $statement = $pdo->prepare('SELECT parent_id FROM dossier_folders WHERE id = :id AND service_code = :service_code LIMIT 1');
        $statement->execute(['id' => $currentId, 'service_code' => $serviceCode]);
        $parentId = $statement->fetchColumn();
        $currentId = $parentId ? (int) $parentId : 0;
    }

    return false;
}

function nextSortOrder(PDO $pdo, string $table, string $foreignKey, string $serviceCode, ?int $folderId): int
{
    $statement = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 FROM {$table} WHERE service_code = :service_code AND {$foreignKey} <=> :folder_id");
    $statement->execute(['service_code' => $serviceCode, 'folder_id' => $folderId]);
    return (int) $statement->fetchColumn();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['success' => false, 'message' => 'Méthode non autorisée.'], 405);
    }

    $data = body();
    $serviceCode = activeServiceCode($user);
    $serviceId = activeServiceId($pdo, $serviceCode);
    $userId = (int) ($user['id'] ?? 0);

    $type = (string) ($data['type'] ?? '');
    $id = (int) ($data['id'] ?? 0);
    $targetFolderId = array_key_exists('target_folder_id', $data) && $data['target_folder_id'] !== null && $data['target_folder_id'] !== ''
        ? (int) $data['target_folder_id']
        : null;

    if (!in_array($type, ['folder', 'file'], true) || $id <= 0) {
        respond(['success' => false, 'message' => 'Élément invalide.'], 400);
    }

    if ($targetFolderId !== null) {
        $targetFolder = fetchFolder($pdo, $targetFolderId, $serviceCode);
        if (!$targetFolder || $targetFolder['deleted_at'] !== null) {
            respond(['success' => false, 'message' => 'Dossier destination introuvable.'], 404);
        }
    }

    if ($type === 'folder') {
        $folder = fetchFolder($pdo, $id, $serviceCode);
        if (!$folder || $folder['deleted_at'] !== null) {
            respond(['success' => false, 'message' => 'Dossier source introuvable.'], 404);
        }

        if ($targetFolderId === $id) {
            respond(['success' => false, 'message' => 'Impossible de déplacer un dossier dans lui-même.'], 400);
        }

        if ($targetFolderId !== null && isDescendantFolder($pdo, $id, $targetFolderId, $serviceCode)) {
            respond(['success' => false, 'message' => 'Impossible de déplacer un dossier dans un de ses sous-dossiers.'], 400);
        }

        $sortOrder = nextSortOrder($pdo, 'dossier_folders', 'parent_id', $serviceCode, $targetFolderId);
        $statement = $pdo->prepare('UPDATE dossier_folders SET parent_id = :parent_id, sort_order = :sort_order, updated_at = NOW() WHERE id = :id AND service_code = :service_code');
        $statement->execute(['parent_id' => $targetFolderId, 'sort_order' => $sortOrder, 'id' => $id, 'service_code' => $serviceCode]);
        addMoveLog($pdo, $serviceId, $serviceCode, 'folder', $id, $targetFolderId, $userId);
        respond(['success' => true, 'message' => 'Dossier déplacé.', 'target_folder_id' => $targetFolderId]);
    }

    $statement = $pdo->prepare('SELECT id, folder_id, deleted_at FROM dossier_files WHERE id = :id AND service_code = :service_code LIMIT 1');
    $statement->execute(['id' => $id, 'service_code' => $serviceCode]);
    $file = $statement->fetch();

    if (!$file || $file['deleted_at'] !== null) {
        respond(['success' => false, 'message' => 'Fichier source introuvable.'], 404);
    }

    $sortOrder = nextSortOrder($pdo, 'dossier_files', 'folder_id', $serviceCode, $targetFolderId);
    $statement = $pdo->prepare('UPDATE dossier_files SET folder_id = :folder_id, sort_order = :sort_order, updated_at = NOW() WHERE id = :id AND service_code = :service_code');
    $statement->execute(['folder_id' => $targetFolderId, 'sort_order' => $sortOrder, 'id' => $id, 'service_code' => $serviceCode]);
    addMoveLog($pdo, $serviceId, $serviceCode, 'file', $id, $targetFolderId, $userId);
    respond(['success' => true, 'message' => 'Fichier déplacé.', 'target_folder_id' => $targetFolderId]);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Déplacement impossible.', 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null], 500);
}
