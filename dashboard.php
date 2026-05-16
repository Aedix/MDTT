<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/bbcode.php';

$user = requireAuthenticatedUser();
$canOpenPanel = canOpenManagementPanel($user);
$pdo = getDatabaseConnection();

$activeServiceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
$activeServiceName = (string) ($user['active_service_name'] ?? $activeServiceCode);
$activeRankName = (string) ($user['active_rank_name'] ?? $user['rank_name'] ?? 'Non défini');
$activeServiceLogo = (string) ($user['active_service_logo'] ?? '');

$statuses = ['Disponible', 'Non affecté', 'Patrouille', 'Intervention', 'Pause', 'Transport', 'En attente', 'Indisponible'];
$ppaLevels = ['PPA I', 'PPA II', 'PPA III', 'PPA IV'];

function statusClass(string $status): string
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

function memberSummary(array $members): string
{
    $count = count($members);

    if ($count === 0) {
        return 'Aucun agent';
    }

    $first = (string) ($members[0]['username'] ?? 'Agent');

    if ($count === 1) {
        return $first;
    }

    return $first . ' + ' . ($count - 1);
}

function memberTooltip(array $members): string
{
    if (empty($members)) {
        return 'Aucun agent affecté';
    }

    return implode(', ', array_map(static fn (array $member): string => (string) $member['username'], $members));
}

$serviceInfo = [
    'service_id' => null,
    'motd_title' => 'Annonce opérationnelle',
    'motd_body' => 'Aucune annonce active pour le moment.',
    'motd_updated_at' => null,
    'motd_updated_by' => null,
];

try {
    $serviceStatement = $pdo->prepare(
        'SELECT s.id AS service_id,
                s.logo_path,
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
    $serviceRow = $serviceStatement->fetch();

    if ($serviceRow) {
        $activeServiceLogo = (string) ($serviceRow['logo_path'] ?? $activeServiceLogo);
        $serviceInfo = array_merge($serviceInfo, array_filter($serviceRow, static fn ($value) => $value !== null));
    }
} catch (Throwable $exception) {
    // Migration MOTD not installed yet.
}

$updatedLabel = 'Jamais mis à jour';
if (!empty($serviceInfo['motd_updated_at'])) {
    $updatedAt = new DateTime((string) $serviceInfo['motd_updated_at']);
    $now = new DateTime();
    $diffSeconds = max(0, $now->getTimestamp() - $updatedAt->getTimestamp());

    if ($diffSeconds < 60) {
        $updatedLabel = 'Mis à jour il y a moins d’une minute';
    } elseif ($diffSeconds < 3600) {
        $updatedLabel = 'Mis à jour il y a ' . floor($diffSeconds / 60) . ' min';
    } elseif ($diffSeconds < 86400) {
        $updatedLabel = 'Mis à jour il y a ' . floor($diffSeconds / 3600) . ' h';
    } else {
        $updatedLabel = 'Mis à jour il y a ' . floor($diffSeconds / 86400) . ' j';
    }

    if (!empty($serviceInfo['motd_updated_by'])) {
        $updatedLabel .= ' par ' . $serviceInfo['motd_updated_by'];
    }
}

$activeShift = null;
$onDutyAgents = [];
$divisions = [];
$dispatchUnits = [];
$unitMembers = [];
$agentAssignments = [];

try {
    $serviceId = (int) ($serviceInfo['service_id'] ?? 0);

    $shiftStatement = $pdo->prepare(
        'SELECT id, started_at
         FROM service_shifts
         WHERE user_id = :user_id
           AND service_id = :service_id
           AND ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1'
    );
    $shiftStatement->execute([
        'user_id' => (int) $user['id'],
        'service_id' => $serviceId,
    ]);
    $activeShift = $shiftStatement->fetch() ?: null;

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
        'SELECT du.id, du.name, du.status, du.comment, du.ppa_level, du.division_id, du.created_by, d.name AS division_name, creator.username AS creator_username
         FROM dispatch_units du
         LEFT JOIN divisions d ON d.id = du.division_id
         LEFT JOIN users creator ON creator.id = du.created_by
         WHERE du.service_id = :service_id
           AND du.is_active = 1
         ORDER BY du.created_at ASC'
    );
    $unitsStatement->execute(['service_id' => $serviceId]);
    $dispatchUnits = $unitsStatement->fetchAll();

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

    foreach ($dispatchUnits as $unit) {
        foreach (($unitMembers[(int) $unit['id']] ?? []) as $member) {
            $agentAssignments[(int) $member['user_id']] = [
                'unit_name' => (string) $unit['name'],
                'unit_status' => (string) $unit['status'],
                'status_class' => statusClass((string) $unit['status']),
            ];
        }
    }
} catch (Throwable $exception) {
    $activeShift = null;
    $onDutyAgents = [];
    $divisions = [];
    $dispatchUnits = [];
    $unitMembers = [];
    $agentAssignments = [];
}

