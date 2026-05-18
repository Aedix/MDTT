(() => {
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

  function normalizeStatus(value) {
    return String(value || 'unknown')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function ownerServiceCode(report) {
    return report.service_code || currentReportServiceCode || activeServiceCode?.() || 'MDT';
  }

  function ownerServiceName(report) {
    return report.service_name || currentReportServiceName || ownerServiceCode(report);
  }

  function ownerServiceLogo(report) {
    const code = ownerServiceCode(report);
    const storedLogo = report.service_logo_path || currentReportServiceLogo || '';
    if (storedLogo) return storedLogo;
    if (report.id || report.report_number) return `/assets/services/${String(code).toLowerCase()}_logo.png`;
    return activeServiceLogo?.() || `/assets/services/${String(code).toLowerCase()}_logo.png`;
  }

  function fixedDateParts(value) {
    if (!value) return { date: 'xx.xx.2026', time: '00:00', weekday: 'Non renseigné' };
    const normalized = String(value).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return { date: value, time: '00:00', weekday: 'Non renseigné' };
    const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
    return {
      date: date.toLocaleDateString('fr-FR'),
      time: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    };
  }

  function installClassifiedStyle() {
    if (document.querySelector('#mdtClassifiedRichStyle')) return;
    const style = document.createElement('style');
    style.id = 'mdtClassifiedRichStyle';
    style.textContent = `
      .rich-editor-redact,.rich-editor-classified{min-width:40px!important;background:#050505!important;color:#050505!important;border-color:#334155!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
      .mdt-rich-redacted,.mdt-rich-classified{display:inline-block;min-width:4.5em;min-height:1em;background:#050505;color:#050505!important;border-radius:2px;vertical-align:-.12em;user-select:none}
      .rich-editor-surface .mdt-rich-redacted,.rich-editor-surface .mdt-rich-classified{color:rgba(255,255,255,.08)!important;caret-color:#fff}
      .fib-template-rich .mdt-rich-redacted,.fib-template-rich .mdt-rich-classified{color:#050505!important}
      .report-panel-inner[data-locked="1"] .rich-editor-toolbar button:not(.rich-editor-expand){opacity:.45;pointer-events:none}
      .report-lock-notice{margin:10px 0 0;padding:10px 12px;border:1px solid rgba(245,158,11,.25);border-radius:12px;background:rgba(245,158,11,.08);color:#fde68a;font-weight:800;font-size:.86rem}
    `;
    document.head.appendChild(style);
  }

  function canCurrentUserEditReport(report) {
    if (!report || !report.id) return true;
    const currentService = activeServiceCode?.() || '';
    const ownerService = report.service_code || currentReportServiceCode || currentService;
    const sameService = String(ownerService).toLowerCase() === String(currentService).toLowerCase();
    const elevated = Boolean(window.MDT_CAN_EDIT_REPORT_STATUS);
    if (!sameService) return false;
    if (elevated) return true;
    return String(report.status || 'submitted') === 'draft';
  }

  function lockReportForm(report) {
    const root = document.querySelector('.report-panel-inner');
    if (!root) return;
    const locked = !canCurrentUserEditReport(report);
    root.dataset.locked = locked ? '1' : '0';

    ['saveReportButton', 'editReportButton'].forEach((id) => {
      const button = get(id);
      if (button) button.hidden = locked || button.hidden;
    });

    root.querySelectorAll('input, textarea, select').forEach((field) => {
      if (field.id === 'reportId' || field.id === 'reportStatus') return;
      field.disabled = locked;
    });

    root.querySelectorAll('.lookup-item, .selected-chip, #newReportButton').forEach((item) => {
      item.disabled = locked;
    });

    root.querySelector('.report-lock-notice')?.remove();
    if (locked) {
      const notice = document.createElement('p');
      notice.className = 'report-lock-notice';
      notice.textContent = 'Document verrouillé : seuls les brouillons du service propriétaire sont modifiables. Les dossiers soumis sont réservés au Command Staff / Director du service propriétaire.';
      root.querySelector('.report-tab-panels')?.prepend(notice);
      setEditMode(false);
    }
  }

  installClassifiedStyle();
  window.MDT_CAN_REDACT_REPORTS = Boolean(window.MDT_CAN_REDACT_REPORTS || window.MDT_CAN_EDIT_REPORT_STATUS);
  window.formatDateParts = fixedDateParts;

  window.renderReports = function renderReportsFixed() {
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

  const baseFillReport = window.fillReport;
  window.fillReport = function fillReportWithLock(report = null, extra = {}) {
    baseFillReport(report, extra);
    lockReportForm(report || window.payload?.() || {});
  };

  window.renderDocument = function renderDocumentFixed(report) {
    const type = labelFor(reportMeta.types, report.type_code);
    const status = labelFor(reportMeta.statuses, report.status || 'submitted');
    const date = fixedDateParts(report.occurred_at);
    const officers = linkedNames(linkedAgents) || 'Non renseigné';
    const serviceCode = ownerServiceCode(report);
    const serviceName = ownerServiceName(report);
    const logo = ownerServiceLogo(report);
    const signature = report.created_by_username || currentReportCreatedBy || '';

    get('reportNumberView').textContent = report.report_number || 'Nouveau rapport';
    get('reportTitleView').textContent = report.title || 'Nouveau rapport';
    get('reportMetaView').textContent = `${type} · ${status}`;
    get('reportDocumentView').innerHTML = `
      <div class="fib-report-template" id="reportPdfSource" data-service-code="${safe(serviceCode)}">
        <div class="fib-template-header">
          <div><em>${safe(serviceName)}</em><strong>RAPPORT</strong></div>
          <div class="fib-template-logo">${logo ? `<img src="${safe(logo)}" alt="${safe(serviceCode)}" onerror="this.remove();this.parentElement.textContent='${safe(serviceCode)}';">` : safe(serviceCode)}</div>
        </div>
        <div class="fib-template-grid three"><div><span>DATE DE L’INCIDENT</span><strong>${safe(date.date)}</strong></div><div><span>HEURE DE L’INCIDENT</span><strong>${safe(date.time)}</strong></div><div><span>JOUR DE LA SEMAINE</span><strong>${safe(date.weekday)}</strong></div></div>
        <div class="fib-template-row"><span>AGENT INTERVENANT</span><strong>${safe(officers)}</strong></div>
        <div class="fib-template-block"><span>RÉCIT</span><div class="fib-template-rich">${rich(report.facts)}</div></div>
        <div class="fib-template-block small"><span>OFFICIERS IMPLIQUÉS</span><p>${safe(officers)}</p></div>
        <div class="fib-template-grid two"><div><span>TYPE D’INCIDENT</span><strong>${safe(type)}</strong></div><div><span>EMPLACEMENT D’INCIDENT</span><strong>${safe(report.location || 'Non renseigné')}</strong></div></div>
        <div class="fib-template-block signature"><span>SIGNATURE OFFICIER</span><p>${safe(signature)}</p></div>
      </div>
    `;
  };
})();
