-- Migration MDT: version légère de synchronisation temps réel.
-- Le dashboard interroge cette table pour savoir s'il doit recharger l'état complet.

CREATE TABLE IF NOT EXISTS realtime_versions (
  service_id INT NOT NULL PRIMARY KEY,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_realtime_versions_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO realtime_versions (service_id, version)
SELECT id, 1
FROM services
ON DUPLICATE KEY UPDATE version = version;
