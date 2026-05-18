<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/report_access.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string) ($_GET['action'] ?? 'list');
$serviceCode = userActiveServiceCode($user);

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

function t(array $data, string $key, int $max = 5000): ?string
{
    $value = trim((string) ($data[$key] ?? ''));
    return $value === '' ? null : mb_substr($value, 0, $max);
}

function structuredJson(array $data): ?string
{
    $value = $data['structured_data'] ?? null;
    if (!is_array($value)) {
        return null;
    }

    unset($value['arrestation_status']);

    return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function canEditReportStatus(array $user): bool
{
    $technicalRole = str_replace(['-', ' '], '_', strtolower(trim((string) ($user['role'] ?? ''))));
    $rankCode = str_replace(['-', ' '], '_', strtolower(trim((string) ($user['active_rank_code'] ?? $user['rank_code'] ?? $user['active_rank_name'] ?? $user['rank_name'] ?? ''))));
    $rankName = strtolower(trim((string) ($user['active_rank_name'] ?? $user['rank_name'] ?? '')));

    return in_array($technicalRole, ['super_admin', 'superadmin'], true)
        || userHasPermission($user, '*')
        || userHasPermission($user, 'reports.status.update')
        || userHasMinimumRole($user, 'chief')
        || str_contains($rankCode, 'director')
        || str_contains($rankName, 'director')
        || str_contains($rankName, 'command staff');
}

function resolveReportStatus(array $data, ?array $existing, array $user): string
{
    $allowedStatuses = ['draft', 'submitted', 'validated', 'archived', 'rejected'];
    $requestedStatus = t($data, 'status', 40) ?? 'submitted';
    if (!in_array($requestedStatus, $allowedStatuses, true)) {
        $requestedStatus = 'submitted';
    }

    if (canEditReportStatus($user)) {
        return $requestedStatus;
    }

    if ($existing) {
        return (string) ($existing['status'] ?? 'submitted');
    }

    return 'submitted';
}

function reportLog(PDO $pdo, int $reportId, string $action, array $details, int $userId): void
{
    $statement = $pdo->prepare('INSERT INTO report_logs (report_id, action, details, created_by) VALUES (:report_id, :action, :details, :created_by)');
    $statement->execute([
        'report_id' => $reportId,
        'action' => $action,
        'details' => json_encode($details, JSON_UNESCAPED_UNICODE),
        'created_by' => $userId,
    ]);
}

function getReport(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare(
        'SELECT r.*, creator.username AS created_by_username, updater.username AS updated_by_username, d.name AS division_name, s.name AS service_name, s.logo_path AS service_logo_path
         FROM reports r
         LEFT JOIN users creator ON creator.id = r.created_by
         LEFT JOIN users updater ON updater.id = r.updated_by
         LEFT JOIN divisions d ON d.id = r.division_id
         LEFT JOIN services s ON s.code = r.service_code
         WHERE r.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    return $statement->fetch() ?: null;
}

function syncLinks(PDO $pdo, int $reportId, string $table, string $column, array $ids, string $relation = 'concerned'): void
{
    $pdo->prepare("DELETE FROM {$table} WHERE report_id = :report_id")->execute(['report_id' => $reportId]);
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn ($id) => $id > 0)));
    if (!$ids) return;

    $statement = $pdo->prepare("INSERT INTO {$table} (report_id, {$column}, relation_type) VALUES (:report_id, :linked_id, :relation_type)");
    foreach ($ids as $id) {
        $statement->execute([
            'report_id' => $reportId,
            'linked_id' => $id,
            'relation_type' => $relation,
        ]);
    }
}

