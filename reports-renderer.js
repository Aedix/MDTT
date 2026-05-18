(() => {
  function safe(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function rich(value) {
    if (window.MDTRichText?.toHtml) return window.MDTRichText.toHtml(value) || 'Non renseigné';
    return safe(value || 'Non renseigné');
  }

  function hasContent(value) {
    const text = window.MDTRichText?.toText ? window.MDTRichText.toText(value) : String(value || '').replace(/<[^>]*>/g, '');
    return text.trim().length > 0;
  }

  function normalizeStatus(value) {
    return String(value || 'unknown')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
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

  function ownerInfo(report = {}) {
    const code = report.service_code || window.currentReportServiceCode || window.activeServiceCode?.() || 'MDT';
    const name = report.service_name || window.currentReportServiceName || window.activeServiceName?.() || code;
    const logo = report.service_logo_path || window.currentReportServiceLogo || `/assets/services/${String(code).toLowerCase()}_logo.png`;
    return { code, name, logo };
  }

  function linkedNamesSafe(items) {
    return items?.length ? items.map((item) => item.label || item.username || `#${item.id}`).join(', ') : 'Non renseigné';
  }

  function richBlock(title, value, className = '') {
    if (!hasContent(value)) return '';
    return `<div class="fib-template-block ${className}"><span>${safe(title)}</span><div class="fib-template-rich">${rich(value)}</div></div>`;
  }

  window.formatDateParts = dateParts;

  window.renderReports = function renderReportsOptimized() {
    reportCount.textContent = String(reports.length);
    if (!reports.length) {
      reportsList.innerHTML = '<p class="reports-empty">Aucun rapport visible.</p>';
      return;
    }

    reportsList.innerHTML = reports.map((report) => {
      const status = normalizeStatus(report.status);
      return `
        <button type="button" class="report-row status-highlight status-${status} ${Number(report.id) === selectedReportId ? 'active' : ''}" data-id="${Number(report.id)}">
          <small>${safe(report.report_number)}</small>
          <strong>${safe(report.title)}</strong>
          <span>${safe(labelFor(reportMeta.types, report.type_code))} · ${safe(labelFor(reportMeta.statuses, report.status))}</span>
          <span>${safe(report.location || report.created_by_username || 'Non renseigné')}</span>
        </button>
      `;
    }).join('');
  };

  window.renderDocument = function renderStandardReportDocument(report = {}) {
    if ((report.type_code || document.querySelector('#reportType')?.value || '') === 'arrestation_dossier') return;

    const type = labelFor(reportMeta.types, report.type_code) || report.type_code || 'Rapport';
    const status = labelFor(reportMeta.statuses, report.status || 'submitted') || report.status || 'Soumis';
    const date = dateParts(report.occurred_at);
    const officers = linkedNamesSafe(window.linkedAgents || []);
    const service = ownerInfo(report);
    const signature = report.created_by_username || window.currentReportCreatedBy || '';

    get('reportNumberView').textContent = report.report_number || 'Nouveau rapport';
    get('reportTitleView').textContent = report.title || 'Nouveau rapport';
    get('reportMetaView').textContent = `${type} · ${status}`;

    get('reportDocumentView').innerHTML = `
      <div class="fib-report-template" id="reportPdfSource" data-service-code="${safe(service.code)}">
        <div class="fib-template-header">
          <div><em>${safe(service.name)}</em><strong>RAPPORT</strong></div>
          <div class="fib-template-logo">${service.logo ? `<img src="${safe(service.logo)}" alt="${safe(service.code)}" onerror="this.remove();this.parentElement.textContent='${safe(service.code)}';">` : safe(service.code)}</div>
        </div>
        <div class="fib-template-grid three">
          <div><span>DATE DE L’INCIDENT</span><strong>${safe(date.date)}</strong></div>
          <div><span>HEURE DE L’INCIDENT</span><strong>${safe(date.time)}</strong></div>
          <div><span>JOUR DE LA SEMAINE</span><strong>${safe(date.weekday)}</strong></div>
        </div>
        <div class="fib-template-row"><span>AGENT INTERVENANT</span><strong>${safe(officers)}</strong></div>
        ${richBlock('RÉCIT', report.facts, 'report-story')}
        ${richBlock('ACTIONS EFFECTUÉES', report.actions_taken, 'small')}
        ${richBlock('CONCLUSIONS', report.conclusions, 'small')}
        ${richBlock('NOTES COMPLÉMENTAIRES', report.notes, 'small')}
        <div class="fib-template-block small"><span>OFFICIERS IMPLIQUÉS</span><p>${safe(officers)}</p></div>
        <div class="fib-template-grid two">
          <div><span>TYPE D’INCIDENT</span><strong>${safe(type)}</strong></div>
          <div><span>EMPLACEMENT D’INCIDENT</span><strong>${safe(report.location || 'Non renseigné')}</strong></div>
        </div>
        <div class="fib-template-block signature"><span>SIGNATURE OFFICIER</span><p>${safe(signature)}</p></div>
      </div>
    `;
  };
})();
