-- Migration MDT: nouveau type de rapport "Dossier d'arrestation".
-- Ajoute un champ structuré générique pour stocker les données spécifiques aux templates avancés.

INSERT INTO report_types (code, label, description, sort_order) VALUES
  ('arrestation_dossier', 'Dossier d’arrestation', 'Document structuré pour les dossiers d’arrestation et d’interpellation.', 35)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = 1;

ALTER TABLE reports
  ADD COLUMN structured_data LONGTEXT NULL AFTER notes;
