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
let lastVehicles = [];
let lastRecords = [];
let lastCanDelete = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setMessage(message, type = 'error') {
  const box = document.querySelector('#citizenMessage');
  if (!box) return;
  box.textContent = message;
  box.dataset.type = type;
}

function ensurePhotoModal() {
  let modal = document.querySelector('#citizenPhotoModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'citizenPhotoModal';
  modal.className = 'citizen-photo-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="citizen-photo-modal-card">
      <button type="button" class="citizen-photo-modal-close" aria-label="Fermer">×</button>
      <img id="citizenPhotoModalImage" alt="Photo citoyen agrandie">
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('.citizen-photo-modal-close')) {
      modal.hidden = true;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') modal.hidden = true;
  });

  return modal;
}

function openPhotoModal() {
  const path = getInput('citizenPhotoPath');
  if (!path) {
    setMessage('Aucune photo à agrandir pour cette fiche.', 'info');
    return;
  }

  const modal = ensurePhotoModal();
  const image = modal.querySelector('#citizenPhotoModalImage');
  image.src = path;
  modal.hidden = false;
}

async function apiGet(url) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
  return result;
}

async function apiPost(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Action refusée.');
  return result;
}

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

  if (!citizens.length) {
    citizensList.innerHTML = '<p class="search-empty">Aucun citoyen trouvé.</p>';
    return;
  }

  citizensList.innerHTML = citizens.map((citizen) => {
    const fullName = `${citizen.last_name || ''} ${citizen.first_name || ''}`.trim();
    const meta = [citizen.phone, citizen.job, citizen.affiliation].filter(Boolean).join(' · ') || citizen.address || 'Aucune information rapide';
    const photo = citizen.photo_path ? `<img src="${escapeHtml(citizen.photo_path)}" alt="${escapeHtml(fullName)}">` : 'ID';
    return `
      <button type="button" class="citizen-row ${Number(citizen.id) === selectedCitizenId ? 'active' : ''}" data-id="${Number(citizen.id)}">
        <span class="citizen-row-photo">${photo}</span>
        <span class="citizen-row-main"><strong>${escapeHtml(fullName)}</strong><span>${escapeHtml(meta)}</span></span>
        <span class="citizen-row-badges"><span class="search-mini-badge">${Number(citizen.vehicles_count || 0)}V</span><span class="search-mini-badge">${Number(citizen.records_count || 0)}C</span></span>
      </button>
    `;
  }).join('');
}

function mountCitizenPanel() {
  citizenPanel.innerHTML = '';
  citizenPanel.appendChild(citizenPanelTemplate.content.cloneNode(true));
  bindCitizenPanelEvents();
}

function setInput(id, value) {
  const field = document.querySelector(`#${id}`);
  if (field) field.value = value ?? '';
}

function getInput(id) {
  return document.querySelector(`#${id}`)?.value.trim() || '';
}

