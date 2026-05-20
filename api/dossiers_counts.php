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

function serviceCode(array $user): string
{
    return (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
}

function userValues(array $user): array
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

function rankValues(array $user): array
{
    $values = [];
    foreach (['active_rank_code', 'rank_code', 'active_rank_name', 'rank_name'] as $key) {
        $value = trim((string) ($user[$key] ?? ''));
        if ($value !== '') $values[] = $value;
    }
    return array_values(array_unique($values));
}

function scalar(PDO $pdo, string $sql, array $params): int
{
    $statement = $pdo->prepare($sql);
    $statement->execute($params);
    return (int) $statement->fetchColumn();
}

try {
    $serviceCode = serviceCode($user);
    $userId = (int) ($user['id'] ?? 0);

    $activeFolders = scalar($pdo, 'SELECT COUNT(*) FROM dossier_folders WHERE service_code = :service_code AND deleted_at IS NULL AND status = "active"', ['service_code' => $serviceCode]);
    $activeFiles = scalar($pdo, 'SELECT COUNT(*) FROM dossier_files WHERE service_code = :service_code AND deleted_at IS NULL AND status = "active"', ['service_code' => $serviceCode]);
    $archiveFolders = scalar($pdo, 'SELECT COUNT(*) FROM dossier_folders WHERE service_code = :service_code AND deleted_at IS NULL AND status = "archived"', ['service_code' => $serviceCode]);
    $archiveFiles = scalar($pdo, 'SELECT COUNT(*) FROM dossier_files WHERE service_code = :service_code AND deleted_at IS NULL AND status = "archived"', ['service_code' => $serviceCode]);
    $trashFolders = scalar($pdo, 'SELECT COUNT(*) FROM dossier_folders WHERE service_code = :service_code AND deleted_at IS NOT NULL', ['service_code' => $serviceCode]);
    $trashFiles = scalar($pdo, 'SELECT COUNT(*) FROM dossier_files WHERE service_code = :service_code AND deleted_at IS NOT NULL', ['service_code' => $serviceCode]);

    $favoriteFolders = scalar($pdo, 'SELECT COUNT(*) FROM dossier_favorites fav INNER JOIN dossier_folders f ON f.id = fav.target_id AND fav.target_type = "folder" WHERE fav.user_id = :user_id AND f.service_code = :service_code AND f.deleted_at IS NULL AND f.status = "active"', ['user_id' => $userId, 'service_code' => $serviceCode]);
    $favoriteFiles = scalar($pdo, 'SELECT COUNT(*) FROM dossier_favorites fav INNER JOIN dossier_files df ON df.id = fav.target_id AND fav.target_type = "file" WHERE fav.user_id = :user_id AND df.service_code = :service_code AND df.deleted_at IS NULL AND df.status = "active"', ['user_id' => $userId, 'service_code' => $serviceCode]);

    $recentFolders = scalar($pdo, 'SELECT COUNT(*) FROM dossier_recent_views rv INNER JOIN dossier_folders f ON f.id = rv.target_id AND rv.target_type = "folder" WHERE rv.user_id = :user_id AND f.service_code = :service_code AND f.deleted_at IS NULL AND f.status = "active"', ['user_id' => $userId, 'service_code' => $serviceCode]);
    $recentFiles = scalar($pdo, 'SELECT COUNT(*) FROM dossier_recent_views rv INNER JOIN dossier_files df ON df.id = rv.target_id AND rv.target_type = "file" WHERE rv.user_id = :user_id AND df.service_code = :service_code AND df.deleted_at IS NULL AND df.status = "active"', ['user_id' => $userId, 'service_code' => $serviceCode]);

    $subjects = ['(p.subject_type = "service" AND p.subject_value = :service_code)'];
    $params = ['service_code' => $serviceCode];
    foreach (userValues($user) as $index => $value) {
        $key = 'user_value_' . $index;
        $params[$key] = $value;
        $subjects[] = '(p.subject_type = "user" AND p.subject_value = :' . $key . ')';
    }
    foreach (rankValues($user) as $index => $value) {
        $key = 'rank_value_' . $index;
        $params[$key] = $value;
        $subjects[] = '(p.subject_type = "rank" AND p.subject_value = :' . $key . ')';
    }
    $subjectSql = implode(' OR ', $subjects);
    $sharedFolders = scalar($pdo, 'SELECT COUNT(DISTINCT f.id) FROM dossier_permissions p INNER JOIN dossier_folders f ON f.id = p.target_id AND p.target_type = "folder" WHERE f.service_code = :service_code AND f.deleted_at IS NULL AND f.status = "active" AND (p.expires_at IS NULL OR p.expires_at > NOW()) AND (' . $subjectSql . ')', $params);
    $sharedFiles = scalar($pdo, 'SELECT COUNT(DISTINCT df.id) FROM dossier_permissions p INNER JOIN dossier_files df ON df.id = p.target_id AND p.target_type = "file" WHERE df.service_code = :service_code AND df.deleted_at IS NULL AND df.status = "active" AND (p.expires_at IS NULL OR p.expires_at > NOW()) AND (' . $subjectSql . ')', $params);

    respond([
        'success' => true,
        'counts' => [
            'all' => $activeFolders + $activeFiles,
            'shared' => $sharedFolders + $sharedFiles,
            'recent' => $recentFolders + $recentFiles,
            'favorite' => $favoriteFolders + $favoriteFiles,
            'archive' => $archiveFolders + $archiveFiles,
            'trash' => $trashFolders + $trashFiles,
        ],
    ]);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Compteurs dossiers indisponibles.', 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null], 500);
}
