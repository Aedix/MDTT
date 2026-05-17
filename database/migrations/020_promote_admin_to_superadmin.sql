-- Corrige le compte technique Admin pour qu'il soit reconnu comme superadmin MDT.
-- À exécuter uniquement si le compte Admin doit réellement avoir les droits superadmin.

UPDATE users
SET role = 'super_admin'
WHERE username = 'Admin';
