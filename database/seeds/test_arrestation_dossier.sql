-- Seed de test MDT: dossier d'arrestation complet.
-- À exécuter uniquement sur l'environnement de test.
-- Relançable: supprime/recrée le rapport FIB-AD-TEST-001.
-- Fix collation: toutes les chaînes sensibles sont forcées en utf8mb4_unicode_ci pour éviter l'erreur SQL 1267.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @test_report_number := CONVERT('FIB-AD-TEST-001' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @service_code := CONVERT('FIB' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @suspect_first_name := CONVERT('Ethan' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @suspect_last_name := CONVERT('Vargas' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @suspect_birth_date := DATE('1994-04-18');
SET @vehicle_plate := CONVERT('FIB-742' USING utf8mb4) COLLATE utf8mb4_unicode_ci;

INSERT INTO report_types (code, label, description, sort_order, is_active) VALUES
  ('arrestation_dossier', 'Dossier d’arrestation', 'Document structuré pour les dossiers d’arrestation et d’interpellation.', 35, 1)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = 1;

SELECT id INTO @existing_report_id
FROM reports
WHERE report_number COLLATE utf8mb4_unicode_ci = @test_report_number
LIMIT 1;

DELETE FROM report_citizens WHERE report_id = @existing_report_id;
DELETE FROM report_vehicles WHERE report_id = @existing_report_id;
DELETE FROM report_agents WHERE report_id = @existing_report_id;
DELETE FROM report_logs WHERE report_id = @existing_report_id;
DELETE FROM reports WHERE id = @existing_report_id;

SELECT id INTO @created_by_id
FROM users
ORDER BY id ASC
LIMIT 1;

SELECT id INTO @suspect_id
FROM citizens
WHERE first_name COLLATE utf8mb4_unicode_ci = @suspect_first_name
  AND last_name COLLATE utf8mb4_unicode_ci = @suspect_last_name
  AND birth_date = @suspect_birth_date
LIMIT 1;

INSERT INTO citizens (
  first_name,
  last_name,
  birth_date,
  phone,
  address,
  job,
  hair_color,
  eye_color,
  height_cm,
  physical_details,
  affiliation,
  known_criminal_group,
  special_status,
  notes,
  created_by,
  updated_by
)
SELECT
  @suspect_first_name,
  @suspect_last_name,
  @suspect_birth_date,
  '555-0148',
  'Alta Street, Los Santos',
  'Mécanicien indépendant',
  'Bruns',
  'Marron',
  182,
  'Tatouage visible sur l’avant-bras droit. Cicatrice légère arcade gauche.',
  'Aucune affiliation officielle connue',
  'Suspicions de lien avec un réseau local de revente d’armes',
  'Surveillance FIB active',
  'Individu coopératif après interpellation. Antécédents mineurs connus.',
  @created_by_id,
  @created_by_id
WHERE @suspect_id IS NULL;

SELECT id INTO @suspect_id
FROM citizens
WHERE first_name COLLATE utf8mb4_unicode_ci = @suspect_first_name
  AND last_name COLLATE utf8mb4_unicode_ci = @suspect_last_name
  AND birth_date = @suspect_birth_date
LIMIT 1;

INSERT INTO citizen_vehicles (
  citizen_id,
  plate,
  model,
  color,
  category,
  registration_status,
  notes,
  created_by,
  updated_by
) VALUES (
  @suspect_id,
  @vehicle_plate,
  'Dominator GTX',
  'Noir mat',
  'Muscle',
  'Actif',
  'Véhicule observé sur plusieurs lieux liés au dossier.',
  @created_by_id,
  @created_by_id
)
ON DUPLICATE KEY UPDATE
  citizen_id = VALUES(citizen_id),
  model = VALUES(model),
  color = VALUES(color),
  category = VALUES(category),
  registration_status = VALUES(registration_status),
  notes = VALUES(notes),
  updated_by = VALUES(updated_by);

