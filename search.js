const citizensList = document.querySelector('#citizensList');
const citizenPanel = document.querySelector('#citizenPanel');
const citizenPanelTemplate = document.querySelector('#citizenPanelTemplate');
const citizenSearchInput = document.querySelector('#citizenSearchInput');
const newCitizenButton = document.querySelector('#newCitizenButton');
const refreshCitizensButton = document.querySelector('#refreshCitizensButton');
const citizenCount = document.querySelector('#citizenCount');

let citizens = [];
let selectedCitizenId = null;
let selectedCitizenData = null;
let searchDebounce = null;
let lastCanDelete = false;
let isEditing = true;

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function setMessage(message, type = 'error') {
  const box = document.querySelector('#citizenMessage');
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
}

async function apiGet(url) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide. Vérifie la requête ou la BDD.'); }
  if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
  return result;
}

async function apiPost(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Réponse serveur invalide. Vérifie la requête ou la BDD.'); }
  if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
  return result;
}

function setInput(id, value) {
  const field = document.querySelector(`#${id}`);
  if (!field) return;
  if (field.type === 'checkbox') field.checked = Boolean(Number(value) || value === true);
  else field.value = value ?? '';
}

function getInput(id) {
  const field = document.querySelector(`#${id}`);
  if (!field) return '';
  if (field.type === 'checkbox') return field.checked;
  return field.value.trim();
}

function displayValue(value) { return value ? escapeHtml(value) : '<span class="empty-value">Non renseigné</span>'; }
function displayCheck(value) { return value ? '<span class="license-pill ok">Oui</span>' : '<span class="license-pill no">Non</span>'; }
function healthLabel(value) { return value === 'deceased' ? 'Décédé' : 'En vie'; }

async function loadCitizens() {
  const q = encodeURIComponent(citizenSearchInput?.value.trim() || '');
  citizensList.innerHTML = '<p class="search-empty">Chargement...</p>';
  try {
    const result = await apiGet(`/api/citizens.php?action=list&q=${q}`);
    citizens = result.citizens || [];
    renderCitizens();
  } catch (error) {
    citizensList.innerHTML = `<p class="search-empty">${escapeHtml(error.message)}</p>`;
    if (citizenCount) citizenCount.textContent = '0';
  }
}

function renderCitizens() {
  if (citizenCount) citizenCount.textContent = String(citizens.length);
  if (!citizens.length) { citizensList.innerHTML = '<p class="search-empty">Aucun citoyen trouvé.</p>'; return; }
  citizensList.innerHTML = citizens.map((citizen) => {
    const fullName = `${citizen.last_name || ''} ${citizen.first_name || ''}`.trim();
    const meta = [citizen.phone, citizen.job, citizen.affiliation].filter(Boolean).join(' · ') || citizen.address || 'Aucune information rapide';
    const photo = citizen.photo_path ? `<img src="${escapeHtml(citizen.photo_path)}" alt="${escapeHtml(fullName)}">` : 'ID';
    const health = citizen.health_status === 'deceased' ? 'deceased' : 'alive';
    return `<button type="button" class="citizen-row ${Number(citizen.id) === selectedCitizenId ? 'active' : ''}" data-id="${Number(citizen.id)}"><span class="health-dot ${health}" title="${healthLabel(health)}"></span><span class="citizen-row-photo">${photo}</span><span class="citizen-row-main"><strong>${escapeHtml(fullName)}</strong><span>${escapeHtml(meta)}</span></span><span class="citizen-row-badges"><span class="search-mini-badge">${Number(citizen.vehicles_count || 0)}V</span><span class="search-mini-badge">${Number(citizen.records_count || 0)}C</span></span></button>`;
  }).join('');
}

function mountCitizenPanel() {
  citizenPanel.innerHTML = '';
  citizenPanel.appendChild(citizenPanelTemplate.content.cloneNode(true));
  bindCitizenPanelEvents();
}

