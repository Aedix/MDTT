-- Migration MDT: module Dossiers / gestion documentaire.
-- Phase 1 : vraie structure de dossiers + logs basiques.
-- Les fichiers seront ajoutés dans une migration dédiée lors de la phase upload.

CREATE TABLE IF NOT EXISTS dossier_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NULL,
  service_code VARCHAR(32) NOT NULL,
  parent_id INT NULL,
  owner_user_id INT NULL,
  name VARCHAR(140) NOT NULL,
  description TEXT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'general',
  confidentiality_level ENUM('private','service','restricted','confidential') NOT NULL DEFAULT 'service',
  status ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_dossier_folders_service_parent (service_code, parent_id, deleted_at),
  INDEX idx_dossier_folders_service_status (service_code, status, deleted_at),
  INDEX idx_dossier_folders_owner (owner_user_id),
  INDEX idx_dossier_folders_parent (parent_id),
  FULLTEXT INDEX ft_dossier_folders_search (name, description),
  CONSTRAINT fk_dossier_folders_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_dossier_folders_parent FOREIGN KEY (parent_id) REFERENCES dossier_folders(id) ON DELETE SET NULL,
  CONSTRAINT fk_dossier_folders_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NULL,
  service_code VARCHAR(32) NOT NULL,
  target_type ENUM('folder','file') NOT NULL,
  target_id INT NOT NULL,
  action VARCHAR(80) NOT NULL,
  details TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dossier_logs_target (target_type, target_id, created_at),
  INDEX idx_dossier_logs_service (service_code, created_at),
  INDEX idx_dossier_logs_user (created_by),
  CONSTRAINT fk_dossier_logs_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_dossier_logs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
