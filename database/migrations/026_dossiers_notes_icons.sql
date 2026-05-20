-- Migration MDT: Dossiers / notes enrichies + icônes de dossiers.
-- À exécuter après 025_dossiers_ui_order_preview.sql.

ALTER TABLE dossier_folders
  ADD COLUMN icon_key VARCHAR(80) NOT NULL DEFAULT 'folder' AFTER logo_label,
  ADD COLUMN icon_path VARCHAR(255) NULL AFTER icon_key;

CREATE INDEX idx_dossier_folders_icon_key ON dossier_folders (service_code, icon_key);
