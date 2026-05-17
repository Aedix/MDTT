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
let linkedCitizens = [];
let linkedVehicles = [];
let linkedAgents = [];

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
function labelFor(items, code) { return items.find(item => String(item.code) === String(code))?.label || code || 'Non défini'; }

function activeServiceLogo() {
  return document.querySelector('.mdt-brand-logo img')?.getAttribute('src') || '';
}

function activeServiceCode() {
  return document.querySelector('.mdt-brand-title')?.textContent?.trim() || 'MDT';
}

function fillSelect(id, items, placeholder = null) {
  const select = get(id);
  if (!select) return;
  select.innerHTML = '';
  if (placeholder) select.innerHTML += `<option value="">${esc(placeholder)}</option>`;
  items.forEach(item => select.innerHTML += `<option value="${esc(item.code ?? item.id)}">${esc(item.label ?? item.name)}</option>`);
}

async function loadMeta() { reportMeta = await apiGet('/api/reports.php?action=meta'); }

async function loadReports() {
  const q = encodeURIComponent(reportSearchInput.value.trim());
  reportsList.innerHTML = '<p class="reports-empty">Chargement...</p>';
  try {
    const result = await apiGet(`/api/report-list-simple.php?q=${q}`);
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
      <span>${esc(report.location || report.created_by_username || 'Non renseigné')}</span>
    </button>
  `).join('');
}

function mountReportPanel() {
  reportPanel.innerHTML = '';
  reportPanel.appendChild(reportPanelTemplate.content.cloneNode(true));
  fillSelect('reportType', reportMeta.types);
  fillSelect('reportAccessScope', reportMeta.access_scopes);
  fillSelect('reportDivision', reportMeta.divisions.map(d => ({ code: d.id, label: d.name })), 'Aucune division');
  bindReportPanel();
}

function setEditMode(enabled) {
  const root = document.querySelector('.report-panel-inner');
  if (!root) return;
  root.dataset.editing = enabled ? '1' : '0';
  get('editReportButton').hidden = enabled;
}

function showTab(tabName) {
  document.querySelectorAll('.report-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  document.querySelectorAll('.report-tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === tabName));
}

function formatDateParts(value) {
  if (!value) return { date: 'xx.xx.2026', time: '00:00 - 00:00', weekday: 'Non renseigné' };
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return { date: value, time: '00:00 - 00:00', weekday: 'Non renseigné' };
  const weekday = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  return { date: date.toLocaleDateString('fr-FR'), time: `${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - 00:00`, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
}

function linkedNames(items) { return items.length ? items.map(item => item.label || `#${item.id}`).join(', ') : ''; }

function renderDocument(report) {
  const type = labelFor(reportMeta.types, report.type_code);
  const status = labelFor(reportMeta.statuses, report.status || 'submitted');
  const date = formatDateParts(report.occurred_at);
  const officers = linkedNames(linkedAgents) || 'Non renseigné';
  const logo = report.service_logo_path || activeServiceLogo();
  const serviceCode = report.service_code || activeServiceCode();
  get('reportNumberView').textContent = report.report_number || 'Nouveau rapport';
  get('reportTitleView').textContent = report.title || 'Nouveau rapport';
  get('reportMetaView').textContent = `${type} · ${status}`;
  get('reportDocumentView').innerHTML = `
    <div class="fib-report-template" id="reportPdfSource">
      <div class="fib-template-header"><div><em>Federal Investigation Bureau</em><strong>RAPPORT</strong></div><div class="fib-template-logo">${logo ? `<img src="${esc(logo)}" alt="${esc(serviceCode)}">` : esc(serviceCode)}</div></div>
      <div class="fib-template-grid three"><div><span>DATE DE L’INCIDENT</span><strong>${esc(date.date)}</strong></div><div><span>HEURE DE L’INCIDENT</span><strong>${esc(date.time)}</strong></div><div><span>JOUR DE LA SEMAINE</span><strong>${esc(date.weekday)}</strong></div></div>
      <div class="fib-template-row"><span>AGENT INTERVENANT</span><strong>${esc(officers)}</strong></div>
      <div class="fib-template-block"><span>RÉCIT</span><p>${esc(report.facts || 'Non renseigné')}</p></div>
      <div class="fib-template-block small"><span>OFFICIERS IMPLIQUÉS</span><p>${esc(officers)}</p></div>
      <div class="fib-template-grid two"><div><span>TYPE D’INCIDENT</span><strong>${esc(type)}</strong></div><div><span>EMPLACEMENT D’INCIDENT</span><strong>${esc(report.location || 'Non renseigné')}</strong></div></div>
      <div class="fib-template-block signature"><span>SIGNATURE OFFICIER</span><p>${esc(report.created_by_username || '')}</p></div>
    </div>
  `;
}

function setLinked(kind, items) {
  if (kind === 'citizens') linkedCitizens = items;
  if (kind === 'vehicles') linkedVehicles = items;
  if (kind === 'agents') linkedAgents = items;
  const selected = kind === 'citizens' ? linkedCitizens : kind === 'vehicles' ? linkedVehicles : linkedAgents;
  const inputMap = { citizens: 'reportCitizenIds', vehicles: 'reportVehicleIds', agents: 'reportAgentIds' };
  const boxMap = { citizens: 'reportCitizensSelected', vehicles: 'reportVehiclesSelected', agents: 'reportAgentsSelected' };
  setVal(inputMap[kind], selected.map(item => item.id).join(','));
  const box = get(boxMap[kind]);
  if (box) box.innerHTML = selected.map(item => `<button type="button" class="selected-chip" data-kind="${kind}" data-id="${Number(item.id)}">${esc(item.label)} <span>×</span></button>`).join('');
  renderDocument(payload());
}

function renderLinks(data) {
  linkedCitizens = (data.citizens || []).map(c => ({ id: Number(c.id), label: `${c.last_name} ${c.first_name}`, meta: c.relation_type }));
  linkedVehicles = (data.vehicles || []).map(v => ({ id: Number(v.id), label: `${v.model || 'Véhicule'} · ${v.plate || ''}`, meta: v.relation_type }));
  linkedAgents = (data.agents || []).map(a => ({ id: Number(a.id), label: a.username, meta: a.relation_type }));
  setLinked('citizens', linkedCitizens);
  setLinked('vehicles', linkedVehicles);
  setLinked('agents', linkedAgents);
}

function renderLogs(logs = []) { get('reportLogsView').innerHTML = logs.length ? logs.map(log => `<div class="report-log"><strong>${esc(log.action)}</strong><br><span>${esc(log.created_at)} · ${esc(log.username || 'Système')}</span></div>`).join('') : '<p class="reports-empty">Aucun historique.</p>'; }

function fillReport(report = null, extra = {}) {
  mountReportPanel();
  selectedReportId = Number(report?.id || 0) || null;
  setVal('reportId', report?.id || '');
  setVal('reportTitle', report?.title || '');
  setVal('reportType', report?.type_code || 'intervention');
  setVal('reportStatus', report?.status || 'submitted');
  setVal('reportOccurredAt', report?.occurred_at ? String(report.occurred_at).replace(' ', 'T').slice(0, 16) : '');
  setVal('reportLocation', report?.location || '');
  setVal('reportAccessScope', report?.access_scope || 'service');
  setVal('reportDivision', report?.division_id || '');
  setVal('reportFacts', report?.facts || '');
  setVal('reportActionsTaken', report?.actions_taken || '');
  setVal('reportConclusions', report?.conclusions || '');
  setVal('reportNotes', report?.notes || '');
  renderLinks(extra);
  renderLogs(extra.logs || []);
  renderDocument(report || payload());
  showTab('main');
  setEditMode(!report?.id);
  renderReports();
}

async function loadReport(id) { try { const result = await apiGet(`/api/reports.php?action=get&id=${encodeURIComponent(id)}`); fillReport(result.report, result); } catch (error) { alert(error.message); } }

function payload() {
  return { id: Number(val('reportId') || 0), title: val('reportTitle'), type_code: val('reportType'), status: val('reportStatus') || 'submitted', occurred_at: val('reportOccurredAt') ? val('reportOccurredAt').replace('T', ' ') + ':00' : '', location: val('reportLocation'), access_scope: val('reportAccessScope'), division_id: Number(val('reportDivision') || 0), summary: val('reportFacts').slice(0, 500), facts: val('reportFacts'), actions_taken: val('reportActionsTaken'), conclusions: val('reportConclusions'), notes: val('reportNotes'), citizen_ids: ids(val('reportCitizenIds')), vehicle_ids: ids(val('reportVehicleIds')), agent_ids: ids(val('reportAgentIds')) };
}

async function saveReport() { setMsg('Sauvegarde du rapport...', 'info'); try { const result = await apiPost('/api/reports.php?action=save', payload()); setMsg('Rapport sauvegardé.', 'success'); await loadReports(); await loadReport(result.id); } catch (error) { setMsg(error.message); } }
async function lookup(kind, query) { const target = kind === 'citizens' ? 'citizens' : kind === 'vehicles' ? 'vehicles' : 'agents'; if (query.trim().length < 2) return []; const result = await apiGet(`/api/reports.php?action=lookup&target=${target}&q=${encodeURIComponent(query.trim())}`); return result.items || []; }

function bindLookup(inputId, resultsId, kind) {
  let timer = null;
  const input = get(inputId);
  const results = get(resultsId);
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(async () => { try { const items = await lookup(kind, input.value); results.innerHTML = items.map(item => `<button type="button" class="lookup-item" data-kind="${kind}" data-id="${Number(item.id)}" data-label="${esc(item.label)}" data-meta="${esc(item.meta || '')}"><strong>${esc(item.label)}</strong><span>${esc(item.meta || '')}</span></button>`).join('') || '<p>Aucun résultat.</p>'; } catch (error) { results.innerHTML = `<p>${esc(error.message)}</p>`; } }, 250); });
}

function addLinked(kind, item) { const list = kind === 'citizens' ? linkedCitizens : kind === 'vehicles' ? linkedVehicles : linkedAgents; if (!list.some(existing => Number(existing.id) === Number(item.id))) list.push(item); setLinked(kind, list); }

function downloadReportPdf() {
  renderDocument(payload());
  const source = get('reportPdfSource');
  if (!source || typeof html2pdf === 'undefined') { window.print(); return; }
  const filename = `${(val('reportTitle') || 'rapport').replace(/[^a-z0-9_-]+/gi, '_')}.pdf`;
  html2pdf().set({ margin: 0, filename, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' } }).from(source).save();
}

function bindReportPanel() {
  document.querySelectorAll('.report-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  get('saveReportButton').addEventListener('click', saveReport);
  get('editReportButton').addEventListener('click', () => setEditMode(true));
  get('cancelReportButton').addEventListener('click', () => selectedReportId ? loadReport(selectedReportId) : (reportPanel.innerHTML = '<div class="report-empty-state"><p class="mdt-kicker">Rapport</p><h3>Sélectionne ou crée un rapport</h3><p>Le rapport s’affichera ici.</p></div>'));
  get('previewReportButton').addEventListener('click', () => { renderDocument(payload()); setEditMode(false); showTab('main'); });
  get('downloadReportButton').addEventListener('click', downloadReportPdf);
  bindLookup('citizenLookupInput', 'citizenLookupResults', 'citizens');
  bindLookup('vehicleLookupInput', 'vehicleLookupResults', 'vehicles');
  bindLookup('agentLookupInput', 'agentLookupResults', 'agents');
  ['reportTitle','reportType','reportOccurredAt','reportLocation','reportAccessScope','reportFacts','reportActionsTaken','reportConclusions','reportNotes'].forEach(id => { get(id)?.addEventListener('input', () => renderDocument(payload())); get(id)?.addEventListener('change', () => renderDocument(payload())); });
}

reportPanel.addEventListener('click', (event) => { const item = event.target.closest('.lookup-item'); if (item) { addLinked(item.dataset.kind, { id: Number(item.dataset.id), label: item.dataset.label, meta: item.dataset.meta }); item.closest('.lookup-results').innerHTML = ''; } const chip = event.target.closest('.selected-chip'); if (chip) { const kind = chip.dataset.kind; const id = Number(chip.dataset.id); const list = kind === 'citizens' ? linkedCitizens : kind === 'vehicles' ? linkedVehicles : linkedAgents; setLinked(kind, list.filter(item => Number(item.id) !== id)); } });
reportsList.addEventListener('click', event => { const row = event.target.closest('.report-row'); if (row) loadReport(Number(row.dataset.id)); });
newReportButton.addEventListener('click', () => fillReport(null));
reportSearchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadReports, 250); });

(async () => { try { await loadMeta(); await loadReports(); } catch (error) { reportsList.innerHTML = `<p class="reports-empty">${esc(error.message)}</p>`; } })();
