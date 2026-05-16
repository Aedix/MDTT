-- Migration MDT: commentaire court sur les unités dispatch existantes.
-- À exécuter si la table dispatch_units existe déjà sans colonne comment.

ALTER TABLE dispatch_units
ADD COLUMN comment VARCHAR(160) NULL AFTER status;
