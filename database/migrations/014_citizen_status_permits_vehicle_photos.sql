-- Migration MDT: état citoyen, permis et photos véhicules.
-- À exécuter après 013_citizens_vehicles_records.sql.

ALTER TABLE citizens
  ADD COLUMN health_status ENUM('alive', 'deceased') NOT NULL DEFAULT 'alive' AFTER photo_path,
  ADD COLUMN has_driver_license TINYINT(1) NOT NULL DEFAULT 0 AFTER health_status,
  ADD COLUMN has_weapon_license TINYINT(1) NOT NULL DEFAULT 0 AFTER has_driver_license;

ALTER TABLE citizen_vehicles
  ADD COLUMN photo_path VARCHAR(255) NULL AFTER registration_status;
