<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/permissions.php';

$user = requireAuthenticatedUser();
$canOpenPanel = canOpenManagementPanel($user);
$userTechnicalRole = str_replace(['-', ' '], '_', strtolower(trim((string) ($user['role'] ?? ''))));
$canRemoveReports = strtolower(trim((string) ($user['username'] ?? ''))) === 'admin'
    || in_array($userTechnicalRole, ['super_admin', 'superadmin'], true)
    || userHasPermission($user, '*');

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
  <title>MDT - Rapports</title>
  <link rel="stylesheet" href="/style.css?v=11" />
  <link rel="stylesheet" href="/mdt.css?v=7" />
  <link rel="stylesheet" href="/reports.css?v=3" />
  <link rel="stylesheet" href="/mdt-status-highlights.css?v=1" />
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
        <a href="#" class="mdt-nav-link disabled">Dossiers <span class="mdt-placeholder">Soon</span></a>
        <a href="/reports.php" class="mdt-nav-link active">Rapports</a>
        <a href="#" class="mdt-nav-link disabled">Dispatch <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Divisions <span class="mdt-placeholder">Soon</span></a>
        <a href="#" class="mdt-nav-link disabled">Paramètres <span class="mdt-placeholder">Soon</span></a>
        <?php if ($canOpenPanel): ?><a href="/admin/index.php" class="mdt-nav-link management">Panel de gestion</a><?php endif; ?>
      </nav>
      <div class="mdt-sidebar-footer"><strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong><span><?= htmlspecialchars($activeRankName, ENT_QUOTES, 'UTF-8') ?></span></div>
    </aside>

    <div class="mdt-main">
      <header class="mdt-topbar">
        <div><p class="mdt-kicker"><?= htmlspecialchars($activeServiceName, ENT_QUOTES, 'UTF-8') ?></p><h1>Rapports MDT</h1></div>
        <div class="mdt-top-actions"><div class="mdt-user-mini"><strong><?= htmlspecialchars($user['username'], ENT_QUOTES, 'UTF-8') ?></strong><span><?= htmlspecialchars($activeServiceCode . ' · ' . $activeRankName, ENT_QUOTES, 'UTF-8') ?></span></div><button type="button" id="logoutButton" class="mdt-button-danger">Déconnexion</button></div>
      </header>

      <main class="mdt-content reports-page">
        <section class="reports-command-card">
          <div><p class="mdt-kicker">Documents opérationnels</p><h2>Rapports</h2></div>
          <div class="reports-command-bar"><input type="search" id="reportSearchInput" placeholder="Numéro, titre, récit, emplacement..." autocomplete="off" /><button type="button" id="newReportButton" class="mdt-button">+ Rapport</button></div>
        </section>

        <section class="reports-layout">
          <aside class="mdt-card reports-list-card">
            <div class="reports-list-header"><span>Rapports visibles</span><small id="reportCount">—</small></div>
            <div id="reportsList" class="reports-list"><p class="reports-empty">Chargement des rapports...</p></div>
          </aside>
          <article id="reportPanel" class="mdt-card report-panel"><div class="report-empty-state"><p class="mdt-kicker">Rapport</p><h3>Sélectionne ou crée un rapport</h3><p>Le rapport s’affichera comme un document propre en consultation, puis comme formulaire en modification.</p></div></article>
        </section>
      </main>
    </div>
  </div>

  <template id="reportPanelTemplate">
    <div class="report-panel-inner" data-editing="1">
      <header class="report-document-header">
        <div><p class="mdt-kicker" id="reportNumberView">Nouveau rapport</p><h2 id="reportTitleView">Nouveau rapport</h2><p class="report-meta" id="reportMetaView">Non enregistré</p></div>
        <div class="report-actions"><button type="button" id="editReportButton" class="search-icon-button edit" hidden title="Modifier">✎</button><button type="button" id="previewReportButton" class="mdt-button-secondary">Aperçu</button><button type="button" id="downloadReportButton" class="mdt-button-secondary">Ouvrir export PDF</button><button type="button" id="saveReportButton" class="mdt-button">Sauvegarder</button><button type="button" id="cancelReportButton" class="mdt-button-secondary">Annuler</button><?php if ($canRemoveReports): ?><button type="button" id="removeReportButton" class="mdt-button-danger report-delete-button">Supprimer</button><?php endif; ?></div>
      </header>
      <input type="hidden" id="reportId" />
      <input type="hidden" id="reportStatus" value="submitted" />
      <nav class="report-tabs"><button type="button" class="report-tab active" data-tab="main">Rapport</button><button type="button" class="report-tab" data-tab="access">Accès</button><button type="button" class="report-tab" data-tab="links">Liaisons</button><button type="button" class="report-tab" data-tab="history">Historique</button></nav>
      <div class="report-tab-panels">
        <section class="report-tab-panel active" data-panel="main">
          <div class="report-form-grid two">
            <label>Titre<input id="reportTitle" type="text" /></label>
            <label>Type<select id="reportType"></select></label>
            <label>Date / heure de l’incident<input id="reportOccurredAt" type="datetime-local" /></label>
            <label>Emplacement de l’incident<input id="reportLocation" type="text" placeholder="Los Santos" /></label>
            <label class="wide">Récit<textarea id="reportFacts" rows="10"></textarea></label>
            <label class="wide">Actions effectuées<textarea id="reportActionsTaken" rows="4"></textarea></label>
            <label class="wide">Conclusions<textarea id="reportConclusions" rows="4"></textarea></label>
            <label class="wide">Notes complémentaires<textarea id="reportNotes" rows="3"></textarea></label>
          </div>
          <article id="reportDocumentView" class="report-document-view"></article>
        </section>
        <section class="report-tab-panel" data-panel="access">
          <div class="report-form-grid two">
            <label>Visibilité<select id="reportAccessScope"></select></label>
            <label>Division<select id="reportDivision"></select></label>
          </div>
          <p class="report-help">Service actif = visible uniquement par ce service. Interservice = visible par les autres services autorisés du MDT.</p>
        </section>
        <section class="report-tab-panel" data-panel="links">
          <div class="linked-search-grid">
            <div class="linked-search-box"><label>Citoyens liés<input id="citizenLookupInput" type="search" placeholder="Rechercher nom, prénom, téléphone..." /></label><div id="citizenLookupResults" class="lookup-results"></div><div id="reportCitizensSelected" class="selected-links"></div></div>
            <div class="linked-search-box"><label>Véhicules liés<input id="vehicleLookupInput" type="search" placeholder="Rechercher plaque, modèle, couleur..." /></label><div id="vehicleLookupResults" class="lookup-results"></div><div id="reportVehiclesSelected" class="selected-links"></div></div>
            <div class="linked-search-box"><label>Agents liés<input id="agentLookupInput" type="search" placeholder="Rechercher agent, grade..." /></label><div id="agentLookupResults" class="lookup-results"></div><div id="reportAgentsSelected" class="selected-links"></div></div>
          </div>
          <input type="hidden" id="reportCitizenIds" />
          <input type="hidden" id="reportVehicleIds" />
          <input type="hidden" id="reportAgentIds" />
          <div id="reportLinksView" class="report-links-view"></div>
        </section>
        <section class="report-tab-panel" data-panel="history"><div id="reportLogsView" class="report-logs-view"></div></section>
      </div>
      <p id="reportMessage" class="form-message"></p>
    </div>
  </template>

  <script>document.querySelector('#logoutButton').addEventListener('click',async()=>{const response=await fetch('/api/logout.php',{method:'POST',credentials:'same-origin'});const result=await response.json();window.location.href=result.redirect||'/index.html';});</script>
  <script>
    window.MDT_CAN_REMOVE_REPORTS = <?= $canRemoveReports ? 'true' : 'false' ?>;
    document.addEventListener('click', async (event) => {
      const button = event.target.closest('#removeReportButton');
      if (!button) return;

      const reportId = Number(document.querySelector('#reportId')?.value || 0);
      if (!reportId || !window.MDT_CAN_REMOVE_REPORTS) return;

      const title = document.querySelector('#reportTitleView')?.textContent?.trim() || 'ce rapport';
      if (!confirm(`Supprimer définitivement ${title} ?`)) return;

      try {
        const response = await fetch('/api/report-remove.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id: reportId }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Suppression refusée.');

        selectedReportId = null;
        reportPanel.innerHTML = '<div class="report-empty-state"><p class="mdt-kicker">Rapport</p><h3>Rapport supprimé</h3><p>Sélectionne ou crée un autre rapport.</p></div>';
        await loadReports();
      } catch (error) {
        alert(error.message);
      }
    });
  </script>
  <script src="/reports.js?v=6"></script>
  <script src="/reports-runtime-fixes.js?v=2"></script>
  <script src="/reports-status-editor.js?v=1"></script>
  <script src="/reports-export-preview.js?v=1"></script>
</body>
</html>
