-- Migration MDT: module Dossiers / fichiers, permissions, favoris, récents et liaisons.
-- À exécuter après 023_dossiers_module.sql.

CREATE TABLE IF NOT EXISTS dossier_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_id INT NULL,
  service_id INT NULL,
  service_code VARCHAR(32) NOT NULL,
  owner_user_id INT NULL,
  original_name VARCHAR(180) NOT NULL,
  stored_name VARCHAR(180) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  extension VARCHAR(20) NOT NULL,
  size_bytes INT NOT NULL DEFAULT 0,
  file_path VARCHAR(255) NOT NULL,
  description TEXT NULL,
  confidentiality_level ENUM('private','service','restricted','confidential') NOT NULL DEFAULT 'service',
  status ENUM('active','archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_dossier_files_folder (folder_id, deleted_at),
  INDEX idx_dossier_files_service (service_code, deleted_at),
  INDEX idx_dossier_files_owner (owner_user_id),
  FULLTEXT INDEX ft_dossier_files_search (original_name, description),
  CONSTRAINT fk_dossier_files_folder FOREIGN KEY (folder_id) REFERENCES dossier_folders(id) ON DELETE SET NULL,
  CONSTRAINT fk_dossier_files_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_dossier_files_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type ENUM('folder','file') NOT NULL,
  target_id INT NOT NULL,
  subject_type ENUM('user','service','rank') NOT NULL,
  subject_value VARCHAR(80) NOT NULL,
  permission ENUM('view','upload','edit','delete','restore','download','share','manage_access','archive','owner') NOT NULL DEFAULT 'view',
  expires_at DATETIME NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dossier_permission (target_type, target_id, subject_type, subject_value, permission),
  INDEX idx_dossier_permissions_target (target_type, target_id),
  INDEX idx_dossier_permissions_subject (subject_type, subject_value),
  CONSTRAINT fk_dossier_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  target_type ENUM('folder','file') NOT NULL,
  target_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dossier_favorite (user_id, target_type, target_id),
  INDEX idx_dossier_favorites_user (user_id),
  CONSTRAINT fk_dossier_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_recent_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  target_type ENUM('folder','file') NOT NULL,
  target_id INT NOT NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dossier_recent (user_id, target_type, target_id),
  INDEX idx_dossier_recent_user_time (user_id, viewed_at),
  CONSTRAINT fk_dossier_recent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type ENUM('folder','file') NOT NULL,
  target_id INT NOT NULL,
  linked_type VARCHAR(40) NOT NULL,
  linked_id INT NOT NULL,
  label VARCHAR(160) NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dossier_links_target (target_type, target_id),
  INDEX idx_dossier_links_linked (linked_type, linked_id),
  CONSTRAINT fk_dossier_links_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_code VARCHAR(32) NOT NULL,
  name VARCHAR(60) NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_dossier_tag_service_name (service_code, name),
  CONSTRAINT fk_dossier_tags_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dossier_tag_links (
  tag_id INT NOT NULL,
  target_type ENUM('folder','file') NOT NULL,
  target_id INT NOT NULL,
  PRIMARY KEY (tag_id, target_type, target_id),
  INDEX idx_dossier_tag_links_target (target_type, target_id),
  CONSTRAINT fk_dossier_tag_links_tag FOREIGN KEY (tag_id) REFERENCES dossier_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
