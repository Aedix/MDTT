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

function serviceCode(array $user): string
{
    return (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
}

function cleanItems(array $items): array
{
    $clean = [];
    foreach ($items as $item) {
        $type = (string) ($item['type'] ?? '');
        $id = (int) ($item['id'] ?? 0);
        if (!in_array($type, ['folder', 'file'], true) || $id <= 0) continue;
        $clean[] = ['type' => $type, 'id' => $id];
    }
    return $clean;
}

function updateItem(PDO $pdo, string $serviceCode, string $type, int $id, string $action): void
{
    $table = $type === 'folder' ? 'dossier_folders' : 'dossier_files';
    if ($action === 'archive') {
        $pdo->prepare("UPDATE {$table} SET status = 'archived', updated_at = NOW() WHERE id = :id AND service_code = :service_code AND deleted_at IS NULL")->execute(['id' => $id, 'service_code' => $serviceCode]);
        return;
    }
    if ($action === 'unarchive') {
        $pdo->prepare("UPDATE {$table} SET status = 'active', updated_at = NOW() WHERE id = :id AND service_code = :service_code AND deleted_at IS NULL")->execute(['id' => $id, 'service_code' => $serviceCode]);
        return;
    }
    if ($action === 'delete') {
        $pdo->prepare("UPDATE {$table} SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id AND service_code = :service_code AND deleted_at IS NULL")->execute(['id' => $id, 'service_code' => $serviceCode]);
        return;
    }
    if ($action === 'restore') {
        $pdo->prepare("UPDATE {$table} SET deleted_at = NULL, updated_at = NOW() WHERE id = :id AND service_code = :service_code")->execute(['id' => $id, 'service_code' => $serviceCode]);
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['success' => false, 'message' => 'Méthode non autorisée.'], 405);
    }

    $data = body();
    $action = (string) ($data['action'] ?? '');
    if (!in_array($action, ['archive', 'unarchive', 'delete', 'restore'], true)) {
        respond(['success' => false, 'message' => 'Action groupée invalide.'], 400);
    }

    $items = cleanItems(is_array($data['items'] ?? null) ? $data['items'] : []);
    if (!$items) {
        respond(['success' => false, 'message' => 'Aucun élément sélectionné.'], 400);
    }

    $serviceCode = serviceCode($user);
    foreach ($items as $item) {
        updateItem($pdo, $serviceCode, $item['type'], $item['id'], $action);
    }

    respond(['success' => true, 'message' => count($items) . ' élément(s) traité(s).']);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Action groupée impossible.', 'debug' => defined('DEBUG_MODE') && DEBUG_MODE ? $exception->getMessage() : null], 500);
}
