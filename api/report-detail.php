<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/report_access.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$id = (int) ($_GET['id'] ?? 0);

try {
    $statement = $pdo->prepare(
        'SELECT r.*, creator.username AS created_by_username, updater.username AS updated_by_username, d.name AS division_name, s.name AS service_name, s.logo_path AS service_logo_path
         FROM reports r
         LEFT JOIN users creator ON creator.id = r.created_by
         LEFT JOIN users updater ON updater.id = r.updated_by
         LEFT JOIN divisions d ON d.id = r.division_id
         LEFT JOIN services s ON s.code = r.service_code
         WHERE r.id = ?
         LIMIT 1'
    );
    $statement->execute([$id]);
    $report = $statement->fetch();

    if (!$report) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Rapport introuvable.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!canUserAccessReport($user, $report, $pdo)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Accès refusé.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $citizens = $pdo->prepare('SELECT c.id, c.first_name, c.last_name, rc.relation_type FROM report_citizens rc INNER JOIN citizens c ON c.id = rc.citizen_id WHERE rc.report_id = ? ORDER BY c.last_name ASC, c.first_name ASC');
    $citizens->execute([$id]);

    $vehicles = $pdo->prepare('SELECT v.id, v.model, v.plate, rv.relation_type FROM report_vehicles rv INNER JOIN citizen_vehicles v ON v.id = rv.vehicle_id WHERE rv.report_id = ? ORDER BY v.model ASC, v.plate ASC');
    $vehicles->execute([$id]);

    $agents = $pdo->prepare('SELECT u.id, u.username, ra.relation_type FROM report_agents ra INNER JOIN users u ON u.id = ra.user_id WHERE ra.report_id = ? ORDER BY u.username ASC');
    $agents->execute([$id]);

    $logs = $pdo->prepare('SELECT rl.action, rl.details, rl.created_at, u.username FROM report_logs rl LEFT JOIN users u ON u.id = rl.created_by WHERE rl.report_id = ? ORDER BY rl.created_at DESC LIMIT 20');
    $logs->execute([$id]);

    echo json_encode([
        'success' => true,
        'report' => $report,
        'citizens' => $citizens->fetchAll(),
        'vehicles' => $vehicles->fetchAll(),
        'agents' => $agents->fetchAll(),
        'logs' => $logs->fetchAll(),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $exception) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur serveur: ' . $exception->getMessage()], JSON_UNESCAPED_UNICODE);
}