try {
    if ($method === 'GET' && $action === 'meta') {
        $types = $pdo->query('SELECT code, label FROM report_types WHERE is_active = 1 ORDER BY sort_order ASC, label ASC')->fetchAll();
        $divisionsStatement = $pdo->prepare('SELECT id, name FROM divisions WHERE is_active = 1 AND service_id = (SELECT id FROM services WHERE code = :code LIMIT 1) ORDER BY sort_order ASC, name ASC');
        $divisionsStatement->execute(['code' => $serviceCode]);

        respond([
            'success' => true,
            'types' => $types,
            'divisions' => $divisionsStatement->fetchAll(),
            'statuses' => [
                ['code' => 'draft', 'label' => 'Brouillon'],
                ['code' => 'submitted', 'label' => 'Soumis'],
                ['code' => 'validated', 'label' => 'Validé'],
                ['code' => 'archived', 'label' => 'Archivé'],
                ['code' => 'rejected', 'label' => 'Rejeté'],
            ],
            'access_scopes' => [
                ['code' => 'service', 'label' => 'Service actif uniquement'],
                ['code' => 'interservice', 'label' => 'Interservice'],
                ['code' => 'division', 'label' => 'Division'],
                ['code' => 'supervisors', 'label' => 'Supervisor minimum'],
                ['code' => 'directors', 'label' => 'Director uniquement'],
                ['code' => 'explicit', 'label' => 'Agents autorisés uniquement'],
            ],
        ]);
    }

    if ($method === 'GET' && $action === 'list') {
        $q = trim((string) ($_GET['q'] ?? ''));
        $search = '%' . $q . '%';
        $statement = $pdo->prepare(
            'SELECT r.id, r.report_number, r.title, r.type_code, r.status, r.service_code, r.access_scope, r.occurred_at, r.location, r.created_at, u.username AS created_by_username
             FROM reports r
             LEFT JOIN users u ON u.id = r.created_by
             WHERE (r.service_code = :service_code OR r.access_scope = "interservice")
               AND (:q = "" OR r.report_number LIKE :search OR r.title LIKE :search OR r.summary LIKE :search OR r.facts LIKE :search OR r.location LIKE :search)
             ORDER BY r.updated_at DESC
             LIMIT 120'
        );
        $statement->execute([
            'service_code' => $serviceCode,
            'q' => $q,
            'search' => $search,
        ]);

        $reports = array_values(array_filter($statement->fetchAll(), static fn (array $report): bool => canUserAccessReport($GLOBALS['user'], $report, $GLOBALS['pdo'])));
        respond(['success' => true, 'reports' => $reports]);
    }

    if ($method === 'GET' && $action === 'get') {
        $id = (int) ($_GET['id'] ?? 0);
        $report = getReport($pdo, $id);
        if (!$report) respond(['success' => false, 'message' => 'Rapport introuvable.'], 404);
        if (!canUserAccessReport($user, $report, $pdo)) respond(['success' => false, 'message' => 'Accès refusé.'], 403);

        $citizens = $pdo->prepare('SELECT c.id, c.first_name, c.last_name, rc.relation_type FROM report_citizens rc INNER JOIN citizens c ON c.id = rc.citizen_id WHERE rc.report_id = :id ORDER BY c.last_name ASC');
        $citizens->execute(['id' => $id]);
        $vehicles = $pdo->prepare('SELECT v.id, v.model, v.plate, rv.relation_type FROM report_vehicles rv INNER JOIN citizen_vehicles v ON v.id = rv.vehicle_id WHERE rv.report_id = :id ORDER BY v.model ASC, v.plate ASC');
        $vehicles->execute(['id' => $id]);
        $agents = $pdo->prepare('SELECT u.id, u.username, ra.relation_type FROM report_agents ra INNER JOIN users u ON u.id = ra.user_id WHERE ra.report_id = :id ORDER BY u.username ASC');
        $agents->execute(['id' => $id]);
        $logs = $pdo->prepare('SELECT rl.action, rl.details, rl.created_at, u.username FROM report_logs rl LEFT JOIN users u ON u.id = rl.created_by WHERE rl.report_id = :id ORDER BY rl.created_at DESC LIMIT 20');
        $logs->execute(['id' => $id]);

        respond([
            'success' => true,
            'report' => $report,
            'citizens' => $citizens->fetchAll(),
            'vehicles' => $vehicles->fetchAll(),
            'agents' => $agents->fetchAll(),
            'logs' => $logs->fetchAll(),
        ]);
    }

    if ($method === 'GET' && $action === 'lookup') {
        $target = (string) ($_GET['target'] ?? 'citizens');
        $q = trim((string) ($_GET['q'] ?? ''));
        $search = '%' . $q . '%';

        if (mb_strlen($q) < 2) respond(['success' => true, 'items' => []]);

        if ($target === 'citizens') {
            $statement = $pdo->prepare('SELECT id, CONCAT(last_name, " ", first_name) AS label, phone AS meta FROM citizens WHERE last_name LIKE ? OR first_name LIKE ? OR phone LIKE ? ORDER BY last_name ASC, first_name ASC LIMIT 12');
            $statement->execute([$search, $search, $search]);
        } elseif ($target === 'vehicles') {
            $statement = $pdo->prepare('SELECT id, CONCAT(COALESCE(model, "Véhicule"), " · ", plate) AS label, CONCAT(COALESCE(category, ""), " ", COALESCE(color, "")) AS meta FROM citizen_vehicles WHERE model LIKE ? OR plate LIKE ? OR category LIKE ? OR color LIKE ? ORDER BY model ASC, plate ASC LIMIT 12');
            $statement->execute([$search, $search, $search, $search]);
        } else {
            $statement = $pdo->prepare('SELECT id, username AS label, rank_name AS meta FROM users WHERE username LIKE ? OR rank_name LIKE ? ORDER BY username ASC LIMIT 12');
            $statement->execute([$search, $search]);
        }

        respond(['success' => true, 'items' => $statement->fetchAll()]);
    }

    if ($method === 'POST' && $action === 'save') {
        $data = body();
        $id = (int) ($data['id'] ?? 0);
        $type = t($data, 'type_code', 60) ?? 'intervention';
        $title = t($data, 'title', 180);
        if (!$title) respond(['success' => false, 'message' => 'Titre obligatoire.'], 400);

        $existing = null;
        if ($id > 0) {
            $existing = getReport($pdo, $id);
            if (!$existing) respond(['success' => false, 'message' => 'Rapport introuvable.'], 404);
            if (!canUserAccessReport($user, $existing, $pdo)) respond(['success' => false, 'message' => 'Accès refusé.'], 403);
        }

        $allowedScopes = ['service', 'interservice', 'division', 'supervisors', 'directors', 'explicit'];
        $accessScope = t($data, 'access_scope', 40) ?? 'service';
        if (!in_array($accessScope, $allowedScopes, true)) $accessScope = 'service';

        $status = resolveReportStatus($data, $existing, $user);
        $ownerServiceCode = $existing['service_code'] ?? $serviceCode;

        $payload = [
            'title' => $title,
            'type_code' => $type,
            'status' => $status,
            'service_code' => $ownerServiceCode,
            'division_id' => ((int) ($data['division_id'] ?? 0)) ?: null,
            'access_scope' => $accessScope,
            'minimum_role_code' => null,
            'minimum_power_level' => 0,
            'occurred_at' => t($data, 'occurred_at', 40),
            'location' => t($data, 'location', 180),
            'summary' => t($data, 'summary', 6000),
            'facts' => t($data, 'facts', 12000),
            'actions_taken' => t($data, 'actions_taken', 8000),
            'conclusions' => t($data, 'conclusions', 8000),
            'notes' => t($data, 'notes', 6000),
            'structured_data' => structuredJson($data),
            'updated_by' => (int) $user['id'],
        ];

        if ($id > 0) {
            $payload['id'] = $id;
            $statement = $pdo->prepare('UPDATE reports SET title = :title, type_code = :type_code, status = :status, service_code = :service_code, division_id = :division_id, access_scope = :access_scope, minimum_role_code = :minimum_role_code, minimum_power_level = :minimum_power_level, occurred_at = :occurred_at, location = :location, summary = :summary, facts = :facts, actions_taken = :actions_taken, conclusions = :conclusions, notes = :notes, structured_data = :structured_data, updated_by = :updated_by WHERE id = :id');
            $statement->execute($payload);
            reportLog($pdo, $id, 'update', $payload, (int) $user['id']);
        } else {
            $payload['report_number'] = generateReportNumber($pdo, $serviceCode, $type);
            $payload['created_by'] = (int) $user['id'];
            $statement = $pdo->prepare('INSERT INTO reports (report_number, title, type_code, status, service_code, division_id, access_scope, minimum_role_code, minimum_power_level, occurred_at, location, summary, facts, actions_taken, conclusions, notes, structured_data, created_by, updated_by) VALUES (:report_number, :title, :type_code, :status, :service_code, :division_id, :access_scope, :minimum_role_code, :minimum_power_level, :occurred_at, :location, :summary, :facts, :actions_taken, :conclusions, :notes, :structured_data, :created_by, :updated_by)');
            $statement->execute($payload);
            $id = (int) $pdo->lastInsertId();
            reportLog($pdo, $id, 'create', $payload, (int) $user['id']);
        }

        syncLinks($pdo, $id, 'report_citizens', 'citizen_id', $data['citizen_ids'] ?? [], 'concerned');
        syncLinks($pdo, $id, 'report_vehicles', 'vehicle_id', $data['vehicle_ids'] ?? [], 'involved');
        syncLinks($pdo, $id, 'report_agents', 'user_id', $data['agent_ids'] ?? [], 'involved');

        respond(['success' => true, 'id' => $id]);
    }

    respond(['success' => false, 'message' => 'Action inconnue.'], 404);
} catch (Throwable $exception) {
    respond(['success' => false, 'message' => 'Erreur serveur: ' . $exception->getMessage()], 500);
}
