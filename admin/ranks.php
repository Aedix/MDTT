<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/db.php';

$user = requirePermission('ranks.view');
$canCreateRanks = userHasPermission($user, 'ranks.create');
$canUpdateRanks = userHasPermission($user, 'ranks.rename') || userHasPermission($user, 'ranks.move');
$canDeleteRanks = userHasPermission($user, 'ranks.delete');
$pdo = getDatabaseConnection();

$services = $pdo->query('SELECT id, code, name FROM services WHERE is_active = 1 ORDER BY code ASC')->fetchAll();

$ranks = $pdo->query(
    'SELECT r.id, r.service_id, r.code, r.name, r.level, r.sort_order, r.is_command, r.is_active, s.code AS service_code
     FROM ranks r
     INNER JOIN services s ON s.id = r.service_id
     WHERE s.is_active = 1
     ORDER BY s.code ASC, r.level ASC, r.sort_order ASC, r.name ASC'
)->fetchAll();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - Grades</title>
  <link rel="stylesheet" href="/style.css?v=8" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Gestion grades MDT" style="max-width: 980px;">
      <div class="brand-block">
        <div class="seal">FIB</div>
        <p class="eyebrow">MDT Ranks</p>
        <h1>Gestion des grades</h1>
        <p class="subtitle">Créer, renommer, ordonner ou désactiver les grades RP.</p>
      </div>

      <p id="formMessage" class="form-message" aria-live="polite"></p>

      <?php if ($canCreateRanks): ?>
        <form id="createRankForm" class="dashboard-info">
          <h2 style="margin-top:0;">Créer un grade</h2>
          <div class="field-group">
            <label for="serviceId">Service</label>
            <select id="serviceId" name="serviceId" required>
              <option value="">Choisir un service</option>
              <?php foreach ($services as $service): ?>
                <option value="<?= (int) $service['id'] ?>">
                  <?= htmlspecialchars($service['code'] . ' - ' . $service['name'], ENT_QUOTES, 'UTF-8') ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="field-group">
            <label for="name">Nom du grade</label>
            <input type="text" id="name" name="name" placeholder="Ex : Captain" required />
          </div>

          <div class="field-group">
            <label for="level">Niveau</label>
            <input type="number" id="level" name="level" min="1" placeholder="Ex : 60" required />
          </div>

          <div class="field-group">
            <label for="sortOrder">Ordre d'affichage</label>
            <input type="number" id="sortOrder" name="sortOrder" min="1" placeholder="Ex : 60" />
          </div>

          <label style="display:flex;gap:8px;align-items:center;margin:8px 0 14px;">
            <input type="checkbox" id="isCommand" name="isCommand" style="width:auto;" />
            Grade commandement
          </label>

          <button type="submit" class="primary-button">Créer le grade</button>
        </form>
      <?php endif; ?>

      <?php foreach ($ranks as $rank): ?>
        <div class="dashboard-info" style="opacity: <?= ((int) $rank['is_active'] === 1) ? '1' : '0.55' ?>;">
          <p><strong><?= htmlspecialchars($rank['service_code'] . ' - ' . $rank['name'], ENT_QUOTES, 'UTF-8') ?></strong></p>
          <p>Code : <?= htmlspecialchars($rank['code'], ENT_QUOTES, 'UTF-8') ?> | Status : <?= ((int) $rank['is_active'] === 1) ? 'Actif' : 'Désactivé' ?></p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:10px;">
            <div class="field-group">
              <label for="rank-name-<?= (int) $rank['id'] ?>">Nom</label>
              <input type="text" id="rank-name-<?= (int) $rank['id'] ?>" value="<?= htmlspecialchars($rank['name'], ENT_QUOTES, 'UTF-8') ?>" <?= $canUpdateRanks ? '' : 'disabled' ?> />
            </div>
            <div class="field-group">
              <label for="rank-level-<?= (int) $rank['id'] ?>">Niveau</label>
              <input type="number" id="rank-level-<?= (int) $rank['id'] ?>" value="<?= (int) $rank['level'] ?>" <?= $canUpdateRanks ? '' : 'disabled' ?> />
            </div>
            <div class="field-group">
              <label for="rank-sort-<?= (int) $rank['id'] ?>">Ordre</label>
              <input type="number" id="rank-sort-<?= (int) $rank['id'] ?>" value="<?= (int) $rank['sort_order'] ?>" <?= $canUpdateRanks ? '' : 'disabled' ?> />
            </div>
          </div>

          <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
            <input type="checkbox" id="rank-command-<?= (int) $rank['id'] ?>" style="width:auto;" <?= ((int) $rank['is_command'] === 1) ? 'checked' : '' ?> <?= $canUpdateRanks ? '' : 'disabled' ?> />
            Grade commandement
          </label>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
            <?php if ($canUpdateRanks): ?>
              <button type="button" class="primary-button rank-update-button" data-rank-id="<?= (int) $rank['id'] ?>">Sauvegarder</button>
            <?php endif; ?>
            <?php if ($canDeleteRanks && (int) $rank['is_active'] === 1): ?>
              <button type="button" class="primary-button rank-delete-button" data-rank-id="<?= (int) $rank['id'] ?>" data-rank-name="<?= htmlspecialchars($rank['name'], ENT_QUOTES, 'UTF-8') ?>" style="background:rgba(160,30,30,0.85);">Désactiver</button>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>

      <a href="/admin/index.php" class="primary-button" style="display:block;text-align:center;text-decoration:none;">Retour panel</a>
    </section>
  </main>

  <script src="/admin/ranks.js?v=1"></script>
</body>
</html>
