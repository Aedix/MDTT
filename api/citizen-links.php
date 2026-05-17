<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/report_access.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$action = (string) ($_GET['action'] ?? 'list');

function jsonOut(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function requestBody(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

try {
    if ($action === 'list') {
        $citizenId = (int) ($_GET['citizen_id'] ?? 0);
        if ($citizenId <= 0) {
            jsonOut(['success' => false, 'message' => 'Citoyen invalide.'], 400);
        }

        $reportsStatement = $pdo->prepare(
            'SELECT r.id, r.report_number, r.title, r.type_code, r.status, r.service_code, r.access_scope, r.occurred_at, r.location, u.username AS created_by_username
             FROM report_citizens rc
             INNER JOIN reports r ON r.id = rc.report_id
             LEFT JOIN users u ON u.id = r.created_by
             WHERE rc.citizen_id = ?
             ORDER BY r.occurred_at DESC, r.updated_at DESC'
        );
        $reportsStatement->execute([$citizenId]);
        $reports = array_values(array_filter($reportsStatement->fetchAll(), fn (array $report): bool => canUserAccessReport($user, $report, $pdo)));

        $complaintsStatement = $pdo->prepare(
            'SELECT c.*, creator.username AS created_by_username, updater.username AS updated_by_username
             FROM citizen_complaints c
             LEFT JOIN users creator ON creator.id = c.created_by
             LEFT JOIN users updater ON updater.id = c.updated_by
             WHERE c.citizen_id = ?
             ORDER BY c.complaint_date DESC, c.updated_at DESC'
        );
        $complaintsStatement->execute([$citizenId]);

        jsonOut([
            'success' => true,
            'reports' => $reports,
            'complaints' => $complaintsStatement->fetchAll(),
        ]);
    }

    if ($action === 'save_complaint') {
        $data = requestBody();
        $id = (int) ($data['id'] ?? 0);
        $citizenId = (int) ($data['citizen_id'] ?? 0);
        $title = trim((string) ($data['title'] ?? ''));

        if ($citizenId <= 0 || $title === '') {
            jsonOut(['success' => false, 'message' => 'Citoyen et titre obligatoires.'], 400);
        }

        $payload = [
            'citizen_id' => $citizenId,
            'title' => mb_substr($title, 0, 180),
            'complainant_name' => mb_substr(trim((string) ($data['complainant_name'] ?? '')), 0, 140) ?: null,
            'complaint_date' => trim((string) ($data['complaint_date'] ?? '')) ?: date('Y-m-d'),
            'location' => mb_substr(trim((string) ($data['location'] ?? '')), 0, 180) ?: null,
            'status' => mb_substr(trim((string) ($data['status'] ?? 'Ouverte')), 0, 60) ?: 'Ouverte',
            'description' => trim((string) ($data['description'] ?? '')) ?: null,
            'notes' => trim((string) ($data['notes'] ?? '')) ?: null,
            'updated_by' => (int) $user['id'],
        ];

        if ($id > 0) {
            $payload['id'] = $id;
            $statement = $pdo->prepare('UPDATE citizen_complaints SET citizen_id = :citizen_id, title = :title, complainant_name = :complainant_name, complaint_date = :complaint_date, location = :location, status = :status, description = :description, notes = :notes, updated_by = :updated_by WHERE id = :id');
            $statement->execute($payload);
        } else {
            $payload['created_by'] = (int) $user['id'];
            $statement = $pdo->prepare('INSERT INTO citizen_complaints (citizen_id, title, complainant_name, complaint_date, location, status, description, notes, created_by, updated_by) VALUES (:citizen_id, :title, :complainant_name, :complaint_date, :location, :status, :description, :notes, :created_by, :updated_by)');
            $statement->execute($payload);
            $id = (int) $pdo->lastInsertId();
        }

        jsonOut(['success' => true, 'id' => $id]);
    }

    jsonOut(['success' => false, 'message' => 'Action inconnue.'], 404);
} catch (Throwable $exception) {
    jsonOut(['success' => false, 'message' => 'Erreur serveur: ' . $exception->getMessage()], 500);
}
