-- Migration MDT: notes interservices + notes internes par service.
-- citizens.notes reste la note interservices visible par tous les services autorisés.
-- citizen_service_notes stocke une note privée par citoyen et par service actif (FIB, LSPD, SAMS, etc.).

CREATE TABLE IF NOT EXISTS citizen_service_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT NOT NULL,
  service_code VARCHAR(32) NOT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_citizen_service_note (citizen_id, service_code),
  INDEX idx_citizen_service_notes_citizen (citizen_id),
  INDEX idx_citizen_service_notes_service (service_code),
  CONSTRAINT fk_citizen_service_notes_citizen
    FOREIGN KEY (citizen_id) REFERENCES citizens(id)
    ON DELETE CASCADE
);
