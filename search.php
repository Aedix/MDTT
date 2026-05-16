<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';

$user = requireAuthenticatedUser();
$canOpenPanel = canOpenManagementPanel($user);

$activeServiceCode = (string) ($user['active_service_code'] ?? $user['service'] ?? 'MDT');
$activeServiceName = (string) ($user['active_service_name'] ?? $activeServiceCode);
$activeRankName = (string) ($user['active_rank_name'] ?? $user['rank_name'] ?? 'Non défini');
$activeServiceLogo = (string) ($user['active_service_logo'] ?? '');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - Recherches</title>
  <link rel="stylesheet" href="/style.css?v=11" />
  <link rel="stylesheet" href="/mdt.css?v=7" />
  <link rel="stylesheet" href="/search.css?v=1" />
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
        <a href="/dashboard.php" class="mdt-nav-link">Dashboard</a>
        <a href="/search.php" class="mdt-nav-link active">Recherches</a>
        <a href="#" class="mdt-nav-link disabled">Dossiers <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Rapports <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Dispatch <span class="mdt-placeholder">Soon</span></a>
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
          <h1>Recherches MDT</h1>
        </div>
        <div class="mdt-top-actions">
          <div class="mdt-user-mini">
            <strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong>
            <span><?= htmlspecialchars($activeServiceCode . ' · ' . $activeRankName, ENT_QUOTES, 'UTF-8') ?></span>
          </div>
          <a href="/dashboard.php" class="mdt-button-secondary">Retour dashboard</a>
          <button type="button" id="logoutButton" class="mdt-button-danger">Déconnexion</button>
        </div>
      </header>

      <main class="mdt-content search-page">
        <section class="mdt-card search-hero-card">
          <div>
            <p class="mdt-kicker">Base de données civile</p>
            <h2>Citoyens & véhicules</h2>
            <p class="search-muted">Recherche, recensement, véhicules associés et casier judiciaire.</p>
          </div>
          <div class="search-actions">
            <button type="button" id="newCitizenButton" class="mdt-button">Nouveau citoyen</button>
          </div>
        </section>

        <section class="search-layout">
          <article class="mdt-card search-list-card">
            <div class="search-toolbar">
              <input type="search" id="citizenSearchInput" placeholder="Rechercher nom, téléphone, adresse, emploi, affiliation, plaque..." autocomplete="off" />
              <button type="button" id="refreshCitizensButton" class="mdt-button-secondary">Actualiser</button>
            </div>
            <div id="citizensList" class="citizens-list">
              <p class="search-empty">Chargement des citoyens...</p>
            </div>
          </article>

          <article class="mdt-card citizen-panel" id="citizenPanel">
            <div class="citizen-empty-state">
              <p class="mdt-kicker">Fiche citoyen</p>
              <h3>Sélectionne un citoyen</h3>
              <p>La fiche complète, les véhicules et le casier judiciaire apparaîtront ici.</p>
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>

  <template id="citizenPanelTemplate">
    <div class="citizen-panel-inner">
      <div class="citizen-profile-header">
        <div class="citizen-photo-box">
          <img id="citizenPhotoPreview" alt="Photo citoyen" hidden />
          <span id="citizenPhotoFallback">PHOTO</span>
        </div>
        <div>
          <p class="mdt-kicker">Fiche citoyen</p>
          <h2 id="citizenFullName">Nouveau citoyen</h2>
          <p id="citizenMeta" class="search-muted">Non enregistré</p>
        </div>
        <div class="citizen-panel-actions">
          <button type="button" id="saveCitizenButton" class="mdt-button">Sauvegarder</button>
          <button type="button" id="resetCitizenButton" class="mdt-button-secondary">Réinitialiser</button>
        </div>
      </div>

      <input type="hidden" id="citizenId" />
      <input type="hidden" id="citizenPhotoPath" />

      <div class="citizen-form-grid">
        <section>
          <h3>Identité</h3>
          <div class="form-grid two">
            <label>Nom<input id="lastName" type="text" /></label>
            <label>Prénom<input id="firstName" type="text" /></label>
            <label>Date de naissance<input id="birthDate" type="date" /></label>
            <label>Téléphone<input id="phone" type="text" /></label>
            <label class="wide">Adresse<input id="address" type="text" /></label>
            <label class="wide">Emploi / profession<input id="job" type="text" /></label>
          </div>
        </section>

        <section>
          <h3>Description physique</h3>
          <div class="form-grid two">
            <label>Cheveux<input id="hairColor" type="text" /></label>
            <label>Yeux<input id="eyeColor" type="text" /></label>
            <label>Taille en cm<input id="heightCm" type="number" min="1" max="260" /></label>
            <label class="wide">Particularités<textarea id="physicalDetails" rows="3"></textarea></label>
          </div>
        </section>

        <section>
          <h3>Informations RP</h3>
          <div class="form-grid two">
            <label>Appartenance / affiliation<input id="affiliation" type="text" /></label>
            <label>Organisation connue<input id="knownOrganization" type="text" /></label>
            <label>Groupe criminel connu<input id="knownCriminalGroup" type="text" /></label>
            <label>Statut particulier<input id="specialStatus" type="text" /></label>
          </div>
        </section>

        <section>
          <h3>Photo & notes</h3>
          <div class="form-grid two">
            <label>Photo citoyen<input id="citizenPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" /></label>
            <label class="wide">Notes internes<textarea id="notes" rows="5"></textarea></label>
          </div>
        </section>
      </div>

      <div class="citizen-subsections">
        <section class="citizen-subcard">
          <div class="subcard-header">
            <div>
              <p class="mdt-kicker">Véhicules</p>
              <h3>Véhicules enregistrés</h3>
            </div>
            <button type="button" id="newVehicleButton" class="mdt-button-secondary">Ajouter véhicule</button>
          </div>
          <div id="vehiclesList" class="record-list"></div>
          <form id="vehicleForm" class="inline-record-form" hidden>
            <input type="hidden" id="vehicleId" />
            <div class="form-grid two">
              <label>Plaque<input id="vehiclePlate" type="text" /></label>
              <label>Modèle<input id="vehicleModel" type="text" /></label>
              <label>Couleur<input id="vehicleColor" type="text" /></label>
              <label>Catégorie<input id="vehicleCategory" type="text" /></label>
              <label>Statut<select id="vehicleStatus"><option>Actif</option><option>Recherché</option><option>Saisi</option><option>Volé</option><option>Inactif</option></select></label>
              <label class="wide">Notes<textarea id="vehicleNotes" rows="3"></textarea></label>
            </div>
            <div class="inline-actions"><button type="submit" class="mdt-button">Valider véhicule</button><button type="button" id="cancelVehicleButton" class="mdt-button-secondary">Annuler</button></div>
          </form>
        </section>

        <section class="citizen-subcard">
          <div class="subcard-header">
            <div>
              <p class="mdt-kicker">Casier judiciaire</p>
              <h3>Infractions enregistrées</h3>
            </div>
            <button type="button" id="newRecordButton" class="mdt-button-secondary">Ajouter infraction</button>
          </div>
          <div id="recordsList" class="record-list"></div>
          <form id="recordForm" class="inline-record-form" hidden>
            <input type="hidden" id="recordId" />
            <div class="form-grid two">
              <label>Date<input id="offenseDate" type="date" /></label>
              <label>Type d’infraction<input id="offenseType" type="text" /></label>
              <label>Statut<select id="caseStatus"><option>Ouvert</option><option>En enquête</option><option>Classé</option><option>Condamné</option><option>Archivé</option></select></label>
              <label>Sanction / peine<input id="sanction" type="text" /></label>
              <label class="wide">Description<textarea id="description" rows="4"></textarea></label>
              <label class="wide">Notes supplémentaires<textarea id="recordNotes" rows="3"></textarea></label>
            </div>
            <div class="inline-actions"><button type="submit" class="mdt-button">Valider infraction</button><button type="button" id="cancelRecordButton" class="mdt-button-secondary">Annuler</button></div>
          </form>
        </section>
      </div>
      <p id="citizenMessage" class="form-message"></p>
    </div>
  </template>

  <script>
    const logoutButton = document.querySelector('#logoutButton');
    logoutButton.addEventListener('click', async () => {
      const response = await fetch('/api/logout.php', { method: 'POST', credentials: 'same-origin' });
      const result = await response.json();
      window.location.href = result.redirect || '/index.html';
    });
  </script>
  <script src="/search.js?v=1"></script>
</body>
</html>
