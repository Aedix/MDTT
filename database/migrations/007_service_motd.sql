-- Migration MDT: MOTD / annonce par service.
-- À exécuter après la migration services.

CREATE TABLE IF NOT EXISTS service_motd (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL DEFAULT 'Annonce service',
  body TEXT NOT NULL,
  updated_by INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_motd_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_motd_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO service_motd (service_id, title, body)
SELECT id, 'Annonce FIB', 'Aucune annonce prioritaire pour le moment.'
FROM services
WHERE code = 'FIB'
ON DUPLICATE KEY UPDATE title = VALUES(title);

UPDATE services SET logo_path = '/assets/img/services/fib_logo.png' WHERE code = 'FIB';
UPDATE services SET logo_path = '/assets/img/services/lspd_logo.png' WHERE code = 'LSPD';
UPDATE services SET logo_path = '/assets/img/services/sams_logo.png' WHERE code = 'SAMS';
