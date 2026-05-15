<?php

declare(strict_types=1);

require_once __DIR__ . '/../includes/permissions.php';
require_once __DIR__ . '/../includes/db.php';

$user = requirePermission('accounts.view');
$canDeleteAccounts = userHasPermission($user, 'accounts.delete');
$canChangeRank = userHasPermission($user, 'accounts.change_rank');
$canAssignServices = isSuperAdminUser($user);
$pdo = getDatabaseConnection();

$users = $pdo->query(
    'SELECT id, username, service, rank_name, role, is_active, created_at
     FROM users
     ORDER BY is_active ASC, created_at DESC, username ASC'
)->fetchAll();

$services = $pdo->query('SELECT id, code, name FROM services WHERE is_active = 1 ORDER BY code ASC')->fetchAll();

$ranks = $pdo->query(
    'SELECT r.id, r.service_id, r.name, r.level, s.code AS service_code
     FROM ranks r
     INNER JOIN services s ON s.id = r.service_id
     WHERE r.is_active = 1
       AND s.is_active = 1
     ORDER BY s.code ASC, r.level ASC, r.sort_order ASC'
)->fetchAll();

$userServices = [];
try {
    $assignedRows = $pdo->query(
        'SELECT us.user_id, us.service_id, us.is_primary, s.code AS service_code, s.name AS service_name, r.name AS rank_name
         FROM user_services us
         INNER JOIN services s ON s.id = us.service_id
         LEFT JOIN ranks r ON r.id = us.rank_id
         WHERE us.is_active = 1
         ORDER BY us.is_primary DESC, s.code ASC'
    )->fetchAll();

    foreach ($assignedRows as $row) {
        $userServices[(int) $row['user_id']][] = $row;
    }
} catch (Throwable $exception) {
    $userServices = [];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - Comptes</title>
  <link rel="stylesheet" href="/style.css?v=11" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Gestion comptes MDT" style="max-width: 1100px;">
      <div class="brand-block">
        <div class="seal">MDT</div>
        <p class="eyebrow">MDT Accounts</p>
        <h1>Gestion des comptes</h1>
        <p class="subtitle">Validation, services, grades, désactivation et suppression.</p>
      </div>

      <p id="formMessage" class="form-message" aria-live="polite"></p>

      <?php foreach ($users as $account): ?>
        <div class="dashboard-info">
          <p><strong><?= htmlspecialchars($account['username'], ENT_QUOTES, 'UTF-8') ?></strong></p>
          <p>Service principal : <?= htmlspecialchars((string) $account['service'], ENT_QUOTES, 'UTF-8') ?></p>
          <p>Rank principal : <?= htmlspecialchars((string) $account['rank_name'], ENT_QUOTES, 'UTF-8') ?></p>
          <p>Role MDT : <?= htmlspecialchars((string) $account['role'], ENT_QUOTES, 'UTF-8') ?></p>
          <p>Status : <?= ((int) $account['is_active'] === 1) ? 'Actif' : 'En attente / désactivé' ?></p>

          <div class="assigned-services-list">
            <?php foreach (($userServices[(int) $account['id']] ?? []) as $assigned): ?>
              <span class="assigned-service-pill">
                <?= htmlspecialchars($assigned['service_code'], ENT_QUOTES, 'UTF-8') ?>
                <?= ((int) $assigned['is_primary'] === 1) ? '· Principal' : '' ?>
                <?php if ($assigned['rank_name']): ?>
                  · <?= htmlspecialchars($assigned['rank_name'], ENT_QUOTES, 'UTF-8') ?>
                <?php endif; ?>
                <?php if ($canAssignServices): ?>
                  <button type="button" class="service-remove-button" data-user-id="<?= (int) $account['id'] ?>" data-service-id="<?= (int) $assigned['service_id'] ?>">×</button>
                <?php endif; ?>
              </span>
            <?php endforeach; ?>
          </div>

          <?php if ($canAssignServices): ?>
            <div class="account-service-manager">
              <div class="field-group">
                <label for="service-<?= (int) $account['id'] ?>">Affecter un service</label>
                <select id="service-<?= (int) $account['id'] ?>" class="account-service-select" data-user-id="<?= (int) $account['id'] ?>">
                  <option value="">Choisir un service</option>
                  <?php foreach ($services as $service): ?>
                    <option value="<?= (int) $service['id'] ?>">
                      <?= htmlspecialchars($service['code'] . ' - ' . $service['name'], ENT_QUOTES, 'UTF-8') ?>
                    </option>
                  <?php endforeach; ?>
                </select>
              </div>

              <div class="field-group">
                <label for="service-rank-<?= (int) $account['id'] ?>">Grade du service</label>
                <select id="service-rank-<?= (int) $account['id'] ?>" class="account-service-rank-select" data-user-id="<?= (int) $account['id'] ?>">
                  <option value="">Grade en attente</option>
                  <?php foreach ($ranks as $rank): ?>
                    <option value="<?= (int) $rank['id'] ?>" data-service-id="<?= (int) $rank['service_id'] ?>">
                      <?= htmlspecialchars($rank['service_code'] . ' - ' . $rank['name'], ENT_QUOTES, 'UTF-8') ?>
                    </option>
                  <?php endforeach; ?>
                </select>
              </div>

              <label class="inline-check">
                <input type="checkbox" class="account-service-primary" data-user-id="<?= (int) $account['id'] ?>" />
                Définir comme service principal
              </label>

              <button type="button" class="primary-button service-assign-button" data-user-id="<?= (int) $account['id'] ?>">Affecter le service</button>
            </div>
          <?php endif; ?>

          <?php if ($canChangeRank): ?>
            <div class="field-group" style="margin-bottom:12px;">
              <label for="rank-<?= (int) $account['id'] ?>">Modifier le grade RP principal</label>
              <select id="rank-<?= (int) $account['id'] ?>" class="account-rank-select" data-user-id="<?= (int) $account['id'] ?>">
                <option value="">Choisir un grade</option>
                <?php foreach ($ranks as $rank): ?>
                  <option value="<?= (int) $rank['id'] ?>">
                    <?= htmlspecialchars($rank['service_code'] . ' - ' . $rank['name'], ENT_QUOTES, 'UTF-8') ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
          <?php endif; ?>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
            <button type="button" class="primary-button account-status-button" data-user-id="<?= (int) $account['id'] ?>" data-is-active="1">Activer</button>
            <button type="button" class="primary-button account-status-button" data-user-id="<?= (int) $account['id'] ?>" data-is-active="0" style="background:rgba(255,107,107,0.75);">Désactiver</button>
            <?php if ($canDeleteAccounts): ?>
              <button type="button" class="primary-button account-delete-button" data-user-id="<?= (int) $account['id'] ?>" data-username="<?= htmlspecialchars($account['username'], ENT_QUOTES, 'UTF-8') ?>" style="background:rgba(160,30,30,0.85);">Supprimer</button>
            <?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>

      <a href="/admin/index.php" class="primary-button" style="display:block;text-align:center;text-decoration:none;">Retour panel</a>
    </section>
  </main>

  <script src="/admin/accounts.js?v=4"></script>
</body>
</html>
