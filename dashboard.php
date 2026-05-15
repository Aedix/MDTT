<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';
require_once __DIR__ . '/includes/db.php';

$user = requireAuthenticatedUser();
$canOpenPanel = canOpenManagementPanel($user);
$pdo = getDatabaseConnection();

$activeServiceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
$activeServiceName = (string) ($user['active_service_name'] ?? $activeServiceCode);
$activeRankName = (string) ($user['active_rank_name'] ?? $user['rank_name'] ?? 'Non défini');
$activeServiceLogo = (string) ($user['active_service_logo'] ?? '');

$totalUsers = (int) $pdo->query('SELECT COUNT(*) AS total FROM users')->fetch()['total'];
$activeUsers = (int) $pdo->query('SELECT COUNT(*) AS total FROM users WHERE is_active = 1')->fetch()['total'];
$pendingUsers = (int) $pdo->query('SELECT COUNT(*) AS total FROM users WHERE is_active = 0')->fetch()['total'];
$totalRanks = (int) $pdo->query('SELECT COUNT(*) AS total FROM ranks WHERE is_active = 1')->fetch()['total'];

$serviceUsers = 0;
try {
    $serviceUsersStatement = $pdo->prepare(
        'SELECT COUNT(*) AS total
         FROM user_services us
         INNER JOIN services s ON s.id = us.service_id
         WHERE s.code = :service_code
           AND us.is_active = 1'
    );
    $serviceUsersStatement->execute(['service_code' => $activeServiceCode]);
    $serviceUsers = (int) $serviceUsersStatement->fetch()['total'];
} catch (Throwable $exception) {
    $fallbackStatement = $pdo->prepare('SELECT COUNT(*) AS total FROM users WHERE service = :service_code');
    $fallbackStatement->execute(['service_code' => $activeServiceCode]);
    $serviceUsers = (int) $fallbackStatement->fetch()['total'];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="stylesheet" href="/style.css?v=11" />
  <link rel="stylesheet" href="/mdt.css?v=1" />
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
        <a href="#" class="mdt-nav-link disabled">Agents <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Dossiers <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Rapports <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Recherches <span class="mdt-placeholder">Soon</span></a>
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
        <section class="mdt-hero">
          <article class="mdt-card mdt-hero-main">
            <p class="mdt-kicker">Session active</p>
            <h2>Bienvenue dans le terminal <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></h2>
            <p>
              Ce dashboard est la base du service actif. Les modules Agents, Dossiers, Rapports,
              Recherches et Divisions seront branchés progressivement sur cette structure.
            </p>
          </article>

          <article class="mdt-card mdt-service-card">
            <div class="mdt-service-logo">
              <?php if ($activeServiceLogo): ?>
                <img src="<?= htmlspecialchars($activeServiceLogo, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?>" />
              <?php else: ?>
                <?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?>
              <?php endif; ?>
            </div>
            <div>
              <p class="mdt-kicker">Service</p>
              <h3><?= htmlspecialchars($activeServiceName, ENT_QUOTES, 'UTF-8') ?></h3>
            </div>
          </article>
        </section>

        <section class="mdt-grid" aria-label="Statistiques MDT">
          <article class="mdt-card mdt-stat">
            <span>Comptes MDT</span>
            <strong><?= $totalUsers ?></strong>
            <p>Total utilisateurs.</p>
          </article>
          <article class="mdt-card mdt-stat">
            <span>Comptes actifs</span>
            <strong><?= $activeUsers ?></strong>
            <p>Peuvent se connecter.</p>
          </article>
          <article class="mdt-card mdt-stat">
            <span>En attente</span>
            <strong><?= $pendingUsers ?></strong>
            <p>À valider ou désactivés.</p>
          </article>
          <article class="mdt-card mdt-stat">
            <span><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?> membres</span>
            <strong><?= $serviceUsers ?></strong>
            <p>Affectés au service actif.</p>
          </article>
        </section>

        <section class="mdt-section-grid">
          <article class="mdt-card mdt-panel">
            <h3>Profil opérationnel</h3>
            <div class="mdt-list-line"><span>Username</span><strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="mdt-list-line"><span>Service actif</span><strong><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="mdt-list-line"><span>Grade RP</span><strong><?= htmlspecialchars($activeRankName, ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="mdt-list-line"><span>Rôle MDT</span><strong><?= htmlspecialchars((string) ($user['role'] ?? 'user'), ENT_QUOTES, 'UTF-8') ?></strong></div>
          </article>

          <article class="mdt-card mdt-panel">
            <h3>Modules service</h3>
            <div class="mdt-module-grid">
              <div class="mdt-module-tile"><strong>Agents</strong>Gestion des membres du service.</div>
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
</body>
</html>