function showTab(tabName) {
  document.querySelectorAll('.citizen-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.citizen-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });
}

function updateQuickTags(citizen = null) {
  const container = document.querySelector('#citizenQuickTags');
  if (!container) return;
  const tags = [
    getInput('phone') || citizen?.phone,
    getInput('job') || citizen?.job,
    getInput('affiliation') || citizen?.affiliation,
    getInput('specialStatus') || citizen?.special_status,
  ].filter(Boolean).slice(0, 4);

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

function fillCitizen(citizen) {
  mountCitizenPanel();
  selectedCitizenId = Number(citizen?.id || 0) || null;
  selectedCitizenData = citizen || null;
  lastVehicles = [];
  lastRecords = [];

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

  const photoPreview = document.querySelector('#citizenPhotoPreview');
  const fallback = document.querySelector('#citizenPhotoFallback');
  if (citizen?.photo_path) {
    photoPreview.src = citizen.photo_path;
    photoPreview.hidden = false;
    fallback.hidden = true;
  }

  updateCitizenHeader(citizen);
  renderVehicles([]);
  renderRecords([]);
  renderCitizens();
  showTab('identity');
}

async function loadCitizen(id) {
  try {
    const result = await apiGet(`/api/citizens.php?action=get&id=${encodeURIComponent(id)}`);
    fillCitizen(result.citizen);
    lastVehicles = result.vehicles || [];
    lastRecords = result.records || [];
    lastCanDelete = Boolean(result.can_delete);
    renderVehicles(lastVehicles, lastCanDelete);
    renderRecords(lastRecords, lastCanDelete);
  } catch (error) {
    alert(error.message);
  }
}

function citizenPayload() {
  return {
    id: Number(getInput('citizenId') || 0),
    last_name: getInput('lastName'),
    first_name: getInput('firstName'),
    birth_date: getInput('birthDate'),
    phone: getInput('phone'),
    address: getInput('address'),
    job: getInput('job'),
    hair_color: getInput('hairColor'),
    eye_color: getInput('eyeColor'),
    height_cm: getInput('heightCm'),
    physical_details: getInput('physicalDetails'),
    affiliation: getInput('affiliation'),
    known_organization: getInput('knownOrganization'),
    known_criminal_group: getInput('knownCriminalGroup'),
    special_status: getInput('specialStatus'),
    notes: getInput('notes'),
    photo_path: getInput('citizenPhotoPath'),
  };
}

async function saveCitizen() {
  setMessage('Enregistrement de la fiche...', 'info');

  try {
    const result = await apiPost('/api/citizens.php?action=save', citizenPayload());
    setInput('citizenId', result.id);
    selectedCitizenId = Number(result.id);
    setMessage('Fiche citoyen sauvegardée.', 'success');
    await loadCitizens();
    await loadCitizen(result.id);
  } catch (error) {
    setMessage(error.message);
  }
}

async function uploadCitizenPhoto(file) {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await fetch('/api/upload-citizen-photo.php', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Upload impossible.');
  return result.path;
}

function renderVehicles(vehicles, canDelete = false) {
  const container = document.querySelector('#vehiclesList');
  if (!container) return;
  if (!vehicles.length) {
    container.innerHTML = '<p class="search-empty">Aucun véhicule enregistré.</p>';
    return;
  }

  container.innerHTML = vehicles.map((vehicle) => `
    <div class="record-item" data-vehicle='${escapeHtml(JSON.stringify(vehicle))}'>
      <div><strong>${escapeHtml(vehicle.plate)}</strong><p>${escapeHtml([vehicle.model, vehicle.color, vehicle.category, vehicle.registration_status].filter(Boolean).join(' · '))}</p>${vehicle.notes ? `<p>${escapeHtml(vehicle.notes)}</p>` : ''}</div>
      <div class="record-actions"><button type="button" class="search-icon-button edit-vehicle">✎</button>${canDelete ? '<button type="button" class="search-icon-button delete delete-vehicle">×</button>' : ''}</div>
    </div>
  `).join('');
}

function renderRecords(records, canDelete = false) {
  const container = document.querySelector('#recordsList');
  if (!container) return;
  if (!records.length) {
    container.innerHTML = '<p class="search-empty">Aucune infraction enregistrée.</p>';
    return;
  }

  container.innerHTML = records.map((record) => `
    <div class="record-item" data-record='${escapeHtml(JSON.stringify(record))}'>
      <div><strong>${escapeHtml(record.offense_type)}</strong><p>${escapeHtml([record.offense_date, record.case_status, record.sanction].filter(Boolean).join(' · '))}</p>${record.description ? `<p>${escapeHtml(record.description)}</p>` : ''}</div>
      <div class="record-actions"><button type="button" class="search-icon-button edit-record">✎</button>${canDelete ? '<button type="button" class="search-icon-button delete delete-record">×</button>' : ''}</div>
    </div>
  `).join('');
}

function fillVehicleForm(vehicle = {}) {
  showTab('vehicles');
  document.querySelector('#vehicleForm').hidden = false;
  setInput('vehicleId', vehicle.id || '');
  setInput('vehiclePlate', vehicle.plate || '');
  setInput('vehicleModel', vehicle.model || '');
  setInput('vehicleColor', vehicle.color || '');
  setInput('vehicleCategory', vehicle.category || '');
  setInput('vehicleStatus', vehicle.registration_status || 'Actif');
  setInput('vehicleNotes', vehicle.notes || '');
}

function fillRecordForm(record = {}) {
  showTab('records');
  document.querySelector('#recordForm').hidden = false;
  setInput('recordId', record.id || '');
  setInput('offenseDate', record.offense_date || '');
  setInput('offenseType', record.offense_type || '');
  setInput('caseStatus', record.case_status || 'Ouvert');
  setInput('sanction', record.sanction || '');
  setInput('description', record.description || '');
  setInput('recordNotes', record.notes || '');
}

async function saveVehicle(event) {
  event.preventDefault();
  const citizenId = Number(getInput('citizenId'));
  if (!citizenId) return setMessage('Sauvegarde d’abord la fiche citoyen.');

  try {
    await apiPost('/api/citizens.php?action=save_vehicle', {
      id: Number(getInput('vehicleId') || 0),
      citizen_id: citizenId,
      plate: getInput('vehiclePlate'),
      model: getInput('vehicleModel'),
      color: getInput('vehicleColor'),
      category: getInput('vehicleCategory'),
      registration_status: getInput('vehicleStatus'),
      notes: getInput('vehicleNotes'),
    });
    setMessage('Véhicule sauvegardé.', 'success');
    await loadCitizen(citizenId);
    showTab('vehicles');
  } catch (error) {
    setMessage(error.message);
  }
}

async function saveRecord(event) {
  event.preventDefault();
  const citizenId = Number(getInput('citizenId'));
  if (!citizenId) return setMessage('Sauvegarde d’abord la fiche citoyen.');

  try {
    await apiPost('/api/citizens.php?action=save_record', {
      id: Number(getInput('recordId') || 0),
      citizen_id: citizenId,
      offense_date: getInput('offenseDate'),
      offense_type: getInput('offenseType'),
      case_status: getInput('caseStatus'),
      sanction: getInput('sanction'),
      description: getInput('description'),
      notes: getInput('recordNotes'),
    });
    setMessage('Infraction sauvegardée.', 'success');
    await loadCitizen(citizenId);
    showTab('records');
  } catch (error) {
    setMessage(error.message);
  }
}

function bindCitizenPanelEvents() {
  document.querySelector('#saveCitizenButton').addEventListener('click', saveCitizen);
  document.querySelector('#resetCitizenButton').addEventListener('click', () => selectedCitizenId ? loadCitizen(selectedCitizenId) : fillCitizen(null));
  document.querySelectorAll('#lastName,#firstName,#birthDate,#phone,#job,#affiliation,#specialStatus').forEach((field) => field.addEventListener('input', () => updateCitizenHeader(selectedCitizenData)));

  document.querySelectorAll('.citizen-tab').forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  const photoTrigger = document.querySelector('#citizenPhotoTrigger');
  const photoInput = document.querySelector('#citizenPhotoInput');
  const photoExpand = document.querySelector('#citizenPhotoExpand');

  photoTrigger?.addEventListener('click', () => photoInput?.click());
  photoExpand?.addEventListener('click', (event) => {
    event.stopPropagation();
    openPhotoModal();
  });

  photoInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const path = await uploadCitizenPhoto(file);
      setInput('citizenPhotoPath', path);
      const photoPreview = document.querySelector('#citizenPhotoPreview');
      const fallback = document.querySelector('#citizenPhotoFallback');
      photoPreview.src = path;
      photoPreview.hidden = false;
      fallback.hidden = true;
      setMessage('Photo ajoutée. Pense à sauvegarder la fiche.', 'info');
    } catch (error) {
      setMessage(error.message);
    }
  });

  document.querySelector('#newVehicleButton').addEventListener('click', () => fillVehicleForm());
  document.querySelector('#cancelVehicleButton').addEventListener('click', () => document.querySelector('#vehicleForm').hidden = true);
  document.querySelector('#vehicleForm').addEventListener('submit', saveVehicle);

  document.querySelector('#newRecordButton').addEventListener('click', () => fillRecordForm());
  document.querySelector('#cancelRecordButton').addEventListener('click', () => document.querySelector('#recordForm').hidden = true);
  document.querySelector('#recordForm').addEventListener('submit', saveRecord);
}

