<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/permissions.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = (string) ($_GET['action'] ?? 'list');

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function bodyData(): array
{
    $data = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($data) ? $data : [];
}

function textValue(array $data, string $key, int $max = 255): ?string
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '') {
        return null;
    }

    return mb_substr($value, 0, $max);
}

function intValue(array $data, string $key): ?int
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '') {
        return null;
    }

    $int = (int) $value;
    return $int > 0 ? $int : null;
}

function dateValue(array $data, string $key): ?string
{
    $value = trim((string) ($data[$key] ?? ''));
    if ($value === '') {
        return null;
    }

    $date = DateTime::createFromFormat('Y-m-d', $value);
    return $date ? $date->format('Y-m-d') : null;
}

function canDeleteCitizenData(array $user): bool
{
    return isSuperAdminUser($user) || userHasPermission($user, 'accounts.delete');
}

function addCitizenLog(PDO $pdo, ?int $citizenId, string $entityType, ?int $entityId, string $action, array $details, int $userId): void
{
    try {
        $statement = $pdo->prepare(
            'INSERT INTO citizen_audit_logs (citizen_id, entity_type, entity_id, action, details, created_by)
             VALUES (:citizen_id, :entity_type, :entity_id, :action, :details, :created_by)'
        );
        $statement->execute([
            'citizen_id' => $citizenId,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action' => $action,
            'details' => json_encode($details, JSON_UNESCAPED_UNICODE),
            'created_by' => $userId,
        ]);
    } catch (Throwable $exception) {
        // Logs should never block the MDT action.
    }
}

function getCitizen(PDO $pdo, int $id): ?array
{
    $statement = $pdo->prepare(
        'SELECT c.*, creator.username AS created_by_username, updater.username AS updated_by_username
         FROM citizens c
         LEFT JOIN users creator ON creator.id = c.created_by
         LEFT JOIN users updater ON updater.id = c.updated_by
         WHERE c.id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $id]);
    $citizen = $statement->fetch();

    return $citizen ?: null;
}

if ($method === 'GET' && $action === 'list') {
    $query = trim((string) ($_GET['q'] ?? ''));
    $search = '%' . $query . '%';

    if ($query !== '') {
        $statement = $pdo->prepare(
            'SELECT c.id, c.first_name, c.last_name, c.birth_date, c.phone, c.address, c.job, c.affiliation, c.photo_path,
                    COUNT(DISTINCT v.id) AS vehicles_count,
                    COUNT(DISTINCT r.id) AS records_count
             FROM citizens c
             LEFT JOIN citizen_vehicles v ON v.citizen_id = c.id
             LEFT JOIN criminal_records r ON r.citizen_id = c.id
             WHERE c.first_name LIKE :search
                OR c.last_name LIKE :search
                OR c.phone LIKE :search
                OR c.address LIKE :search
                OR c.job LIKE :search
                OR c.affiliation LIKE :search
                OR c.known_organization LIKE :search
                OR c.known_criminal_group LIKE :search
                OR c.special_status LIKE :search
                OR c.notes LIKE :search
                OR v.plate LIKE :search
                OR v.model LIKE :search
             GROUP BY c.id
             ORDER BY c.last_name ASC, c.first_name ASC
             LIMIT 80'
        );
        $statement->execute(['search' => $search]);
    } else {
        $statement = $pdo->query(
            'SELECT c.id, c.first_name, c.last_name, c.birth_date, c.phone, c.address, c.job, c.affiliation, c.photo_path,
                    COUNT(DISTINCT v.id) AS vehicles_count,
                    COUNT(DISTINCT r.id) AS records_count
             FROM citizens c
             LEFT JOIN citizen_vehicles v ON v.citizen_id = c.id
             LEFT JOIN criminal_records r ON r.citizen_id = c.id
             GROUP BY c.id
             ORDER BY c.updated_at DESC
             LIMIT 80'
        );
    }

    jsonResponse(['success' => true, 'citizens' => $statement->fetchAll()]);
}

if ($method === 'GET' && $action === 'get') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'Citoyen invalide.'], 400);
    }

    $citizen = getCitizen($pdo, $id);
    if (!$citizen) {
        jsonResponse(['success' => false, 'message' => 'Citoyen introuvable.'], 404);
    }

    $vehiclesStatement = $pdo->prepare(
        'SELECT v.*, creator.username AS created_by_username, updater.username AS updated_by_username
         FROM citizen_vehicles v
         LEFT JOIN users creator ON creator.id = v.created_by
         LEFT JOIN users updater ON updater.id = v.updated_by
         WHERE v.citizen_id = :citizen_id
         ORDER BY v.plate ASC'
    );
    $vehiclesStatement->execute(['citizen_id' => $id]);

    $recordsStatement = $pdo->prepare(
        'SELECT r.*, creator.username AS created_by_username, updater.username AS updated_by_username
         FROM criminal_records r
         LEFT JOIN users creator ON creator.id = r.created_by
         LEFT JOIN users updater ON updater.id = r.updated_by
         WHERE r.citizen_id = :citizen_id
         ORDER BY r.offense_date DESC, r.created_at DESC'
    );
    $recordsStatement->execute(['citizen_id' => $id]);

    jsonResponse([
        'success' => true,
        'citizen' => $citizen,
        'vehicles' => $vehiclesStatement->fetchAll(),
        'records' => $recordsStatement->fetchAll(),
        'can_delete' => canDeleteCitizenData($user),
    ]);
}

