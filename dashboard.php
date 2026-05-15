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

$serviceInfo = [
    'service_id' => null,
    'motd_title' => 'Annonce opérationnelle',
    'motd_body' => 'Aucune annonce active pour le moment.',
    'motd_updated_at' => null,
];

try {
    $serviceStatement = $pdo->prepare(
        'SELECT s.id AS service_id, s.logo_path, sm.title AS motd_title, sm.body AS motd_body, sm.updated_at AS motd_updated_at
         FROM services s
         LEFT JOIN service_motd sm ON sm.service_id = s.id
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
}

$activeShift = null;
$onDutyAgents = [];
$divisions = [];

try {
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
        'service_id' => (int) ($serviceInfo['service_id'] ?? 0),
    ]);
    $activeShift = $shiftStatement->fetch() ?: null;

    $agentsStatement = $pdo->prepare(
        'SELECT u.username, u.rank_name, ss.started_at
         FROM service_shifts ss
         INNER JOIN users u ON u.id = ss.user_id
         WHERE ss.service_id = :service_id
           AND ss.ended_at IS NULL
         ORDER BY ss.started_at ASC'
    );
    $agentsStatement->execute(['service_id' => (int) ($serviceInfo['service_id'] ?? 0)]);
    $onDutyAgents = $agentsStatement->fetchAll();

    $divisionsStatement = $pdo->prepare(
        'SELECT name
         FROM divisions
         WHERE service_id = :service_id
           AND is_active = 1
         ORDER BY sort_order ASC, name ASC'
    );
    $divisionsStatement->execute(['service_id' => (int) ($serviceInfo['service_id'] ?? 0)]);
    $divisions = $divisionsStatement->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $exception) {
    $activeShift = null;
    $onDutyAgents = [];
    $divisions = [];
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
  <link rel="stylesheet" href="/mdt.css?v=4" />
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
        <a href="#" class="mdt-nav-link disabled">Recherches <span class="mdt-placeholder">Soon</span></a>
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
            <div>
              <p class="mdt-kicker">Annonce service</p>
              <h2 id="motdTitleView"><?= htmlspecialchars((string) ($serviceInfo['motd_title'] ?? 'Annonce opérationnelle'), ENT_QUOTES, 'UTF-8') ?></h2>
            </div>
            <div class="mdt-motd-actions">
              <span class="mdt-timecode"><?= htmlspecialchars($updatedLabel, ENT_QUOTES, 'UTF-8') ?></span>
              <button type="button" id="motdEditButton" class="mdt-icon-button" title="Modifier l’annonce" aria-label="Modifier l’annonce">✎</button>
            </div>
          </div>

          <div id="motdView" class="mdt-motd-body bbcode-content"><?= renderBbCode((string) ($serviceInfo['motd_body'] ?? 'Aucune annonce active.')) ?></div>

          <form id="motdForm" class="mdt-motd-inline-editor" hidden>
            <div class="field-group">
              <label for="motdTitle">Titre</label>
              <input type="text" id="motdTitle" name="title" maxlength="120" value="<?= htmlspecialchars((string) ($serviceInfo['motd_title'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" required />
            </div>

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
            <p id="motdMessage" class="form-message"></p>
            <div class="mdt-form-actions">
              <button type="submit" class="mdt-button">Sauvegarder</button>
              <button type="button" id="motdCancelButton" class="mdt-button-secondary">Annuler</button>
            </div>
          </form>
        </section>

        <section class="mdt-dashboard-grid">
          <article class="mdt-card mdt-panel mdt-dispatch-panel">
            <div class="mdt-panel-header">
              <div>
                <p class="mdt-kicker">Dispatch</p>
                <h3>Unités actives</h3>
              </div>
              <button type="button" class="mdt-button-secondary" disabled>Créer unité</button>
            </div>

            <div class="mdt-dispatch-table">
              <div class="mdt-dispatch-row header">
                <span>Unité</span>
                <span>Statut</span>
                <span>Division</span>
                <span>PPA</span>
                <span>Agents</span>
              </div>
              <div class="mdt-dispatch-empty">
                Aucune unité dispatch active. Le module complet sera branché après la prise de service.
              </div>
            </div>

            <div class="mdt-dispatch-draft">
              <input type="text" value="FIB-01" aria-label="Nom unité" disabled />
              <input type="text" value="Disponible" aria-label="Statut unité" disabled />
              <select disabled>
                <option>Division active</option>
                <?php foreach ($divisions as $division): ?>
                  <option><?= htmlspecialchars((string) $division, ENT_QUOTES, 'UTF-8') ?></option>
                <?php endforeach; ?>
              </select>
              <select disabled>
                <option>PPA I</option>
                <option>PPA II</option>
                <option>PPA III</option>
                <option>PPA IV</option>
              </select>
            </div>
          </article>

          <article class="mdt-card mdt-panel">
            <div class="mdt-panel-header">
              <div>
                <p class="mdt-kicker">Timeclock</p>
                <h3>Effectifs en service</h3>
              </div>
              <span class="mdt-shift-pill <?= $activeShift ? 'on' : 'off' ?>" id="shiftStatus" data-started-at="<?= htmlspecialchars($shiftStartedAt, ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($shiftLabel, ENT_QUOTES, 'UTF-8') ?></span>
            </div>

            <p id="shiftTimer" class="mdt-shift-timer"><?= $activeShift ? 'Calcul du temps...' : 'Aucune prise de service active.' ?></p>

            <div class="mdt-duty-list">
              <?php if (empty($onDutyAgents)): ?>
                <p class="mdt-muted-line">Aucun agent en service actuellement.</p>
              <?php endif; ?>
              <?php foreach ($onDutyAgents as $agent): ?>
                <div class="mdt-duty-agent">
                  <strong><?= htmlspecialchars((string) $agent['username'], ENT_QUOTES, 'UTF-8') ?></strong>
                  <span><?= htmlspecialchars((string) ($agent['rank_name'] ?? 'Grade inconnu'), ENT_QUOTES, 'UTF-8') ?></span>
                  <small>Depuis <?= htmlspecialchars((string) $agent['started_at'], ENT_QUOTES, 'UTF-8') ?></small>
                </div>
              <?php endforeach; ?>
            </div>
          </article>
        </section>

        <section class="mdt-card mdt-panel mdt-modules-bottom">
          <h3>Modules service</h3>
          <div class="mdt-module-grid">
            <div class="mdt-module-tile"><strong>Recherches</strong>Recherche de personnes, dossiers et informations.</div>
            <div class="mdt-module-tile"><strong>Dossiers</strong>Fiches, enquêtes et suivis.</div>
            <div class="mdt-module-tile"><strong>Rapports</strong>Compte-rendus opérationnels.</div>
            <div class="mdt-module-tile"><strong>Divisions</strong>Unités internes et accès dédiés.</div>
          </div>
        </section>
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
  <script src="/motd.js?v=2"></script>
  <script src="/shift.js?v=1"></script>
</body>
</html>
