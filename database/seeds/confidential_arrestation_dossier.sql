-- Seed RP MDT: dossier d'arrestation confidentiel de démonstration.
-- À exécuter uniquement sur un environnement de test.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @test_report_number := CONVERT('FIB-AD-CLASS-001' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @service_code := CONVERT('FIB' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @suspect_first_name := CONVERT('Mara' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @suspect_last_name := CONVERT('Solano' USING utf8mb4) COLLATE utf8mb4_unicode_ci;
SET @suspect_birth_date := DATE('1991-11-03');
SET @vehicle_plate := CONVERT('FIB-913' USING utf8mb4) COLLATE utf8mb4_unicode_ci;

INSERT INTO report_types (code, label, description, sort_order, is_active) VALUES
  ('arrestation_dossier', 'Dossier d’arrestation', 'Document structuré pour les dossiers d’arrestation et d’interpellation.', 35, 1)
ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description), sort_order = VALUES(sort_order), is_active = 1;

SELECT id INTO @existing_report_id FROM reports WHERE report_number COLLATE utf8mb4_unicode_ci = @test_report_number LIMIT 1;
DELETE FROM report_citizens WHERE report_id = @existing_report_id;
DELETE FROM report_vehicles WHERE report_id = @existing_report_id;
DELETE FROM report_agents WHERE report_id = @existing_report_id;
DELETE FROM report_logs WHERE report_id = @existing_report_id;
DELETE FROM reports WHERE id = @existing_report_id;

SELECT id INTO @created_by_id FROM users ORDER BY id ASC LIMIT 1;

SELECT id INTO @suspect_id FROM citizens
WHERE first_name COLLATE utf8mb4_unicode_ci = @suspect_first_name
  AND last_name COLLATE utf8mb4_unicode_ci = @suspect_last_name
  AND birth_date = @suspect_birth_date
LIMIT 1;

INSERT INTO citizens (first_name,last_name,birth_date,phone,address,job,hair_color,eye_color,height_cm,physical_details,affiliation,known_criminal_group,special_status,notes,created_by,updated_by)
SELECT @suspect_first_name,@suspect_last_name,@suspect_birth_date,'555-0193','Appartement 14B, Vespucci Canals, Los Santos','Consultante événementiel','Noirs','Verts',171,'Tatouage discret au poignet gauche.','Contacts avec plusieurs sociétés-écrans locales','Réseau Los Santos Meridian','Personne sensible - suivi FIB recommandé','Dossier de démonstration avec passages confidentiels.',@created_by_id,@created_by_id
WHERE @suspect_id IS NULL;

SELECT id INTO @suspect_id FROM citizens
WHERE first_name COLLATE utf8mb4_unicode_ci = @suspect_first_name
  AND last_name COLLATE utf8mb4_unicode_ci = @suspect_last_name
  AND birth_date = @suspect_birth_date
LIMIT 1;

INSERT INTO citizen_vehicles (citizen_id,plate,model,color,category,registration_status,notes,created_by,updated_by)
VALUES (@suspect_id,@vehicle_plate,'Oracle XS','Gris anthracite','Berline','Sous surveillance','Véhicule lié à un dossier FIB confidentiel.',@created_by_id,@created_by_id)
ON DUPLICATE KEY UPDATE citizen_id = VALUES(citizen_id), model = VALUES(model), color = VALUES(color), category = VALUES(category), registration_status = VALUES(registration_status), notes = VALUES(notes), updated_by = VALUES(updated_by);

SELECT id INTO @vehicle_id FROM citizen_vehicles WHERE plate COLLATE utf8mb4_unicode_ci = @vehicle_plate LIMIT 1;

INSERT INTO reports (report_number,title,type_code,status,service_code,division_id,access_scope,minimum_role_code,minimum_power_level,occurred_at,location,summary,facts,actions_taken,conclusions,notes,structured_data,created_by,updated_by)
VALUES (
  @test_report_number,
  'CONFIDENTIEL - Dossier d’arrestation Mara Solano',
  'arrestation_dossier',
  'submitted',
  @service_code,
  NULL,
  'directors',
  NULL,
  0,
  '2026-05-18 23:14:00',
  'Sous-sol de service, Arcadius Business Center, Downtown Los Santos',
  'Dossier RP sensible avec passages caviardés pour démonstration du template FIB.',
  '<p><strong>Classification :</strong> dossier restreint FIB / Command Staff. Toute diffusion non autorisée est interdite.</p><p><strong>Contexte :</strong> Mara Solano a été identifiée comme intermédiaire dans un échange de documents sensibles. Le contact d’origine est enregistré sous le nom de code <span class="mdt-rich-classified">ORCHID-7</span>.</p><p>À 23:08, la suspecte a été observée dans le sous-sol de service avec une enveloppe scellée et un téléphone secondaire. L’observateur confidentiel <span class="mdt-rich-classified">K. Mercer - UC-12</span> a confirmé la situation.</p><p><strong>Interpellation :</strong> à 23:14, l’équipe FIB a procédé à la sécurisation de la suspecte. Les droits ont été lus immédiatement après menottage.</p><ul><li>Droits lus à 23:17.</li><li>Fouille effectuée sur place.</li><li>Lieu exact du second dépôt : <span class="mdt-rich-classified">Local technique B2 - accès maintenance nord</span>.</li></ul><p><strong>Point sensible :</strong> le destinataire final est désigné comme <span class="mdt-rich-classified">contact institutionnel non identifié</span>.</p>',
  '<p>Scellés constitués sur place. Téléphone secondaire isolé. Enveloppe remise au superviseur FIB.</p>',
  '<p>Validation Director requise avant toute transmission interservice.</p>',
  '<p><strong>Note Director :</strong> les passages caviardés doivent rester masqués dans toute version déclassifiée.</p>',
  JSON_OBJECT('arresting_matricule','Special Agent Admin · FIB-01','main_charge','Entrave à enquête FIB et tentative de destruction de preuve','rights_read','Oui','rights_time','23:17','search_done','Oui','lawyer_present','Oui','lawyer_name','Me Adrian Wolfe','charges','Entrave à une enquête FIB\nTentative de destruction de preuve\nPossession non autorisée de documents sensibles','seized_items','Téléphone secondaire, enveloppe scellée, badge temporaire','custody_decision','Placement en cellule sécurisée - validation Director requise'),
  @created_by_id,
  @created_by_id
);

SET @report_id := LAST_INSERT_ID();
INSERT INTO report_citizens (report_id,citizen_id,relation_type) SELECT @report_id,@suspect_id,'suspect' WHERE @suspect_id IS NOT NULL;
INSERT INTO report_vehicles (report_id,vehicle_id,relation_type) SELECT @report_id,@vehicle_id,'involved' WHERE @vehicle_id IS NOT NULL;
INSERT INTO report_agents (report_id,user_id,relation_type) SELECT @report_id,@created_by_id,'lead_officer' WHERE @created_by_id IS NOT NULL;
INSERT INTO report_logs (report_id,action,details,created_by) VALUES (@report_id,'seed_confidential_demo',JSON_OBJECT('message','Dossier confidentiel RP généré pour démonstration du template FIB.'),@created_by_id);

SELECT @report_id AS report_id, @test_report_number AS report_number, 'Dossier d’arrestation confidentiel RP créé.' AS result;
