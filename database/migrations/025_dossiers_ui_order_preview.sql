-- Migration MDT: Dossiers / tri manuel + logos de dossiers.
-- À exécuter après 024_dossiers_files_permissions.sql.

ALTER TABLE dossier_folders
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN logo_key VARCHAR(80) NOT NULL DEFAULT 'service' AFTER sort_order,
  ADD COLUMN logo_label VARCHAR(80) NULL AFTER logo_key;

ALTER TABLE dossier_files
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER status;

CREATE INDEX idx_dossier_folders_manual_order ON dossier_folders (service_code, parent_id, deleted_at, status, sort_order, updated_at);
CREATE INDEX idx_dossier_files_manual_order ON dossier_files (service_code, folder_id, deleted_at, status, sort_order, updated_at);
