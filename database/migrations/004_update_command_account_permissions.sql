-- Migration MDT: permissions de commandement sur les comptes.
-- Chief peut supprimer les comptes.
-- Sergeant et Lieutenant peuvent activer/desactiver et changer le grade RP, mais pas supprimer.

INSERT INTO permissions (code, label, description, is_active) VALUES
('accounts.change_rank', 'Modifier le grade RP', 'Permet de modifier le grade RP d un utilisateur selon les limites du rôle.', 1),
('accounts.delete', 'Supprimer les comptes', 'Permet de supprimer définitivement un compte utilisateur.', 1)
ON DUPLICATE KEY UPDATE
label = VALUES(label),
description = VALUES(description),
is_active = VALUES(is_active);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('accounts.change_rank')
WHERE r.code IN ('sergeant', 'lieutenant');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('accounts.delete')
WHERE r.code IN ('chief', 'super_admin');

DELETE rp
FROM role_permissions rp
INNER JOIN roles r ON r.id = rp.role_id
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE r.code IN ('sergeant', 'lieutenant')
AND p.code = 'accounts.delete';
