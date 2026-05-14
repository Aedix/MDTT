<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/permissions.php';

$user = requireMinimumRole('admin');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT FIB - Admin</title>
  <link rel="stylesheet" href="/style.css?v=4" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Panel admin MDT">
      <div class="brand-block">
        <div class="seal">FIB</div>
        <p class="eyebrow">MDT Administration</p>
        <h1>Panel admin</h1>
        <p class="subtitle">Accès réservé aux rôles admin et super_admin.</p>
      </div>

      <div class="dashboard-info">
        <p><strong>Connecté :</strong> <?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></p>
        <p><strong>Role MDT :</strong> <?= htmlspecialchars((string) ($user['role'] ?? 'user'), ENT_QUOTES, 'UTF-8') ?></p>
      </div>

      <p class="form-message" data-type="info">Les outils admin seront ajoutés ici : validation de comptes, reset password, gestion des rôles.</p>

      <a href="/dashboard.php" class="primary-button" style="display:block;text-align:center;text-decoration:none;">Retour dashboard</a>
    </section>
  </main>
</body>
</html>
