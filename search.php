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
  <link rel="stylesheet" href="/search.css?v=6" />
</head>
<body class="mdt-body service-<?= htmlspecialchars(strtolower($activeServiceCode), ENT_QUOTES, 'UTF-8') ?>">
  <div class="mdt-shell">
    <aside class="mdt-sidebar">
      <div class="mdt-brand">
        <div class="mdt-brand-logo"><?php if ($activeServiceLogo): ?><img src="<?= htmlspecialchars($activeServiceLogo, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?>" /><?php else: ?><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?><?php endif; ?></div>
        <div><p class="mdt-brand-kicker">Mobile Data Terminal</p><h1 class="mdt-brand-title"><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></h1></div>
      </div>
      <nav class="mdt-nav" aria-label="Navigation MDT">
        <a href="/dashboard.php" class="mdt-nav-link">Dashboard</a><a href="/search.php" class="mdt-nav-link active">Recherches</a><a href="#" class="mdt-nav-link disabled">Dossiers <span class="mdt-placeholder">Soon</span></a><a href="/reports.php" class="mdt-nav-link">Rapports</a><a href="#" class="mdt-nav-link disabled">Dispatch <span class="mdt-placeholder">Soon</span></a><a href="#" class="mdt-nav-link disabled">Divisions <span class="mdt-placeholder">Soon</span></a><a href="#" class="mdt-nav-link disabled">Paramètres <span class="mdt-placeholder">Soon</span></a><?php if ($canOpenPanel): ?><a href="/admin/index.php" class="mdt-nav-link management">Panel de gestion</a><?php endif; ?>
      </nav>
      <div class="mdt-sidebar-footer"><strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong><span><?= htmlspecialchars($activeRankName, ENT_QUOTES, 'UTF-8') ?></span></div>
    </aside>

    <div class="mdt-main">
      <header class="mdt-topbar"><div><p class="mdt-kicker"><?= htmlspecialchars($activeServiceName, ENT_QUOTES, 'UTF-8') ?></p><h1>Recherches MDT</h1></div><div class="mdt-top-actions"><div class="mdt-user-mini"><strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong><span><?= htmlspecialchars($activeServiceCode . ' · ' . $activeRankName, ENT_QUOTES, 'UTF-8') ?></span></div><a href="/dashboard.php" class="mdt-button-secondary">Retour dashboard</a><button type="button" id="logoutButton" class="mdt-button-danger">Déconnexion</button></div></header>

      <main class="mdt-content search-page">
        <section class="search-command-card"><div class="search-command-title"><p class="mdt-kicker">Base civile</p><h2>Citoyens</h2></div><div class="search-command-bar"><input type="search" id="citizenSearchInput" placeholder="Nom, téléphone, adresse, emploi, affiliation, plaque..." autocomplete="off" /><button type="button" id="newCitizenButton" class="mdt-button">+ Citoyen</button></div></section>
        <section class="search-layout"><aside class="mdt-card search-list-card"><div class="search-list-header"><span>Résultats</span><div class="search-list-tools"><small id="citizenCount">—</small><button type="button" id="refreshCitizensButton" class="search-refresh-button" title="Actualiser">↻</button></div></div><div id="citizensList" class="citizens-list"><p class="search-empty">Chargement des citoyens...</p></div></aside><article class="mdt-card citizen-panel" id="citizenPanel"><div class="citizen-empty-state"><p class="mdt-kicker">Fiche citoyen</p><h3>Sélectionne un citoyen</h3><p>La fiche complète, les véhicules et le casier judiciaire apparaîtront ici.</p></div></article></section>
      </main>
    </div>
  </div>

  <template id="citizenPanelTemplate">
    <div class="citizen-panel-inner" data-editing="1">
      <div class="citizen-profile-header compact">
        <div class="citizen-photo-box"><button type="button" class="citizen-photo-trigger" id="citizenPhotoTrigger" title="Ajouter ou changer la photo"><img id="citizenPhotoPreview" alt="Photo citoyen" hidden /><span id="citizenPhotoFallback">ID</span><small>Changer photo · max 4 Mo</small></button><button type="button" class="citizen-photo-expand" id="citizenPhotoExpand" title="Agrandir la photo" aria-label="Agrandir la photo">⛶</button></div>
        <input id="citizenPhotoInput" class="citizen-photo-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
        <input type="hidden" id="citizenPhotoPath" />
        <input type="hidden" id="healthStatus" value="alive" />
        <div class="citizen-profile-main"><p class="mdt-kicker">Fiche citoyen</p><h2 id="citizenFullName">Nouveau citoyen</h2><p id="citizenMeta" class="search-muted">Non enregistré</p><div class="citizen-quick-tags" id="citizenQuickTags"></div></div>
        <div class="citizen-panel-actions"><button type="button" id="editCitizenButton" class="search-icon-button edit" hidden title="Modifier">✎</button><button type="button" id="saveCitizenButton" class="mdt-button">Sauvegarder</button><button type="button" id="resetCitizenButton" class="mdt-button-secondary">Annuler</button></div>
      </div>
      <input type="hidden" id="citizenId" />
      <nav class="citizen-tabs" aria-label="Sections fiche citoyen"><button type="button" class="citizen-tab active" data-tab="identity">Identité</button><button type="button" class="citizen-tab" data-tab="physical">Physique</button><button type="button" class="citizen-tab" data-tab="affiliation">Appartenance</button><button type="button" class="citizen-tab" data-tab="vehicles">Véhicules</button><button type="button" class="citizen-tab" data-tab="records">Casier</button><button type="button" class="citizen-tab" data-tab="notes">Notes</button></nav>
      <div class="citizen-tab-panels">
        <section class="citizen-tab-panel active" data-panel="identity"><div class="form-grid two compact-form"><label>Nom<input id="lastName" type="text" /></label><label>Prénom<input id="firstName" type="text" /></label><label>Date de naissance<input id="birthDate" type="date" /></label><label>Téléphone<input id="phone" type="text" /></label><label class="wide">Adresse<input id="address" type="text" /></label><label class="wide">Emploi / profession<input id="job" type="text" /></label><label class="license-check"><input id="hasDriverLicense" type="checkbox" /> Permis de conduire</label><label class="license-check"><input id="hasWeaponLicense" type="checkbox" /> Permis de port d’arme</label></div></section>
        <section class="citizen-tab-panel" data-panel="physical"><div class="form-grid two compact-form"><label>Cheveux<input id="hairColor" type="text" /></label><label>Yeux<input id="eyeColor" type="text" /></label><label>Taille en cm<input id="heightCm" type="number" min="1" max="260" /></label><label class="wide">Particularités<textarea id="physicalDetails" rows="4"></textarea></label></div></section>
        <section class="citizen-tab-panel" data-panel="affiliation"><div class="form-grid two compact-form"><label>Appartenance / affiliation<input id="affiliation" type="text" /></label><label>Organisation connue<input id="knownOrganization" type="text" /></label><label>Groupe criminel connu<input id="knownCriminalGroup" type="text" /></label><label>Statut particulier<input id="specialStatus" type="text" /></label></div></section>
        <section class="citizen-tab-panel" data-panel="vehicles"><div class="subcard-header clean"><div><p class="mdt-kicker">Véhicules</p><h3>Véhicules enregistrés</h3></div><button type="button" id="newVehicleButton" class="mdt-button-secondary">+ Véhicule</button></div><div id="vehiclesList" class="record-list compact"></div><form id="vehicleForm" class="inline-record-form" hidden><input type="hidden" id="vehicleId" /><input type="hidden" id="vehiclePhotoPath" /><div class="vehicle-photo-edit"><button type="button" id="vehiclePhotoButton" class="vehicle-photo-button">Photo véhicule<br><small>png/jpg/webp · max 4 Mo</small></button><input id="vehiclePhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden /></div><div class="form-grid two compact-form"><label>Modèle<input id="vehicleModel" type="text" /></label><label>Catégorie<input id="vehicleCategory" type="text" /></label><label>Couleur<input id="vehicleColor" type="text" /></label><label>Plaque<input id="vehiclePlate" type="text" /></label><label>Statut<select id="vehicleStatus"><option>Actif</option><option>Recherché</option><option>Saisi</option><option>Volé</option><option>Inactif</option></select></label><label class="wide">Notes<textarea id="vehicleNotes" rows="3"></textarea></label></div><div class="inline-actions"><button type="submit" class="mdt-button">Valider</button><button type="button" id="cancelVehicleButton" class="mdt-button-secondary">Annuler</button></div></form></section>
        <section class="citizen-tab-panel" data-panel="records"><div class="subcard-header clean"><div><p class="mdt-kicker">Casier judiciaire</p><h3>Infractions enregistrées</h3></div><button type="button" id="newRecordButton" class="mdt-button-secondary">+ Infraction</button></div><div id="recordsList" class="record-list compact"></div><form id="recordForm" class="inline-record-form" hidden><input type="hidden" id="recordId" /><div class="form-grid two compact-form"><label>Date<input id="offenseDate" type="date" /></label><label>Type d’infraction<input id="offenseType" type="text" /></label><label>Statut<select id="caseStatus"><option>Ouvert</option><option>En enquête</option><option>Classé</option><option>Condamné</option><option>Archivé</option></select></label><label>Sanction / peine<input id="sanction" type="text" /></label><label class="wide">Description<textarea id="description" rows="4"></textarea></label><label class="wide">Notes supplémentaires<textarea id="recordNotes" rows="3"></textarea></label></div><div class="inline-actions"><button type="submit" class="mdt-button">Valider</button><button type="button" id="cancelRecordButton" class="mdt-button-secondary">Annuler</button></div></form></section>
        <section class="citizen-tab-panel" data-panel="notes"><div class="form-grid compact-form"><label>Notes interservices<textarea id="notes" rows="7" placeholder="Visible par tous les services autorisés."></textarea></label></div></section>
      </div>
      <p id="citizenMessage" class="form-message"></p>
    </div>
  </template>
  <script>const logoutButton=document.querySelector('#logoutButton');logoutButton.addEventListener('click',async()=>{const response=await fetch('/api/logout.php',{method:'POST',credentials:'same-origin'});const result=await response.json();window.location.href=result.redirect||'/index.html';});</script>
  <script src="/search.js?v=6"></script>
  <script src="/search-linked-sections.js?v=1"></script>
  <script src="/search-service-notes.js?v=1"></script>
</body>
</html>
