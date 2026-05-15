<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';
require_once __DIR__ . '/includes/db.php';

$user = requireAuthenticatedUser();
$canOpenPanel = canOpenManagementPanel($user);
$canUpdateMotd = userHasPermission($user, 'service.motd.update');
$pdo = getDatabaseConnection();

$activeServiceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
$activeServiceName = (string) ($user['active_service_name'] ?? $activeServiceCode);
$activeRankName = (string) ($user['active_rank_name'] ?? $user['rank_name'] ?? 'Non défini');
$activeServiceLogo = (string) ($user['active_service_logo'] ?? '');

$serviceInfo = [
    'motd_title' => 'Annonce opérationnelle',
    'motd_body' => 'Aucune annonce active pour le moment.',
    'motd_updated_at' => null,
];

try {
    $serviceStatement = $pdo->prepare(
        'SELECT logo_path, motd_title, motd_body, motd_updated_at
         FROM services
         WHERE code = :code
         LIMIT 1'
    );
    $serviceStatement->execute(['code' => $activeServiceCode]);
    $serviceRow = $serviceStatement->fetch();

    if ($serviceRow) {
        $activeServiceLogo = (string) ($serviceRow['logo_path'] ?? $activeServiceLogo);
        $serviceInfo = array_merge($serviceInfo, $serviceRow);
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
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="stylesheet" href="/style.css?v=11" />
  <link rel="stylesheet" href="/mdt.css?v=2" />
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
          <button type="button" id="logoutButton" class="mdt-button-danger">Déconnexion</button>
        </div>
      </header>

      <main class="mdt-content">
        <section class="mdt-card mdt-motd-card">
          <div class="mdt-motd-header">
            <div>
              <p class="mdt-kicker">Annonce service</p>
              <h2><?= htmlspecialchars((string) ($serviceInfo['motd_title'] ?? 'Annonce opérationnelle'), ENT_QUOTES, 'UTF-8') ?></h2>
            </div>
            <span class="mdt-timecode"><?= htmlspecialchars($updatedLabel, ENT_QUOTES, 'UTF-8') ?></span>
          </div>

          <p class="mdt-motd-body"><?= nl2br(htmlspecialchars((string) ($serviceInfo['motd_body'] ?? 'Aucune annonce active.'), ENT_QUOTES, 'UTF-8')) ?></p>

          <?php if ($canUpdateMotd): ?>
            <button type="button" id="motdEditButton" class="mdt-button-secondary">Modifier l’annonce</button>
            <form id="motdForm" class="mdt-motd-form" hidden>
              <div class="field-group">
                <label for="motdTitle">Titre</label>
                <input type="text" id="motdTitle" name="title" maxlength="160" value="<?= htmlspecialchars((string) ($serviceInfo['motd_title'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" required />
              </div>
              <div class="field-group">
                <label for="motdBody">Annonce</label>
                <textarea id="motdBody" name="body" maxlength="1200" required><?= htmlspecialchars((string) ($serviceInfo['motd_body'] ?? ''), ENT_QUOTES, 'UTF-8') ?></textarea>
              </div>
              <p id="motdMessage" class="form-message"></p>
              <div class="mdt-form-actions">
                <button type="submit" class="mdt-button">Sauvegarder</button>
                <button type="button" id="motdCancelButton" class="mdt-button-secondary">Annuler</button>
              </div>
            </form>
          <?php endif; ?>
        </section>

        <section class="mdt-section-grid compact-dashboard">
          <article class="mdt-card mdt-panel">
            <h3>Profil opérationnel</h3>
            <div class="mdt-list-line"><span>Agent</span><strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="mdt-list-line"><span>Service actif</span><strong><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="mdt-list-line"><span>Grade</span><strong><?= htmlspecialchars($activeRankName, ENT_QUOTES, 'UTF-8') ?></strong></div>
          </article>

          <article class="mdt-card mdt-panel">
            <h3>Modules service</h3>
            <div class="mdt-module-grid">
              <div class="mdt-module-tile"><strong>Recherches</strong>Recherche de personnes, dossiers et informations.</div>
              <div class="mdt-module-tile"><strong>Dossiers</strong>Fiches, enquêtes et suivis.</div>
              <div class="mdt-module-tile"><strong>Rapports</strong>Compte-rendus opérationnels.</div>
              <div class="mdt-module-tile"><strong>Divisions</strong>Unités internes et accès dédiés.</div>
            </div>
          </article>
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
  <script src="/motd.js?v=1"></script>
</body>
</html>
