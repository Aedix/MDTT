-- Migration MDT: masque l'ancien type simple "Rapport d'arrestation".
-- Le nouveau type officiel est arrestation_dossier.
-- Les anciens rapports avec type_code = 'arrestation' restent consultables, mais ce type n'est plus proposé à la création.

UPDATE report_types
SET
  label = 'Rapport d’arrestation (ancien)',
  description = 'Ancien type simple conservé pour compatibilité. Utiliser Dossier d’arrestation pour les nouveaux documents.',
  is_active = 0
WHERE code = 'arrestation';

INSERT INTO report_types (code, label, description, sort_order, is_active) VALUES
  ('arrestation_dossier', 'Dossier d’arrestation', 'Document structuré pour les dossiers d’arrestation et d’interpellation.', 35, 1)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = 1;
