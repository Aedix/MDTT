<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();

function viewJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function activeServiceCode(array $user): string
{
    return (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
}

function activeRankValues(array $user): array
{
    $values = [];
    foreach (['active_rank_code', 'rank_code', 'active_rank_name', 'rank_name'] as $key) {
        $value = trim((string) ($user[$key] ?? ''));
        if ($value !== '') $values[] = $value;
    }
    return array_values(array_unique($values));
}

function activeUserValues(array $user): array
{
    $values = [];
    $id = (int) ($user['id'] ?? 0);
    if ($id > 0) $values[] = (string) $id;
    foreach (['username', 'email'] as $key) {
        $value = trim((string) ($user[$key] ?? ''));
        if ($value !== '') $values[] = $value;
    }
    return array_values(array_unique($values));
}

function likeClause(string $prefix, string $query, array &$params, string $folderAlias = 'f', string $fileAlias = 'df'): array
{
    if ($query === '') return ['', ''];
    $folderKey = $prefix . '_folder_q';
    $fileKey = $prefix . '_file_q';
    $params[$folderKey] = '%' . $query . '%';
    $params[$fileKey] = '%' . $query . '%';
    return [
        " AND ({$folderAlias}.name LIKE :{$folderKey} OR {$folderAlias}.description LIKE :{$folderKey} OR {$folderAlias}.category LIKE :{$folderKey})",
        " AND ({$fileAlias}.original_name LIKE :{$fileKey} OR {$fileAlias}.description LIKE :{$fileKey} OR {$fileAlias}.extension LIKE :{$fileKey})",
    ];
}

function folderSelectSql(string $extraSelect = '', string $from = 'dossier_folders f'): string
{
    return 'SELECT f.*, owner.username AS owner_username,
            (SELECT COUNT(*) FROM dossier_folders child WHERE child.parent_id = f.id AND child.deleted_at IS NULL) AS folders_count,
            (SELECT COUNT(*) FROM dossier_files file WHERE file.folder_id = f.id AND file.deleted_at IS NULL) AS files_count,
            ' . ($extraSelect !== '' ? $extraSelect : '0 AS is_favorite') . '
        FROM ' . $from . '
        LEFT JOIN users owner ON owner.id = f.owner_user_id';
}

function fileSelectSql(string $extraSelect = '', string $from = 'dossier_files df'): string
{
    return 'SELECT df.*, owner.username AS owner_username,
            ' . ($extraSelect !== '' ? $extraSelect : '0 AS is_favorite') . '
        FROM ' . $from . '
        LEFT JOIN users owner ON owner.id = df.owner_user_id';
}

function executeAll(PDO $pdo, string $sql, array $params): array
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return $statement->fetchAll();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        viewJson(['success' => false, 'message' => 'Méthode non autorisée.'], 405);
    }

    $view = (string) ($_GET['view'] ?? '');
    if (!in_array($view, ['shared', 'recent', 'favorite'], true)) {
        viewJson(['success' => false, 'message' => 'Vue non prise en charge.'], 400);
    }

    $serviceCode = activeServiceCode($user);
    $userId = (int) ($user['id'] ?? 0);
    $query = trim((string) ($_GET['q'] ?? ''));
    $folders = [];
    $files = [];

    if ($view === 'favorite') {
        $params = ['folder_user_id' => $userId, 'folder_service_code' => $serviceCode, 'file_user_id' => $userId, 'file_service_code' => $serviceCode];
        [$folderSearch, $fileSearch] = likeClause('favorite', $query, $params);

        $folders = executeAll($pdo,
            folderSelectSql('1 AS is_favorite', 'dossier_favorites fav INNER JOIN dossier_folders f ON f.id = fav.target_id AND fav.target_type = "folder"') . '
            WHERE fav.user_id = :folder_user_id
              AND f.service_code = :folder_service_code
              AND f.deleted_at IS NULL
              AND f.status = "active"' . $folderSearch . '
            ORDER BY fav.created_at DESC, f.updated_at DESC
            LIMIT 160',
            array_intersect_key($params, array_flip(['folder_user_id', 'folder_service_code', 'favorite_folder_q']))
        );

        $files = executeAll($pdo,
            fileSelectSql('1 AS is_favorite', 'dossier_favorites fav INNER JOIN dossier_files df ON df.id = fav.target_id AND fav.target_type = "file"') . '
            WHERE fav.user_id = :file_user_id
              AND df.service_code = :file_service_code
              AND df.deleted_at IS NULL
              AND df.status = "active"' . $fileSearch . '
            ORDER BY fav.created_at DESC, df.updated_at DESC
            LIMIT 220',
            array_intersect_key($params, array_flip(['file_user_id', 'file_service_code', 'favorite_file_q']))
        );
    }

    if ($view === 'recent') {
        $params = ['folder_recent_user_id' => $userId, 'folder_service_code' => $serviceCode, 'folder_fav_user_id' => $userId, 'file_recent_user_id' => $userId, 'file_service_code' => $serviceCode, 'file_fav_user_id' => $userId];
        [$folderSearch, $fileSearch] = likeClause('recent', $query, $params);

        $folders = executeAll($pdo,
            folderSelectSql('EXISTS (SELECT 1 FROM dossier_favorites favf WHERE favf.user_id = :folder_fav_user_id AND favf.target_type = "folder" AND favf.target_id = f.id) AS is_favorite', 'dossier_recent_views rv INNER JOIN dossier_folders f ON f.id = rv.target_id AND rv.target_type = "folder"') . '
            WHERE rv.user_id = :folder_recent_user_id
              AND f.service_code = :folder_service_code
              AND f.deleted_at IS NULL
              AND f.status = "active"' . $folderSearch . '
            ORDER BY rv.viewed_at DESC
            LIMIT 160',
            array_intersect_key($params, array_flip(['folder_recent_user_id', 'folder_service_code', 'folder_fav_user_id', 'recent_folder_q']))
        );

        $files = executeAll($pdo,
            fileSelectSql('EXISTS (SELECT 1 FROM dossier_favorites favf WHERE favf.user_id = :file_fav_user_id AND favf.target_type = "file" AND favf.target_id = df.id) AS is_favorite', 'dossier_recent_views rv INNER JOIN dossier_files df ON df.id = rv.target_id AND rv.target_type = "file"') . '
            WHERE rv.user_id = :file_recent_user_id
              AND df.service_code = :file_service_code
              AND df.deleted_at IS NULL
              AND df.status = "active"' . $fileSearch . '
            ORDER BY rv.viewed_at DESC
            LIMIT 220',
            array_intersect_key($params, array_flip(['file_recent_user_id', 'file_service_code', 'file_fav_user_id', 'recent_file_q']))
        );
    }

    if ($view === 'shared') {
        $userValues = activeUserValues($user);
        $rankValues = activeRankValues($user);
        $params = [
            'folder_service_code' => $serviceCode,
            'folder_subject_service' => $serviceCode,
            'folder_fav_user_id' => $userId,
            'file_service_code' => $serviceCode,
            'file_subject_service' => $serviceCode,
            'file_fav_user_id' => $userId,
        ];

        $folderSubjectSql = '(p.subject_type = "service" AND p.subject_value = :folder_subject_service)';
        $fileSubjectSql = '(p.subject_type = "service" AND p.subject_value = :file_subject_service)';

        foreach ($userValues as $index => $value) {
            $folderKey = 'folder_user_value_' . $index;
            $fileKey = 'file_user_value_' . $index;
            $params[$folderKey] = $value;
            $params[$fileKey] = $value;
            $folderSubjectSql .= " OR (p.subject_type = \"user\" AND p.subject_value = :{$folderKey})";
            $fileSubjectSql .= " OR (p.subject_type = \"user\" AND p.subject_value = :{$fileKey})";
        }

        foreach ($rankValues as $index => $value) {
            $folderKey = 'folder_rank_value_' . $index;
            $fileKey = 'file_rank_value_' . $index;
            $params[$folderKey] = $value;
            $params[$fileKey] = $value;
            $folderSubjectSql .= " OR (p.subject_type = \"rank\" AND p.subject_value = :{$folderKey})";
            $fileSubjectSql .= " OR (p.subject_type = \"rank\" AND p.subject_value = :{$fileKey})";
        }

        [$folderSearch, $fileSearch] = likeClause('shared', $query, $params);

        $folderParamKeys = array_merge(['folder_service_code', 'folder_subject_service', 'folder_fav_user_id', 'shared_folder_q'], array_map(fn($i) => 'folder_user_value_' . $i, array_keys($userValues)), array_map(fn($i) => 'folder_rank_value_' . $i, array_keys($rankValues)));
        $fileParamKeys = array_merge(['file_service_code', 'file_subject_service', 'file_fav_user_id', 'shared_file_q'], array_map(fn($i) => 'file_user_value_' . $i, array_keys($userValues)), array_map(fn($i) => 'file_rank_value_' . $i, array_keys($rankValues)));

        $folders = executeAll($pdo,
            folderSelectSql('EXISTS (SELECT 1 FROM dossier_favorites favf WHERE favf.user_id = :folder_fav_user_id AND favf.target_type = "folder" AND favf.target_id = f.id) AS is_favorite', 'dossier_permissions p INNER JOIN dossier_folders f ON f.id = p.target_id AND p.target_type = "folder"') . '
            WHERE f.service_code = :folder_service_code
              AND f.deleted_at IS NULL
              AND f.status = "active"
              AND (p.expires_at IS NULL OR p.expires_at > NOW())
              AND (' . $folderSubjectSql . ')' . $folderSearch . '
            GROUP BY f.id
            ORDER BY MAX(p.created_at) DESC, f.updated_at DESC
            LIMIT 160',
            array_intersect_key($params, array_flip($folderParamKeys))
        );

        $files = executeAll($pdo,
            fileSelectSql('EXISTS (SELECT 1 FROM dossier_favorites favf WHERE favf.user_id = :file_fav_user_id AND favf.target_type = "file" AND favf.target_id = df.id) AS is_favorite', 'dossier_permissions p INNER JOIN dossier_files df ON df.id = p.target_id AND p.target_type = "file"') . '
            WHERE df.service_code = :file_service_code
              AND df.deleted_at IS NULL
              AND df.status = "active"
              AND (p.expires_at IS NULL OR p.expires_at > NOW())
              AND (' . $fileSubjectSql . ')' . $fileSearch . '
            GROUP BY df.id
            ORDER BY MAX(p.created_at) DESC, df.updated_at DESC
            LIMIT 220',
            array_intersect_key($params, array_flip($fileParamKeys))
        );
    }

    viewJson([
        'success' => true,
        'service_code' => $serviceCode,
        'parent_id' => null,
        'view' => $view,
        'breadcrumb' => [],
        'folders' => $folders,
        'files' => $files,
    ]);
} catch (Throwable $exception) {
    viewJson(['success' => false, 'message' => 'Vue dossiers impossible.', 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null], 500);
}