function showTab(tabName) {
  document.querySelectorAll('.citizen-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === tabName));
  document.querySelectorAll('.citizen-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tabName));
}

function setTabBadge(tabName, count) {
  const tab = document.querySelector(`.citizen-tab[data-tab="${tabName}"]`);
  if (!tab) return;
  tab.querySelector('.tab-count')?.remove();
  const badge = document.createElement('span');
  badge.className = 'tab-count';
  badge.textContent = String(count || 0);
  tab.appendChild(badge);
}

function updateQuickTags(citizen = null) {
  const container = document.querySelector('#citizenQuickTags');
  if (!container) return;
  const tags = [getInput('phone') || citizen?.phone, getInput('job') || citizen?.job, getInput('affiliation') || citizen?.affiliation, getInput('specialStatus') || citizen?.special_status].filter(Boolean).slice(0, 4);
  container.innerHTML = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
}

function updateCitizenHeader(citizen = null) {
  const firstName = getInput('firstName') || citizen?.first_name || '';
  const lastName = getInput('lastName') || citizen?.last_name || '';
  const fullName = `${lastName} ${firstName}`.trim() || 'Nouveau citoyen';
  const meta = [getInput('birthDate') || citizen?.birth_date, getInput('phone') || citizen?.phone, getInput('job') || citizen?.job].filter(Boolean).join(' · ') || 'Fiche non enregistrée';
  document.querySelector('#citizenFullName').textContent = fullName;
  document.querySelector('#citizenMeta').textContent = meta;
  updateQuickTags(citizen);
}

function renderReadOnlyPanels(citizen) {
  const panels = {
    identity: [['Nom', citizen.last_name], ['Prénom', citizen.first_name], ['Date de naissance', citizen.birth_date], ['Téléphone', citizen.phone], ['Adresse', citizen.address], ['Emploi / profession', citizen.job], ['Permis de conduire', citizen.has_driver_license, 'check'], ['Permis de port d’arme', citizen.has_weapon_license, 'check']],
    physical: [['Cheveux', citizen.hair_color], ['Yeux', citizen.eye_color], ['Taille', citizen.height_cm ? `${citizen.height_cm} cm` : ''], ['Particularités', citizen.physical_details]],
    affiliation: [['Appartenance / affiliation', citizen.affiliation], ['Organisation connue', citizen.known_organization], ['Groupe criminel connu', citizen.known_criminal_group], ['Statut particulier', citizen.special_status]],
    notes: [['Notes internes', citizen.notes]],
  };
  Object.entries(panels).forEach(([key, rows]) => {
    const panel = document.querySelector(`[data-panel="${key}"]`);
    if (!panel) return;
    panel.querySelector('.readonly-grid')?.remove();
    const grid = document.createElement('div');
    grid.className = 'readonly-grid';
    grid.innerHTML = rows.map(([label, value, type]) => `<div class="readonly-item"><span>${escapeHtml(label)}</span><strong>${type === 'check' ? displayCheck(value) : displayValue(value)}</strong></div>`).join('');
    panel.appendChild(grid);
  });
}

function setEditMode(enabled) {
  isEditing = enabled;
  const root = document.querySelector('.citizen-panel-inner');
  if (!root) return;
  root.dataset.editing = enabled ? '1' : '0';
  document.querySelectorAll('.form-grid').forEach((grid) => grid.hidden = !enabled);
  document.querySelectorAll('.readonly-grid').forEach((grid) => grid.hidden = enabled);
  document.querySelector('#saveCitizenButton').hidden = !enabled;
  document.querySelector('#resetCitizenButton').hidden = !enabled;
  document.querySelector('#editCitizenButton').hidden = enabled;
}

function fillCitizen(citizen) {
  mountCitizenPanel();
  selectedCitizenId = Number(citizen?.id || 0) || null;
  selectedCitizenData = citizen || null;
  setInput('citizenId', citizen?.id || '');
  setInput('lastName', citizen?.last_name || '');
  setInput('firstName', citizen?.first_name || '');
  setInput('birthDate', citizen?.birth_date || '');
  setInput('phone', citizen?.phone || '');
  setInput('address', citizen?.address || '');
  setInput('job', citizen?.job || '');
  setInput('hairColor', citizen?.hair_color || '');
  setInput('eyeColor', citizen?.eye_color || '');
  setInput('heightCm', citizen?.height_cm || '');
  setInput('physicalDetails', citizen?.physical_details || '');
  setInput('affiliation', citizen?.affiliation || '');
  setInput('knownOrganization', citizen?.known_organization || '');
  setInput('knownCriminalGroup', citizen?.known_criminal_group || '');
  setInput('specialStatus', citizen?.special_status || '');
  setInput('notes', citizen?.notes || '');
  setInput('citizenPhotoPath', citizen?.photo_path || '');
  setInput('healthStatus', citizen?.health_status || 'alive');
  setInput('hasDriverLicense', citizen?.has_driver_license || 0);
  setInput('hasWeaponLicense', citizen?.has_weapon_license || 0);
  const photoPreview = document.querySelector('#citizenPhotoPreview');
  const fallback = document.querySelector('#citizenPhotoFallback');
  if (citizen?.photo_path) { photoPreview.src = citizen.photo_path; photoPreview.hidden = false; fallback.hidden = true; }
  document.querySelector('#citizenHealthDot')?.remove();
  const healthDot = document.createElement('span');
  const health = citizen?.health_status === 'deceased' ? 'deceased' : 'alive';
  healthDot.id = 'citizenHealthDot';
  healthDot.className = `health-dot large ${health}`;
  healthDot.title = healthLabel(health);
  document.querySelector('.citizen-profile-main').prepend(healthDot);
  updateCitizenHeader(citizen);
  renderReadOnlyPanels(citizen || {});
  renderVehicles([]);
  renderRecords([]);
  renderCitizens();
  showTab('identity');
  setEditMode(!citizen?.id);
}

async function loadCitizen(id) {
  try {
    const result = await apiGet(`/api/citizens.php?action=get&id=${encodeURIComponent(id)}`);
    fillCitizen(result.citizen);
    lastCanDelete = Boolean(result.can_delete);
    renderVehicles(result.vehicles || [], lastCanDelete);
    renderRecords(result.records || [], lastCanDelete);
    setTabBadge('vehicles', (result.vehicles || []).length);
    setTabBadge('records', (result.records || []).length);
  } catch (error) { alert(error.message); }
}

function citizenPayload() {
  return { id: Number(getInput('citizenId') || 0), last_name: getInput('lastName'), first_name: getInput('firstName'), birth_date: getInput('birthDate'), phone: getInput('phone'), address: getInput('address'), job: getInput('job'), hair_color: getInput('hairColor'), eye_color: getInput('eyeColor'), height_cm: getInput('heightCm'), physical_details: getInput('physicalDetails'), affiliation: getInput('affiliation'), known_organization: getInput('knownOrganization'), known_criminal_group: getInput('knownCriminalGroup'), special_status: getInput('specialStatus'), notes: getInput('notes'), photo_path: getInput('citizenPhotoPath'), health_status: getInput('healthStatus') || 'alive', has_driver_license: getInput('hasDriverLicense'), has_weapon_license: getInput('hasWeaponLicense') };
}

async function saveCitizen() {
  setMessage('Enregistrement de la fiche...', 'info');
  try {
    const result = await apiPost('/api/citizens.php?action=save', citizenPayload());
    selectedCitizenId = Number(result.id);
    setMessage('Fiche citoyen sauvegardée.', 'success');
    await loadCitizens();
    await loadCitizen(result.id);
  } catch (error) { setMessage(error.message); }
}

async function uploadPhoto(file, endpoint) {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', body: formData });
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('Upload impossible. Réponse serveur invalide.'); }
  if (!response.ok || !result.success) throw new Error(result.message || 'Upload impossible. Limite: 4 Mo. Formats: png, jpg, jpeg, webp.');
  return result.path;
}

function ensurePhotoModal() {
  let modal = document.querySelector('#citizenPhotoModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'citizenPhotoModal';
  modal.className = 'citizen-photo-modal';
  modal.hidden = true;
  modal.innerHTML = `<div class="citizen-photo-modal-card"><button type="button" class="citizen-photo-modal-close" aria-label="Fermer">×</button><img id="citizenPhotoModalImage" alt="Image agrandie"></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => { if (event.target === modal || event.target.closest('.citizen-photo-modal-close')) modal.hidden = true; });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') modal.hidden = true; });
  return modal;
}

function openImageModal(path) {
  if (!path) { setMessage('Aucune image à agrandir.', 'info'); return; }
  const modal = ensurePhotoModal();
  modal.querySelector('#citizenPhotoModalImage').src = path;
  modal.hidden = false;
}

function openPhotoModal() { openImageModal(getInput('citizenPhotoPath')); }

function openCropper(file, type, callback) {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    const ratio = type === 'vehicle' ? 16 / 9 : 4 / 5;
    canvas.width = type === 'vehicle' ? 1280 : 800;
    canvas.height = Math.round(canvas.width / ratio);
    const modal = document.createElement('div');
    modal.className = 'crop-modal';
    modal.innerHTML = `<div class="crop-card"><h3>Recadrer l’image</h3><canvas></canvas><div class="crop-controls"><label>Zoom <input type="range" min="1" max="3" step="0.05" value="1"></label><button class="mdt-button crop-validate">Valider</button><button class="mdt-button-secondary crop-cancel">Annuler</button></div></div>`;
    document.body.appendChild(modal);
    const preview = modal.querySelector('canvas');
    const ctx = preview.getContext('2d');
    const range = modal.querySelector('input');
    preview.width = canvas.width; preview.height = canvas.height;
    let dx = 0, dy = 0, dragging = false, sx = 0, sy = 0;
    const draw = () => { const zoom = Number(range.value); const iw = image.width * zoom; const ih = image.height * zoom; ctx.clearRect(0,0,preview.width,preview.height); ctx.drawImage(image, (preview.width - iw) / 2 + dx, (preview.height - ih) / 2 + dy, iw, ih); };
    preview.onmousedown = e => { dragging = true; sx = e.clientX; sy = e.clientY; };
    window.onmouseup = () => dragging = false;
    preview.onmousemove = e => { if (!dragging) return; dx += e.clientX - sx; dy += e.clientY - sy; sx = e.clientX; sy = e.clientY; draw(); };
    range.oninput = draw; draw();
    modal.querySelector('.crop-cancel').onclick = () => modal.remove();
    modal.querySelector('.crop-validate').onclick = () => preview.toBlob((blob) => { modal.remove(); callback(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })); }, 'image/jpeg', 0.9);
  };
  image.src = URL.createObjectURL(file);
}

function renderVehicles(vehicles, canDelete = false) {
  const container = document.querySelector('#vehiclesList'); if (!container) return;
  if (!vehicles.length) { container.innerHTML = '<p class="search-empty">Aucun véhicule enregistré.</p>'; return; }
  container.innerHTML = vehicles.map((v) => `<div class="record-item vehicle-item" data-vehicle='${escapeHtml(JSON.stringify(v))}'>${v.photo_path ? `<button type="button" class="vehicle-thumb vehicle-image-button" data-image="${escapeHtml(v.photo_path)}"><img src="${escapeHtml(v.photo_path)}" alt="${escapeHtml(v.model || 'Véhicule')}"></button>` : '<span class="vehicle-thumb empty">VH</span>'}<div><strong>${escapeHtml(v.model || 'Modèle inconnu')}</strong><p>${escapeHtml([v.category, v.color, v.plate, v.registration_status].filter(Boolean).join(' · '))}</p>${v.notes ? `<p>${escapeHtml(v.notes)}</p>` : ''}</div><div class="record-actions"><button type="button" class="search-icon-button edit-vehicle">✎</button>${canDelete ? '<button type="button" class="search-icon-button delete delete-vehicle">×</button>' : ''}</div></div>`).join('');
}

function renderRecords(records, canDelete = false) {
  const container = document.querySelector('#recordsList'); if (!container) return;
  if (!records.length) { container.innerHTML = '<p class="search-empty">Aucune infraction enregistrée.</p>'; return; }
  container.innerHTML = records.map((r) => `<div class="record-item" data-record='${escapeHtml(JSON.stringify(r))}'><div><strong>${escapeHtml(r.offense_type)}</strong><p>${escapeHtml([r.offense_date, r.case_status, r.sanction].filter(Boolean).join(' · '))}</p>${r.description ? `<p>${escapeHtml(r.description)}</p>` : ''}</div><div class="record-actions"><button type="button" class="search-icon-button edit-record">✎</button>${canDelete ? '<button type="button" class="search-icon-button delete delete-record">×</button>' : ''}</div></div>`).join('');
}

function fillVehicleForm(v = {}) { showTab('vehicles'); document.querySelector('#vehicleForm').hidden = false; setInput('vehicleId', v.id || ''); setInput('vehicleModel', v.model || ''); setInput('vehicleCategory', v.category || ''); setInput('vehicleColor', v.color || ''); setInput('vehiclePlate', v.plate || ''); setInput('vehicleStatus', v.registration_status || 'Actif'); setInput('vehiclePhotoPath', v.photo_path || ''); setInput('vehicleNotes', v.notes || ''); document.querySelector('#vehiclePhotoButton').innerHTML = v.photo_path ? `Photo ajoutée<br><small>${escapeHtml(String(v.photo_path).split('/').pop())}</small>` : 'Photo véhicule<br><small>png/jpg/webp · max 4 Mo</small>'; }
function fillRecordForm(r = {}) { showTab('records'); document.querySelector('#recordForm').hidden = false; setInput('recordId', r.id || ''); setInput('offenseDate', r.offense_date || ''); setInput('offenseType', r.offense_type || ''); setInput('caseStatus', r.case_status || 'Ouvert'); setInput('sanction', r.sanction || ''); setInput('description', r.description || ''); setInput('recordNotes', r.notes || ''); }

async function saveVehicle(event) { event.preventDefault(); const citizenId = Number(getInput('citizenId')); if (!citizenId) return setMessage('Sauvegarde d’abord la fiche citoyen.'); try { await apiPost('/api/citizens.php?action=save_vehicle', { id: Number(getInput('vehicleId') || 0), citizen_id: citizenId, model: getInput('vehicleModel'), category: getInput('vehicleCategory'), color: getInput('vehicleColor'), plate: getInput('vehiclePlate'), registration_status: getInput('vehicleStatus'), photo_path: getInput('vehiclePhotoPath'), notes: getInput('vehicleNotes') }); setMessage('Véhicule sauvegardé.', 'success'); await loadCitizen(citizenId); showTab('vehicles'); } catch (error) { setMessage(error.message); } }
async function saveRecord(event) { event.preventDefault(); const citizenId = Number(getInput('citizenId')); if (!citizenId) return setMessage('Sauvegarde d’abord la fiche citoyen.'); try { await apiPost('/api/citizens.php?action=save_record', { id: Number(getInput('recordId') || 0), citizen_id: citizenId, offense_date: getInput('offenseDate'), offense_type: getInput('offenseType'), case_status: getInput('caseStatus'), sanction: getInput('sanction'), description: getInput('description'), notes: getInput('recordNotes') }); setMessage('Infraction sauvegardée.', 'success'); await loadCitizen(citizenId); showTab('records'); } catch (error) { setMessage(error.message); } }

function bindCitizenPanelEvents() {
  document.querySelector('#saveCitizenButton').addEventListener('click', saveCitizen);
  document.querySelector('#resetCitizenButton').addEventListener('click', () => selectedCitizenId ? loadCitizen(selectedCitizenId) : fillCitizen(null));
  document.querySelector('#editCitizenButton').addEventListener('click', () => setEditMode(true));
  document.querySelectorAll('#lastName,#firstName,#birthDate,#phone,#job,#affiliation,#specialStatus').forEach((field) => field.addEventListener('input', () => updateCitizenHeader(selectedCitizenData)));
  document.querySelectorAll('.citizen-tab').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  const photoTrigger = document.querySelector('#citizenPhotoTrigger'); const photoInput = document.querySelector('#citizenPhotoInput'); const photoExpand = document.querySelector('#citizenPhotoExpand');
  photoTrigger?.addEventListener('click', () => { if (isEditing) photoInput?.click(); else openPhotoModal(); });
  photoExpand?.addEventListener('click', (event) => { event.stopPropagation(); openPhotoModal(); });
  photoInput?.addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; openCropper(file, 'citizen', async (cropped) => { try { const path = await uploadPhoto(cropped, '/api/upload-citizen-photo.php'); setInput('citizenPhotoPath', path); const img = document.querySelector('#citizenPhotoPreview'); const fallback = document.querySelector('#citizenPhotoFallback'); img.src = path; img.hidden = false; fallback.hidden = true; setMessage('Photo ajoutée. Pense à sauvegarder la fiche.', 'info'); } catch (error) { setMessage(error.message); } }); });
  document.querySelector('#newVehicleButton').addEventListener('click', () => fillVehicleForm());
  document.querySelector('#cancelVehicleButton').addEventListener('click', () => document.querySelector('#vehicleForm').hidden = true);
  document.querySelector('#vehicleForm').addEventListener('submit', saveVehicle);
  document.querySelector('#vehiclePhotoButton').addEventListener('click', () => document.querySelector('#vehiclePhotoInput').click());
  document.querySelector('#vehiclePhotoInput').addEventListener('change', async (event) => { const file = event.target.files?.[0]; if (!file) return; openCropper(file, 'vehicle', async (cropped) => { try { const path = await uploadPhoto(cropped, '/api/upload-vehicle-photo.php'); setInput('vehiclePhotoPath', path); document.querySelector('#vehiclePhotoButton').innerHTML = `Photo ajoutée<br><small>${escapeHtml(path.split('/').pop())}</small>`; } catch (error) { setMessage(error.message); } }); });
  document.querySelector('#newRecordButton').addEventListener('click', () => fillRecordForm());
  document.querySelector('#cancelRecordButton').addEventListener('click', () => document.querySelector('#recordForm').hidden = true);
  document.querySelector('#recordForm').addEventListener('submit', saveRecord);
}

citizensList.addEventListener('click', (event) => { const row = event.target.closest('.citizen-row'); if (row) loadCitizen(Number(row.dataset.id)); });
citizenPanel.addEventListener('click', async (event) => {
  const vehicleItem = event.target.closest('[data-vehicle]'); const recordItem = event.target.closest('[data-record]');
  const vehicleImage = event.target.closest('.vehicle-image-button');
  if (vehicleImage) openImageModal(vehicleImage.dataset.image);
  if (event.target.closest('.edit-vehicle') && vehicleItem) fillVehicleForm(JSON.parse(vehicleItem.dataset.vehicle));
  if (event.target.closest('.edit-record') && recordItem) fillRecordForm(JSON.parse(recordItem.dataset.record));
  if (event.target.closest('.delete-vehicle') && vehicleItem) { if (!confirm('Supprimer ce véhicule ?')) return; await apiPost('/api/citizens.php?action=delete_vehicle', { id: JSON.parse(vehicleItem.dataset.vehicle).id }); await loadCitizen(selectedCitizenId); showTab('vehicles'); }
  if (event.target.closest('.delete-record') && recordItem) { if (!confirm('Supprimer cette infraction ?')) return; await apiPost('/api/citizens.php?action=delete_record', { id: JSON.parse(recordItem.dataset.record).id }); await loadCitizen(selectedCitizenId); showTab('records'); }
});
newCitizenButton.addEventListener('click', () => fillCitizen(null));
refreshCitizensButton.addEventListener('click', loadCitizens);
citizenSearchInput.addEventListener('input', () => { window.clearTimeout(searchDebounce); searchDebounce = window.setTimeout(loadCitizens, 250); });
loadCitizens();
