-- Migration MDT: module Rapports.
-- Le contenu structuré en BDD est la source principale.
-- Le PDF / export est généré depuis ces données.

CREATE TABLE IF NOT EXISTS report_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO report_types (code, label, description, sort_order) VALUES
  ('intervention', 'Rapport d’intervention', 'Rapport lié à une intervention opérationnelle.', 10),
  ('incident', 'Rapport d’incident', 'Rapport lié à un incident ou événement notable.', 20),
  ('arrestation', 'Rapport d’arrestation', 'Rapport lié à une arrestation ou interpellation.', 30),
  ('operation', 'Rapport d’opération', 'Rapport lié à une opération planifiée.', 40),
  ('interne', 'Rapport interne', 'Rapport interne au service.', 50),
  ('renseignement', 'Rapport de renseignement', 'Rapport contenant des informations de renseignement.', 60),
  ('patrouille', 'Compte-rendu de patrouille', 'Compte-rendu de patrouille ou activité terrain.', 70)
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), sort_order = VALUES(sort_order), is_active = 1;

CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_number VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  type_code VARCHAR(60) NOT NULL,
  status ENUM('draft','submitted','pending_validation','validated','archived','rejected') NOT NULL DEFAULT 'draft',
  service_code VARCHAR(32) NOT NULL,
  division_id INT NULL,
  access_scope ENUM('service','division','supervisors','directors','explicit') NOT NULL DEFAULT 'service',
  minimum_role_code VARCHAR(60) NULL,
  minimum_power_level INT NOT NULL DEFAULT 0,
  occurred_at DATETIME NULL,
  summary TEXT NULL,
  facts TEXT NULL,
  actions_taken TEXT NULL,
  conclusions TEXT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reports_number (report_number),
  INDEX idx_reports_service (service_code),
  INDEX idx_reports_type (type_code),
  INDEX idx_reports_status (status),
  INDEX idx_reports_division (division_id),
  INDEX idx_reports_created_by (created_by),
  FULLTEXT INDEX ft_reports_search (report_number, title, summary, facts, actions_taken, conclusions, notes),
  CONSTRAINT fk_reports_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_citizens (
  report_id INT NOT NULL,
  citizen_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL DEFAULT 'concerned',
  PRIMARY KEY (report_id, citizen_id, relation_type),
  INDEX idx_report_citizens_citizen (citizen_id),
  CONSTRAINT fk_report_citizens_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_citizens_citizen FOREIGN KEY (citizen_id) REFERENCES citizens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_vehicles (
  report_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL DEFAULT 'involved',
  PRIMARY KEY (report_id, vehicle_id, relation_type),
  INDEX idx_report_vehicles_vehicle (vehicle_id),
  CONSTRAINT fk_report_vehicles_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_vehicles_vehicle FOREIGN KEY (vehicle_id) REFERENCES citizen_vehicles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_agents (
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  relation_type VARCHAR(60) NOT NULL DEFAULT 'involved',
  PRIMARY KEY (report_id, user_id, relation_type),
  INDEX idx_report_agents_user (user_id),
  CONSTRAINT fk_report_agents_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_agents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_allowed_users (
  report_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (report_id, user_id),
  INDEX idx_report_allowed_users_user (user_id),
  CONSTRAINT fk_report_allowed_users_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_allowed_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  original_name VARCHAR(180) NULL,
  mime_type VARCHAR(120) NULL,
  size_bytes INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_attachments_report (report_id),
  CONSTRAINT fk_report_attachments_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_attachments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  action VARCHAR(80) NOT NULL,
  details TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_report_logs_report (report_id),
  CONSTRAINT fk_report_logs_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_logs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
