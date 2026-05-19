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
            'created_by' => $userId,
        ]);
    } catch (Throwable $exception) {
        // Logs must never block the main action.
    }
}

function fetchFolder(PDO $pdo, int $id, string $serviceCode): ?array
{
    $statement = $pdo->prepare(
        'SELECT f.*, owner.username AS owner_username,
                (SELECT COUNT(*) FROM dossier_folders child WHERE child.parent_id = f.id AND child.deleted_at IS NULL) AS folders_count,
                0 AS files_count
         FROM dossier_folders f
         LEFT JOIN users owner ON owner.id = f.owner_user_id
         WHERE f.id = :id
           AND f.service_code = :service_code
           AND f.deleted_at IS NULL
         LIMIT 1'
    );
    $statement->execute([
        'id' => $id,
        'service_code' => $serviceCode,
    ]);
    $folder = $statement->fetch();
    return $folder ?: null;
}

function buildBreadcrumb(PDO $pdo, ?int $folderId, string $serviceCode): array
{
    if (!$folderId) {
        return [];
    }

    $items = [];
    $currentId = $folderId;
    $guard = 0;

    while ($currentId && $guard < 20) {
        $guard++;
        $statement = $pdo->prepare(
            'SELECT id, parent_id, name
             FROM dossier_folders
             WHERE id = :id
               AND service_code = :service_code
               AND deleted_at IS NULL
             LIMIT 1'
        );
        $statement->execute([
            'id' => $currentId,
            'service_code' => $serviceCode,
        ]);
        $folder = $statement->fetch();

        if (!$folder) {
            break;
        }

        array_unshift($items, [
            'id' => (int) $folder['id'],
            'name' => (string) $folder['name'],
        ]);
        $currentId = $folder['parent_id'] !== null ? (int) $folder['parent_id'] : null;
    }

    return $items;
}

try {
    $serviceCode = activeServiceCode($user);
    $serviceId = activeServiceId($pdo, $serviceCode);
    $userId = (int) ($user['id'] ?? 0);

    if ($method === 'GET' && $action === 'list') {
        $parentIdRaw = trim((string) ($_GET['parent_id'] ?? ''));
        $parentId = $parentIdRaw === '' || $parentIdRaw === 'root' ? null : (int) $parentIdRaw;
        $query = trim((string) ($_GET['q'] ?? ''));

        $params = ['service_code' => $serviceCode];
        $where = 'f.service_code = :service_code AND f.deleted_at IS NULL';

        if ($parentId !== null && $parentId > 0) {
            $where .= ' AND f.parent_id = :parent_id';
            $params['parent_id'] = $parentId;
        } else {
            $where .= ' AND f.parent_id IS NULL';
        }

        if ($query !== '') {
            $where .= ' AND (f.name LIKE :query OR f.description LIKE :query OR f.category LIKE :query)';
            $params['query'] = '%' . $query . '%';
        }

        $statement = $pdo->prepare(
            'SELECT f.*, owner.username AS owner_username,
                    (SELECT COUNT(*) FROM dossier_folders child WHERE child.parent_id = f.id AND child.deleted_at IS NULL) AS folders_count,
                    0 AS files_count
             FROM dossier_folders f
             LEFT JOIN users owner ON owner.id = f.owner_user_id
             WHERE ' . $where . '
             ORDER BY f.updated_at DESC, f.name ASC
             LIMIT 120'
        );
        $statement->execute($params);

        dossiersJson([
            'success' => true,
            'service_code' => $serviceCode,
            'parent_id' => $parentId,
            'breadcrumb' => buildBreadcrumb($pdo, $parentId, $serviceCode),
            'folders' => $statement->fetchAll(),
            'files' => [],
        ]);
    }

    if ($method === 'GET' && $action === 'get') {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) dossiersJson(['success' => false, 'message' => 'Dossier invalide.'], 400);

        $folder = fetchFolder($pdo, $id, $serviceCode);
        if (!$folder) dossiersJson(['success' => false, 'message' => 'Dossier introuvable.'], 404);

        dossiersJson([
            'success' => true,
            'folder' => $folder,
            'breadcrumb' => buildBreadcrumb($pdo, $id, $serviceCode),
        ]);
    }

    if ($method === 'POST' && $action === 'create-folder') {
        $data = dossiersBody();
        $name = dossierText($data, 'name', 140);
        $description = dossierText($data, 'description', 3000);
        $category = dossierText($data, 'category', 80) ?? 'general';
        $confidentiality = normalizeConfidentiality(dossierText($data, 'confidentiality_level', 40));
        $parentId = isset($data['parent_id']) && (int) $data['parent_id'] > 0 ? (int) $data['parent_id'] : null;

        if (!$name) {
            dossiersJson(['success' => false, 'message' => 'Nom du dossier obligatoire.'], 400);
        }

        if ($parentId !== null && !fetchFolder($pdo, $parentId, $serviceCode)) {
            dossiersJson(['success' => false, 'message' => 'Dossier parent introuvable.'], 404);
        }

        $statement = $pdo->prepare(
            'INSERT INTO dossier_folders
             (service_id, service_code, parent_id, owner_user_id, name, description, category, confidentiality_level, status)
             VALUES
             (:service_id, :service_code, :parent_id, :owner_user_id, :name, :description, :category, :confidentiality_level, :status)'
        );
        $statement->execute([
            'service_id' => $serviceId,
            'service_code' => $serviceCode,
            'parent_id' => $parentId,
            'owner_user_id' => $userId ?: null,
            'name' => $name,
            'description' => $description,
            'category' => $category,
            'confidentiality_level' => $confidentiality,
            'status' => 'active',
        ]);

        $id = (int) $pdo->lastInsertId();
        addDossierLog($pdo, $serviceId, $serviceCode, 'folder', $id, 'folder_created', [
            'name' => $name,
            'parent_id' => $parentId,
            'confidentiality_level' => $confidentiality,
        ], $userId);

        dossiersJson([
            'success' => true,
            'folder' => fetchFolder($pdo, $id, $serviceCode),
        ], 201);
    }

    dossiersJson(['success' => false, 'message' => 'Action dossiers inconnue.'], 404);
} catch (Throwable $exception) {
    dossiersJson([
        'success' => false,
        'message' => 'Erreur module Dossiers.',
        'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null,
    ], 500);
}
