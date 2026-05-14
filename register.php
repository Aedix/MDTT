<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/db.php';

$pdo = getDatabaseConnection();
$services = $pdo->query('SELECT id, code, name FROM services WHERE is_active = 1 ORDER BY name ASC')->fetchAll();
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT FIB - Création de compte</title>
  <link rel="stylesheet" href="/style.css?v=6" />
</head>
<body>
  <main class="login-page">
    <section class="login-card" aria-label="Création de compte MDT">
      <div class="brand-block">
        <div class="seal">FIB</div>
        <p class="eyebrow">MDT Account Request</p>
        <h1>Création de compte</h1>
        <p class="subtitle">Le compte sera créé en attente de validation.</p>
      </div>

      <form id="registerForm" class="login-form">
        <div class="field-group">
          <label for="username">Username</label>
          <input type="text" id="username" name="username" placeholder="Ex : Austin" autocomplete="username" required />
        </div>

        <div class="field-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" placeholder="Minimum 8 caractères" autocomplete="new-password" required />
        </div>

        <div class="field-group">
          <label for="passwordConfirm">Confirm password</label>
          <input type="password" id="passwordConfirm" name="passwordConfirm" placeholder="Confirme le password" autocomplete="new-password" required />
        </div>

        <div class="field-group">
          <label for="serviceId">Service demandé</label>
          <select id="serviceId" name="serviceId" required>
            <option value="">Choisir un service</option>
            <?php foreach ($services as $service): ?>
              <option value="<?= (int) $service['id'] ?>">
                <?= htmlspecialchars($service['code'] . ' - ' . $service['name'], ENT_QUOTES, 'UTF-8') ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <p id="formMessage" class="form-message" aria-live="polite"></p>

        <button type="submit" class="primary-button">Créer le compte</button>
        <a href="/index.html" class="primary-button" style="display:block;text-align:center;text-decoration:none;background:rgba(255,255,255,0.08);">Retour connexion</a>
      </form>
    </section>
  </main>

  <script src="/register.js?v=2"></script>
</body>
</html>
