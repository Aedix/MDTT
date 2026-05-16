<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/bbcode.php';
require_once __DIR__ . '/../includes/realtime.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();

$activeServiceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? '');
$statuses = ['Disponible', 'Non affecté', 'Patrouille', 'Intervention', 'Pause', 'Transport', 'En attente', 'Indisponible'];
$ppaLevels = ['PPA I', 'PPA II', 'PPA III', 'PPA IV'];

function h(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function statusClassState(string $status): string
{
    return match ($status) {
        'Disponible' => 'status-available',
        'Patrouille' => 'status-patrol',
        'Intervention' => 'status-intervention',
        'Pause' => 'status-pause',
        'Transport' => 'status-transport',
        'En attente' => 'status-waiting',
        'Indisponible' => 'status-unavailable',
        default => 'status-unassigned',
    };
}

function memberSummaryState(array $members): string
{
    $count = count($members);
    if ($count === 0) {
        return 'Aucun agent';
    }

    $first = (string) ($members[0]['username'] ?? 'Agent');
    return $count === 1 ? $first : $first . ' + ' . ($count - 1);
}

function memberTooltipState(array $members): string
{
    if (empty($members)) {
        return 'Aucun agent affecté';
    }

    return implode(', ', array_map(static fn (array $member): string => (string) $member['username'], $members));
}

function updatedLabel(?string $updatedAt, ?string $updatedBy): string
{
    if (!$updatedAt) {
        return 'Jamais mis à jour';
    }

    $updatedDate = new DateTime($updatedAt);
    $now = new DateTime();
    $diffSeconds = max(0, $now->getTimestamp() - $updatedDate->getTimestamp());

    if ($diffSeconds < 60) {
        $label = 'Mis à jour il y a moins d’une minute';
    } elseif ($diffSeconds < 3600) {
        $label = 'Mis à jour il y a ' . floor($diffSeconds / 60) . ' min';
    } elseif ($diffSeconds < 86400) {
        $label = 'Mis à jour il y a ' . floor($diffSeconds / 3600) . ' h';
    } else {
        $label = 'Mis à jour il y a ' . floor($diffSeconds / 86400) . ' j';
    }

    if ($updatedBy) {
        $label .= ' par ' . $updatedBy;
    }

    return $label;
}

function renderDispatchList(array $dispatchUnits, array $unitMembers, array $divisions, array $statuses, array $ppaLevels): string
{
    ob_start();
    ?>
    <div class="dispatch-list-header">
      <span></span>
      <span>Unité</span>
      <span>Statut</span>
      <span>Division</span>
      <span>PPA</span>
      <span>Agents</span>
      <span>Commentaire</span>
      <span></span>
    </div>

    <?php if (empty($dispatchUnits)): ?>
      <div class="mdt-dispatch-empty">Aucune unité dispatch active.</div>
    <?php endif; ?>

    <?php foreach ($dispatchUnits as $unit): ?>
      <?php
        $unitId = (int) $unit['id'];
        $currentMembers = $unitMembers[$unitId] ?? [];
        $memberIds = implode(',', array_map(static fn (array $member): string => (string) $member['user_id'], $currentMembers));
        $summary = memberSummaryState($currentMembers);
        $tooltip = memberTooltipState($currentMembers);
        $status = (string) $unit['status'];
        $rowClass = statusClassState($status);
      ?>
      <div class="dispatch-view-row" data-unit-id="<?= $unitId ?>">
        <span class="dispatch-status-dot <?= h($rowClass) ?>"></span>
        <strong><?= h($unit['name']) ?></strong>
        <span><?= h($status) ?></span>
        <span><?= h($unit['division_name'] ?? 'Aucune division') ?></span>
        <span><?= h($unit['ppa_level']) ?></span>
        <button type="button" class="dispatch-agent-summary" title="<?= h($tooltip) ?>" data-members="<?= h($memberIds) ?>"><?= h($summary) ?></button>
        <span class="dispatch-comment" title="<?= h($unit['comment'] ?? '') ?>"><?= h($unit['comment'] ?? '—') ?></span>
        <div class="dispatch-row-actions compact">
          <button type="button" class="dispatch-icon-action edit dispatch-edit-button" title="Modifier">✎</button>
          <button type="button" class="dispatch-icon-action delete dispatch-close-button" title="Fermer" data-unit-id="<?= $unitId ?>">×</button>
        </div>
      </div>

      <form class="dispatch-update-form dispatch-edit-row" data-unit-id="<?= $unitId ?>" hidden>
        <input type="hidden" name="member_ids" class="dispatch-members-input" value="<?= h($memberIds) ?>" />
        <span class="dispatch-status-dot <?= h($rowClass) ?>"></span>
        <input type="text" name="name" value="<?= h($unit['name']) ?>" aria-label="Nom unité" />
        <select name="status" aria-label="Statut unité">
          <?php foreach ($statuses as $availableStatus): ?>
            <option <?= $availableStatus === $status ? 'selected' : '' ?>><?= h($availableStatus) ?></option>
          <?php endforeach; ?>
        </select>
        <select name="division_id" aria-label="Division">
          <option value="0">Aucune division</option>
          <?php foreach ($divisions as $division): ?>
            <option value="<?= (int) $division['id'] ?>" <?= ((int) ($unit['division_id'] ?? 0) === (int) $division['id']) ? 'selected' : '' ?>><?= h($division['name']) ?></option>
          <?php endforeach; ?>
        </select>
        <select name="ppa_level" aria-label="PPA">
          <?php foreach ($ppaLevels as $ppa): ?>
            <option <?= ((string) $unit['ppa_level'] === $ppa) ? 'selected' : '' ?>><?= h($ppa) ?></option>
          <?php endforeach; ?>
        </select>
        <button type="button" class="dispatch-agent-button" data-members="<?= h($memberIds) ?>">Affecter agents</button>
        <input type="text" name="comment" maxlength="160" value="<?= h($unit['comment'] ?? '') ?>" placeholder="Commentaire" aria-label="Commentaire" />
        <div class="dispatch-row-actions compact">
          <button type="submit" class="dispatch-icon-action validate" title="Valider">✓</button>
          <button type="button" class="dispatch-icon-action cancel dispatch-cancel-edit-button" title="Annuler">↩</button>
        </div>
      </form>
    <?php endforeach; ?>
    <?php
    return trim((string) ob_get_clean());
}

function renderDutyList(array $onDutyAgents, array $agentAssignments): string
{
    ob_start();
    ?>
    <?php if (empty($onDutyAgents)): ?>
      <p class="mdt-muted-line">Aucun agent en service actuellement.</p>
    <?php endif; ?>
    <?php foreach ($onDutyAgents as $agent): ?>
      <?php $assignment = $agentAssignments[(int) $agent['id']] ?? null; ?>
      <div class="mdt-duty-agent compact">
        <strong><?= h($agent['username']) ?></strong>
        <?php if ($assignment): ?>
          <span><i class="dispatch-status-dot mini <?= h($assignment['status_class']) ?>"></i><?= h($assignment['unit_name'] . ' · ' . $assignment['unit_status']) ?></span>
        <?php else: ?>
          <span><i class="dispatch-status-dot mini status-unassigned"></i>Non affecté</span>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
    <?php
    return trim((string) ob_get_clean());
}

function renderDrawerAgents(array $onDutyAgents): string
{
    ob_start();
    foreach ($onDutyAgents as $agent): ?>
      <label>
        <input type="checkbox" value="<?= (int) $agent['id'] ?>" />
        <span><?= h($agent['username']) ?></span>
        <small><?= h($agent['rank_name'] ?? 'Grade inconnu') ?></small>
      </label>
    <?php endforeach;
    return trim((string) ob_get_clean());
}

$serviceStatement = $pdo->prepare(
    'SELECT s.id AS service_id,
            sm.title AS motd_title,
            sm.body AS motd_body,
            sm.updated_at AS motd_updated_at,
            u.username AS motd_updated_by
     FROM services s
     LEFT JOIN service_motd sm ON sm.service_id = s.id
     LEFT JOIN users u ON u.id = sm.updated_by
     WHERE s.code = :code
     LIMIT 1'
);
$serviceStatement->execute(['code' => $activeServiceCode]);
$serviceInfo = $serviceStatement->fetch();

if (!$serviceInfo) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Service introuvable.']);
    exit;
}

