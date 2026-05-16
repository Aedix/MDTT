<?php

declare(strict_types=1);

function touchRealtimeVersion(PDO $pdo, int $serviceId): void
{
    if ($serviceId <= 0) {
        return;
    }

    try {
        $statement = $pdo->prepare(
            'INSERT INTO realtime_versions (service_id, version)
             VALUES (:service_id, 1)
             ON DUPLICATE KEY UPDATE
               version = version + 1,
               updated_at = CURRENT_TIMESTAMP'
        );
        $statement->execute(['service_id' => $serviceId]);
    } catch (Throwable $exception) {
        // Si la migration n'est pas encore exécutée, on ne bloque pas l'action métier.
    }
}

function getRealtimeVersion(PDO $pdo, int $serviceId): int
{
    if ($serviceId <= 0) {
        return 0;
    }

    try {
        $statement = $pdo->prepare('SELECT version FROM realtime_versions WHERE service_id = :service_id LIMIT 1');
        $statement->execute(['service_id' => $serviceId]);
        $version = $statement->fetchColumn();

        if ($version === false) {
            return 0;
        }

        return (int) $version;
    } catch (Throwable $exception) {
        return 0;
    }
}
