<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/permissions.php';

$user = requirePermission('panel.access');
$canManageRanks = userHasPermission($user, 'ranks.rename');
$canManageAccounts = userHasPermission($user, 'accounts.activate');
$canResetPasswords = userHasPermission($user, 'accounts.reset_password');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT FIB - Gestion</title>
  <link rel="stylesheet" href="/style.css?v=4" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Panel de gestion MDT">
      <div class="brand-block">
        <div class="seal">FIB</div>
        <p class="eyebrow">MDT Management</p>
        <h1>Panel de gestion</h1>
        <p class="subtitle">Accès selon permissions du rôle MDT.</p>
      </div>

      <div class="dashboard-info">
        <p><strong>Connecté :</strong> <?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></p>
        <p><strong>Role MDT :</strong> <?= htmlspecialchars((string) ($user['role'] ?? 'user'), ENT_QUOTES, 'UTF-8') ?></p>
        <p><strong>Activation comptes :</strong> <?= $canManageAccounts ? 'Oui' : 'Non' ?></p>
        <p><strong>Gestion grades :</strong> <?= $canManageRanks ? 'Oui' : 'Non' ?></p>
        <p><strong>Reset passwords :</strong> <?= $canResetPasswords ? 'Oui' : 'Non' ?></p>
      </div>

      <?php if (userHasPermission($user, 'accounts.view')): ?>
        <a href="/admin/accounts.php" class="primary-button" style="display:block;text-align:center;text-decoration:none;margin-bottom:12px;">Gestion des comptes</a>
      <?php endif; ?>

      <p class="form-message" data-type="info">Prochaine étape : validation des comptes, puis changement de grade.</p>

      <a href="/dashboard.php" class="primary-button" style="display:block;text-align:center;text-decoration:none;">Retour dashboard</a>
    </section>
  </main>
</body>
</html>