$serviceId = (int) $serviceInfo['service_id'];

$lock = null;
try {
    $pdo->prepare('DELETE FROM service_motd_locks WHERE service_id = :service_id AND heartbeat_at < (NOW() - INTERVAL 45 SECOND)')
        ->execute(['service_id' => $serviceId]);
    $lockStatement = $pdo->prepare(
        'SELECT l.user_id, l.heartbeat_at, u.username
         FROM service_motd_locks l
         INNER JOIN users u ON u.id = l.user_id
         WHERE l.service_id = :service_id
         LIMIT 1'
    );
    $lockStatement->execute(['service_id' => $serviceId]);
    $lock = $lockStatement->fetch() ?: null;
} catch (Throwable $exception) {
    $lock = null;
}

$activeShiftStatement = $pdo->prepare(
    'SELECT id, started_at
     FROM service_shifts
     WHERE user_id = :user_id
       AND service_id = :service_id
       AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1'
);
$activeShiftStatement->execute(['user_id' => (int) $user['id'], 'service_id' => $serviceId]);
$activeShift = $activeShiftStatement->fetch() ?: null;

$agentsStatement = $pdo->prepare(
    'SELECT u.id, u.username, u.rank_name, ss.started_at
     FROM service_shifts ss
     INNER JOIN users u ON u.id = ss.user_id
     WHERE ss.service_id = :service_id
       AND ss.ended_at IS NULL
     ORDER BY u.username ASC'
);
$agentsStatement->execute(['service_id' => $serviceId]);
$onDutyAgents = $agentsStatement->fetchAll();

