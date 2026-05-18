(() => {
  const CLASSIFICATIONS = [
    ['unclassified', 'Non classifié'],
    ['internal', 'Interne service'],
    ['confidential', 'Confidentiel'],
    ['restricted_cs', 'Restreint Command Staff'],
    ['declassified', 'Déclassifié'],
  ];

  const STATUS_FLOW = [
    ['draft', 'Brouillon'],
    ['submitted', 'Soumis'],
    ['review', 'En révision CS'],
    ['validated', 'Validé'],
    ['rejected', 'Rejeté'],
    ['archived', 'Archivé'],
  ];

  const WRITING_TEMPLATES = {
    intervention: 'Contexte :\n\nDéroulé des faits :\n\nMesures prises :\n\nRésultat :\n\nObservations / Notes :',
    incident: 'Contexte :\n\nFaits constatés :\n\nPersonnes impliquées :\n\nMesures prises :\n\nSuite donnée :',
    arrestation_dossier: 'Contexte opérationnel :\n\nDéroulé de l’interpellation :\n\nDroits et fouille :\n\nÉléments saisis :\n\nDécision / suite donnée :',
    operation: 'Objectif de l’opération :\n\nMoyens engagés :\n\nDéroulé :\n\nRésultat :\n\nObservations :',
    renseignement: 'Source / origine :\n\nInformation collectée :\n\nAnalyse :\n\nNiveau de fiabilité :\n\nSuite recommandée :',
    patrouille: 'Secteur patrouillé :\n\nEffectifs engagés :\n\nÉvénements notables :\n\nContrôles effectués :\n\nFin de patrouille :',
  };

  let filtersBound = false;
  let autosaveTimer = null;
  let autosaveDirty = false;
  let lastAutosaveHash = '';

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function get(id) { return document.querySelector(`#${id}`); }
  function value(id) { return get(id)?.value?.trim() || ''; }
  function isCommandStaff() { return Boolean(window.MDT_CAN_EDIT_REPORT_STATUS); }
  function label(items, code) { return items?.find((item) => String(item.code) === String(code))?.label || code || 'Non défini'; }
  function activeServiceCode() { return document.querySelector('.mdt-brand-title')?.textContent?.trim() || 'MDT'; }
  function normalize(value) { return String(value || '').trim().toLowerCase(); }

  function reportEditable() {
    const id = Number(value('reportId') || 0);
    if (!id) return true;
    const owner = normalize(window.currentReportServiceCode || document.querySelector('#reportPdfSource')?.dataset.serviceCode || '');
    const active = normalize(activeServiceCode());
    if (owner && active && owner !== active) return false;
    if (isCommandStaff()) return true;
    return value('reportStatus') === 'draft';
  }

  function ownerIsForeign() {
    const owner = normalize(window.currentReportServiceCode || document.querySelector('#reportPdfSource')?.dataset.serviceCode || '');
    const active = normalize(activeServiceCode());
    return Boolean(owner && active && owner !== active);
  }

  function payloadHash() {
    try { return JSON.stringify(window.payload?.() || {}); } catch { return ''; }
  }

  function statusCode(value) {
    return String(value || 'unknown').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function enhanceReportsList() {
    document.querySelectorAll('.report-row:not(.experience-bound)').forEach((row) => {
      const id = Number(row.dataset.id || 0);
      const report = (window.reports || []).find((item) => Number(item.id) === id);
      if (!report) return;
      row.classList.add('experience-bound', 'rich-row');
      const typeLabel = label(window.reportMeta?.types || [], report.type_code);
      const statusLabel = label(window.reportMeta?.statuses || [], report.status);
      const classificationLabel = label(window.reportMeta?.classifications || CLASSIFICATIONS.map(([code, text]) => ({ code, label: text })), report.classification_level || 'internal');
      const date = report.occurred_at ? new Date(String(report.occurred_at).replace(' ', 'T')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Date non renseignée';
      row.innerHTML = `
        <div class="report-row-top">
          <div class="report-row-title"><small>${escapeHtml(report.report_number)}</small><strong>${escapeHtml(report.title)}</strong></div>
          <span class="report-badge service">${escapeHtml(report.service_code || 'MDT')}</span>
        </div>
        <div class="report-badges">
          <span class="report-badge type">${escapeHtml(typeLabel)}</span>
          <span class="report-badge status-${statusCode(report.status)}">${escapeHtml(statusLabel)}</span>
          <span class="report-badge classification">${escapeHtml(classificationLabel)}</span>
          ${Number(report.citizens_count || 0) ? '<span class="report-badge">👥 Citoyen</span>' : ''}
          ${Number(report.vehicles_count || 0) ? '<span class="report-badge">🚓 Véhicule</span>' : ''}
          ${Number(report.agents_count || 0) ? '<span class="report-badge">🛡 Agent</span>' : ''}
        </div>
        <div class="report-row-meta"><span>${escapeHtml(report.location || 'Lieu non renseigné')}</span><span>${escapeHtml(report.created_by_username || 'Système')} · ${escapeHtml(date)}</span></div>
      `;
    });
  }

  function injectFilters() {
    if (filtersBound || !document.querySelector('.reports-list-card')) return;
    filtersBound = true;
    const card = document.createElement('section');
    card.className = 'reports-filter-card';
    card.innerHTML = `
      <div class="reports-filter-row">
        <select id="filterReportType"><option value="">Type</option></select>
        <select id="filterReportStatus"><option value="">Statut</option></select>
        <select id="filterReportService"><option value="">Service</option></select>
        <select id="filterReportClassification"><option value="">Classification</option></select>
        <input id="filterReportDateFrom" type="date" title="Date de début" />
        <input id="filterReportDateTo" type="date" title="Date de fin" />
      </div>
      <div class="reports-filter-row second">
        <input id="filterReportCreatedBy" type="search" placeholder="Créé par" />
        <select id="filterReportSort"><option value="recent">Plus récent</option><option value="oldest">Plus ancien</option><option value="type">Type</option><option value="status">Statut</option><option value="service">Service</option></select>
        <button type="button" id="resetReportFilters" class="mdt-button-secondary">Réinitialiser</button>
        <input id="filterReportText" type="search" placeholder="Rechercher..." />
      </div>
    `;
    document.querySelector('.reports-list-header')?.insertAdjacentElement('afterend', card);

    const typeSelect = get('filterReportType');
    (window.reportMeta?.types || []).forEach((item) => typeSelect.innerHTML += `<option value="${escapeHtml(item.code)}">${escapeHtml(item.label)}</option>`);
    const statusSelect = get('filterReportStatus');
    (window.reportMeta?.statuses || []).forEach((item) => statusSelect.innerHTML += `<option value="${escapeHtml(item.code)}">${escapeHtml(item.label)}</option>`);
    const serviceSelect = get('filterReportService');
    (window.reportMeta?.services || [{ code: activeServiceCode(), label: activeServiceCode() }]).forEach((item) => serviceSelect.innerHTML += `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)}</option>`);
    const classSelect = get('filterReportClassification');
    (window.reportMeta?.classifications || CLASSIFICATIONS.map(([code, text]) => ({ code, label: text }))).forEach((item) => classSelect.innerHTML += `<option value="${escapeHtml(item.code)}">${escapeHtml(item.label)}</option>`);

    let timer = null;
    card.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadFilteredReports, 250); });
    card.addEventListener('change', () => loadFilteredReports());
    get('resetReportFilters')?.addEventListener('click', () => {
      card.querySelectorAll('input, select').forEach((field) => field.value = '');
      get('filterReportSort').value = 'recent';
      loadFilteredReports();
    });
  }

  async function loadFilteredReports() {
    const params = new URLSearchParams({
      q: get('filterReportText')?.value || get('reportSearchInput')?.value || '',
      type: get('filterReportType')?.value || '',
      status: get('filterReportStatus')?.value || '',
      service: get('filterReportService')?.value || '',
      classification: get('filterReportClassification')?.value || '',
      date_from: get('filterReportDateFrom')?.value || '',
      date_to: get('filterReportDateTo')?.value || '',
      created_by: get('filterReportCreatedBy')?.value || '',
      sort: get('filterReportSort')?.value || 'recent',
    });
    const list = document.querySelector('#reportsList');
    if (!list) return;
    list.innerHTML = '<p class="reports-empty">Chargement...</p>';
    try {
      const result = await window.apiGet(`/api/report-list-simple.php?${params.toString()}`);
      window.reports = result.reports || [];
      if (typeof window.renderReports === 'function') window.renderReports();
      setTimeout(enhanceReportsList, 0);
    } catch (error) {
      list.innerHTML = `<p class="reports-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  function injectClassificationField() {
    if (get('reportClassification') || !get('reportAccessScope')) return;
    const labelEl = document.createElement('label');
    labelEl.className = 'report-classification-field';
    labelEl.innerHTML = `Niveau de classification<select id="reportClassification"></select><small id="reportClassificationHelp">Définit l’accès global du document.</small>`;
    get('reportAccessScope')?.closest('label')?.insertAdjacentElement('afterend', labelEl);
    const select = get('reportClassification');
    (window.reportMeta?.classifications || CLASSIFICATIONS.map(([code, text]) => ({ code, label: text }))).forEach((item) => select.innerHTML += `<option value="${escapeHtml(item.code)}">${escapeHtml(item.label)}</option>`);
    select.addEventListener('change', () => {
      updateClassificationHelp();
      window.renderDocument?.(window.payload?.() || {});
    });
  }

  function updateClassificationHelp() {
    const help = get('reportClassificationHelp');
    const v = value('reportClassification');
    const messages = {
      unclassified: 'Accès normal selon la visibilité du rapport.',
      internal: 'Visible par le service propriétaire.',
      confidential: 'Visible par le service propriétaire et profils autorisés.',
      restricted_cs: 'Visible uniquement par Command Staff / Director.',
      declassified: 'Document déclassifié selon la visibilité définie.',
    };
    if (help) help.textContent = messages[v] || 'Définit l’accès global du document.';
  }

  function injectWritingTools() {
    const main = document.querySelector('[data-panel="main"]');
    if (!main || get('reportWritingTools')) return;
    const block = document.createElement('section');
    block.id = 'reportWritingTools';
    block.className = 'report-writing-tools';
    block.innerHTML = `
      <div class="report-mini-card"><h4>Templates de rédaction</h4><p class="writing-template-preview" id="writingTemplatePreview"></p><button type="button" class="mdt-button-secondary" id="insertWritingTemplate">Insérer structure</button></div>
      <div class="report-mini-card"><h4>Checklist dossier</h4><div class="checklist" id="reportChecklist"></div></div>
    `;
    document.querySelector('#reportFacts')?.closest('label')?.insertAdjacentElement('beforebegin', block);
    get('insertWritingTemplate')?.addEventListener('click', () => {
      const type = value('reportType') || 'intervention';
      const template = WRITING_TEMPLATES[type] || WRITING_TEMPLATES.intervention;
      const field = get('reportFacts');
      if (!field) return;
      if (field.value.trim() && !confirm('Insérer la structure à la suite du récit existant ?')) return;
      field.value = field.value.trim() ? `${field.value}\n\n${template}` : template;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      window.MDTRichText?.refresh?.();
    });
    updateWritingTools();
  }

  function updateWritingTools() {
    const type = value('reportType') || 'intervention';
    const preview = get('writingTemplatePreview');
    if (preview) preview.textContent = WRITING_TEMPLATES[type] || WRITING_TEMPLATES.intervention;
    const checklist = get('reportChecklist');
    if (!checklist) return;
    const items = type === 'arrestation_dossier'
      ? [
        ['Suspect lié', (window.linkedCitizens || []).length > 0],
        ['Agent principal renseigné', Boolean(value('arrestingMatricule'))],
        ['Droits lus', Boolean(value('rightsRead')) && value('rightsRead') !== 'Non renseigné'],
        ['Fouille renseignée', Boolean(value('searchDone')) && value('searchDone') !== 'Non renseigné'],
        ['Chefs d’accusation renseignés', Boolean(value('chargesList'))],
        ['Décision / suite renseignée', Boolean(value('custodyDecision'))],
        ['Objets saisis renseignés', Boolean(value('seizedItems'))],
      ]
      : [
        ['Titre renseigné', Boolean(value('reportTitle'))],
        ['Date renseignée', Boolean(value('reportOccurredAt'))],
        ['Récit renseigné', Boolean(value('reportFacts'))],
        ['Agent lié', (window.linkedAgents || []).length > 0],
      ];
    checklist.innerHTML = items.map(([text, done]) => `<div class="check-item ${done ? 'done' : ''}"><span class="check-box">${done ? '✓' : ''}</span>${escapeHtml(text)}</div>`).join('');
  }

  function decorateConsultation() {
    const root = document.querySelector('.report-panel-inner');
    const view = get('reportDocumentView');
    if (!root || !view || root.dataset.editing !== '0' || view.dataset.consultationDecorated === '1') return;
    view.dataset.consultationDecorated = '1';
    const wrap = document.createElement('div');
    wrap.className = 'report-consultation-shell';
    wrap.innerHTML = `<section class="report-consultation-card"><div class="report-consultation-head"><div><h3>Mode consultation</h3><p>Document officiel affiché directement en lecture seule.</p></div><span class="report-readonly-badge">LECTURE SEULE</span></div></section>`;
    const card = wrap.querySelector('.report-consultation-card');
    while (view.firstChild) card.appendChild(view.firstChild);
    const sideGrid = document.createElement('section');
    sideGrid.className = 'report-side-grid';
    sideGrid.innerHTML = buildSideCards();
    wrap.appendChild(sideGrid);
    view.appendChild(wrap);
    styleSignature();
  }

  function buildSideCards() {
    const logs = Array.from(document.querySelectorAll('.report-log')).slice(0, 5).map((log) => `<div class="report-timeline-item"><strong>${escapeHtml(log.querySelector('strong')?.textContent || 'Action')}</strong><small>${escapeHtml(log.textContent.replace(log.querySelector('strong')?.textContent || '', '').trim())}</small></div>`).join('') || '<p>Aucun historique.</p>';
    return `
      <div class="report-mini-card"><h4>Workflow</h4><div class="report-workflow">${STATUS_FLOW.map(([code, text]) => `<div class="workflow-step ${value('reportStatus') === code ? 'active' : ''}"><span class="workflow-dot"></span>${text}</div>`).join('')}</div></div>
      <div class="report-mini-card"><h4>Liens rapides</h4>${quickLinksHtml()}</div>
      <div class="report-mini-card"><h4>Classification</h4><p>${escapeHtml(label(window.reportMeta?.classifications || [], value('reportClassification') || 'internal'))}</p></div>
      <div class="report-mini-card"><h4>Historique</h4><div class="report-timeline">${logs}</div></div>
    `;
  }

  function quickLinksHtml() {
    const citizens = (window.linkedCitizens || []).map((item) => `<button type="button" data-open-citizen="${Number(item.id)}">${escapeHtml(item.label)} ↗</button>`).join('') || '<p>Aucun citoyen lié.</p>';
    const vehicles = (window.linkedVehicles || []).map((item) => `<button type="button" data-open-vehicle="${Number(item.id)}">${escapeHtml(item.label)} ↗</button>`).join('') || '<p>Aucun véhicule lié.</p>';
    const agents = (window.linkedAgents || []).map((item) => `<p>${escapeHtml(item.label)} ↗</p>`).join('') || '<p>Aucun agent lié.</p>';
    return `<h4>Citoyens liés</h4>${citizens}<h4>Véhicules liés</h4>${vehicles}<h4>Agents liés</h4>${agents}`;
  }

  function styleSignature() {
    document.querySelectorAll('.arrestation-decision-grid>div:last-child strong,.fib-template-block.signature p').forEach((el) => {
      if (el.dataset.signatureStyled === '1') return;
      const text = el.textContent.trim();
      if (!text) return;
      el.dataset.signatureStyled = '1';
      el.innerHTML = `<span>Signé par</span><div class="signature-script">${escapeHtml(text)}</div><small>Signé électroniquement via MDT</small>`;
    });
  }

  function injectLockBanner() {
    const panel = document.querySelector('.report-panel-inner');
    if (!panel || get('reportExperienceLockBanner') || reportEditable()) return;
    const foreign = ownerIsForeign();
    const banner = document.createElement('section');
    banner.id = 'reportExperienceLockBanner';
    banner.className = `report-lock-banner ${foreign ? 'foreign' : 'submitted'}`;
    banner.innerHTML = foreign
      ? '<div class="icon">🛡</div><div><strong>Rapport d’un autre service — consultation uniquement</strong><span>Vous pouvez consulter ce document, mais seul le service propriétaire peut le modifier.</span></div>'
      : '<div class="icon">🔒</div><div><strong>Rapport soumis — édition verrouillée</strong><span>Seul le Command Staff peut modifier ce document.</span></div>';
    document.querySelector('.report-document-header')?.insertAdjacentElement('afterend', banner);
  }

  function startAutosave() {
    if (autosaveTimer) return;
    autosaveTimer = setInterval(async () => {
      if (!autosaveDirty || !reportEditable() || value('reportStatus') !== 'draft' || !Number(value('reportId') || 0)) return;
      const hash = payloadHash();
      if (!hash || hash === lastAutosaveHash) return;
      const state = get('reportAutosaveState');
      if (state) { state.textContent = 'Sauvegarde en cours...'; state.className = 'report-autosave-state saving'; }
      try {
        const result = await window.apiPost('/api/reports.php?action=save', window.payload());
        lastAutosaveHash = hash;
        autosaveDirty = false;
        if (state) { state.textContent = `Brouillon sauvegardé à ${new Date().toLocaleTimeString('fr-FR')} ✓`; state.className = 'report-autosave-state'; }
      } catch (error) {
        if (state) { state.textContent = 'Erreur autosave'; state.className = 'report-autosave-state error'; }
      }
    }, 20000);
  }

  function injectAutosaveState() {
    if (get('reportAutosaveState')) return;
    const state = document.createElement('span');
    state.id = 'reportAutosaveState';
    state.className = 'report-autosave-state';
    state.textContent = 'Autosave prêt';
    document.querySelector('.report-actions')?.prepend(state);
    startAutosave();
  }

  function syncFormExtras() {
    injectClassificationField();
    injectWritingTools();
    injectAutosaveState();
    updateClassificationHelp();
    updateWritingTools();
    injectLockBanner();
    decorateConsultation();
    styleSignature();
  }

  const basePayload = window.payload;
  window.payload = function payloadWithExperience() {
    const data = basePayload ? basePayload() : {};
    data.classification_level = value('reportClassification') || data.classification_level || 'internal';
    data.command_staff_comment = value('commandStaffComment');
    return data;
  };

  const baseFillReport = window.fillReport;
  window.fillReport = function fillReportWithExperience(report = null, extra = {}) {
    baseFillReport?.(report, extra);
    setTimeout(() => {
      injectClassificationField();
      const classification = report?.classification_level || 'internal';
      if (get('reportClassification')) get('reportClassification').value = classification;
      syncFormExtras();
      lastAutosaveHash = payloadHash();
      autosaveDirty = false;
    }, 0);
  };

  const baseRenderDocument = window.renderDocument;
  window.renderDocument = function renderDocumentWithFooter(report = {}) {
    baseRenderDocument?.(report);
    const source = document.querySelector('#reportPdfSource');
    if (source && !source.querySelector('.report-export-footer')) {
      const footer = document.createElement('footer');
      footer.className = 'report-export-footer';
      footer.innerHTML = `<span>${escapeHtml(report.report_number || get('reportNumberView')?.textContent || 'Document MDT')}</span><span>Export MDT · ${new Date().toLocaleString('fr-FR')}</span>`;
      source.appendChild(footer);
    }
    setTimeout(syncFormExtras, 0);
  };

  document.addEventListener('input', (event) => {
    if (event.target.closest('.report-panel-inner')) {
      autosaveDirty = true;
      setTimeout(updateWritingTools, 0);
    }
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target.closest('.report-panel-inner')) {
      autosaveDirty = true;
      setTimeout(syncFormExtras, 0);
    }
  }, true);
  document.addEventListener('click', (event) => {
    const citizen = event.target.closest('[data-open-citizen]');
    if (citizen) window.location.href = `/search.php?citizen_id=${citizen.dataset.openCitizen}`;
  });

  const observer = new MutationObserver(() => {
    injectFilters();
    enhanceReportsList();
    syncFormExtras();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { injectFilters(); enhanceReportsList(); syncFormExtras(); }, 50));
  setTimeout(() => { injectFilters(); enhanceReportsList(); syncFormExtras(); }, 300);
})();
