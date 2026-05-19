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
$username = (string) ($user['username'] ?? 'Agent');
?>
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MDT - Dossiers</title>
  <link rel="stylesheet" href="/style.css?v=11" />
  <link rel="stylesheet" href="/mdt.css?v=7" />
  <link rel="stylesheet" href="/dossiers.css?v=1" />
  <link rel="stylesheet" href="/dossiers-fixes.css?v=2" />
</head>
<body class="mdt-body service-<?= htmlspecialchars(strtolower($activeServiceCode), ENT_QUOTES, 'UTF-8') ?>">
  <div class="mdt-shell">
    <aside class="mdt-sidebar">
      <div class="mdt-brand">
        <div class="mdt-brand-logo"><?php if ($activeServiceLogo): ?><img src="<?= htmlspecialchars($activeServiceLogo, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?>" /><?php else: ?><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?><?php endif; ?></div>
        <div><p class="mdt-brand-kicker">Mobile Data Terminal</p><h1 class="mdt-brand-title"><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></h1></div>
      </div>
      <nav class="mdt-nav" aria-label="Navigation MDT">
        <a href="/dashboard.php" class="mdt-nav-link">Dashboard</a>
        <a href="/search.php" class="mdt-nav-link">Recherches</a>
        <a href="/dossiers.php" class="mdt-nav-link active">Dossiers</a>
        <a href="/reports.php" class="mdt-nav-link">Rapports</a>
        <a href="#" class="mdt-nav-link disabled">Dispatch <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Divisions <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Paramètres <span class="mdt-placeholder">Soon</span></a>
        <?php if ($canOpenPanel): ?><a href="/admin/index.php" class="mdt-nav-link management">Panel de gestion</a><?php endif; ?>
      </nav>
      <div class="mdt-sidebar-footer"><strong><?= htmlspecialchars($username, ENT_QUOTES, 'UTF-8') ?></strong><span><?= htmlspecialchars($activeRankName, ENT_QUOTES, 'UTF-8') ?></span></div>
    </aside>

    <div class="mdt-main">
      <main class="dossiers-page" aria-labelledby="dossiersTitle">
        <section class="dossiers-hero">
          <div class="dossiers-title-block">
            <p class="mdt-kicker"><?= htmlspecialchars($activeServiceName, ENT_QUOTES, 'UTF-8') ?></p>
            <h1 id="dossiersTitle">Dossiers</h1>
            <p>Gérez, organisez et partagez les documents du service.</p>
          </div>
          <label class="dossiers-search" for="dossiersSearchInput"><span aria-hidden="true">⌕</span><input id="dossiersSearchInput" type="search" placeholder="Rechercher un dossier, fichier, tag..." autocomplete="off" /><kbd>Ctrl K</kbd></label>
        </section>

        <section class="dossiers-quick-row" aria-label="Raccourcis dossiers">
          <button type="button" class="dossiers-quick-card is-active" data-filter="all"><span class="quick-icon">□</span><span><strong>Mes dossiers</strong><small>Dossiers actifs</small></span></button>
          <button type="button" class="dossiers-quick-card" data-filter="shared"><span class="quick-icon">♙</span><span><strong>Partagés avec moi</strong><small>Accès autorisés</small></span></button>
          <button type="button" class="dossiers-quick-card" data-filter="recent"><span class="quick-icon">◷</span><span><strong>Récents</strong><small>Dernières vues</small></span></button>
          <button type="button" class="dossiers-quick-card" data-filter="favorite"><span class="quick-icon accent">☆</span><span><strong>Favoris</strong><small>Éléments suivis</small></span></button>
          <button type="button" class="dossiers-quick-card" data-filter="archive"><span class="quick-icon">▣</span><span><strong>Archives</strong><small>Éléments archivés</small></span></button>
          <button type="button" class="dossiers-quick-card" data-filter="trash"><span class="quick-icon danger">♲</span><span><strong>Corbeille</strong><small>Suppressions</small></span></button>
          <button type="button" id="newDossierButton" class="dossiers-new-button">+ Nouveau <span>⌄</span></button>
        </section>

        <section class="dossiers-workspace" aria-label="Explorateur de fichiers MDT">
          <article class="dossiers-browser">
            <header class="dossiers-browser-toolbar"><nav class="dossiers-breadcrumb" aria-label="Fil d’Ariane"><span><?= htmlspecialchars($activeServiceCode, ENT_QUOTES, 'UTF-8') ?></span><span>›</span><span>Enquêtes actives</span><span>›</span><strong>Dossier #FIB-2026-041</strong></nav><div class="dossiers-view-tools"><div class="dossiers-view-toggle"><button type="button" class="is-active" data-view="grid">▦</button><button type="button" data-view="list">☰</button></div><button type="button" class="dossiers-tool-button">Date de modification ⌄</button><button type="button" class="dossiers-tool-button">Filtres</button></div></header>
            <div id="dossiersGrid" class="dossiers-grid" data-view="grid">
              <button type="button" class="dossier-item folder is-selected" data-id="case-root" data-kind="folder" data-search="dossier enquête fib confidentiel"><span class="item-menu">⋮</span><span class="folder-icon"></span><strong>Dossier #FIB-2026-041</strong><small>Enquête active</small></button>
            </div>
          </article>

          <aside class="dossiers-detail-panel" aria-label="Détail de l’élément sélectionné">
            <header class="detail-header"><div class="detail-title-row"><span id="detailIcon" class="folder-icon"></span><div><h2 id="detailTitle">Dossier #FIB-2026-041</h2><p><span id="detailSubtype">Dossier d’enquête</span> <span id="detailBadge" class="detail-badge">Confidentiel</span></p></div></div><div class="detail-actions-mini"><button type="button" id="favoriteButton" title="Favori">☆</button><button type="button" title="Menu">⋮</button></div></header>
            <nav class="detail-tabs" aria-label="Onglets du détail"><button type="button" class="is-active" data-tab="details">Détails</button><button type="button" data-tab="activity">Activité</button><button type="button" data-tab="access">Accès</button></nav>
            <section class="detail-tab-panel is-active" data-panel="details"><div class="detail-field wide"><span>Description</span><p id="detailDescription">Dossier relatif à l’enquête active du service.</p></div><div class="detail-meta-grid"><div class="detail-field"><span>Propriétaire</span><strong id="detailOwner">Agent Carter</strong></div><div class="detail-field"><span>Service</span><strong id="detailService">FIB</strong></div><div class="detail-field"><span>Créé le</span><strong id="detailCreated">17/05/2026 à 14:32</strong></div><div class="detail-field"><span>Dernière modification</span><strong id="detailUpdated">18/05/2026 à 16:45</strong></div></div><div class="detail-field wide"><span>Tags</span><div id="detailTags" class="detail-tags"><span>enquête</span><span>confidentiel</span><span>service</span></div></div><div class="detail-field wide"><span>Lié à</span><strong id="detailLinked">Enquête #FIB-2026-041</strong></div></section>
            <section class="detail-tab-panel" data-panel="activity"><div id="detailActivity" class="detail-activity"></div></section>
            <section class="detail-tab-panel" data-panel="access"><div id="detailAccess" class="detail-access"></div></section>
            <button type="button" id="manageAccessButton" class="dossiers-access-button">Gérer les accès</button>
            <footer class="detail-footer-actions"><button type="button" title="Partager">↗</button><button type="button" title="Renommer">✎</button><button type="button" title="Télécharger">⇩</button><button type="button" title="Plus">⋮</button><button type="button" class="danger" title="Supprimer">⌫</button></footer>
            <p id="dossierFeedback" class="dossier-feedback" aria-live="polite"></p>
          </aside>
        </section>
      </main>
    </div>
  </div>
  <script src="/mdt-sidebar.js?v=2"></script>
  <script src="/dossiers.js?v=2"></script>
</body>
</html>
