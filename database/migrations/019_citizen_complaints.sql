-- Migration MDT: plaintes liées aux citoyens.
-- Les rapports liés utilisent déjà report_citizens.

CREATE TABLE IF NOT EXISTS citizen_complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  complainant_name VARCHAR(140) NULL,
  complaint_date DATE NULL,
  location VARCHAR(180) NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'Ouverte',
  description TEXT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_citizen_complaints_citizen (citizen_id),
  INDEX idx_citizen_complaints_status (status),
  CONSTRAINT fk_citizen_complaints_citizen
    FOREIGN KEY (citizen_id) REFERENCES citizens(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_citizen_complaints_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_citizen_complaints_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
