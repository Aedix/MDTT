-- Migration MDT: roles, permissions, services et ranks.
-- À exécuter dans phpMyAdmin ou dans l'outil SQL de l'hébergeur.
-- Si la colonne users.role existe déjà, ignore la première requête ALTER TABLE.

ALTER TABLE users
ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user' AFTER rank_name;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  power_level INT NOT NULL DEFAULT 10,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 1,
  is_command TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rank_per_service (service_id, code),
  INDEX idx_ranks_service_level (service_id, level),
  CONSTRAINT fk_ranks_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (code, label, power_level, is_system, is_active) VALUES
('user', 'User', 10, 1, 1),
('officer', 'Officer', 10, 1, 1),
('senior', 'Senior Officer', 10, 1, 1),
('sergeant', 'Sergeant', 40, 1, 1),
('lieutenant', 'Lieutenant', 50, 1, 1),
('chief', 'Chief', 80, 1, 1),
('admin', 'Admin MDT', 90, 1, 1),
('super_admin', 'Super Admin MDT', 100, 1, 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label),
power_level = VALUES(power_level),
is_system = VALUES(is_system),
is_active = VALUES(is_active);

INSERT INTO permissions (code, label, description, is_active) VALUES
('mdt.access', 'Accès MDT', 'Permet de se connecter au MDT.', 1),
('panel.access', 'Accès panel de gestion', 'Permet d’ouvrir le panel de gestion.', 1),
('service.full_access', 'Full access service', 'Donne le contrôle complet sur son service, hors actions système sensibles.', 1),
('accounts.view', 'Voir les comptes', 'Permet de consulter les comptes utilisateurs.', 1),
('accounts.activate', 'Activer les comptes', 'Permet d’activer les comptes en attente.', 1),
('accounts.deactivate', 'Désactiver les comptes', 'Permet de désactiver un compte.', 1),
('accounts.change_rank', 'Modifier le grade', 'Permet de modifier le grade RP d’un utilisateur.', 1),
('accounts.reset_password', 'Reset password', 'Permet de réinitialiser un mot de passe.', 1),
('ranks.view', 'Voir les grades', 'Permet de consulter les grades.', 1),
('ranks.create', 'Créer des grades', 'Permet de créer des grades dans un service.', 1),
('ranks.rename', 'Renommer des grades', 'Permet de renommer un grade.', 1),
('ranks.move', 'Déplacer des grades', 'Permet de changer l’ordre ou le niveau des grades.', 1),
('ranks.delete', 'Supprimer des grades', 'Permet de supprimer ou désactiver un grade.', 1),
('roles.view', 'Voir les rôles MDT', 'Permet de consulter les rôles techniques.', 1),
('roles.assign', 'Attribuer les rôles MDT', 'Permet d’attribuer un rôle technique à un utilisateur.', 1),
('permissions.view', 'Voir les permissions', 'Permet de consulter la matrice de permissions.', 1),
('permissions.manage', 'Modifier les permissions', 'Permet de modifier les permissions des rôles depuis le MDT.', 1),
('services.view', 'Voir les services', 'Permet de consulter les services.', 1),
('services.manage', 'Modifier les services', 'Permet de créer ou modifier les services.', 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label),
description = VALUES(description),
is_active = VALUES(is_active);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('mdt.access')
WHERE r.code IN ('user', 'officer', 'senior')
ON DUPLICATE KEY UPDATE role_id = role_id;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('mdt.access', 'panel.access', 'accounts.view', 'accounts.activate', 'accounts.deactivate')
WHERE r.code IN ('sergeant', 'lieutenant')
ON DUPLICATE KEY UPDATE role_id = role_id;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('mdt.access', 'panel.access', 'service.full_access', 'accounts.view', 'accounts.activate', 'accounts.deactivate', 'accounts.change_rank', 'ranks.view', 'ranks.create', 'ranks.rename', 'ranks.move', 'ranks.delete')
WHERE r.code = 'chief'
ON DUPLICATE KEY UPDATE role_id = role_id;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('mdt.access', 'panel.access', 'service.full_access', 'accounts.view', 'accounts.activate', 'accounts.deactivate', 'accounts.change_rank', 'accounts.reset_password', 'ranks.view', 'ranks.create', 'ranks.rename', 'ranks.move', 'ranks.delete', 'roles.view', 'roles.assign', 'permissions.view')
WHERE r.code = 'admin'
ON DUPLICATE KEY UPDATE role_id = role_id;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('mdt.access', 'panel.access', 'service.full_access', 'accounts.view', 'accounts.activate', 'accounts.deactivate', 'accounts.change_rank', 'accounts.reset_password', 'ranks.view', 'ranks.create', 'ranks.rename', 'ranks.move', 'ranks.delete', 'roles.view', 'roles.assign', 'permissions.view', 'permissions.manage', 'services.view', 'services.manage')
WHERE r.code = 'super_admin'
ON DUPLICATE KEY UPDATE role_id = role_id;

INSERT INTO services (code, name, is_active) VALUES
('FIB', 'Federal Investigation Bureau', 1),
('LSPD', 'Los Santos Police Department', 1),
('SAMS', 'San Andreas Medical Services', 1)
ON DUPLICATE KEY UPDATE
name = VALUES(name),
is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'officer', 'Officer', 10, 10, 0, 1 FROM services s WHERE s.code IN ('FIB', 'LSPD')
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'senior', 'Senior Officer', 20, 20, 0, 1 FROM services s WHERE s.code IN ('FIB', 'LSPD')
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'sergeant', 'Sergeant', 40, 40, 1, 1 FROM services s WHERE s.code IN ('FIB', 'LSPD')
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'lieutenant', 'Lieutenant', 50, 50, 1, 1 FROM services s WHERE s.code IN ('FIB', 'LSPD')
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'chief', 'Chief', 80, 80, 1, 1 FROM services s WHERE s.code IN ('FIB', 'LSPD')
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'paramedic', 'Paramedic', 10, 10, 0, 1 FROM services s WHERE s.code = 'SAMS'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'doctor', 'Doctor', 40, 40, 1, 1 FROM services s WHERE s.code = 'SAMS'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);

INSERT INTO ranks (service_id, code, name, level, sort_order, is_command, is_active)
SELECT s.id, 'chief', 'Chief', 80, 80, 1, 1 FROM services s WHERE s.code = 'SAMS'
ON DUPLICATE KEY UPDATE name = VALUES(name), level = VALUES(level), sort_order = VALUES(sort_order), is_command = VALUES(is_command), is_active = VALUES(is_active);
