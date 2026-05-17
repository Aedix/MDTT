const reportsList = document.querySelector('#reportsList');
const reportPanel = document.querySelector('#reportPanel');
const reportPanelTemplate = document.querySelector('#reportPanelTemplate');
const reportSearchInput = document.querySelector('#reportSearchInput');
const newReportButton = document.querySelector('#newReportButton');
const reportCount = document.querySelector('#reportCount');

let reports = [];
let reportMeta = { types: [], statuses: [], access_scopes: [], divisions: [] };
let selectedReportId = null;
let searchTimer = null;
let editing = true;

function esc(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

async function apiGet(url) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide.'); }
  if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
  return result;
}

async function apiPost(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide.'); }
  if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
  return result;
}

function get(id) { return document.querySelector(`#${id}`); }
function val(id) { return get(id)?.value.trim() || ''; }
function setVal(id, value) { const field = get(id); if (field) field.value = value ?? ''; }
function ids(value) { return String(value || '').split(',').map(v => Number(v.trim())).filter(Boolean); }
function setMsg(message, type = 'error') { const box = get('reportMessage'); if (box) { box.textContent = message; box.dataset.type = type; } }
function labelFor(items, code) { return items.find(item => item.code === code)?.label || code || 'Non défini'; }

function fillSelect(id, items, placeholder = null) {
  const select = get(id);
  if (!select) return;
  select.innerHTML = '';
  if (placeholder) select.innerHTML += `<option value="">${esc(placeholder)}</option>`;
  items.forEach(item => select.innerHTML += `<option value="${esc(item.code ?? item.id)}">${esc(item.label ?? item.name)}</option>`);
}

async function loadMeta() {
  reportMeta = await apiGet('/api/reports.php?action=meta');
}

async function loadReports() {
  const q = encodeURIComponent(reportSearchInput.value.trim());
  reportsList.innerHTML = '<p class="reports-empty">Chargement...</p>';
  try {
    const result = await apiGet(`/api/reports.php?action=list&q=${q}`);
    reports = result.reports || [];
    renderReports();
  } catch (error) {
    reportsList.innerHTML = `<p class="reports-empty">${esc(error.message)}</p>`;
  }
}

function renderReports() {
  reportCount.textContent = String(reports.length);
  if (!reports.length) {
    reportsList.innerHTML = '<p class="reports-empty">Aucun rapport visible.</p>';
    return;
  }
  reportsList.innerHTML = reports.map(report => `
    <button type="button" class="report-row ${Number(report.id) === selectedReportId ? 'active' : ''}" data-id="${Number(report.id)}">
      <small>${esc(report.report_number)}</small>
      <strong>${esc(report.title)}</strong>
      <span>${esc(labelFor(reportMeta.types, report.type_code))} · ${esc(labelFor(reportMeta.statuses, report.status))}</span>
      <span>${esc(report.created_by_username || 'Agent inconnu')}</span>
    </button>
  `).join('');
}

function mountReportPanel() {
  reportPanel.innerHTML = '';
  reportPanel.appendChild(reportPanelTemplate.content.cloneNode(true));
  fillSelect('reportType', reportMeta.types);
  fillSelect('reportStatus', reportMeta.statuses);
  fillSelect('reportAccessScope', reportMeta.access_scopes);
  fillSelect('reportDivision', reportMeta.divisions.map(d => ({ code: d.id, label: d.name })), 'Aucune division');
  bindReportPanel();
}

function setEditMode(enabled) {
  editing = enabled;
  const root = document.querySelector('.report-panel-inner');
  if (!root) return;
  root.dataset.editing = enabled ? '1' : '0';
  get('editReportButton').hidden = enabled;
}

function showTab(tabName) {
  document.querySelectorAll('.report-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  document.querySelectorAll('.report-tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabName));
}

function renderDocument(report) {
  const type = labelFor(reportMeta.types, report.type_code);
  const status = labelFor(reportMeta.statuses, report.status);
  get('reportNumberView').textContent = report.report_number || 'Nouveau rapport';
  get('reportTitleView').textContent = report.title || 'Nouveau rapport';
  get('reportMetaView').textContent = `${type} · ${status}`;
  get('reportDocumentView').innerHTML = `
    <h1>${esc(report.title || 'Nouveau rapport')}</h1>
    <p><strong>${esc(report.report_number || 'Non généré')}</strong></p>
    <div class="doc-meta">
      <div><strong>Type</strong><br>${esc(type)}</div>
      <div><strong>Statut</strong><br>${esc(status)}</div>
      <div><strong>Date / heure</strong><br>${esc(report.occurred_at || 'Non renseigné')}</div>
      <div><strong>Accès</strong><br>${esc(labelFor(reportMeta.access_scopes, report.access_scope))}</div>
    </div>
    <h2>Résumé</h2><p>${esc(report.summary || 'Non renseigné')}</p>
    <h2>Faits constatés</h2><p>${esc(report.facts || 'Non renseigné')}</p>
    <h2>Actions effectuées</h2><p>${esc(report.actions_taken || 'Non renseigné')}</p>
    <h2>Conclusions</h2><p>${esc(report.conclusions || 'Non renseigné')}</p>
    <h2>Notes complémentaires</h2><p>${esc(report.notes || 'Non renseigné')}</p>
  `;
}