citizensList.addEventListener('click', (event) => {
  const row = event.target.closest('.citizen-row');
  if (!row) return;
  loadCitizen(Number(row.dataset.id));
});

citizenPanel.addEventListener('click', async (event) => {
  const vehicleItem = event.target.closest('[data-vehicle]');
  const recordItem = event.target.closest('[data-record]');

  if (event.target.closest('.edit-vehicle') && vehicleItem) {
    fillVehicleForm(JSON.parse(vehicleItem.dataset.vehicle));
  }

  if (event.target.closest('.edit-record') && recordItem) {
    fillRecordForm(JSON.parse(recordItem.dataset.record));
  }

  if (event.target.closest('.delete-vehicle') && vehicleItem) {
    if (!confirm('Supprimer ce véhicule ?')) return;
    await apiPost('/api/citizens.php?action=delete_vehicle', { id: JSON.parse(vehicleItem.dataset.vehicle).id });
    await loadCitizen(selectedCitizenId);
    showTab('vehicles');
  }

  if (event.target.closest('.delete-record') && recordItem) {
    if (!confirm('Supprimer cette infraction ?')) return;
    await apiPost('/api/citizens.php?action=delete_record', { id: JSON.parse(recordItem.dataset.record).id });
    await loadCitizen(selectedCitizenId);
    showTab('records');
  }
});

newCitizenButton.addEventListener('click', () => fillCitizen(null));
refreshCitizensButton.addEventListener('click', loadCitizens);
citizenSearchInput.addEventListener('input', () => {
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(loadCitizens, 250);
});

loadCitizens();
