-- Migration MDT: permission de suppression de compte.
-- À exécuter après les migrations roles/permissions.

INSERT INTO permissions (code, label, description, is_active) VALUES
('accounts.delete', 'Supprimer les comptes', 'Permet de supprimer définitivement un compte utilisateur.', 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label),
description = VALUES(description),
is_active = VALUES(is_active);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'accounts.delete'
WHERE r.code = 'super_admin';
