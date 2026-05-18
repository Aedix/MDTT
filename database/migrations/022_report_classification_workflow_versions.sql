-- Migration 022: classification, workflow enrichi, versions et indexes rapports.
-- Safe / relançable.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD COLUMN classification_level VARCHAR(40) NOT NULL DEFAULT ''internal'' AFTER status',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'classification_level'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE reports ADD COLUMN command_staff_comment TEXT NULL AFTER notes',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reports' AND COLUMN_NAME = 'command_staff_comment'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS report_versions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id INT UNSIGNED NOT NULL,
  version_number INT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  snapshot LONGTEXT NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_report_versions_number (report_id, version_number),
  KEY idx_report_versions_report (report_id),
  KEY idx_report_versions_created_by (created_by),
  CONSTRAINT fk_report_versions_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_versions_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_reports_type_code ON reports(type_code);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_service_code ON reports(service_code);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_occurred_at ON reports(occurred_at);
CREATE INDEX IF NOT EXISTS idx_reports_report_number ON reports(report_number);
CREATE INDEX IF NOT EXISTS idx_reports_classification_level ON reports(classification_level);
CREATE INDEX IF NOT EXISTS idx_report_citizens_citizen ON report_citizens(citizen_id);
CREATE INDEX IF NOT EXISTS idx_report_vehicles_vehicle ON report_vehicles(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_report_agents_user ON report_agents(user_id);

UPDATE reports
SET classification_level = CASE
  WHEN access_scope = 'directors' THEN 'restricted_cs'
  WHEN access_scope = 'interservice' THEN 'declassified'
  WHEN access_scope = 'supervisors' THEN 'confidential'
  ELSE 'internal'
END
WHERE classification_level IS NULL OR classification_level = '';