SELECT id INTO @vehicle_id
FROM citizen_vehicles
WHERE plate COLLATE utf8mb4_unicode_ci = @vehicle_plate
LIMIT 1;

INSERT INTO reports (
  report_number,
  title,
  type_code,
  status,
  service_code,
  division_id,
  access_scope,
  minimum_role_code,
  minimum_power_level,
  occurred_at,
  location,
  summary,
  facts,
  actions_taken,
  conclusions,
  notes,
  structured_data,
  created_by,
  updated_by
) VALUES (
  @test_report_number,
  'TEST - Dossier d’arrestation Ethan Vargas',
  'arrestation_dossier',
  'submitted',
  @service_code,
  NULL,
  'service',
  NULL,
  0,
  '2026-05-18 22:35:00',
  'Parking arrière du LTD Gasoline, Strawberry, Los Santos',
  'Interpellation test complète liée à un transport d’arme illégale et tentative de fuite.',
  '<p><strong>Contexte opérationnel :</strong> une surveillance discrète a été mise en place suite à plusieurs signalements concernant un véhicule noir immatriculé FIB-742, observé à proximité de transactions suspectes dans le secteur de Strawberry.</p><p>À 22:28, l’individu Ethan Vargas a été aperçu quittant le parking arrière du LTD Gasoline avec un sac noir. Les agents ont procédé à une approche contrôlée après confirmation visuelle du véhicule et du suspect.</p><p><strong>Déroulé de l’interpellation :</strong> le suspect a d’abord refusé d’obtempérer aux injonctions verbales, puis a tenté de rejoindre son véhicule. L’agent principal a effectué une sommation claire. Après sécurisation du périmètre, l’individu a été menotté sans usage létal de la force.</p><ul><li>Droits lus à 22:41.</li><li>Fouille effectuée sur place.</li><li>Objet illégal découvert dans le sac du suspect.</li><li>Véhicule sécurisé et identifié comme élément lié au dossier.</li></ul><p>Le suspect a été transporté au bureau FIB pour poursuite de la procédure et validation par le Command Staff.</p>',
  NULL,
  NULL,
  '<p><strong>Note test :</strong> dossier créé pour vérifier le rendu complet, les champs spécifiques, les liaisons, le rich text et l’export PDF.</p>',
  JSON_OBJECT(
    'arresting_matricule', 'Agent Test FIB · FIB-01',
    'main_charge', 'Transport illégal d’arme et refus d’obtempérer',
    'rights_read', 'Oui',
    'rights_time', '22:41',
    'search_done', 'Oui',
    'lawyer_present', 'Oui',
    'lawyer_name', 'Me Claire Beaumont',
    'charges', 'Possession illégale d’arme\nRefus d’obtempérer\nEntrave à une enquête fédérale\nTransport de matériel prohibé',
    'seized_items', 'Pistolet 9mm non enregistré, chargeur, téléphone crypté, 2 450$ en espèces',
    'custody_decision', 'Placement en cellule temporaire - attente validation Command Staff'
  ),
  @created_by_id,
  @created_by_id
);

SET @report_id := LAST_INSERT_ID();

INSERT INTO report_citizens (report_id, citizen_id, relation_type)
SELECT @report_id, @suspect_id, 'suspect'
WHERE @suspect_id IS NOT NULL;

INSERT INTO report_vehicles (report_id, vehicle_id, relation_type)
SELECT @report_id, @vehicle_id, 'involved'
WHERE @vehicle_id IS NOT NULL;

INSERT INTO report_agents (report_id, user_id, relation_type)
SELECT @report_id, @created_by_id, 'lead_officer'
WHERE @created_by_id IS NOT NULL;

INSERT INTO report_logs (report_id, action, details, created_by)
VALUES (
  @report_id,
  'seed_test',
  JSON_OBJECT('message', 'Dossier d’arrestation de test généré par seed SQL.'),
  @created_by_id
);

SELECT
  @report_id AS report_id,
  @test_report_number AS report_number,
  'Dossier d’arrestation test créé.' AS result;
