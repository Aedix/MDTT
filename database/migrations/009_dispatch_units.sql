-- Migration MDT: dispatch / unités opérationnelles.
-- À exécuter après les migrations services, users, divisions et service_shifts.

CREATE TABLE IF NOT EXISTS dispatch_units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  division_id INT NULL,
  name VARCHAR(80) NOT NULL,
  status VARCHAR(80) NOT NULL DEFAULT 'Disponible',
  ppa_level VARCHAR(20) NOT NULL DEFAULT 'PPA I',
  created_by INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  INDEX idx_dispatch_units_service_active (service_id, is_active),
  INDEX idx_dispatch_units_division (division_id),
  CONSTRAINT fk_dispatch_units_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT fk_dispatch_units_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE SET NULL,
  CONSTRAINT fk_dispatch_units_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispatch_unit_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unit_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_dispatch_members_unit_active (unit_id, is_active),
  INDEX idx_dispatch_members_user_active (user_id, is_active),
  CONSTRAINT fk_dispatch_members_unit FOREIGN KEY (unit_id) REFERENCES dispatch_units(id) ON DELETE CASCADE,
  CONSTRAINT fk_dispatch_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
