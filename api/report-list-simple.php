<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
header('Content-Type: application/json; charset=utf-8');
$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$service = strtoupper(trim((string)($user['active_service_code'] ?? $user['service'] ?? 'MDT')));
$q = trim((string)($_GET['q'] ?? ''));
$like = '%' . $q . '%';
try {
  $sql = 'SELECT r.id, r.report_number, r.title, r.type_code, r.status, r.service_code, r.access_scope, r.occurred_at, r.location, r.created_at, u.username AS created_by_username FROM reports r LEFT JOIN users u ON u.id = r.created_by WHERE (r.service_code = ? OR r.access_scope = "interservice") AND (? = "" OR r.report_number LIKE ? OR r.title LIKE ? OR r.summary LIKE ? OR r.facts LIKE ? OR r.location LIKE ?) ORDER BY r.updated_at DESC LIMIT 120';
  $stmt = $pdo->prepare($sql);
  $stmt->execute([$service, $q, $like, $like, $like, $like, $like]);
  echo json_encode(['success' => true, 'reports' => $stmt->fetchAll()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Erreur serveur: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