$divisionsStatement = $pdo->prepare(
    'SELECT id, name
     FROM divisions
     WHERE service_id = :service_id
       AND is_active = 1
     ORDER BY sort_order ASC, name ASC'
);
$divisionsStatement->execute(['service_id' => $serviceId]);
$divisions = $divisionsStatement->fetchAll();

$unitsStatement = $pdo->prepare(
    'SELECT du.id, du.name, du.status, du.comment, du.ppa_level, du.division_id, d.name AS division_name
     FROM dispatch_units du
     LEFT JOIN divisions d ON d.id = du.division_id
     WHERE du.service_id = :service_id
       AND du.is_active = 1
     ORDER BY du.name ASC, du.created_at ASC'
);
$unitsStatement->execute(['service_id' => $serviceId]);
$dispatchUnits = $unitsStatement->fetchAll();

$unitMembers = [];
$membersStatement = $pdo->prepare(
    'SELECT dum.unit_id, u.id AS user_id, u.username
     FROM dispatch_unit_members dum
     INNER JOIN users u ON u.id = dum.user_id
     INNER JOIN dispatch_units du ON du.id = dum.unit_id
     WHERE du.service_id = :service_id
       AND du.is_active = 1
       AND dum.is_active = 1
     ORDER BY u.username ASC'
);
$membersStatement->execute(['service_id' => $serviceId]);
foreach ($membersStatement->fetchAll() as $memberRow) {
    $unitMembers[(int) $memberRow['unit_id']][] = $memberRow;
}

$agentAssignments = [];
foreach ($dispatchUnits as $unit) {
    foreach (($unitMembers[(int) $unit['id']] ?? []) as $member) {
        $agentAssignments[(int) $member['user_id']] = [
            'unit_name' => (string) $unit['name'],
            'unit_status' => (string) $unit['status'],
            'status_class' => statusClassState((string) $unit['status']),
        ];
    }
}

$motdTitle = (string) ($serviceInfo['motd_title'] ?? 'Annonce opérationnelle');
$motdBody = (string) ($serviceInfo['motd_body'] ?? '');
$motdHtml = trim($motdBody) === '' ? '<p class="mdt-muted-line">Aucune annonce active pour le moment.</p>' : renderBbCode($motdBody);

$state = [
    'success' => true,
    'current_user_id' => (int) $user['id'],
    'version' => getRealtimeVersion($pdo, $serviceId),
    'motd' => [
        'title' => $motdTitle,
        'body_raw' => $motdBody,
        'body_html' => $motdHtml,
        'updated_label' => updatedLabel($serviceInfo['motd_updated_at'] ?? null, $serviceInfo['motd_updated_by'] ?? null),
        'lock' => [
            'is_locked' => (bool) $lock,
            'is_locked_by_me' => $lock ? ((int) $lock['user_id'] === (int) $user['id']) : false,
            'username' => $lock ? (string) $lock['username'] : null,
        ],
    ],
    'shift' => [
        'is_on_duty' => (bool) $activeShift,
        'started_at' => $activeShift ? (string) $activeShift['started_at'] : '',
        'label' => $activeShift ? 'En service' : 'Hors service',
    ],
    'dispatch_html' => renderDispatchList($dispatchUnits, $unitMembers, $divisions, $statuses, $ppaLevels),
    'duty_html' => renderDutyList($onDutyAgents, $agentAssignments),
    'drawer_agents_html' => renderDrawerAgents($onDutyAgents),
];

$state['hash'] = sha1(json_encode([
    $state['motd']['title'],
    $state['motd']['body_raw'],
    $state['motd']['updated_label'],
    $state['motd']['lock'],
    $state['shift'],
    $state['dispatch_html'],
    $state['duty_html'],
], JSON_UNESCAPED_UNICODE));

echo json_encode($state, JSON_UNESCAPED_UNICODE);
