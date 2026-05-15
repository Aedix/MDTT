-- Migration MDT: prise de service / timeclock.
-- À exécuter après les migrations users/services/user_services.

CREATE TABLE IF NOT EXISTS service_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_id INT NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  total_seconds INT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'on_duty',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_service_shifts_user_active (user_id, ended_at),
  INDEX idx_service_shifts_service_active (service_id, ended_at),
  CONSTRAINT fk_service_shifts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_service_shifts_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
