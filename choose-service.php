<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';

$user = requireAuthenticatedUser();
$pdo = getDatabaseConnection();

$servicesStatement = $pdo->prepare(
    'SELECT s.id, s.code, s.name, s.logo_path, r.name AS rank_name, us.is_active AS assigned
     FROM services s
     LEFT JOIN user_services us ON us.service_id = s.id AND us.user_id = :user_id AND us.is_active = 1
     LEFT JOIN ranks r ON r.id = us.rank_id
     WHERE s.is_active = 1
     ORDER BY s.code ASC'
);
$servicesStatement->execute(['user_id' => (int) $user['id']]);
$services = $servicesStatement->fetchAll();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - Sélection service</title>
  <link rel="stylesheet" href="/style.css?v=10" />
</head>
<body>
  <main class="service-select-page">
    <section class="service-select-shell">
      <div class="neutral-brand-block">
        <p class="eyebrow">Mobile Data Terminal</p>
        <h1>Choisir un service</h1>
        <p class="subtitle">Sélectionne le service avec lequel tu veux ouvrir la session MDT.</p>
      </div>

      <p id="formMessage" class="form-message" aria-live="polite"></p>

      <div class="service-grid">
        <?php foreach ($services as $service): ?>
          <?php $isAssigned = (int) ($service['assigned'] ?? 0) === 1; ?>
          <button
            type="button"
            class="service-card <?= $isAssigned ? 'available' : 'locked' ?>"
            data-service-id="<?= (int) $service['id'] ?>"
            <?= $isAssigned ? '' : 'disabled' ?>
          >
            <div class="service-logo-wrap">
              <img src="<?= htmlspecialchars($service['logo_path'] ?: '/assets/services/default.png', ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($service['code'], ENT_QUOTES, 'UTF-8') ?>" />
            </div>
            <strong><?= htmlspecialchars($service['code'], ENT_QUOTES, 'UTF-8') ?></strong>
            <span><?= htmlspecialchars($service['name'], ENT_QUOTES, 'UTF-8') ?></span>
            <small><?= $isAssigned ? htmlspecialchars((string) ($service['rank_name'] ?? 'Grade non défini'), ENT_QUOTES, 'UTF-8') : 'Non affecté' ?></small>
          </button>
        <?php endforeach; ?>
      </div>

      <button type="button" id="logoutButton" class="neutral-secondary-button">Déconnexion</button>
    </section>
  </main>

  <script src="/choose-service.js?v=1"></script>
</body>
</html>
