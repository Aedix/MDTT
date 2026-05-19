<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string) ($_GET['action'] ?? 'list');

function dossiersJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function dossiersBody(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function dossierText(array $data, string $key, int $max = 255): ?string
{
    $value = trim((string) ($data[$key] ?? ''));
    return $value === '' ? null : mb_substr($value, 0, $max);
}

function activeServiceCode(array $user): string
{
    return (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
}

function activeRankCode(array $user): string
{
    return (string) ($user['active_rank_code'] ?? $user['rank_code'] ?? $user['rank_name'] ?? '');
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

function normalizeConfidentiality(?string $value): string
{
    return in_array($value, ['private', 'service', 'restricted', 'confidential'], true) ? $value : 'service';
}

function normalizeTargetType(?string $value): string
{
    return $value === 'file' ? 'file' : 'folder';
}

function normalizeLogoKey(?string $value): string
{
    $value = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $value);
    return $value !== '' ? mb_substr($value, 0, 80) : 'service';
}

function uploadErrorMessage(int $error): string
{
    $limit = ini_get('upload_max_filesize') ?: 'configuration serveur';
    return [
        UPLOAD_ERR_INI_SIZE => 'Fichier trop lourd pour la configuration serveur. Limite PHP actuelle : ' . $limit . '.',
        UPLOAD_ERR_FORM_SIZE => 'Fichier trop lourd pour le formulaire.',
        UPLOAD_ERR_PARTIAL => 'Upload incomplet.',
        UPLOAD_ERR_NO_FILE => 'Aucun fichier envoyé.',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire serveur manquant.',
        UPLOAD_ERR_CANT_WRITE => 'Impossible d’écrire le fichier sur le serveur.',
        UPLOAD_ERR_EXTENSION => 'Upload bloqué par une extension serveur.',
    ][$error] ?? 'Upload impossible.';
}

function addDossierLog(PDO $pdo, ?int $serviceId, string $serviceCode, string $targetType, int $targetId, string $action, array $details, int $userId): void
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

function recordRecentView(PDO $pdo, int $userId, string $targetType, int $targetId): void
{
    if ($userId <= 0) return;
    try {
        $statement = $pdo->prepare(
            'INSERT INTO dossier_recent_views (user_id, target_type, target_id, viewed_at)
             VALUES (:user_id, :target_type, :target_id, NOW())
             ON DUPLICATE KEY UPDATE viewed_at = NOW()'
        );
        $statement->execute(['user_id' => $userId, 'target_type' => $targetType, 'target_id' => $targetId]);
    } catch (Throwable $exception) {}
}

function fetchFolder(PDO $pdo, int $id, string $serviceCode, bool $includeDeleted = false): ?array
{
    $deletedWhere = $includeDeleted ? '' : ' AND f.deleted_at IS NULL';
    $statement = $pdo->prepare(
        'SELECT f.*, owner.username AS owner_username,
                (SELECT COUNT(*) FROM dossier_folders child WHERE child.parent_id = f.id AND child.deleted_at IS NULL) AS folders_count,
                (SELECT COUNT(*) FROM dossier_files file WHERE file.folder_id = f.id AND file.deleted_at IS NULL) AS files_count,
                0 AS is_favorite
         FROM dossier_folders f
         LEFT JOIN users owner ON owner.id = f.owner_user_id
         WHERE f.id = :id
           AND f.service_code = :service_code' . $deletedWhere . '
         LIMIT 1'
    );
    $statement->execute(['id' => $id, 'service_code' => $serviceCode]);
    $folder = $statement->fetch();
    return $folder ?: null;
}

function fetchFileRow(PDO $pdo, int $id, string $serviceCode, bool $includeDeleted = false): ?array
{
    $whereDeleted = $includeDeleted ? '' : ' AND df.deleted_at IS NULL';
    $statement = $pdo->prepare(
        'SELECT df.*, owner.username AS owner_username, 0 AS is_favorite
         FROM dossier_files df
         LEFT JOIN users owner ON owner.id = df.owner_user_id
         WHERE df.id = :id
           AND df.service_code = :service_code' . $whereDeleted . '
         LIMIT 1'
    );
    $statement->execute(['id' => $id, 'service_code' => $serviceCode]);
    $file = $statement->fetch();
    return $file ?: null;
}

function buildBreadcrumb(PDO $pdo, ?int $folderId, string $serviceCode): array
{
    if (!$folderId) return [];
    $items = [];
    $currentId = $folderId;
    $guard = 0;

    while ($currentId && $guard < 20) {
        $guard++;
        $statement = $pdo->prepare('SELECT id, parent_id, name FROM dossier_folders WHERE id = :id AND service_code = :service_code LIMIT 1');
        $statement->execute(['id' => $currentId, 'service_code' => $serviceCode]);
        $folder = $statement->fetch();
        if (!$folder) break;
        array_unshift($items, ['id' => (int) $folder['id'], 'name' => (string) $folder['name']]);
        $currentId = $folder['parent_id'] !== null ? (int) $folder['parent_id'] : null;
    }

    return $items;
}

function fetchLogs(PDO $pdo, string $serviceCode, string $targetType, int $targetId): array
{
    try {
        $statement = $pdo->prepare(
            'SELECT l.*, u.username AS created_by_username
             FROM dossier_activity_logs l
             LEFT JOIN users u ON u.id = l.created_by
             WHERE l.service_code = :service_code AND l.target_type = :target_type AND l.target_id = :target_id
             ORDER BY l.created_at DESC LIMIT 40'
        );
        $statement->execute(['service_code' => $serviceCode, 'target_type' => $targetType, 'target_id' => $targetId]);
        return $statement->fetchAll();
    } catch (Throwable $exception) { return []; }
}

function fetchPermissions(PDO $pdo, string $targetType, int $targetId): array
{
    try {
        $statement = $pdo->prepare('SELECT * FROM dossier_permissions WHERE target_type = :target_type AND target_id = :target_id ORDER BY subject_type ASC, subject_value ASC, permission ASC LIMIT 100');
        $statement->execute(['target_type' => $targetType, 'target_id' => $targetId]);
        return $statement->fetchAll();
    } catch (Throwable $exception) { return []; }
}

function fetchTags(PDO $pdo, string $targetType, int $targetId): array
{
    try {
        $statement = $pdo->prepare(
            'SELECT t.name FROM dossier_tag_links tl INNER JOIN dossier_tags t ON t.id = tl.tag_id
             WHERE tl.target_type = :target_type AND tl.target_id = :target_id ORDER BY t.name ASC'
        );
        $statement->execute(['target_type' => $targetType, 'target_id' => $targetId]);
        return array_map(static fn (array $row): string => (string) $row['name'], $statement->fetchAll());
    } catch (Throwable $exception) { return []; }
}

function replaceTags(PDO $pdo, string $serviceCode, int $userId, string $targetType, int $targetId, array $tags): void
{
    $pdo->prepare('DELETE FROM dossier_tag_links WHERE target_type = :target_type AND target_id = :target_id')->execute(['target_type' => $targetType, 'target_id' => $targetId]);
    foreach ($tags as $tag) {
        $name = mb_substr(trim((string) $tag), 0, 60);
        if ($name === '') continue;
        $insert = $pdo->prepare('INSERT INTO dossier_tags (service_code, name, created_by) VALUES (:service_code, :name, :created_by) ON DUPLICATE KEY UPDATE name = VALUES(name)');
        $insert->execute(['service_code' => $serviceCode, 'name' => $name, 'created_by' => $userId ?: null]);
        $tagIdStatement = $pdo->prepare('SELECT id FROM dossier_tags WHERE service_code = :service_code AND name = :name LIMIT 1');
        $tagIdStatement->execute(['service_code' => $serviceCode, 'name' => $name]);
        $tagId = (int) $tagIdStatement->fetchColumn();
        if ($tagId > 0) {
            $link = $pdo->prepare('INSERT IGNORE INTO dossier_tag_links (tag_id, target_type, target_id) VALUES (:tag_id, :target_type, :target_id)');
            $link->execute(['tag_id' => $tagId, 'target_type' => $targetType, 'target_id' => $targetId]);
        }
    }
}

function collectFolderIds(PDO $pdo, int $folderId, string $serviceCode): array
{
    $ids = [$folderId];
    $queue = [$folderId];
    while ($queue) {
        $current = array_shift($queue);
        $statement = $pdo->prepare('SELECT id FROM dossier_folders WHERE parent_id = :parent_id AND service_code = :service_code');
        $statement->execute(['parent_id' => $current, 'service_code' => $serviceCode]);
        foreach ($statement->fetchAll() as $row) {
            $id = (int) $row['id'];
            if (!in_array($id, $ids, true)) { $ids[] = $id; $queue[] = $id; }
        }
    }
    return $ids;
}

function deleteFilePhysical(array $file): void
{
    $path = (string) ($file['file_path'] ?? '');
    if ($path === '') return;
    $absolute = dirname(__DIR__) . $path;
    if (is_file($absolute)) @unlink($absolute);
}

function cleanupTargets(PDO $pdo, string $targetType, array $targetIds): void
{
    $targetIds = array_values(array_unique(array_map('intval', $targetIds)));
    if (!$targetIds) return;
    $placeholders = implode(',', array_fill(0, count($targetIds), '?'));
    $pdo->prepare("DELETE FROM dossier_tag_links WHERE target_type = ? AND target_id IN ({$placeholders})")->execute(array_merge([$targetType], $targetIds));
    $pdo->prepare("DELETE FROM dossier_favorites WHERE target_type = ? AND target_id IN ({$placeholders})")->execute(array_merge([$targetType], $targetIds));
    $pdo->prepare("DELETE FROM dossier_recent_views WHERE target_type = ? AND target_id IN ({$placeholders})")->execute(array_merge([$targetType], $targetIds));
    $pdo->prepare("DELETE FROM dossier_permissions WHERE target_type = ? AND target_id IN ({$placeholders})")->execute(array_merge([$targetType], $targetIds));
    $pdo->prepare("DELETE FROM dossier_links WHERE target_type = ? AND target_id IN ({$placeholders})")->execute(array_merge([$targetType], $targetIds));
    $pdo->prepare("DELETE FROM dossier_activity_logs WHERE target_type = ? AND target_id IN ({$placeholders})")->execute(array_merge([$targetType], $targetIds));
}

function hardDeleteFolder(PDO $pdo, string $serviceCode, int $folderId): void
{
    $folderIds = collectFolderIds($pdo, $folderId, $serviceCode);
    $placeholders = implode(',', array_fill(0, count($folderIds), '?'));
    $fileStatement = $pdo->prepare("SELECT * FROM dossier_files WHERE service_code = ? AND folder_id IN ({$placeholders})");
    $fileStatement->execute(array_merge([$serviceCode], $folderIds));
    $files = $fileStatement->fetchAll();
    $fileIds = [];
    foreach ($files as $file) { $fileIds[] = (int) $file['id']; deleteFilePhysical($file); }
    cleanupTargets($pdo, 'file', $fileIds);
    cleanupTargets($pdo, 'folder', $folderIds);
    if ($fileIds) {
        $filePlaceholders = implode(',', array_fill(0, count($fileIds), '?'));
        $pdo->prepare("DELETE FROM dossier_files WHERE id IN ({$filePlaceholders}) AND service_code = ?")->execute(array_merge($fileIds, [$serviceCode]));
    }
    rsort($folderIds);
    foreach ($folderIds as $id) $pdo->prepare('DELETE FROM dossier_folders WHERE id = :id AND service_code = :service_code')->execute(['id' => $id, 'service_code' => $serviceCode]);
}

function outputInlineFile(array $file): void
{
    $absolutePath = dirname(__DIR__) . $file['file_path'];
    if (!is_file($absolutePath)) dossiersJson(['success' => false, 'message' => 'Fichier absent du serveur.'], 404);
    $mime = (string) ($file['mime_type'] ?: 'application/octet-stream');
    header_remove('Content-Type');
    header('Content-Type: ' . $mime);
    header('Content-Disposition: inline; filename="' . basename((string) $file['original_name']) . '"');
    header('Content-Length: ' . filesize($absolutePath));
    readfile($absolutePath);
    exit;
}

try {
    $serviceCode = activeServiceCode($user);
    $serviceId = activeServiceId($pdo, $serviceCode);
    $rankCode = activeRankCode($user);
    $userId = (int) ($user['id'] ?? 0);

    if ($method === 'GET' && $action === 'list') {
        $parentIdRaw = trim((string) ($_GET['parent_id'] ?? ''));
        $parentId = $parentIdRaw === '' || $parentIdRaw === 'root' ? null : (int) $parentIdRaw;
        $query = trim((string) ($_GET['q'] ?? ''));
        $view = trim((string) ($_GET['view'] ?? 'all'));

        $folderParams = ['service_code' => $serviceCode, 'current_user_id' => $userId];
        $fileParams = ['service_code' => $serviceCode, 'current_user_id' => $userId];
        $folderWhere = 'f.service_code = :service_code';
        $fileWhere = 'df.service_code = :service_code';
        $folderOrder = 'f.sort_order ASC, f.updated_at DESC, f.name ASC';
        $fileOrder = 'df.sort_order ASC, df.updated_at DESC, df.original_name ASC';

        if ($view === 'trash') {
            $folderWhere .= ' AND f.deleted_at IS NOT NULL';
            $fileWhere .= ' AND df.deleted_at IS NOT NULL';
        } elseif ($view === 'favorite') {
            $folderWhere .= ' AND f.deleted_at IS NULL AND EXISTS (SELECT 1 FROM dossier_favorites fav WHERE fav.user_id = :current_user_id AND fav.target_type = "folder" AND fav.target_id = f.id)';
            $fileWhere .= ' AND df.deleted_at IS NULL AND EXISTS (SELECT 1 FROM dossier_favorites fav WHERE fav.user_id = :current_user_id AND fav.target_type = "file" AND fav.target_id = df.id)';
        } elseif ($view === 'recent') {
            $folderWhere .= ' AND f.deleted_at IS NULL AND EXISTS (SELECT 1 FROM dossier_recent_views rv WHERE rv.user_id = :current_user_id AND rv.target_type = "folder" AND rv.target_id = f.id)';
            $fileWhere .= ' AND df.deleted_at IS NULL AND EXISTS (SELECT 1 FROM dossier_recent_views rv WHERE rv.user_id = :current_user_id AND rv.target_type = "file" AND rv.target_id = df.id)';
            $folderOrder = '(SELECT rv.viewed_at FROM dossier_recent_views rv WHERE rv.user_id = :current_user_id AND rv.target_type = "folder" AND rv.target_id = f.id) DESC';
            $fileOrder = '(SELECT rv.viewed_at FROM dossier_recent_views rv WHERE rv.user_id = :current_user_id AND rv.target_type = "file" AND rv.target_id = df.id) DESC';
        } elseif ($view === 'shared') {
            $folderWhere .= ' AND f.deleted_at IS NULL AND EXISTS (SELECT 1 FROM dossier_permissions p WHERE p.target_type = "folder" AND p.target_id = f.id AND (p.subject_type = "service" AND p.subject_value = :service_code OR p.subject_type = "user" AND p.subject_value = :user_value OR p.subject_type = "rank" AND p.subject_value = :rank_value))';
            $fileWhere .= ' AND df.deleted_at IS NULL AND EXISTS (SELECT 1 FROM dossier_permissions p WHERE p.target_type = "file" AND p.target_id = df.id AND (p.subject_type = "service" AND p.subject_value = :service_code OR p.subject_type = "user" AND p.subject_value = :user_value OR p.subject_type = "rank" AND p.subject_value = :rank_value))';
            $folderParams['user_value'] = (string) $userId; $folderParams['rank_value'] = $rankCode;
            $fileParams['user_value'] = (string) $userId; $fileParams['rank_value'] = $rankCode;
        } elseif ($view === 'archive') {
            $folderWhere .= ' AND f.deleted_at IS NULL AND f.status = "archived"';
            $fileWhere .= ' AND df.deleted_at IS NULL AND df.status = "archived"';
        } else {
            $folderWhere .= ' AND f.deleted_at IS NULL AND f.status = "active"';
            $fileWhere .= ' AND df.deleted_at IS NULL AND df.status = "active"';
            if ($parentId !== null && $parentId > 0) {
                $folderWhere .= ' AND f.parent_id = :parent_id'; $fileWhere .= ' AND df.folder_id = :folder_id';
                $folderParams['parent_id'] = $parentId; $fileParams['folder_id'] = $parentId;
            } else {
                $folderWhere .= ' AND f.parent_id IS NULL'; $fileWhere .= ' AND df.folder_id IS NULL';
            }
        }

        if ($query !== '') {
            $folderWhere .= ' AND (f.name LIKE :query OR f.description LIKE :query OR f.category LIKE :query OR f.logo_label LIKE :query)';
            $fileWhere .= ' AND (df.original_name LIKE :query OR df.description LIKE :query OR df.extension LIKE :query)';
            $folderParams['query'] = '%' . $query . '%'; $fileParams['query'] = '%' . $query . '%';
        }

        $foldersStatement = $pdo->prepare(
            'SELECT f.*, owner.username AS owner_username,
                    (SELECT COUNT(*) FROM dossier_folders child WHERE child.parent_id = f.id AND child.deleted_at IS NULL) AS folders_count,
                    (SELECT COUNT(*) FROM dossier_files file WHERE file.folder_id = f.id AND file.deleted_at IS NULL) AS files_count,
                    EXISTS (SELECT 1 FROM dossier_favorites fav WHERE fav.user_id = :current_user_id AND fav.target_type = "folder" AND fav.target_id = f.id) AS is_favorite
             FROM dossier_folders f LEFT JOIN users owner ON owner.id = f.owner_user_id
             WHERE ' . $folderWhere . ' ORDER BY ' . $folderOrder . ' LIMIT 160'
        );
        $foldersStatement->execute($folderParams);

        $filesStatement = $pdo->prepare(
            'SELECT df.*, owner.username AS owner_username,
                    EXISTS (SELECT 1 FROM dossier_favorites fav WHERE fav.user_id = :current_user_id AND fav.target_type = "file" AND fav.target_id = df.id) AS is_favorite
             FROM dossier_files df LEFT JOIN users owner ON owner.id = df.owner_user_id
             WHERE ' . $fileWhere . ' ORDER BY ' . $fileOrder . ' LIMIT 220'
        );
        $filesStatement->execute($fileParams);

        dossiersJson(['success' => true, 'service_code' => $serviceCode, 'parent_id' => $parentId, 'view' => $view, 'breadcrumb' => $view === 'all' ? buildBreadcrumb($pdo, $parentId, $serviceCode) : [], 'folders' => $foldersStatement->fetchAll(), 'files' => $filesStatement->fetchAll()]);
    }

    if ($method === 'GET' && $action === 'get') {
        $type = normalizeTargetType((string) ($_GET['type'] ?? 'folder'));
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) dossiersJson(['success' => false, 'message' => 'Élément invalide.'], 400);
        if ($type === 'folder') {
            $item = fetchFolder($pdo, $id, $serviceCode, true);
            if (!$item) dossiersJson(['success' => false, 'message' => 'Dossier introuvable.'], 404);
            recordRecentView($pdo, $userId, 'folder', $id);
            dossiersJson(['success' => true, 'type' => 'folder', 'item' => $item, 'tags' => fetchTags($pdo, 'folder', $id), 'logs' => fetchLogs($pdo, $serviceCode, 'folder', $id), 'permissions' => fetchPermissions($pdo, 'folder', $id), 'breadcrumb' => buildBreadcrumb($pdo, $id, $serviceCode)]);
        }
        $item = fetchFileRow($pdo, $id, $serviceCode, true);
        if (!$item) dossiersJson(['success' => false, 'message' => 'Fichier introuvable.'], 404);
        recordRecentView($pdo, $userId, 'file', $id);
        addDossierLog($pdo, $serviceId, $serviceCode, 'file', $id, 'file_viewed', ['name' => $item['original_name']], $userId);
        dossiersJson(['success' => true, 'type' => 'file', 'item' => $item, 'tags' => fetchTags($pdo, 'file', $id), 'logs' => fetchLogs($pdo, $serviceCode, 'file', $id), 'permissions' => fetchPermissions($pdo, 'file', $id), 'breadcrumb' => buildBreadcrumb($pdo, $item['folder_id'] ? (int) $item['folder_id'] : null, $serviceCode)]);
    }

    if ($method === 'POST' && $action === 'create-folder') {
        $data = dossiersBody();
        $name = dossierText($data, 'name', 140);
        $description = dossierText($data, 'description', 3000);
        $category = dossierText($data, 'category', 80) ?? 'general';
        $confidentiality = normalizeConfidentiality(dossierText($data, 'confidentiality_level', 40));
        $parentId = isset($data['parent_id']) && (int) $data['parent_id'] > 0 ? (int) $data['parent_id'] : null;
        $tags = is_array($data['tags'] ?? null) ? $data['tags'] : [];
        $logoKey = normalizeLogoKey(dossierText($data, 'logo_key', 80));
        $logoLabel = dossierText($data, 'logo_label', 80);
        if (!$name) dossiersJson(['success' => false, 'message' => 'Nom du dossier obligatoire.'], 400);
        if ($parentId !== null && !fetchFolder($pdo, $parentId, $serviceCode)) dossiersJson(['success' => false, 'message' => 'Dossier parent introuvable.'], 404);
        $maxOrderStatement = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM dossier_folders WHERE service_code = :service_code AND parent_id <=> :parent_id');
        $maxOrderStatement->execute(['service_code' => $serviceCode, 'parent_id' => $parentId]);
        $sortOrder = (int) $maxOrderStatement->fetchColumn();
        $statement = $pdo->prepare(
            'INSERT INTO dossier_folders (service_id, service_code, parent_id, owner_user_id, name, description, category, confidentiality_level, status, sort_order, logo_key, logo_label)
             VALUES (:service_id, :service_code, :parent_id, :owner_user_id, :name, :description, :category, :confidentiality_level, :status, :sort_order, :logo_key, :logo_label)'
        );
        $statement->execute(['service_id' => $serviceId, 'service_code' => $serviceCode, 'parent_id' => $parentId, 'owner_user_id' => $userId ?: null, 'name' => $name, 'description' => $description, 'category' => $category, 'confidentiality_level' => $confidentiality, 'status' => 'active', 'sort_order' => $sortOrder, 'logo_key' => $logoKey, 'logo_label' => $logoLabel]);
        $id = (int) $pdo->lastInsertId();
        replaceTags($pdo, $serviceCode, $userId, 'folder', $id, $tags);
        addDossierLog($pdo, $serviceId, $serviceCode, 'folder', $id, 'folder_created', ['name' => $name, 'parent_id' => $parentId, 'confidentiality_level' => $confidentiality], $userId);
        dossiersJson(['success' => true, 'folder' => fetchFolder($pdo, $id, $serviceCode)], 201);
    }

    if ($method === 'POST' && $action === 'update') {
        $data = dossiersBody();
        $type = normalizeTargetType(dossierText($data, 'type', 20));
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) dossiersJson(['success' => false, 'message' => 'Élément invalide.'], 400);
        $name = dossierText($data, 'name', 180);
        $description = dossierText($data, 'description', 3000);
        $category = dossierText($data, 'category', 80) ?? 'general';
        $confidentiality = normalizeConfidentiality(dossierText($data, 'confidentiality_level', 40));
        $tags = is_array($data['tags'] ?? null) ? $data['tags'] : [];
        if ($type === 'folder') {
            if (!fetchFolder($pdo, $id, $serviceCode)) dossiersJson(['success' => false, 'message' => 'Dossier introuvable.'], 404);
            if (!$name) dossiersJson(['success' => false, 'message' => 'Nom obligatoire.'], 400);
            $logoKey = normalizeLogoKey(dossierText($data, 'logo_key', 80));
            $logoLabel = dossierText($data, 'logo_label', 80);
            $statement = $pdo->prepare('UPDATE dossier_folders SET name = :name, description = :description, category = :category, confidentiality_level = :confidentiality, logo_key = :logo_key, logo_label = :logo_label WHERE id = :id AND service_code = :service_code');
            $statement->execute(['name' => $name, 'description' => $description, 'category' => $category, 'confidentiality' => $confidentiality, 'logo_key' => $logoKey, 'logo_label' => $logoLabel, 'id' => $id, 'service_code' => $serviceCode]);
            replaceTags($pdo, $serviceCode, $userId, 'folder', $id, $tags);
            addDossierLog($pdo, $serviceId, $serviceCode, 'folder', $id, 'folder_updated', ['name' => $name], $userId);
            dossiersJson(['success' => true, 'item' => fetchFolder($pdo, $id, $serviceCode)]);
        }
        $file = fetchFileRow($pdo, $id, $serviceCode);
        if (!$file) dossiersJson(['success' => false, 'message' => 'Fichier introuvable.'], 404);
        if (!$name) $name = (string) $file['original_name'];
        $statement = $pdo->prepare('UPDATE dossier_files SET original_name = :name, description = :description, confidentiality_level = :confidentiality WHERE id = :id AND service_code = :service_code');
        $statement->execute(['name' => $name, 'description' => $description, 'confidentiality' => $confidentiality, 'id' => $id, 'service_code' => $serviceCode]);
        replaceTags($pdo, $serviceCode, $userId, 'file', $id, $tags);
        addDossierLog($pdo, $serviceId, $serviceCode, 'file', $id, 'file_updated', ['name' => $name], $userId);
        dossiersJson(['success' => true, 'item' => fetchFileRow($pdo, $id, $serviceCode)]);
    }

    if ($method === 'POST' && $action === 'reorder') {
        $data = dossiersBody();
        $items = is_array($data['items'] ?? null) ? $data['items'] : [];
        foreach ($items as $index => $item) {
            $type = normalizeTargetType((string) ($item['type'] ?? 'folder'));
            $id = (int) ($item['id'] ?? 0);
            if ($id <= 0) continue;
            $table = $type === 'folder' ? 'dossier_folders' : 'dossier_files';
            $pdo->prepare("UPDATE {$table} SET sort_order = :sort_order WHERE id = :id AND service_code = :service_code")->execute(['sort_order' => ($index + 1) * 10, 'id' => $id, 'service_code' => $serviceCode]);
        }
        dossiersJson(['success' => true]);
    }

    if ($method === 'POST' && $action === 'upload-file') {
        $folderId = isset($_POST['folder_id']) && (int) $_POST['folder_id'] > 0 ? (int) $_POST['folder_id'] : null;
        $confidentiality = normalizeConfidentiality((string) ($_POST['confidentiality_level'] ?? 'service'));
        $description = mb_substr(trim((string) ($_POST['description'] ?? '')), 0, 3000) ?: null;
        $tags = array_filter(array_map('trim', explode(',', (string) ($_POST['tags'] ?? ''))));
        if ($folderId !== null && !fetchFolder($pdo, $folderId, $serviceCode)) dossiersJson(['success' => false, 'message' => 'Dossier parent introuvable.'], 404);
        if (empty($_FILES['files'])) dossiersJson(['success' => false, 'message' => 'Aucun fichier envoyé.'], 400);
        $files = $_FILES['files'];
        $names = is_array($files['name']) ? $files['name'] : [$files['name']];
        $tmpNames = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
        $errors = is_array($files['error']) ? $files['error'] : [$files['error']];
        $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
        $allowed = ['png','jpg','jpeg','webp','pdf','txt','doc','docx','mp4','webm','mp3','wav','ogg','zip'];
        $maxSize = 250 * 1024 * 1024;
        $serviceFolder = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($serviceCode));
        $uploadRoot = dirname(__DIR__) . '/uploads/dossiers/' . $serviceFolder;
        if (!is_dir($uploadRoot) && !mkdir($uploadRoot, 0755, true)) dossiersJson(['success' => false, 'message' => 'Dossier upload inaccessible.'], 500);
        $maxOrderStatement = $pdo->prepare('SELECT COALESCE(MAX(sort_order), 0) + 10 FROM dossier_files WHERE service_code = :service_code AND folder_id <=> :folder_id');
        $maxOrderStatement->execute(['service_code' => $serviceCode, 'folder_id' => $folderId]);
        $sortOrder = (int) $maxOrderStatement->fetchColumn();
        $created = [];
        foreach ($names as $index => $originalName) {
            $error = (int) ($errors[$index] ?? UPLOAD_ERR_NO_FILE);
            if ($error !== UPLOAD_ERR_OK) dossiersJson(['success' => false, 'message' => uploadErrorMessage($error)], 400);
            $size = (int) ($sizes[$index] ?? 0);
            if ($size <= 0 || $size > $maxSize) dossiersJson(['success' => false, 'message' => 'Fichier invalide ou trop lourd. Maximum applicatif 250 Mo. Si ça bloque avant, augmente upload_max_filesize et post_max_size côté hébergeur.'], 400);
            $extension = strtolower(pathinfo((string) $originalName, PATHINFO_EXTENSION));
            if (!in_array($extension, $allowed, true)) dossiersJson(['success' => false, 'message' => 'Type de fichier non autorisé.'], 400);
            $tmpName = (string) ($tmpNames[$index] ?? '');
            $storedName = date('Ymd_His') . '_' . bin2hex(random_bytes(8)) . '.' . $extension;
            $targetPath = $uploadRoot . '/' . $storedName;
            if (!move_uploaded_file($tmpName, $targetPath)) dossiersJson(['success' => false, 'message' => 'Impossible d’enregistrer le fichier. Vérifie aussi upload_max_filesize/post_max_size côté serveur.'], 500);
            $publicPath = '/uploads/dossiers/' . $serviceFolder . '/' . $storedName;
            $mimeType = mime_content_type($targetPath) ?: 'application/octet-stream';
            $statement = $pdo->prepare(
                'INSERT INTO dossier_files (folder_id, service_id, service_code, owner_user_id, original_name, stored_name, mime_type, extension, size_bytes, file_path, description, confidentiality_level, sort_order)
                 VALUES (:folder_id, :service_id, :service_code, :owner_user_id, :original_name, :stored_name, :mime_type, :extension, :size_bytes, :file_path, :description, :confidentiality_level, :sort_order)'
            );
            $statement->execute(['folder_id' => $folderId, 'service_id' => $serviceId, 'service_code' => $serviceCode, 'owner_user_id' => $userId ?: null, 'original_name' => mb_substr((string) $originalName, 0, 180), 'stored_name' => $storedName, 'mime_type' => $mimeType, 'extension' => $extension, 'size_bytes' => $size, 'file_path' => $publicPath, 'description' => $description, 'confidentiality_level' => $confidentiality, 'sort_order' => $sortOrder + ($index * 10)]);
            $fileId = (int) $pdo->lastInsertId();
            replaceTags($pdo, $serviceCode, $userId, 'file', $fileId, $tags);
            addDossierLog($pdo, $serviceId, $serviceCode, 'file', $fileId, 'file_uploaded', ['name' => $originalName, 'folder_id' => $folderId, 'size_bytes' => $size], $userId);
            $created[] = fetchFileRow($pdo, $fileId, $serviceCode);
        }
        dossiersJson(['success' => true, 'files' => $created], 201);
    }

    if ($method === 'POST' && in_array($action, ['delete','restore','archive','unarchive','permanent-delete','favorite','permission','remove-permission'], true)) {
        $data = dossiersBody();
        $type = normalizeTargetType(dossierText($data, 'type', 20));
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) dossiersJson(['success' => false, 'message' => 'Élément invalide.'], 400);
        if ($action === 'favorite') {
            $enabled = !empty($data['enabled']);
            if ($enabled) $pdo->prepare('INSERT IGNORE INTO dossier_favorites (user_id, target_type, target_id) VALUES (:user_id, :target_type, :target_id)')->execute(['user_id' => $userId, 'target_type' => $type, 'target_id' => $id]);
            else $pdo->prepare('DELETE FROM dossier_favorites WHERE user_id = :user_id AND target_type = :target_type AND target_id = :target_id')->execute(['user_id' => $userId, 'target_type' => $type, 'target_id' => $id]);
            dossiersJson(['success' => true]);
        }
        if ($action === 'permission') {
            $subjectType = in_array(($data['subject_type'] ?? ''), ['user','service','rank'], true) ? $data['subject_type'] : 'service';
            $subjectValue = mb_substr(trim((string) ($data['subject_value'] ?? $serviceCode)), 0, 80);
            $permission = in_array(($data['permission'] ?? ''), ['view','upload','edit','delete','restore','download','share','manage_access','archive','owner'], true) ? $data['permission'] : 'view';
            $expiresAt = trim((string) ($data['expires_at'] ?? '')) ?: null;
            $statement = $pdo->prepare('INSERT INTO dossier_permissions (target_type, target_id, subject_type, subject_value, permission, expires_at, created_by) VALUES (:target_type, :target_id, :subject_type, :subject_value, :permission, :expires_at, :created_by) ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)');
            $statement->execute(['target_type' => $type, 'target_id' => $id, 'subject_type' => $subjectType, 'subject_value' => $subjectValue, 'permission' => $permission, 'expires_at' => $expiresAt, 'created_by' => $userId ?: null]);
            addDossierLog($pdo, $serviceId, $serviceCode, $type, $id, 'access_updated', ['subject_type' => $subjectType, 'subject_value' => $subjectValue, 'permission' => $permission], $userId);
            dossiersJson(['success' => true, 'permissions' => fetchPermissions($pdo, $type, $id)]);
        }
        if ($action === 'remove-permission') {
            $permissionId = (int) ($data['permission_id'] ?? 0);
            if ($permissionId <= 0) dossiersJson(['success' => false, 'message' => 'Permission invalide.'], 400);
            $pdo->prepare('DELETE FROM dossier_permissions WHERE id = :id AND target_type = :target_type AND target_id = :target_id')->execute(['id' => $permissionId, 'target_type' => $type, 'target_id' => $id]);
            addDossierLog($pdo, $serviceId, $serviceCode, $type, $id, 'access_removed', ['permission_id' => $permissionId], $userId);
            dossiersJson(['success' => true, 'permissions' => fetchPermissions($pdo, $type, $id)]);
        }
        $table = $type === 'folder' ? 'dossier_folders' : 'dossier_files';
        $target = $type === 'folder' ? fetchFolder($pdo, $id, $serviceCode, true) : fetchFileRow($pdo, $id, $serviceCode, true);
        if (!$target) dossiersJson(['success' => false, 'message' => 'Élément introuvable.'], 404);
        if ($action === 'delete') { $pdo->prepare("UPDATE {$table} SET deleted_at = NOW() WHERE id = :id AND service_code = :service_code")->execute(['id' => $id, 'service_code' => $serviceCode]); addDossierLog($pdo, $serviceId, $serviceCode, $type, $id, $type . '_deleted', [], $userId); dossiersJson(['success' => true]); }
        if ($action === 'restore') { $pdo->prepare("UPDATE {$table} SET deleted_at = NULL WHERE id = :id AND service_code = :service_code")->execute(['id' => $id, 'service_code' => $serviceCode]); addDossierLog($pdo, $serviceId, $serviceCode, $type, $id, $type . '_restored', [], $userId); dossiersJson(['success' => true]); }
        if ($action === 'archive') { $pdo->prepare("UPDATE {$table} SET status = 'archived' WHERE id = :id AND service_code = :service_code")->execute(['id' => $id, 'service_code' => $serviceCode]); addDossierLog($pdo, $serviceId, $serviceCode, $type, $id, $type . '_archived', [], $userId); dossiersJson(['success' => true]); }
        if ($action === 'unarchive') { $pdo->prepare("UPDATE {$table} SET status = 'active' WHERE id = :id AND service_code = :service_code")->execute(['id' => $id, 'service_code' => $serviceCode]); addDossierLog($pdo, $serviceId, $serviceCode, $type, $id, $type . '_unarchived', [], $userId); dossiersJson(['success' => true]); }
        if ($action === 'permanent-delete') { if ($type === 'folder') hardDeleteFolder($pdo, $serviceCode, $id); else { deleteFilePhysical($target); cleanupTargets($pdo, 'file', [$id]); $pdo->prepare('DELETE FROM dossier_files WHERE id = :id AND service_code = :service_code')->execute(['id' => $id, 'service_code' => $serviceCode]); } dossiersJson(['success' => true]); }
    }

    if ($method === 'GET' && in_array($action, ['download', 'preview'], true)) {
        $id = (int) ($_GET['id'] ?? 0);
        $file = fetchFileRow($pdo, $id, $serviceCode);
        if (!$file) dossiersJson(['success' => false, 'message' => 'Fichier introuvable.'], 404);
        $absolutePath = dirname(__DIR__) . $file['file_path'];
        if (!is_file($absolutePath)) dossiersJson(['success' => false, 'message' => 'Fichier absent du serveur.'], 404);
        addDossierLog($pdo, $serviceId, $serviceCode, 'file', $id, $action === 'preview' ? 'file_viewed' : 'file_downloaded', ['name' => $file['original_name']], $userId);
        if ($action === 'preview') outputInlineFile($file);
        header_remove('Content-Type');
        header('Content-Type: ' . ($file['mime_type'] ?: 'application/octet-stream'));
        header('Content-Disposition: attachment; filename="' . basename((string) $file['original_name']) . '"');
        header('Content-Length: ' . filesize($absolutePath));
        readfile($absolutePath);
        exit;
    }

    dossiersJson(['success' => false, 'message' => 'Action dossiers inconnue.'], 404);
} catch (Throwable $exception) {
    dossiersJson(['success' => false, 'message' => 'Erreur module Dossiers.', 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null], 500);
}
