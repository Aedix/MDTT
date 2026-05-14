<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/db.php';

$user = requirePermission('accounts.view');
$pdo = getDatabaseConnection();

$users = $pdo->query(
    'SELECT id, username, service, rank_name, role, is_active, created_at
     FROM users
     ORDER BY is_active ASC, created_at DESC, username ASC'
)->fetchAll();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - Comptes</title>
  <link rel="stylesheet" href="/style.css?v=4" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Gestion comptes MDT" style="max-width: 960px;">
      <div class="brand-block">
        <div class="seal">FIB</div>
        <p class="eyebrow">MDT Accounts</p>
        <h1>Gestion des comptes</h1>
        <p class="subtitle">Validation et désactivation des comptes.</p>
      </div>

      <p id="formMessage" class="form-message" aria-live="polite"></p>

      <?php foreach ($users as $account): ?>
        <div class="dashboard-info">
          <p><strong><?= htmlspecialchars($account['username'], ENT_QUOTES, 'UTF-8') ?></strong></p>
          <p>Service : <?= htmlspecialchars((string) $account['service'], ENT_QUOTES, 'UTF-8') ?></p>
          <p>Rank : <?= htmlspecialchars((string) $account['rank_name'], ENT_QUOTES, 'UTF-8') ?></p>
          <p>Role : <?= htmlspecialchars((string) $account['role'], ENT_QUOTES, 'UTF-8') ?></p>
          <p>Status : <?= ((int) $account['is_active'] === 1) ? 'Actif' : 'En attente / désactivé' ?></p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button type="button" class="primary-button account-status-button" data-user-id="<?= (int) $account['id'] ?>" data-is-active="1">Activer</button>
            <button type="button" class="primary-button account-status-button" data-user-id="<?= (int) $account['id'] ?>" data-is-active="0" style="background:rgba(255,107,107,0.75);">Désactiver</button>
          </div>
        </div>
      <?php endforeach; ?>

      <a href="/admin/index.php" class="primary-button" style="display:block;text-align:center;text-decoration:none;">Retour panel</a>
    </section>
  </main>

  <script src="/admin/accounts.js?v=1"></script>
</body>
</html>