if ($method === 'POST' && $action === 'save') {
    $data = bodyData();
    $id = (int) ($data['id'] ?? 0);
    $firstName = textValue($data, 'first_name', 80);
    $lastName = textValue($data, 'last_name', 80);

    if (!$firstName || !$lastName) {
        jsonResponse(['success' => false, 'message' => 'Nom et prénom obligatoires.'], 400);
    }

    $payload = [
        'first_name' => $firstName,
        'last_name' => $lastName,
        'birth_date' => dateValue($data, 'birth_date'),
        'phone' => textValue($data, 'phone', 40),
        'address' => textValue($data, 'address', 255),
        'job' => textValue($data, 'job', 120),
        'hair_color' => textValue($data, 'hair_color', 80),
        'eye_color' => textValue($data, 'eye_color', 80),
        'height_cm' => intValue($data, 'height_cm'),
        'physical_details' => textValue($data, 'physical_details', 3000),
        'affiliation' => textValue($data, 'affiliation', 160),
        'known_organization' => textValue($data, 'known_organization', 160),
        'known_criminal_group' => textValue($data, 'known_criminal_group', 160),
        'special_status' => textValue($data, 'special_status', 160),
        'notes' => textValue($data, 'notes', 6000),
        'photo_path' => textValue($data, 'photo_path', 255),
        'updated_by' => (int) $user['id'],
    ];

    if ($id > 0) {
        $existing = getCitizen($pdo, $id);
        if (!$existing) {
            jsonResponse(['success' => false, 'message' => 'Citoyen introuvable.'], 404);
        }

        $payload['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE citizens SET
                first_name = :first_name,
                last_name = :last_name,
                birth_date = :birth_date,
                phone = :phone,
                address = :address,
                job = :job,
                hair_color = :hair_color,
                eye_color = :eye_color,
                height_cm = :height_cm,
                physical_details = :physical_details,
                affiliation = :affiliation,
                known_organization = :known_organization,
                known_criminal_group = :known_criminal_group,
                special_status = :special_status,
                notes = :notes,
                photo_path = :photo_path,
                updated_by = :updated_by
             WHERE id = :id'
        );
        $statement->execute($payload);
        addCitizenLog($pdo, $id, 'citizen', $id, 'update', $payload, (int) $user['id']);
    } else {
        $payload['created_by'] = (int) $user['id'];
        $statement = $pdo->prepare(
            'INSERT INTO citizens
             (first_name, last_name, birth_date, phone, address, job, hair_color, eye_color, height_cm, physical_details, affiliation, known_organization, known_criminal_group, special_status, notes, photo_path, created_by, updated_by)
             VALUES
             (:first_name, :last_name, :birth_date, :phone, :address, :job, :hair_color, :eye_color, :height_cm, :physical_details, :affiliation, :known_organization, :known_criminal_group, :special_status, :notes, :photo_path, :created_by, :updated_by)'
        );
        $statement->execute($payload);
        $id = (int) $pdo->lastInsertId();
        addCitizenLog($pdo, $id, 'citizen', $id, 'create', $payload, (int) $user['id']);
    }

    jsonResponse(['success' => true, 'message' => 'Fiche citoyen enregistrée.', 'id' => $id]);
}

