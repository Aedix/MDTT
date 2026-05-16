<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/realtime.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$serviceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');
$data = json_decode(file_get_contents('php://input') ?: '', true);
$action = is_array($data) ? (string) ($data['action'] ?? 'status') : 'status';

if ($serviceCode === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Service actif introuvable.']);
    exit;
}

$serviceStatement = $pdo->prepare('SELECT id FROM services WHERE code = :code AND is_active = 1 LIMIT 1');
$serviceStatement->execute(['code' => $serviceCode]);
$service = $serviceStatement->fetch();

if (!$service) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

$serviceId = (int) $service['id'];
$userId = (int) $user['id'];

function getMotdLock(PDO $pdo, int $serviceId): ?array
{
    $statement = $pdo->prepare(
        'SELECT l.service_id, l.user_id, l.heartbeat_at, u.username
         FROM service_motd_locks l
         INNER JOIN users u ON u.id = l.user_id
         WHERE l.service_id = :service_id
         LIMIT 1'
    );
    $statement->execute(['service_id' => $serviceId]);
    $lock = $statement->fetch();

    return $lock ?: null;
}

function clearExpiredMotdLock(PDO $pdo, int $serviceId): void
{
    $statement = $pdo->prepare(
        'DELETE FROM service_motd_locks
         WHERE service_id = :service_id
           AND heartbeat_at < (NOW() - INTERVAL 45 SECOND)'
    );
    $statement->execute(['service_id' => $serviceId]);
}

function emitLockResponse(PDO $pdo, int $serviceId, int $currentUserId): void
{
    $lock = getMotdLock($pdo, $serviceId);

    echo json_encode([
        'success' => true,
        'version' => getRealtimeVersion($pdo, $serviceId),
        'lock' => [
            'is_locked' => (bool) $lock,
            'is_locked_by_me' => $lock ? ((int) $lock['user_id'] === $currentUserId) : false,
            'user_id' => $lock ? (int) $lock['user_id'] : null,
            'username' => $lock ? (string) $lock['username'] : null,
            'heartbeat_at' => $lock ? (string) $lock['heartbeat_at'] : null,
        ],
    ], JSON_UNESCAPED_UNICODE);
}

try {
    clearExpiredMotdLock($pdo, $serviceId);

    if ($action === 'acquire') {
        $lock = getMotdLock($pdo, $serviceId);

        if ($lock && (int) $lock['user_id'] !== $userId) {
            emitLockResponse($pdo, $serviceId, $userId);
            exit;
        }

        $statement = $pdo->prepare(
            'INSERT INTO service_motd_locks (service_id, user_id, locked_at, heartbeat_at)
             VALUES (:service_id, :user_id, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
               user_id = VALUES(user_id),
               heartbeat_at = NOW()'
        );
        $statement->execute(['service_id' => $serviceId, 'user_id' => $userId]);
        touchRealtimeVersion($pdo, $serviceId);
        emitLockResponse($pdo, $serviceId, $userId);
        exit;
    }

    if ($action === 'heartbeat') {
        $statement = $pdo->prepare(
            'UPDATE service_motd_locks
             SET heartbeat_at = NOW()
             WHERE service_id = :service_id
               AND user_id = :user_id'
        );
        $statement->execute(['service_id' => $serviceId, 'user_id' => $userId]);
        emitLockResponse($pdo, $serviceId, $userId);
        exit;
    }

    if ($action === 'release') {
        $statement = $pdo->prepare(
            'DELETE FROM service_motd_locks
             WHERE service_id = :service_id
               AND user_id = :user_id'
        );
        $statement->execute(['service_id' => $serviceId, 'user_id' => $userId]);
        touchRealtimeVersion($pdo, $serviceId);
        emitLockResponse($pdo, $serviceId, $userId);
        exit;
    }

    emitLockResponse($pdo, $serviceId, $userId);
} catch (Throwable $exception) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Verrou MOTD indisponible.']);
}
