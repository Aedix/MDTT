-- Rapport de test accessible à tous les services autorisés.
-- À exécuter après les migrations 016 et 017.

INSERT INTO reports
(report_number, title, type_code, status, service_code, division_id, access_scope, minimum_role_code, minimum_power_level, occurred_at, location, summary, facts, actions_taken, conclusions, notes, created_by, updated_by)
SELECT
  'FIB-TEST-2026-0001',
  'Intervention contrôle véhicule - Mirror Park',
  'intervention',
  'submitted',
  'FIB',
  NULL,
  'interservice',
  NULL,
  0,
  '2026-05-16 21:35:00',
  'Mirror Park, Los Santos',
  'Contrôle d’un véhicule signalé comme suspect à proximité de Mirror Park.',
  'Le 16/05/2026 à 21h35, une unité FIB a procédé au contrôle d’un véhicule stationné à proximité de Mirror Park. Le conducteur a été identifié et aucun comportement hostile n’a été constaté durant l’intervention. Une vérification visuelle du véhicule a été effectuée. Aucun élément dangereux apparent n’a été relevé sur place. Le secteur a ensuite été sécurisé et l’unité a repris sa patrouille.',
  'Contrôle d’identité du conducteur. Vérification du véhicule. Signalement transmis aux unités disponibles. Aucun renfort nécessaire.',
  'Incident clos sans arrestation. Le rapport reste consultable à titre informatif pour les services concernés.',
  'Rapport de test créé pour valider l’affichage, les accès interservices et l’export PDF.',
  (SELECT id FROM users ORDER BY id ASC LIMIT 1),
  (SELECT id FROM users ORDER BY id ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM reports WHERE report_number = 'FIB-TEST-2026-0001');
