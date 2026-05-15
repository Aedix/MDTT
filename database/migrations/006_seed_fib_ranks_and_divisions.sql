-- Migration MDT: structure FIB initiale.
-- Objectif: poser les grades FIB propres et les premières divisions FIB.
-- À exécuter après les migrations services/ranks/user_services.

CREATE TABLE IF NOT EXISTS divisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_division_per_service (service_id, code),
  INDEX idx_divisions_service (service_id),
  CONSTRAINT fk_divisions_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_divisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  division_id INT NOT NULL,
  is_supervisor TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_division (user_id, division_id),
  INDEX idx_user_divisions_user (user_id),
  INDEX idx_user_divisions_division (division_id),
  CONSTRAINT fk_user_divisions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_divisions_division FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nettoyage uniquement des anciens grades FIB de seed générique, sans toucher aux autres services.
UPDATE ranks r
INNER JOIN services s ON s.id = r.service_id
SET r.is_active = 0
WHERE s.code = 'FIB';

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'trainee_agent', 'Trainee Agent', 10, 10, 0, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'federal_agent', 'Federal Agent', 20, 20, 0, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'special_agent', 'Special Agent', 30, 30, 0, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'senior_special_agent', 'Senior Special Agent', 40, 40, 0, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'agent_supervisor', 'Agent Supervisor', 50, 50, 1, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'agent_executive_supervisor', 'Agent Executive Supervisor', 60, 60, 1, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'deputy_director', 'Deputy Director', 90, 90, 1, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'director', 'Director', 100, 100, 1, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO divisions (service_id, code, name, sort_order, is_active)
SELECT s.id, 'hostage_rescue', 'Hostage Rescue', 10, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO divisions (service_id, code, name, sort_order, is_active)
SELECT s.id, 'crime_investigation', 'Crime Investigation', 20, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO divisions (service_id, code, name, sort_order, is_active)
SELECT s.id, 'financial_crime', 'Financial Crime', 30, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO divisions (service_id, code, name, sort_order, is_active)
SELECT s.id, 'digital_forensics', 'Digital Forensics', 40, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO divisions (service_id, code, name, sort_order, is_active)
SELECT s.id, 'media_relation', 'Media Relation', 50, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO divisions (service_id, code, name, sort_order, is_active)
SELECT s.id, 'recruit_team', 'Recruit Team', 60, 1 FROM services s WHERE s.code = 'FIB'
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = VALUES(is_active);
