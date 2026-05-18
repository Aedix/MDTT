(() => {
  let arrestationData = {};
  const baseRenderDocument = window.renderDocument;
  const basePayload = window.payload;
  const baseFillReport = window.fillReport;

  function safe(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function rich(value) {
    if (window.MDTRichText?.toHtml) {
      const html = window.MDTRichText.toHtml(value);
      return html || 'Non renseigné';
    }
    return safe(value || 'Non renseigné');
  }

  function getField(id) {
    return document.querySelector(`#${id}`);
  }

  function fieldValue(id) {
    return getField(id)?.value?.trim() || '';
  }

  function setFieldValue(id, value) {
    const field = getField(id);
    if (field) field.value = value ?? '';
  }

  function setLabelText(inputId, text) {
    const label = getField(inputId)?.closest('label');
    if (!label) return;
    const textNode = Array.from(label.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = text;
  }

  function setLabelHidden(inputId, hidden) {
    const label = getField(inputId)?.closest('label');
    if (label) label.hidden = hidden;
  }

  function hideLegacyArrestationOption() {
    const select = getField('reportType');
    if (!select || select.value === 'arrestation') return;
    select.querySelector('option[value="arrestation"]')?.remove();
  }

  function syncGenericReportFields() {
    const dossier = isArrestationDossier();

    hideLegacyArrestationOption();
    setLabelText('reportOccurredAt', dossier ? 'Date / heure de l’arrestation' : 'Date / heure de l’incident');
    setLabelText('reportLocation', dossier ? 'Lieu de l’interpellation' : 'Emplacement de l’incident');
    setLabelText('reportFacts', dossier ? 'Récit de l’arrestation' : 'Récit');
    setLabelText('reportNotes', dossier ? 'Notes complémentaires du dossier' : 'Notes complémentaires');

    setLabelHidden('reportActionsTaken', dossier);
    setLabelHidden('reportConclusions', dossier);
    syncArrestationLinksPlacement(dossier);
  }

  function parseStructuredData(report) {
    if (!report?.structured_data) return {};
    if (typeof report.structured_data === 'object') return report.structured_data || {};
    try {
      return JSON.parse(report.structured_data) || {};
    } catch {
      return {};
    }
  }

  function isArrestationDossier(report = null) {
    const type = report?.type_code || fieldValue('reportType');
    return type === 'arrestation_dossier';
  }

  function dateParts(value) {
    if (!value) return { date: 'xx.xx.2026', time: '00:00', weekday: 'Non renseigné' };
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return { date: value, time: '00:00', weekday: 'Non renseigné' };
    const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    return {
      date: date.toLocaleDateString('fr-FR'),
      time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    };
  }

  function serviceInfo(report = {}) {
    const serviceCode = report.service_code || currentReportServiceCode || activeServiceCode?.() || 'MDT';
    const serviceName = report.service_name || currentReportServiceName || activeServiceName?.() || serviceCode;
    const storedLogo = report.service_logo_path || currentReportServiceLogo || '';
    const logo = storedLogo || `/assets/services/${String(serviceCode).toLowerCase()}_logo.png`;
    return { serviceCode, serviceName, logo };
  }

  function linkedNamesSafe(items, fallback = 'Non renseigné') {
    return items?.length ? items.map((item) => item.label || `#${item.id}`).join(', ') : fallback;
  }

  function firstLinkedLabel(items, fallback = 'Non renseigné') {
    return items?.length ? (items[0].label || `#${items[0].id}`) : fallback;
  }

  function chargesFromData(data) {
    const raw = data.charges || '';
    return String(raw).split('\n').map((item) => item.trim()).filter(Boolean);
  }

  function renderChargeBoxes(charges) {
    const cleanCharges = charges.length ? charges : ['Non renseigné'];
    return cleanCharges.slice(0, 6).map((charge) => `<strong>${safe(charge)}</strong>`).join('');
  }

  function lawyerSummary(data) {
    const present = data.lawyer_present || 'Non renseigné';
    const name = data.lawyer_name || '';
    if (present === 'Oui' && name) return `Oui - ${name}`;
    if (present === 'Oui') return 'Oui - nom non renseigné';
    return present;
  }

  function arrestationPayloadData() {
    const lawyerPresent = fieldValue('lawyerPresent') || 'Non renseigné';
    return {
      arresting_matricule: fieldValue('arrestingMatricule'),
      main_charge: fieldValue('mainCharge'),
      rights_read: fieldValue('rightsRead'),
      rights_time: fieldValue('rightsTime'),
      search_done: fieldValue('searchDone'),
      lawyer_present: lawyerPresent,
      lawyer_name: lawyerPresent === 'Oui' ? fieldValue('lawyerName') : '',
      charges: fieldValue('chargesList'),
      seized_items: fieldValue('seizedItems'),
      custody_decision: fieldValue('custodyDecision'),
    };
  }

  function syncLawyerNameVisibility() {
    const lawyerNameLabel = getField('lawyerName')?.closest('label');
    if (lawyerNameLabel) lawyerNameLabel.hidden = fieldValue('lawyerPresent') !== 'Oui';
  }

  function bindArrestingAgentSuggest(box) {
    const input = box.querySelector('#arrestingMatricule');
    const results = box.querySelector('#arrestingAgentSuggestions');
    if (!input || !results || input.dataset.suggestBound === '1') return;

    input.dataset.suggestBound = '1';
    let timer = null;

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const query = input.value.trim();
        if (query.length < 2) {
          results.innerHTML = '';
          return;
        }

        try {
          const response = await apiGet(`/api/reports.php?action=lookup&target=agents&q=${encodeURIComponent(query)}`);
          const items = response.items || [];
          results.innerHTML = items.map((item) => `
            <button type="button" class="lookup-item arrestation-agent-option" data-id="${Number(item.id)}" data-label="${safe(item.label)}" data-meta="${safe(item.meta || '')}">
              <strong>${safe(item.label)}</strong><span>${safe(item.meta || '')}</span>
            </button>
          `).join('') || '<p>Aucun agent trouvé.</p>';
        } catch (error) {
          results.innerHTML = `<p>${safe(error.message)}</p>`;
        }
      }, 220);
    });

    results.addEventListener('click', (event) => {
      const option = event.target.closest('.arrestation-agent-option');
      if (!option) return;

      const value = [option.dataset.label, option.dataset.meta].filter(Boolean).join(' · ');
      input.value = value;
      results.innerHTML = '';

      if (typeof addLinked === 'function') {
        addLinked('agents', { id: Number(option.dataset.id), label: option.dataset.label, meta: option.dataset.meta });
      }

      window.renderDocument?.(window.payload?.() || {});
    });
  }

  function ensureInlineLinksSection() {
    let section = document.querySelector('#arrestationInlineLinks');
    if (section) return section;

    section = document.createElement('section');
    section.id = 'arrestationInlineLinks';
    section.className = 'arrestation-inline-links wide';
    section.innerHTML = `
      <div class="arrestation-fields-header">
        <div>
          <p class="mdt-kicker">Liaisons dossier</p>
          <h3>Personnes, véhicule et officiers liés</h3>
        </div>
        <small>Ces liaisons alimentent directement le document officiel.</small>
      </div>
      <div id="arrestationLinksMount"></div>
    `;

    const dossierFields = document.querySelector('#arrestationDossierFields');
    dossierFields?.insertAdjacentElement('afterend', section);
    return section;
  }

  function syncArrestationLinksPlacement(enabled) {
    const linksPanel = document.querySelector('[data-panel="links"]');
    const linksTab = document.querySelector('.report-tab[data-tab="links"]');
    const grid = document.querySelector('.linked-search-grid');
    if (!linksPanel || !grid) return;

    let originalSlot = document.querySelector('#linkedSearchOriginalSlot');
    if (!originalSlot) {
      originalSlot = document.createElement('div');
      originalSlot.id = 'linkedSearchOriginalSlot';
      grid.insertAdjacentElement('beforebegin', originalSlot);
    }

    const inlineSection = ensureInlineLinksSection();
    const inlineMount = document.querySelector('#arrestationLinksMount');
    if (!inlineMount || !inlineSection) return;

    inlineSection.hidden = !enabled;
    if (linksTab) linksTab.hidden = enabled;

    if (enabled) {
      if (grid.parentElement !== inlineMount) inlineMount.appendChild(grid);
      if (document.querySelector('.report-tab.active')?.dataset.tab === 'links') showTab('main');
      return;
    }

    if (grid.parentElement === inlineMount) originalSlot.insertAdjacentElement('afterend', grid);
  }

  function injectArrestationFields() {
    const mainPanel = document.querySelector('[data-panel="main"] .report-form-grid');
    if (!mainPanel) return;

    let box = document.querySelector('#arrestationDossierFields');
    if (!box) {
      box = document.createElement('section');
      box.id = 'arrestationDossierFields';
      box.className = 'arrestation-dossier-fields wide';
      box.innerHTML = `
        <div class="arrestation-fields-header">
          <div>
            <p class="mdt-kicker">Dossier d'arrestation</p>
            <h3>Informations spécifiques</h3>
          </div>
          <small>Le statut est géré par le workflow du rapport.</small>
        </div>
        <div class="report-form-grid two arrestation-grid">
          <label>Agent principal / matricule
            <input id="arrestingMatricule" type="text" placeholder="Rechercher un agent ou saisir un matricule" autocomplete="off" />
            <div id="arrestingAgentSuggestions" class="lookup-results arrestation-agent-results"></div>
          </label>
          <label>Droits lus<select id="rightsRead"><option>Oui</option><option>Non</option><option>Non renseigné</option></select></label>
          <label class="wide">Motif principal<input id="mainCharge" type="text" placeholder="Refus d'obtempérer / port d'arme illégal" /></label>
          <label>Heure de lecture des droits<input id="rightsTime" type="time" /></label>
          <label>Fouille effectuée<select id="searchDone"><option>Oui</option><option>Non</option><option>Non renseigné</option></select></label>
          <label>Avocat en charge<select id="lawyerPresent"><option>Non renseigné</option><option>Oui</option><option>Non</option></select></label>
          <label class="wide">Nom de l'avocat<input id="lawyerName" type="text" placeholder="Me Dupont" /></label>
          <label>Objets saisis<input id="seizedItems" type="text" placeholder="Pistolet 9mm, chargeur..." /></label>
          <label class="wide">Chefs d'accusation retenus<textarea id="chargesList" rows="4" placeholder="Un chef d'accusation par ligne"></textarea></label>
          <label class="wide">Décision / suite donnée<input id="custodyDecision" type="text" placeholder="Mise en cellule - attente validation" /></label>
        </div>
      `;

      const anchor = getField('reportLocation')?.closest('label') || getField('reportType')?.closest('label');
      if (anchor && anchor.parentElement === mainPanel) {
        anchor.insertAdjacentElement('afterend', box);
      } else {
        mainPanel.appendChild(box);
      }

      box.querySelectorAll('input, textarea, select').forEach((field) => {
        field.addEventListener('input', () => window.renderDocument?.(window.payload?.() || {}));
        field.addEventListener('change', () => window.renderDocument?.(window.payload?.() || {}));
      });

      getField('lawyerPresent')?.addEventListener('change', syncLawyerNameVisibility);
      bindArrestingAgentSuggest(box);
    }

    box.hidden = !isArrestationDossier();
    syncGenericReportFields();
    syncLawyerNameVisibility();
  }

  function populateArrestationFields() {
    injectArrestationFields();
    setFieldValue('arrestingMatricule', arrestationData.arresting_matricule || '');
    setFieldValue('mainCharge', arrestationData.main_charge || '');
    setFieldValue('rightsRead', arrestationData.rights_read || 'Oui');
    setFieldValue('rightsTime', arrestationData.rights_time || '');
    setFieldValue('searchDone', arrestationData.search_done || 'Oui');
    setFieldValue('lawyerPresent', arrestationData.lawyer_present || 'Non renseigné');
    setFieldValue('lawyerName', arrestationData.lawyer_name || '');
    setFieldValue('chargesList', arrestationData.charges || '');
    setFieldValue('seizedItems', arrestationData.seized_items || '');
    setFieldValue('custodyDecision', arrestationData.custody_decision || '');
    syncLawyerNameVisibility();
  }

  function renderArrestationDocument(report = {}) {
    const structuredData = typeof report.structured_data === 'object' && report.structured_data ? report.structured_data : {};
    const data = { ...arrestationData, ...structuredData };
    if (isArrestationDossier()) Object.assign(data, arrestationPayloadData());

    const { serviceCode, serviceName, logo } = serviceInfo(report);
    const type = labelFor(reportMeta.types, report.type_code) || 'Dossier d’arrestation';
    const status = labelFor(reportMeta.statuses, report.status || 'submitted');
    const date = dateParts(report.occurred_at);
    const suspect = firstLinkedLabel(linkedCitizens, 'Non renseigné');
    const officers = linkedNamesSafe(linkedAgents, 'Non renseigné');
    const vehicles = linkedNamesSafe(linkedVehicles, 'Non renseigné');
    const citizens = linkedNamesSafe(linkedCitizens, 'Non renseigné');
    const charges = chargesFromData(data);

    get('reportNumberView').textContent = report.report_number || 'Nouveau dossier';
    get('reportTitleView').textContent = report.title || 'Dossier d’arrestation';
    get('reportMetaView').textContent = `${type} · ${status}`;

    get('reportDocumentView').innerHTML = `
      <div class="fib-report-template arrestation-document-template" id="reportPdfSource" data-service-code="${safe(serviceCode)}">
        <div class="fib-template-header">
          <div><em>${safe(serviceName)}</em><strong>DOSSIER D'ARRESTATION</strong></div>
          <div class="fib-template-logo">${logo ? `<img src="${safe(logo)}" alt="${safe(serviceCode)}" onerror="this.remove();this.parentElement.textContent='${safe(serviceCode)}';">` : safe(serviceCode)}</div>
        </div>

        <div class="fib-template-grid three">
          <div><span>DATE DE L'ARRESTATION</span><strong>${safe(date.date)}</strong></div>
          <div><span>HEURE</span><strong>${safe(date.time)}</strong></div>
          <div><span>JOUR DE LA SEMAINE</span><strong>${safe(date.weekday)}</strong></div>
        </div>

        <div class="fib-template-grid three arrestation-admin-grid">
          <div><span>SUSPECT INTERPELLÉ</span><strong>${safe(suspect)}</strong></div>
          <div><span>AGENT PRINCIPAL / MATRICULE</span><strong>${safe(data.arresting_matricule || 'Non renseigné')}</strong></div>
          <div><span>AVOCAT EN CHARGE</span><strong>${safe(lawyerSummary(data))}</strong></div>
        </div>

        <div class="fib-template-grid three">
          <div><span>MOTIF PRINCIPAL</span><strong>${safe(data.main_charge || 'Non renseigné')}</strong></div>
          <div><span>LIEU DE L'INTERPELLATION</span><strong>${safe(report.location || 'Non renseigné')}</strong></div>
          <div><span>STATUT DU DOSSIER</span><strong>${safe(status || 'Non renseigné')}</strong></div>
        </div>

        <div class="fib-template-grid three">
          <div><span>DROITS LUS</span><strong>${safe([data.rights_read || 'Non renseigné', data.rights_time].filter(Boolean).join(' - '))}</strong></div>
          <div><span>FOUILLE EFFECTUÉE</span><strong>${safe(data.search_done || 'Non renseigné')}</strong></div>
          <div><span>VÉHICULE LIÉ</span><strong>${safe(vehicles)}</strong></div>
        </div>

        <div class="fib-template-grid two arrestation-linked-grid">
          <div><span>CITOYENS LIÉS</span><strong>${safe(citizens)}</strong></div>
          <div><span>OBJETS SAISIS</span><strong>${safe(data.seized_items || 'Non renseigné')}</strong></div>
        </div>

        <div class="fib-template-block arrestation-charges"><span>CHEFS D'ACCUSATION RETENUS</span><div class="charge-grid">${renderChargeBoxes(charges)}</div></div>
        <div class="fib-template-block arrestation-story"><span>RÉCIT DE L'ARRESTATION</span><div class="fib-template-rich">${rich(report.facts)}</div></div>
        <div class="fib-template-block small"><span>OFFICIERS IMPLIQUÉS</span><p>${safe(officers)}</p></div>
        <div class="fib-template-grid two arrestation-decision-grid"><div><span>DÉCISION / SUITE DONNÉE</span><strong>${safe(data.custody_decision || report.conclusions || 'Non renseigné')}</strong></div><div><span>SIGNATURE OFFICIER</span><strong>${safe(report.created_by_username || currentReportCreatedBy || '')}</strong></div></div>
      </div>
    `;
  }

  window.renderDocument = function renderDocumentWithArrestation(report = {}) {
    if (isArrestationDossier(report)) {
      renderArrestationDocument(report);
      return;
    }
    baseRenderDocument(report);
  };

  window.payload = function payloadWithArrestation() {
    const data = basePayload();
    if (isArrestationDossier(data)) {
      data.structured_data = arrestationPayloadData();
      if (!data.summary && data.facts) data.summary = data.facts.slice(0, 500);
    }
    return data;
  };

  window.fillReport = function fillReportWithArrestation(report = null, extra = {}) {
    arrestationData = parseStructuredData(report);
    baseFillReport(report, extra);
    injectArrestationFields();
    populateArrestationFields();
    window.renderDocument(report || window.payload());
  };

  document.addEventListener('change', (event) => {
    if (event.target?.id === 'reportType') {
      injectArrestationFields();
      window.renderDocument(window.payload());
    }
  }, true);

  const observer = new MutationObserver(() => injectArrestationFields());
  observer.observe(document.body, { childList: true, subtree: true });
})();
