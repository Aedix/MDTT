-- Migration MDT: corrections module Rapports.
-- Ajoute l'accès interservice, retire l'usage UI du power level, ajoute l'emplacement d'incident/opération.

ALTER TABLE reports
  MODIFY access_scope ENUM('service','interservice','division','supervisors','directors','explicit') NOT NULL DEFAULT 'service';

ALTER TABLE reports
  ADD COLUMN location VARCHAR(180) NULL AFTER occurred_at;