function renderLinks(data) {
  const links = get('reportLinksView');
  const citizens = (data.citizens || []).map(c => `<div class="report-chip"><strong>Citoyen</strong> ${esc(c.last_name)} ${esc(c.first_name)} · #${Number(c.id)}</div>`).join('');
  const vehicles = (data.vehicles || []).map(v => `<div class="report-chip"><strong>Véhicule</strong> ${esc(v.model || 'Modèle inconnu')} · ${esc(v.plate || '')} · #${Number(v.id)}</div>`).join('');
  const agents = (data.agents || []).map(a => `<div class="report-chip"><strong>Agent</strong> ${esc(a.username)} · #${Number(a.id)}</div>`).join('');
  links.innerHTML = citizens + vehicles + agents || '<p class="reports-empty">Aucune liaison enregistrée.</p>';
  setVal('reportCitizenIds', (data.citizens || []).map(c => c.id).join(', '));
  setVal('reportVehicleIds', (data.vehicles || []).map(v => v.id).join(', '));
  setVal('reportAgentIds', (data.agents || []).map(a => a.id).join(', '));
}

function renderLogs(logs = []) {
  get('reportLogsView').innerHTML = logs.length ? logs.map(log => `<div class="report-log"><strong>${esc(log.action)}</strong><br><span>${esc(log.created_at)} · ${esc(log.username || 'Système')}</span></div>`).join('') : '<p class="reports-empty">Aucun historique.</p>';
}

function fillReport(report = null, extra = {}) {
  mountReportPanel();
  selectedReportId = Number(report?.id || 0) || null;
  setVal('reportId', report?.id || '');
  setVal('reportTitle', report?.title || '');
  setVal('reportType', report?.type_code || 'intervention');
  setVal('reportStatus', report?.status || 'draft');
  setVal('reportOccurredAt', report?.occurred_at ? String(report.occurred_at).replace(' ', 'T').slice(0, 16) : '');
  setVal('reportAccessScope', report?.access_scope || 'service');
  setVal('reportDivision', report?.division_id || '');
  setVal('reportMinimumPower', report?.minimum_power_level || 0);
  setVal('reportMinimumRole', report?.minimum_role_code || '');
  setVal('reportSummary', report?.summary || '');
  setVal('reportFacts', report?.facts || '');
  setVal('reportActionsTaken', report?.actions_taken || '');
  setVal('reportConclusions', report?.conclusions || '');
  setVal('reportNotes', report?.notes || '');
  renderDocument(report || {});
  renderLinks(extra);
  renderLogs(extra.logs || []);
  showTab('main');
  setEditMode(!report?.id);
  renderReports();
}

async function loadReport(id) {
  try {
    const result = await apiGet(`/api/reports.php?action=get&id=${encodeURIComponent(id)}`);
    fillReport(result.report, result);
  } catch (error) {
    alert(error.message);
  }
}

function payload() {
  return {
    id: Number(val('reportId') || 0),
    title: val('reportTitle'),
    type_code: val('reportType'),
    status: val('reportStatus'),
    occurred_at: val('reportOccurredAt') ? val('reportOccurredAt').replace('T', ' ') + ':00' : '',
    access_scope: val('reportAccessScope'),
    division_id: Number(val('reportDivision') || 0),
    minimum_power_level: Number(val('reportMinimumPower') || 0),
    minimum_role_code: val('reportMinimumRole'),
    summary: val('reportSummary'),
    facts: val('reportFacts'),
    actions_taken: val('reportActionsTaken'),
    conclusions: val('reportConclusions'),
    notes: val('reportNotes'),
    citizen_ids: ids(val('reportCitizenIds')),
    vehicle_ids: ids(val('reportVehicleIds')),
    agent_ids: ids(val('reportAgentIds')),
  };
}

async function saveReport() {
  setMsg('Sauvegarde du rapport...', 'info');
  try {
    const result = await apiPost('/api/reports.php?action=save', payload());
    setMsg('Rapport sauvegardé.', 'success');
    await loadReports();
    await loadReport(result.id);
  } catch (error) {
    setMsg(error.message);
  }
}

function bindReportPanel() {
  document.querySelectorAll('.report-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  get('saveReportButton').addEventListener('click', saveReport);
  get('editReportButton').addEventListener('click', () => setEditMode(true));
  get('cancelReportButton').addEventListener('click', () => selectedReportId ? loadReport(selectedReportId) : (reportPanel.innerHTML = '<div class="report-empty-state"><p class="mdt-kicker">Rapport</p><h3>Sélectionne ou crée un rapport</h3><p>Le rapport s’affichera ici.</p></div>'));
  get('printReportButton').addEventListener('click', () => window.print());
  ['reportTitle','reportType','reportStatus','reportOccurredAt','reportAccessScope','reportSummary','reportFacts','reportActionsTaken','reportConclusions','reportNotes'].forEach(id => {
    get(id)?.addEventListener('input', () => renderDocument(payload()));
    get(id)?.addEventListener('change', () => renderDocument(payload()));
  });
}

reportsList.addEventListener('click', event => {
  const row = event.target.closest('.report-row');
  if (row) loadReport(Number(row.dataset.id));
});
newReportButton.addEventListener('click', () => fillReport(null));
reportSearchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadReports, 250); });

(async () => {
  try {
    await loadMeta();
    await loadReports();
  } catch (error) {
    reportsList.innerHTML = `<p class="reports-empty">${esc(error.message)}</p>`;
  }
})();
