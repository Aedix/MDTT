<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';

$user = requireAuthenticatedUser();
$isAdmin = isAdminUser($user);
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT FIB - Dashboard</title>
  <link rel="stylesheet" href="./style.css?v=4" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Dashboard MDT FIB">
      <div class="brand-block">
        <div class="seal">FIB</div>
        <p class="eyebrow">Federal Investigation Bureau</p>
        <h1>Dashboard MDT</h1>
        <p class="subtitle">Bienvenue, <?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></p>
      </div>

      <div class="dashboard-info">
        <p><strong>Service :</strong> <?= htmlspecialchars((string) ($user['service'] ?? 'Non défini'), ENT_QUOTES, 'UTF-8') ?></p>
        <p><strong>Rank RP :</strong> <?= htmlspecialchars((string) ($user['rank_name'] ?? 'Non défini'), ENT_QUOTES, 'UTF-8') ?></p>
        <p><strong>Role MDT :</strong> <?= htmlspecialchars((string) ($user['role'] ?? 'user'), ENT_QUOTES, 'UTF-8') ?></p>
      </div>

      <?php if ($isAdmin): ?>
        <a href="/admin/index.php" class="admin-link">Panel admin</a>
      <?php endif; ?>

      <button type="button" id="logoutButton" class="primary-button">Déconnexion</button>
    </section>
  </main>

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
