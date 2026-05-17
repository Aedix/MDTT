(() => {
  function normalize(value) {
    return String(value || 'unknown')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function safe(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  const originalRenderRecords = renderRecords;
  renderRecords = function renderRecordsWithStatus(records, canDelete = false) {
    const container = document.querySelector('#recordsList');
    if (!container) return originalRenderRecords(records, canDelete);
    setTabBadge('records', records.length);
    if (!records.length) {
      container.innerHTML = '<p class="search-empty">Aucune infraction enregistrée.</p>';
      return;
    }

    container.innerHTML = records.map((r) => {
      const status = normalize(r.case_status);
      return `<div class="record-item case-status-${status}" data-record='${safe(JSON.stringify(r))}'><div><strong>${safe(r.offense_type)}</strong><p>${safe([r.offense_date, r.case_status, r.sanction].filter(Boolean).join(' · '))}</p>${r.description ? `<p>${safe(r.description)}</p>` : ''}</div><div class="record-actions"><button type="button" class="search-icon-button edit-record">✎</button>${canDelete ? '<button type="button" class="search-icon-button delete delete-record">×</button>' : ''}</div></div>`;
    }).join('');
  };
})();