if ($method === 'POST' && $action === 'save_vehicle') {
    $data = bodyData();
    $id = (int) ($data['id'] ?? 0);
    $citizenId = (int) ($data['citizen_id'] ?? 0);
    $plate = strtoupper((string) textValue($data, 'plate', 32));

    if ($citizenId <= 0 || $plate === '') {
        jsonResponse(['success' => false, 'message' => 'Citoyen et plaque obligatoires.'], 400);
    }

    if (!getCitizen($pdo, $citizenId)) {
        jsonResponse(['success' => false, 'message' => 'Citoyen introuvable.'], 404);
    }

    $payload = [
        'citizen_id' => $citizenId,
        'plate' => $plate,
        'model' => textValue($data, 'model', 120),
        'color' => textValue($data, 'color', 80),
        'category' => textValue($data, 'category', 80),
        'registration_status' => textValue($data, 'registration_status', 80) ?? 'Actif',
        'notes' => textValue($data, 'notes', 3000),
        'updated_by' => (int) $user['id'],
    ];

    try {
        if ($id > 0) {
            $payload['id'] = $id;
            $statement = $pdo->prepare(
                'UPDATE citizen_vehicles SET citizen_id = :citizen_id, plate = :plate, model = :model, color = :color, category = :category, registration_status = :registration_status, notes = :notes, updated_by = :updated_by WHERE id = :id'
            );
            $statement->execute($payload);
            addCitizenLog($pdo, $citizenId, 'vehicle', $id, 'update', $payload, (int) $user['id']);
        } else {
            $payload['created_by'] = (int) $user['id'];
            $statement = $pdo->prepare(
                'INSERT INTO citizen_vehicles (citizen_id, plate, model, color, category, registration_status, notes, created_by, updated_by)
                 VALUES (:citizen_id, :plate, :model, :color, :category, :registration_status, :notes, :created_by, :updated_by)'
            );
            $statement->execute($payload);
            $id = (int) $pdo->lastInsertId();
            addCitizenLog($pdo, $citizenId, 'vehicle', $id, 'create', $payload, (int) $user['id']);
        }
    } catch (PDOException $exception) {
        jsonResponse(['success' => false, 'message' => 'Plaque déjà enregistrée ou donnée invalide.'], 400);
    }

    jsonResponse(['success' => true, 'message' => 'Véhicule enregistré.', 'id' => $id]);
}

if ($method === 'POST' && $action === 'save_record') {
    $data = bodyData();
    $id = (int) ($data['id'] ?? 0);
    $citizenId = (int) ($data['citizen_id'] ?? 0);
    $offenseType = textValue($data, 'offense_type', 160);

    if ($citizenId <= 0 || !$offenseType) {
        jsonResponse(['success' => false, 'message' => 'Citoyen et type d’infraction obligatoires.'], 400);
    }

    if (!getCitizen($pdo, $citizenId)) {
        jsonResponse(['success' => false, 'message' => 'Citoyen introuvable.'], 404);
    }

    $payload = [
        'citizen_id' => $citizenId,
        'offense_date' => dateValue($data, 'offense_date'),
        'offense_type' => $offenseType,
        'description' => textValue($data, 'description', 6000),
        'case_status' => textValue($data, 'case_status', 80) ?? 'Ouvert',
        'sanction' => textValue($data, 'sanction', 255),
        'notes' => textValue($data, 'notes', 3000),
        'updated_by' => (int) $user['id'],
    ];

    if ($id > 0) {
        $payload['id'] = $id;
        $statement = $pdo->prepare(
            'UPDATE criminal_records SET citizen_id = :citizen_id, offense_date = :offense_date, offense_type = :offense_type, description = :description, case_status = :case_status, sanction = :sanction, notes = :notes, updated_by = :updated_by WHERE id = :id'
        );
        $statement->execute($payload);
        addCitizenLog($pdo, $citizenId, 'criminal_record', $id, 'update', $payload, (int) $user['id']);
    } else {
        $payload['created_by'] = (int) $user['id'];
        $statement = $pdo->prepare(
            'INSERT INTO criminal_records (citizen_id, offense_date, offense_type, description, case_status, sanction, notes, created_by, updated_by)
             VALUES (:citizen_id, :offense_date, :offense_type, :description, :case_status, :sanction, :notes, :created_by, :updated_by)'
        );
        $statement->execute($payload);
        $id = (int) $pdo->lastInsertId();
        addCitizenLog($pdo, $citizenId, 'criminal_record', $id, 'create', $payload, (int) $user['id']);
    }

    jsonResponse(['success' => true, 'message' => 'Infraction enregistrée.', 'id' => $id]);
}

if ($method === 'POST' && in_array($action, ['delete_vehicle', 'delete_record'], true)) {
    if (!canDeleteCitizenData($user)) {
        jsonResponse(['success' => false, 'message' => 'Droits insuffisants pour supprimer.'], 403);
    }

    $data = bodyData();
    $id = (int) ($data['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'message' => 'ID invalide.'], 400);
    }

    if ($action === 'delete_vehicle') {
        $statement = $pdo->prepare('SELECT citizen_id FROM citizen_vehicles WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $citizenId = (int) ($statement->fetchColumn() ?: 0);
        $pdo->prepare('DELETE FROM citizen_vehicles WHERE id = :id')->execute(['id' => $id]);
        addCitizenLog($pdo, $citizenId ?: null, 'vehicle', $id, 'delete', [], (int) $user['id']);
    } else {
        $statement = $pdo->prepare('SELECT citizen_id FROM criminal_records WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $id]);
        $citizenId = (int) ($statement->fetchColumn() ?: 0);
        $pdo->prepare('DELETE FROM criminal_records WHERE id = :id')->execute(['id' => $id]);
        addCitizenLog($pdo, $citizenId ?: null, 'criminal_record', $id, 'delete', [], (int) $user['id']);
    }

    jsonResponse(['success' => true, 'message' => 'Suppression effectuée.']);
}

jsonResponse(['success' => false, 'message' => 'Action inconnue.'], 404);
