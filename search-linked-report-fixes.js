(() => {
  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function installStyles() {
    if (document.querySelector('#linkedReportFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'linkedReportFixStyles';
    style.textContent = `
      .linked-report-preview .fib-template-rich{border:1px solid #111;margin:0;padding:7px;background:rgba(255,255,255,.08);line-height:1.22;white-space:normal;min-height:250px;font-size:9pt;color:#111}
      .linked-report-preview .fib-template-rich p{margin:0 0 7px}.linked-report-preview .fib-template-rich ul,.linked-report-preview .fib-template-rich ol{margin:0 0 7px;padding-left:18px}.linked-report-preview .fib-template-rich li{margin:0 0 3px}
      .linked-report-preview .fib-template-rich strong{display:inline;border:0;padding:0;min-height:0;background:transparent;font-size:inherit}
      .linked-report-preview .mdt-rich-color-red{color:#b91c1c}.linked-report-preview .mdt-rich-color-orange{color:#c2410c}.linked-report-preview .mdt-rich-color-yellow{color:#a16207}.linked-report-preview .mdt-rich-color-green{color:#15803d}.linked-report-preview .mdt-rich-color-blue{color:#1d4ed8}.linked-report-preview .mdt-rich-color-purple{color:#7e22ce}
      .linked-report-preview .mdt-rich-highlight-yellow{background:rgba(250,204,21,.48);padding:0 2px;border-radius:2px}.linked-report-preview .mdt-rich-highlight-green{background:rgba(34,197,94,.32);padding:0 2px;border-radius:2px}.linked-report-preview .mdt-rich-highlight-blue{background:rgba(59,130,246,.32);padding:0 2px;border-radius:2px}.linked-report-preview .mdt-rich-highlight-red{background:rgba(239,68,68,.34);padding:0 2px;border-radius:2px}
      .linked-report-preview .mdt-rich-redacted,.linked-report-preview .mdt-rich-classified{display:inline-block;min-width:4.5em;min-height:1em;background:#050505;color:#050505!important;border-radius:2px;vertical-align:-.12em;user-select:none}
      .linked-report-preview .arrestation-document-template .fib-template-header strong{width:118mm;font-size:18pt}.linked-report-preview .arrestation-document-template .arrestation-admin-grid{grid-template-columns:1.25fr 1fr 1fr}.linked-report-preview .arrestation-document-template .arrestation-linked-grid{grid-template-columns:1.35fr .9fr}.linked-report-preview .arrestation-document-template .arrestation-decision-grid{grid-template-columns:1.5fr .8fr}
      .linked-report-preview .arrestation-document-template .charge-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;border:1px solid #111;margin:0;padding:5px;min-height:20mm;background:rgba(255,255,255,.08)}
      .linked-report-preview .arrestation-document-template .charge-grid strong{min-height:18px;border:1px solid #111;background:rgba(255,255,255,.14);padding:4px;font-size:9pt}
      .linked-report-preview .arrestation-document-template .arrestation-story .fib-template-rich{min-height:58mm}.linked-report-preview .arrestation-document-template .arrestation-decision-grid strong{min-height:16mm}
    `;
    document.head.appendChild(style);
  }

  function sanitizeRichHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const allowedTags = new Set(['P', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'BR', 'SPAN']);
    const allowedClasses = new Set([
      'mdt-rich-color-red', 'mdt-rich-color-orange', 'mdt-rich-color-yellow', 'mdt-rich-color-green', 'mdt-rich-color-blue', 'mdt-rich-color-purple',
      'mdt-rich-highlight-yellow', 'mdt-rich-highlight-green', 'mdt-rich-highlight-blue', 'mdt-rich-highlight-red',
      'mdt-rich-redacted', 'mdt-rich-classified',
    ]);

    template.content.querySelectorAll('*').forEach((node) => {
      if (!allowedTags.has(node.tagName)) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      if (node.tagName === 'SPAN') {
        const classes = String(node.getAttribute('class') || '').split(/\s+/).filter((className) => allowedClasses.has(className));
        Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
        if (classes.length) node.setAttribute('class', Array.from(new Set(classes)).join(' '));
        else node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
    });

    return template.innerHTML.trim() || 'Non renseigné';
  }

  function rich(value) {
    if (window.MDTRichText?.toHtml) return window.MDTRichText.toHtml(value) || 'Non renseigné';
    return sanitizeRichHtml(value || 'Non renseigné');
  }

  async function apiGet(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide.'); }
    if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
    return result;
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

  function typeLabel(code) {
    return {
      intervention: 'Rapport d’intervention', incident: 'Rapport d’incident', arrestation: 'Rapport d’arrestation', arrestation_dossier: 'Dossier d’arrestation', operation: 'Rapport d’opération', interne: 'Rapport interne', renseignement: 'Rapport de renseignement', patrouille: 'Compte-rendu de patrouille',
    }[code] || code || 'Rapport';
  }

  function linkedNames(items, key = 'username') {
    return items?.length ? items.map((item) => item[key] || item.label || `#${item.id}`).join(', ') : 'Non renseigné';
  }

  function firstCitizen(citizens) {
    return citizens?.length ? `${citizens[0].last_name || ''} ${citizens[0].first_name || ''}`.trim() : 'Non renseigné';
  }

  function citizenNames(citizens) {
    return citizens?.length ? citizens.map((c) => `${c.last_name || ''} ${c.first_name || ''}`.trim()).join(', ') : 'Non renseigné';
  }

  function vehicleNames(vehicles) {
    return vehicles?.length ? vehicles.map((v) => `${v.model || 'Véhicule'} · ${v.plate || ''}`.trim()).join(', ') : 'Non renseigné';
  }

  function structured(report) {
    if (!report?.structured_data) return {};
    if (typeof report.structured_data === 'object') return report.structured_data;
    try { return JSON.parse(report.structured_data) || {}; } catch { return {}; }
  }

  function renderCharges(raw) {
    const charges = String(raw || '').split('\n').map((item) => item.trim()).filter(Boolean);
    return (charges.length ? charges : ['Non renseigné']).slice(0, 6).map((charge) => `<strong>${esc(charge)}</strong>`).join('');
  }

  function lawyerSummary(data) {
    if (data.lawyer_present === 'Oui' && data.lawyer_name) return `Oui - ${data.lawyer_name}`;
    if (data.lawyer_present === 'Oui') return 'Oui - nom non renseigné';
    return data.lawyer_present || 'Non renseigné';
  }

  function serviceInfo(report) {
    const code = report.service_code || 'MDT';
    const name = report.service_name || code;
    const logo = report.service_logo_path || `/assets/services/${String(code).toLowerCase()}_logo.png`;
    return { code, name, logo };
  }

  function renderStandard(result) {
    const report = result.report;
    const date = dateParts(report.occurred_at);
    const officers = linkedNames(result.agents || []);
    const service = serviceInfo(report);
    return `
      <div class="fib-report-template" data-service-code="${esc(service.code)}">
        <div class="fib-template-header"><div><em>${esc(service.name)}</em><strong>RAPPORT</strong></div><div class="fib-template-logo"><img src="${esc(service.logo)}" alt="${esc(service.code)}" onerror="this.remove();this.parentElement.textContent='${esc(service.code)}';"></div></div>
        <div class="fib-template-grid three"><div><span>DATE DE L’INCIDENT</span><strong>${esc(date.date)}</strong></div><div><span>HEURE DE L’INCIDENT</span><strong>${esc(date.time)}</strong></div><div><span>JOUR DE LA SEMAINE</span><strong>${esc(date.weekday)}</strong></div></div>
        <div class="fib-template-row"><span>AGENT INTERVENANT</span><strong>${esc(officers)}</strong></div>
        <div class="fib-template-block"><span>RÉCIT</span><div class="fib-template-rich">${rich(report.facts)}</div></div>
        <div class="fib-template-block small"><span>OFFICIERS IMPLIQUÉS</span><p>${esc(officers)}</p></div>
        <div class="fib-template-grid two"><div><span>TYPE D’INCIDENT</span><strong>${esc(typeLabel(report.type_code))}</strong></div><div><span>EMPLACEMENT D’INCIDENT</span><strong>${esc(report.location || 'Non renseigné')}</strong></div></div>
        <div class="fib-template-block signature"><span>SIGNATURE OFFICIER</span><p>${esc(report.created_by_username || '')}</p></div>
      </div>
    `;
  }

  function renderArrestation(result) {
    const report = result.report;
    const data = structured(report);
    const date = dateParts(report.occurred_at);
    const service = serviceInfo(report);
    const status = report.status || 'submitted';
    const officers = linkedNames(result.agents || []);
    const citizens = citizenNames(result.citizens || []);
    const vehicles = vehicleNames(result.vehicles || []);
    return `
      <div class="fib-report-template arrestation-document-template" data-service-code="${esc(service.code)}">
        <div class="fib-template-header"><div><em>${esc(service.name)}</em><strong>DOSSIER D'ARRESTATION</strong></div><div class="fib-template-logo"><img src="${esc(service.logo)}" alt="${esc(service.code)}" onerror="this.remove();this.parentElement.textContent='${esc(service.code)}';"></div></div>
        <div class="fib-template-grid three"><div><span>DATE DE L'ARRESTATION</span><strong>${esc(date.date)}</strong></div><div><span>HEURE</span><strong>${esc(date.time)}</strong></div><div><span>JOUR DE LA SEMAINE</span><strong>${esc(date.weekday)}</strong></div></div>
        <div class="fib-template-grid three arrestation-admin-grid"><div><span>SUSPECT INTERPELLÉ</span><strong>${esc(firstCitizen(result.citizens || []))}</strong></div><div><span>AGENT PRINCIPAL / MATRICULE</span><strong>${esc(data.arresting_matricule || 'Non renseigné')}</strong></div><div><span>AVOCAT EN CHARGE</span><strong>${esc(lawyerSummary(data))}</strong></div></div>
        <div class="fib-template-grid three"><div><span>MOTIF PRINCIPAL</span><strong>${esc(data.main_charge || 'Non renseigné')}</strong></div><div><span>LIEU DE L'INTERPELLATION</span><strong>${esc(report.location || 'Non renseigné')}</strong></div><div><span>STATUT DU DOSSIER</span><strong>${esc(status)}</strong></div></div>
        <div class="fib-template-grid three"><div><span>DROITS LUS</span><strong>${esc([data.rights_read || 'Non renseigné', data.rights_time].filter(Boolean).join(' - '))}</strong></div><div><span>FOUILLE EFFECTUÉE</span><strong>${esc(data.search_done || 'Non renseigné')}</strong></div><div><span>VÉHICULE LIÉ</span><strong>${esc(vehicles)}</strong></div></div>
        <div class="fib-template-grid two arrestation-linked-grid"><div><span>CITOYENS LIÉS</span><strong>${esc(citizens)}</strong></div><div><span>OBJETS SAISIS</span><strong>${esc(data.seized_items || 'Non renseigné')}</strong></div></div>
        <div class="fib-template-block arrestation-charges"><span>CHEFS D'ACCUSATION RETENUS</span><div class="charge-grid">${renderCharges(data.charges)}</div></div>
        <div class="fib-template-block arrestation-story"><span>RÉCIT DE L'ARRESTATION</span><div class="fib-template-rich">${rich(report.facts)}</div></div>
        <div class="fib-template-block small"><span>OFFICIERS IMPLIQUÉS</span><p>${esc(officers)}</p></div>
        <div class="fib-template-grid two arrestation-decision-grid"><div><span>DÉCISION / SUITE DONNÉE</span><strong>${esc(data.custody_decision || report.conclusions || 'Non renseigné')}</strong></div><div><span>SIGNATURE OFFICIER</span><strong>${esc(report.created_by_username || '')}</strong></div></div>
      </div>
    `;
  }

  function ensurePreviewBox() {
    let box = document.querySelector('#linkedReportPreview');
    if (box) return box;
    const panel = document.querySelector('[data-panel="linkedReports"]');
    box = document.createElement('div');
    box.id = 'linkedReportPreview';
    box.className = 'linked-report-preview';
    box.hidden = true;
    panel?.appendChild(box);
    return box;
  }

  async function openReport(reportId) {
    installStyles();
    const box = ensurePreviewBox();
    box.hidden = false;
    box.innerHTML = '<p class="search-empty">Chargement du rapport...</p>';
    try {
      const result = await apiGet(`/api/report-detail.php?id=${encodeURIComponent(reportId)}`);
      const report = result.report;
      const html = report.type_code === 'arrestation_dossier' ? renderArrestation(result) : renderStandard(result);
      box.innerHTML = `
        <div class="linked-report-preview-header">
          <div><strong>${esc(report.report_number)} · ${esc(report.title)}</strong><br><span>${esc(typeLabel(report.type_code))} · ${esc(report.status)}</span></div>
          <button type="button" class="search-icon-button" id="closeLinkedReportPreview">×</button>
        </div>
        ${html}
      `;
    } catch (error) {
      box.innerHTML = `<p class="search-empty">${esc(error.message)}</p>`;
    }
  }

  document.addEventListener('click', (event) => {
    const row = event.target.closest('[data-report-id]');
    if (!row || !document.querySelector('#citizenPanel')?.contains(row)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openReport(Number(row.dataset.reportId));
  }, true);
})();
