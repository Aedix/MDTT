-- Migration MDT: MOTD service + chemins logos standardisés.
-- À exécuter après les migrations services/user_services.

ALTER TABLE services
ADD COLUMN motd_title VARCHAR(160) NULL AFTER logo_path,
ADD COLUMN motd_body TEXT NULL AFTER motd_title,
ADD COLUMN motd_updated_at DATETIME NULL AFTER motd_body,
ADD COLUMN motd_updated_by INT NULL AFTER motd_updated_at;

UPDATE services SET logo_path = '/assets/services/fib_logo.png' WHERE code = 'FIB';
UPDATE services SET logo_path = '/assets/services/lspd_logo.png' WHERE code = 'LSPD';
UPDATE services SET logo_path = '/assets/services/sams_logo.png' WHERE code = 'SAMS';

UPDATE services
SET motd_title = 'Annonce opérationnelle',
    motd_body = 'Aucune annonce active pour le moment.',
    motd_updated_at = NOW()
WHERE motd_title IS NULL;

INSERT INTO permissions (code, label, description, is_active) VALUES
('service.motd.update', 'Modifier le MOTD service', 'Permet de modifier l annonce du service actif.', 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label),
description = VALUES(description),
is_active = VALUES(is_active);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'service.motd.update'
WHERE r.code IN ('sergeant', 'lieutenant', 'chief', 'admin', 'super_admin');
