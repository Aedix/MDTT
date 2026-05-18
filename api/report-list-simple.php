<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/report_access.php';
header('Content-Type: application/json; charset=utf-8');
$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$service = strtoupper(trim((string)($user['active_service_code'] ?? $user['service'] ?? 'MDT')));
$q = trim((string)($_GET['q'] ?? ''));
$type = trim((string)($_GET['type'] ?? ''));
$status = trim((string)($_GET['status'] ?? ''));
$serviceFilter = strtoupper(trim((string)($_GET['service'] ?? '')));
$classification = trim((string)($_GET['classification'] ?? ''));
$dateFrom = trim((string)($_GET['date_from'] ?? ''));
$dateTo = trim((string)($_GET['date_to'] ?? ''));
$createdBy = trim((string)($_GET['created_by'] ?? ''));
$sort = trim((string)($_GET['sort'] ?? 'recent'));
$like = '%' . $q . '%';
$createdLike = '%' . $createdBy . '%';

try {
  $where = ['(r.service_code = :active_service OR r.access_scope = "interservice" OR r.created_by = :user_id)'];
  $params = ['active_service' => $service, 'user_id' => (int)$user['id']];

  if ($q !== '') {
    $where[] = '(r.report_number LIKE :search OR r.title LIKE :search OR r.summary LIKE :search OR r.facts LIKE :search OR r.location LIKE :search)';
    $params['search'] = $like;
  }
  if ($type !== '') { $where[] = 'r.type_code = :type'; $params['type'] = $type; }
  if ($status !== '') { $where[] = 'r.status = :status'; $params['status'] = $status; }
  if ($serviceFilter !== '') { $where[] = 'r.service_code = :service_filter'; $params['service_filter'] = $serviceFilter; }
  if ($classification !== '') { $where[] = 'r.classification_level = :classification'; $params['classification'] = $classification; }
  if ($dateFrom !== '') { $where[] = 'DATE(r.occurred_at) >= :date_from'; $params['date_from'] = $dateFrom; }
  if ($dateTo !== '') { $where[] = 'DATE(r.occurred_at) <= :date_to'; $params['date_to'] = $dateTo; }
  if ($createdBy !== '') { $where[] = 'u.username LIKE :created_by'; $params['created_by'] = $createdLike; }

  $orderBy = match ($sort) {
    'oldest' => 'r.updated_at ASC',
    'type' => 'r.type_code ASC, r.updated_at DESC',
    'status' => 'r.status ASC, r.updated_at DESC',
    'service' => 'r.service_code ASC, r.updated_at DESC',
    default => 'r.updated_at DESC',
  };

  $sql = '
    SELECT r.id, r.report_number, r.title, r.type_code, r.status, r.classification_level, r.service_code, r.access_scope, r.occurred_at, r.location, r.created_at, r.updated_at, u.username AS created_by_username,
      (SELECT COUNT(*) FROM report_citizens rc WHERE rc.report_id = r.id) AS citizens_count,
      (SELECT COUNT(*) FROM report_vehicles rv WHERE rv.report_id = r.id) AS vehicles_count,
      (SELECT COUNT(*) FROM report_agents ra WHERE ra.report_id = r.id) AS agents_count
    FROM reports r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE ' . implode(' AND ', $where) . '
    ORDER BY ' . $orderBy . '
    LIMIT 160';
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $reports = array_values(array_filter($stmt->fetchAll(), static fn (array $report): bool => canUserAccessReport($GLOBALS['user'], $report, $GLOBALS['pdo'])));
  echo json_encode(['success' => true, 'reports' => $reports], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Erreur serveur: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