$shiftLabel = 'Hors service';
$shiftStartedAt = '';
if ($activeShift) {
    $shiftLabel = 'En service';
    $shiftStartedAt = (string) $activeShift['started_at'];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="stylesheet" href="/style.css?v=11" />
  <link rel="stylesheet" href="/mdt.css?v=7" />
</head>
<body class="mdt-body service-<?= htmlspecialchars(strtolower($activeServiceCode), ENT_QUOTES, 'UTF-8') ?>">
  <div class="mdt-shell">
    <aside class="mdt-sidebar">
      <div class="mdt-brand">
        <div class="mdt-brand-logo">
          <?php if ($activeServiceLogo): ?>
            <img src="<?= htmlspecialchars($activeServiceLogo, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?>" />
          <?php else: ?>
            <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?>
          <?php endif; ?>
        </div>
        <div>
          <p class="mdt-brand-kicker">Mobile Data Terminal</p>
          <h1 class="mdt-brand-title"><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></h1>
        </div>
      </div>

      <nav class="mdt-nav" aria-label="Navigation MDT">
        <a href="/dashboard.php" class="mdt-nav-link active">Dashboard</a>
        <a href="/search.php" class="mdt-nav-link">Recherches</a>
        <a href="#" class="mdt-nav-link disabled">Dossiers <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Rapports <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Dispatch <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Divisions <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Paramètres <span class="mdt-placeholder">Soon</span></a>
        <?php if ($canOpenPanel): ?>
          <a href="/admin/index.php" class="mdt-nav-link management">Panel de gestion</a>
        <?php endif; ?>
      </nav>

      <div class="mdt-sidebar-footer">
        <strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong>
        <span><?= htmlspecialchars($activeRankName, ENT_QUOTES, 'UTF-8') ?></span>
      </div>
    </aside>

    <div class="mdt-main">
      <header class="mdt-topbar">
        <div>
          <p class="mdt-kicker"><?= htmlspecialchars($activeServiceName, ENT_QUOTES, 'UTF-8') ?></p>
          <h1>Dashboard <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></h1>
        </div>

        <div class="mdt-top-actions">
          <div class="mdt-user-mini">
            <strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong>
            <span><?= htmlspecialchars($activeServiceCode . ' · ' . $activeRankName, ENT_QUOTES, 'UTF-8') ?></span>
          </div>
          <a href="/choose-service.php" class="mdt-button-secondary">Changer service</a>
          <button type="button" id="shiftButton" class="mdt-button mdt-shift-button <?= $activeShift ? 'on-duty' : 'off-duty' ?>" data-on-duty="<?= $activeShift ? '1' : '0' ?>"><?= $activeShift ? 'Fin de service' : 'Prise de service' ?></button>
          <button type="button" id="logoutButton" class="mdt-button-danger">Déconnexion</button>
        </div>
      </header>

      <main class="mdt-content">
        <section class="mdt-card mdt-motd-card">
          <div class="mdt-motd-header">
            <div class="mdt-motd-title-block">
              <p class="mdt-kicker">Annonce service</p>
              <h2 id="motdTitleView"><?= htmlspecialchars((string) ($serviceInfo['motd_title'] ?? 'Annonce opérationnelle'), ENT_QUOTES, 'UTF-8') ?></h2>
              <input type="text" id="motdTitle" name="title" class="mdt-motd-title-input" maxlength="120" value="<?= htmlspecialchars((string) ($serviceInfo['motd_title'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" hidden required />
            </div>
            <div class="mdt-motd-actions">
              <span class="mdt-timecode"><?= htmlspecialchars($updatedLabel, ENT_QUOTES, 'UTF-8') ?></span>
              <button type="button" id="motdEditButton" class="mdt-icon-button" title="Modifier l’annonce" aria-label="Modifier l’annonce">✎</button>
              <button type="button" id="motdSaveButton" class="mdt-button" hidden>Sauvegarder</button>
              <button type="button" id="motdCancelButton" class="mdt-button-secondary" hidden>Annuler</button>
            </div>
          </div>

          <div id="motdView" class="mdt-motd-body bbcode-content"><?= renderBbCode((string) ($serviceInfo['motd_body'] ?? 'Aucune annonce active.')) ?></div>

          <div id="motdEditor" class="mdt-motd-editor-surface" hidden>
            <div class="mdt-editor-toolbar" aria-label="Outils de mise en forme BBCode">
              <button type="button" data-wrap="[b]|[/b]"><strong>B</strong></button>
              <button type="button" data-wrap="[i]|[/i]"><em>I</em></button>
              <button type="button" data-wrap="[u]|[/u]"><u>U</u></button>
              <button type="button" data-wrap="[s]|[/s]"><s>S</s></button>
              <button type="button" data-wrap="[mark]|[/mark]">Surligner</button>
              <button type="button" data-wrap="[quote]|[/quote]">Citation</button>
              <button type="button" data-wrap="[code]|[/code]">Code</button>
              <button type="button" data-insert="list">Liste</button>
              <button type="button" data-insert="url">Lien</button>
              <button type="button" data-insert="image">Image</button>
              <button type="button" data-insert="file">Fichier</button>
            </div>
            <textarea id="motdBody" name="body" maxlength="2000" required><?= htmlspecialchars((string) ($serviceInfo['motd_body'] ?? ''), ENT_QUOTES, 'UTF-8') ?></textarea>
          </div>
          <p id="motdMessage" class="form-message"></p>
        </section>

        <section class="mdt-operations-grid">
          <article class="mdt-card mdt-panel mdt-dispatch-panel">
            <div class="mdt-panel-header compact">
              <div>
                <p class="mdt-kicker">Dispatch</p>
                <h3>Unités actives</h3>
              </div>
              <button type="button" id="createUnitButton" class="mdt-button-secondary">Créer unité</button>
            </div>

            <p id="dispatchMessage" class="form-message"></p>

            <form id="createUnitForm" class="dispatch-create-form compact" hidden>
              <input type="hidden" name="member_ids" class="dispatch-members-input" value="<?= $activeShift ? (int) $user['id'] : '' ?>" />
              <div class="dispatch-compact-edit-grid">
                <span class="dispatch-status-dot status-available"></span>
                <input type="text" name="name" value="<?= htmlspecialchars($activeServiceCode . '-01', ENT_QUOTES, 'UTF-8') ?>" aria-label="Nom unité" required />
                <select name="status" aria-label="Statut unité">
                  <?php foreach ($statuses as $status): ?>
                    <option <?= $status === 'Disponible' ? 'selected' : '' ?>><?= htmlspecialchars($status, ENT_QUOTES, 'UTF-8') ?></option>
                  <?php endforeach; ?>
                </select>
                <select name="division_id" aria-label="Division">
                  <option value="0">Aucune division</option>
                  <?php foreach ($divisions as $division): ?>
                    <option value="<?= (int) $division['id'] ?>"><?= htmlspecialchars((string) $division['name'], ENT_QUOTES, 'UTF-8') ?></option>
                  <?php endforeach; ?>
                </select>
                <select name="ppa_level" aria-label="PPA">
                  <?php foreach ($ppaLevels as $ppa): ?>
                    <option><?= htmlspecialchars($ppa, ENT_QUOTES, 'UTF-8') ?></option>
                  <?php endforeach; ?>
                </select>
                <button type="button" class="dispatch-agent-button" data-members="<?= $activeShift ? (int) $user['id'] : '' ?>">Affecter agents</button>
                <input type="text" name="comment" maxlength="160" placeholder="Commentaire" aria-label="Commentaire" />
                <div class="dispatch-row-actions compact">
                  <button type="submit" class="dispatch-icon-action validate" title="Créer">✓</button>
                  <button type="button" id="cancelCreateUnitButton" class="dispatch-icon-action cancel" title="Annuler">↩</button>
                </div>
              </div>
            </form>

            <div class="dispatch-list">
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
                  $summary = memberSummary($currentMembers);
                  $tooltip = memberTooltip($currentMembers);
                  $status = (string) $unit['status'];
                  $rowClass = statusClass($status);
                ?>
                <div class="dispatch-view-row" data-unit-id="<?= $unitId ?>">
                  <span class="dispatch-status-dot <?= htmlspecialchars($rowClass, ENT_QUOTES, 'UTF-8') ?>"></span>
                  <strong><?= htmlspecialchars((string) $unit['name'], ENT_QUOTES, 'UTF-8') ?></strong>
                  <span><?= htmlspecialchars($status, ENT_QUOTES, 'UTF-8') ?></span>
                  <span><?= htmlspecialchars((string) ($unit['division_name'] ?? 'Aucune division'), ENT_QUOTES, 'UTF-8') ?></span>
                  <span><?= htmlspecialchars((string) $unit['ppa_level'], ENT_QUOTES, 'UTF-8') ?></span>
                  <button type="button" class="dispatch-agent-summary" title="<?= htmlspecialchars($tooltip, ENT_QUOTES, 'UTF-8') ?>" data-members="<?= htmlspecialchars($memberIds, ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($summary, ENT_QUOTES, 'UTF-8') ?></button>
                  <span class="dispatch-comment" title="<?= htmlspecialchars((string) ($unit['comment'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars((string) ($unit['comment'] ?? '—'), ENT_QUOTES, 'UTF-8') ?></span>
                  <div class="dispatch-row-actions compact">
                    <button type="button" class="dispatch-icon-action edit dispatch-edit-button" title="Modifier">✎</button>
                    <button type="button" class="dispatch-icon-action delete dispatch-close-button" title="Fermer" data-unit-id="<?= $unitId ?>">×</button>
                  </div>
                </div>

                <form class="dispatch-update-form dispatch-edit-row" data-unit-id="<?= $unitId ?>" hidden>
                  <input type="hidden" name="member_ids" class="dispatch-members-input" value="<?= htmlspecialchars($memberIds, ENT_QUOTES, 'UTF-8') ?>" />
                  <span class="dispatch-status-dot <?= htmlspecialchars($rowClass, ENT_QUOTES, 'UTF-8') ?>"></span>
                  <input type="text" name="name" value="<?= htmlspecialchars((string) $unit['name'], ENT_QUOTES, 'UTF-8') ?>" aria-label="Nom unité" />
                  <select name="status" aria-label="Statut unité">
                    <?php foreach ($statuses as $availableStatus): ?>
                      <option <?= $availableStatus === $status ? 'selected' : '' ?>><?= htmlspecialchars($availableStatus, ENT_QUOTES, 'UTF-8') ?></option>
                    <?php endforeach; ?>
                  </select>
                  <select name="division_id" aria-label="Division">
                    <option value="0">Aucune division</option>
                    <?php foreach ($divisions as $division): ?>
                      <option value="<?= (int) $division['id'] ?>" <?= ((int) ($unit['division_id'] ?? 0) === (int) $division['id']) ? 'selected' : '' ?>><?= htmlspecialchars((string) $division['name'], ENT_QUOTES, 'UTF-8') ?></option>
                    <?php endforeach; ?>
                  </select>
                  <select name="ppa_level" aria-label="PPA">
                    <?php foreach ($ppaLevels as $ppa): ?>
                      <option <?= ((string) $unit['ppa_level'] === $ppa) ? 'selected' : '' ?>><?= htmlspecialchars($ppa, ENT_QUOTES, 'UTF-8') ?></option>
                    <?php endforeach; ?>
                  </select>
                  <button type="button" class="dispatch-agent-button" data-members="<?= htmlspecialchars($memberIds, ENT_QUOTES, 'UTF-8') ?>">Affecter agents</button>
                  <input type="text" name="comment" maxlength="160" value="<?= htmlspecialchars((string) ($unit['comment'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" placeholder="Commentaire" aria-label="Commentaire" />
                  <div class="dispatch-row-actions compact">
                    <button type="submit" class="dispatch-icon-action validate" title="Valider">✓</button>
                    <button type="button" class="dispatch-icon-action cancel dispatch-cancel-edit-button" title="Annuler">↩</button>
                  </div>
                </form>
              <?php endforeach; ?>
            </div>
          </article>

          <article class="mdt-card mdt-panel mdt-duty-panel">
            <div class="mdt-panel-header compact">
              <div>
                <p class="mdt-kicker">Timeclock</p>
                <h3>Effectifs en service</h3>
              </div>
              <span class="mdt-shift-pill <?= $activeShift ? 'on' : 'off' ?>" id="shiftStatus" data-started-at="<?= htmlspecialchars($shiftStartedAt, ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($shiftLabel, ENT_QUOTES, 'UTF-8') ?></span>
            </div>

            <p id="shiftTimer" class="mdt-shift-timer"><?= $activeShift ? 'Calcul du temps...' : 'Aucune prise de service active.' ?></p>

            <div class="mdt-duty-list compact">
              <?php if (empty($onDutyAgents)): ?>
                <p class="mdt-muted-line">Aucun agent en service actuellement.</p>
              <?php endif; ?>
              <?php foreach ($onDutyAgents as $agent): ?>
                <?php $assignment = $agentAssignments[(int) $agent['id']] ?? null; ?>
                <div class="mdt-duty-agent compact">
                  <strong><?= htmlspecialchars((string) $agent['username'], ENT_QUOTES, 'UTF-8') ?></strong>
                  <?php if ($assignment): ?>
                    <span><i class="dispatch-status-dot mini <?= htmlspecialchars((string) $assignment['status_class'], ENT_QUOTES, 'UTF-8') ?>"></i><?= htmlspecialchars($assignment['unit_name'] . ' · ' . $assignment['unit_status'], ENT_QUOTES, 'UTF-8') ?></span>
                  <?php else: ?>
                    <span><i class="dispatch-status-dot mini status-unassigned"></i>Non affecté</span>
                  <?php endif; ?>
                </div>
              <?php endforeach; ?>
            </div>
          </article>
        </section>

        <aside id="dispatchDrawer" class="dispatch-drawer" hidden>
          <div class="dispatch-drawer-panel">
            <div class="mdt-panel-header compact">
              <div>
                <p class="mdt-kicker">Dispatch</p>
                <h3>Affecter agents</h3>
              </div>
              <button type="button" id="dispatchDrawerClose" class="dispatch-icon-action delete" title="Fermer">×</button>
            </div>
            <div id="dispatchDrawerAgents" class="dispatch-drawer-agents">
              <?php foreach ($onDutyAgents as $agent): ?>
                <label>
                  <input type="checkbox" value="<?= (int) $agent['id'] ?>" />
                  <span><?= htmlspecialchars((string) $agent['username'], ENT_QUOTES, 'UTF-8') ?></span>
                  <small><?= htmlspecialchars((string) ($agent['rank_name'] ?? 'Grade inconnu'), ENT_QUOTES, 'UTF-8') ?></small>
                </label>
              <?php endforeach; ?>
            </div>
            <button type="button" id="dispatchDrawerApply" class="mdt-button">Valider les agents</button>
          </div>
        </aside>
      </main>
    </div>
  </div>

  <script>
    const logoutButton = document.querySelector('#logoutButton');

    logoutButton.addEventListener('click', async () => {
      const response = await fetch('/api/logout.php', {
        method: 'POST',
        credentials: 'same-origin'
      });

      const result = await response.json();
      window.location.href = result.redirect || '/index.html';
    });
  </script>
  <script src="/motd.js?v=3"></script>
  <script src="/shift.js?v=1"></script>
  <script src="/dispatch.js?v=2"></script>
</body>
</html>
