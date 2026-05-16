-- Migration MDT: verrou d'édition MOTD par service.
-- Permet d'éviter que deux agents modifient la même annonce en même temps.

CREATE TABLE IF NOT EXISTS service_motd_locks (
  service_id INT NOT NULL PRIMARY KEY,
  user_id INT NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_motd_locks_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_motd_locks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
