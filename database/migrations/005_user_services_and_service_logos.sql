-- Migration MDT: services multiples par utilisateur + chemins logos.
-- À exécuter après les migrations services/ranks.

ALTER TABLE services
ADD COLUMN logo_path VARCHAR(255) NULL AFTER name;

CREATE TABLE IF NOT EXISTS user_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  rank_id INT NULL,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_service (user_id, service_id),
  INDEX idx_user_services_user (user_id),
  INDEX idx_user_services_service (service_id),
  CONSTRAINT fk_user_services_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_services_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_services_rank FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE services SET logo_path = '/assets/services/fib.png' WHERE code = 'FIB';
UPDATE services SET logo_path = '/assets/services/lspd.png' WHERE code = 'LSPD';
UPDATE services SET logo_path = '/assets/services/sams.png' WHERE code = 'SAMS';

INSERT IGNORE INTO user_services (user_id, service_id, rank_id, is_primary, is_active)
SELECT u.id, s.id, r.id, 1, 1
FROM users u
INNER JOIN services s ON s.code = u.service
LEFT JOIN ranks r ON r.service_id = s.id AND r.name = u.rank_name
WHERE u.service IS NOT NULL
  AND u.service <> '';
