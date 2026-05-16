-- Migration MDT: recherches citoyens, véhicules et casier judiciaire.
-- À exécuter après les migrations utilisateurs/services existantes.

CREATE TABLE IF NOT EXISTS citizens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  birth_date DATE NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  job VARCHAR(120) NULL,
  hair_color VARCHAR(80) NULL,
  eye_color VARCHAR(80) NULL,
  height_cm SMALLINT UNSIGNED NULL,
  physical_details TEXT NULL,
  affiliation VARCHAR(160) NULL,
  known_organization VARCHAR(160) NULL,
  known_criminal_group VARCHAR(160) NULL,
  special_status VARCHAR(160) NULL,
  notes TEXT NULL,
  photo_path VARCHAR(255) NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_citizens_name (last_name, first_name),
  INDEX idx_citizens_phone (phone),
  FULLTEXT INDEX ft_citizens_search (first_name, last_name, phone, address, job, affiliation, known_organization, known_criminal_group, special_status, notes),
  CONSTRAINT fk_citizens_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_citizens_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT NOT NULL,
  plate VARCHAR(32) NOT NULL,
  model VARCHAR(120) NULL,
  color VARCHAR(80) NULL,
  category VARCHAR(80) NULL,
  registration_status VARCHAR(80) NOT NULL DEFAULT 'Actif',
  notes TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_citizen_vehicles_plate (plate),
  INDEX idx_citizen_vehicles_citizen (citizen_id),
  INDEX idx_citizen_vehicles_plate (plate),
  FULLTEXT INDEX ft_vehicle_search (plate, model, color, category, registration_status, notes),
  CONSTRAINT fk_citizen_vehicles_citizen FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
  CONSTRAINT fk_citizen_vehicles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_citizen_vehicles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS criminal_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT NOT NULL,
  offense_date DATE NULL,
  offense_type VARCHAR(160) NOT NULL,
  description TEXT NULL,
  case_status VARCHAR(80) NOT NULL DEFAULT 'Ouvert',
  sanction VARCHAR(255) NULL,
  notes TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_criminal_records_citizen (citizen_id),
  INDEX idx_criminal_records_date (offense_date),
  CONSTRAINT fk_criminal_records_citizen FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE,
  CONSTRAINT fk_criminal_records_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_criminal_records_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id INT NULL,
  action VARCHAR(60) NOT NULL,
  details TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_citizen_logs_citizen (citizen_id),
  INDEX idx_citizen_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_citizen_logs_citizen FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE SET NULL,
  CONSTRAINT fk_citizen_logs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
