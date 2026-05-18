-- Migration MDT: nouveau type de rapport "Dossier d'arrestation".
-- Ajoute un champ structuré générique pour stocker les données spécifiques aux templates avancés.
-- Compatible avec une base où la colonne structured_data existe déjà.

INSERT INTO report_types (code, label, description, sort_order) VALUES
  ('arrestation_dossier', 'Dossier d’arrestation', 'Document structuré pour les dossiers d’arrestation et d’interpellation.', 35)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = 1;

SET @structured_data_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reports'
    AND COLUMN_NAME = 'structured_data'
);

SET @add_structured_data_sql := IF(
  @structured_data_exists = 0,
  'ALTER TABLE reports ADD COLUMN structured_data LONGTEXT NULL AFTER notes',
  'SELECT "reports.structured_data already exists" AS migration_notice'
);

PREPARE add_structured_data_statement FROM @add_structured_data_sql;
EXECUTE add_structured_data_statement;
DEALLOCATE PREPARE add_structured_data_statement;
